module mnemosyne_contracts::memory;

use sui::object::{Self, UID};
use sui::event;
use sui::clock::{Self, Clock};
use sui::tx_context::{Self, TxContext};
use sui::transfer;
use sui::dynamic_field;
use std::vector;

// === Constants ===

#[allow(unused_const)]
const OBSERVATION: u8 = 0;
#[allow(unused_const)]
const DECISION: u8 = 1;
#[allow(unused_const)]
const ARTIFACT: u8 = 2;
#[allow(unused_const)]
const REFLECTION: u8 = 3;

#[error]
const EInvalidMemoryType: vector<u8> = b"Memory type must be 0-3 (observation, decision, artifact, reflection)";

#[error]
const ENotAuthorized: vector<u8> = b"Only namespace owner can perform this action";

#[error]
const EAgentAlreadyRegistered: vector<u8> = b"Agent address already registered in this namespace";

#[error]
const EMemoryExhausted: vector<u8> = b"Memory has reached its maximum use count (all claim slots taken)";

#[error]
const EDuplicateMemory: vector<u8> = b"A memory with this content hash already exists in this namespace";

#[error]
const EMemoryNotShared: vector<u8> = b"Memory must be written as shared to be claimable";

// === Structs ===

/// Shared context space for a swarm of agents
public struct Namespace has key, store {
    id: UID,
    owner: address,
    name: vector<u8>,
    agent_count: u32,
    memory_count: u64,
    created_at_ms: u64,
}

/// On-chain pointer to a Walrus blob — composable with other Sui protocols
public struct MemoryIndex has key, store {
    id: UID,
    blob_id: vector<u8>,
    agent_id: address,
    namespace_id: address,
    memory_type: u8,
    content_hash: vector<u8>,
    parent_count: u32,
    timestamp_ms: u64,
    is_encrypted: bool,
    max_uses: u64,
    use_count: u64,
}

/// Agent registration within a namespace
public struct AgentRegistration has key, store {
    id: UID,
    agent_address: address,
    namespace_id: address,
    role: vector<u8>,
    registered_at_ms: u64,
}

/// Transferable proof that the holder has successfully claimed a MemoryIndex slot.
/// Holders are authorized to process the associated memory blob.
public struct ClaimTicket has key, store {
    id: UID,
    memory_id: address,
    claimer: address,
    namespace_id: address,
    claimed_at_ms: u64,
}

/// Used as the dynamic field key for content-hash deduplication on Namespace.
/// Different type from `address` (used for agent registration) to avoid key collision.
public struct ContentHashKey has copy, drop, store {
    hash: vector<u8>,
}

// === Events ===

public struct MemoryWritten has copy, drop {
    memory_id: address,
    blob_id: vector<u8>,
    agent_id: address,
    namespace_id: address,
    memory_type: u8,
    content_hash: vector<u8>,
    timestamp_ms: u64,
    max_uses: u64,
    is_shared: bool,
    parent_memories: vector<vector<u8>>,
}

public struct NamespaceCreated has copy, drop {
    namespace_id: address,
    owner: address,
    name: vector<u8>,
}

public struct AgentRegistered has copy, drop {
    agent_id: address,
    agent_address: address,
    namespace_id: address,
    role: vector<u8>,
}

public struct MemoryClaimed has copy, drop {
    memory_id: address,
    ticket_id: address,
    claimer: address,
    use_count: u64,
    max_uses: u64,
    claimed_at_ms: u64,
}

// === Public Functions ===

/// Create a namespace — shared context for an agent swarm.
/// The namespace is shared so that any registered agent can write memories.
public fun create_namespace(
    name: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let namespace = Namespace {
        id: object::new(ctx),
        owner: ctx.sender(),
        name,
        agent_count: 0,
        memory_count: 0,
        created_at_ms: clock.timestamp_ms(),
    };

    event::emit(NamespaceCreated {
        namespace_id: object::uid_to_address(&namespace.id),
        owner: namespace.owner,
        name: namespace.name,
    });

    transfer::public_share_object(namespace);
}

/// Register an agent to a namespace (namespace owner only)
public fun register_agent(
    namespace: &mut Namespace,
    agent_address: address,
    role: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
): AgentRegistration {
    assert!(namespace.owner == ctx.sender(), ENotAuthorized);
    assert!(!dynamic_field::exists_(&namespace.id, agent_address), EAgentAlreadyRegistered);

    dynamic_field::add(&mut namespace.id, agent_address, true);

    let registration = AgentRegistration {
        id: object::new(ctx),
        agent_address,
        namespace_id: object::uid_to_address(&namespace.id),
        role,
        registered_at_ms: clock.timestamp_ms(),
    };

    namespace.agent_count = namespace.agent_count + 1;

    event::emit(AgentRegistered {
        agent_id: object::uid_to_address(&registration.id),
        agent_address,
        namespace_id: object::uid_to_address(&namespace.id),
        role: registration.role,
    });

    registration
}

/// Write a memory index on-chain (called after Walrus blob is stored)
public fun write_memory(
    namespace: &mut Namespace,
    blob_id: vector<u8>,
    content_hash: vector<u8>,
    memory_type: u8,
    parent_memories: vector<vector<u8>>,
    is_encrypted: bool,
    clock: &Clock,
    ctx: &mut TxContext,
): MemoryIndex {
    assert!(memory_type <= 3, EInvalidMemoryType);
    assert!(
        ctx.sender() == namespace.owner || dynamic_field::exists_(&namespace.id, ctx.sender()),
        ENotAuthorized
    );

    let parent_count = (vector::length(&parent_memories) as u32);
    let memory = MemoryIndex {
        id: object::new(ctx),
        blob_id,
        agent_id: ctx.sender(),
        namespace_id: object::uid_to_address(&namespace.id),
        memory_type,
        content_hash,
        parent_count,
        timestamp_ms: clock.timestamp_ms(),
        is_encrypted,
        max_uses: 0,
        use_count: 0,
    };

    namespace.memory_count = namespace.memory_count + 1;

    event::emit(MemoryWritten {
        memory_id: object::uid_to_address(&memory.id),
        blob_id: memory.blob_id,
        agent_id: memory.agent_id,
        namespace_id: memory.namespace_id,
        memory_type,
        content_hash: memory.content_hash,
        timestamp_ms: memory.timestamp_ms,
        max_uses: 0,
        is_shared: false,
        parent_memories,
    });

    memory
}

/// Write a memory as a shared object so multiple agents can claim it.
/// max_uses: 0 = unlimited, N = at most N agents can claim() this memory.
/// The memory is shared (not owned), so any registered agent can call claim_memory on it.
public fun write_memory_shared(
    namespace: &mut Namespace,
    blob_id: vector<u8>,
    content_hash: vector<u8>,
    memory_type: u8,
    parent_memories: vector<vector<u8>>,
    is_encrypted: bool,
    max_uses: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(memory_type <= 3, EInvalidMemoryType);
    assert!(
        ctx.sender() == namespace.owner || dynamic_field::exists_(&namespace.id, ctx.sender()),
        ENotAuthorized
    );
    let parent_count = (vector::length(&parent_memories) as u32);
    let memory = MemoryIndex {
        id: object::new(ctx),
        blob_id,
        agent_id: ctx.sender(),
        namespace_id: object::uid_to_address(&namespace.id),
        memory_type,
        content_hash,
        parent_count,
        timestamp_ms: clock.timestamp_ms(),
        is_encrypted,
        max_uses,
        use_count: 0,
    };
    namespace.memory_count = namespace.memory_count + 1;
    event::emit(MemoryWritten {
        memory_id: object::uid_to_address(&memory.id),
        blob_id: memory.blob_id,
        agent_id: memory.agent_id,
        namespace_id: memory.namespace_id,
        memory_type,
        content_hash: memory.content_hash,
        timestamp_ms: memory.timestamp_ms,
        max_uses,
        is_shared: true,
        parent_memories,
    });
    transfer::public_share_object(memory);
}

/// Write an OWNED memory only if no memory with the same content_hash exists in this namespace.
/// Uses a ContentHashKey dynamic field on the Namespace as a thread-safe registry.
/// If a duplicate is found, aborts with EDuplicateMemory.
/// Because Namespace is a shared object, Sui's sequencer makes this atomic.
public fun write_memory_deduped(
    namespace: &mut Namespace,
    blob_id: vector<u8>,
    content_hash: vector<u8>,
    memory_type: u8,
    parent_memories: vector<vector<u8>>,
    is_encrypted: bool,
    max_uses: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): MemoryIndex {
    let key = ContentHashKey { hash: content_hash };
    assert!(!dynamic_field::exists_(&namespace.id, key), EDuplicateMemory);
    dynamic_field::add(&mut namespace.id, key, ctx.sender());
    
    assert!(memory_type <= 3, EInvalidMemoryType);
    assert!(
        ctx.sender() == namespace.owner || dynamic_field::exists_(&namespace.id, ctx.sender()),
        ENotAuthorized
    );
    let parent_count = (vector::length(&parent_memories) as u32);
    let memory = MemoryIndex {
        id: object::new(ctx),
        blob_id,
        agent_id: ctx.sender(),
        namespace_id: object::uid_to_address(&namespace.id),
        memory_type,
        content_hash,
        parent_count,
        timestamp_ms: clock.timestamp_ms(),
        is_encrypted,
        max_uses,
        use_count: 0,
    };
    namespace.memory_count = namespace.memory_count + 1;
    event::emit(MemoryWritten {
        memory_id: object::uid_to_address(&memory.id),
        blob_id: memory.blob_id,
        agent_id: memory.agent_id,
        namespace_id: memory.namespace_id,
        memory_type,
        content_hash: memory.content_hash,
        timestamp_ms: memory.timestamp_ms,
        max_uses,
        is_shared: false,
        parent_memories,
    });
    memory
}

public fun write_memory_shared_deduped(
    namespace: &mut Namespace,
    blob_id: vector<u8>,
    content_hash: vector<u8>,
    memory_type: u8,
    parent_memories: vector<vector<u8>>,
    is_encrypted: bool,
    max_uses: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let key = ContentHashKey { hash: content_hash };
    assert!(!dynamic_field::exists_(&namespace.id, key), EDuplicateMemory);
    dynamic_field::add(&mut namespace.id, key, ctx.sender());
    
    assert!(memory_type <= 3, EInvalidMemoryType);
    assert!(
        ctx.sender() == namespace.owner || dynamic_field::exists_(&namespace.id, ctx.sender()),
        ENotAuthorized
    );
    let parent_count = (vector::length(&parent_memories) as u32);
    let memory = MemoryIndex {
        id: object::new(ctx),
        blob_id,
        agent_id: ctx.sender(),
        namespace_id: object::uid_to_address(&namespace.id),
        memory_type,
        content_hash,
        parent_count,
        timestamp_ms: clock.timestamp_ms(),
        is_encrypted,
        max_uses,
        use_count: 0,
    };
    namespace.memory_count = namespace.memory_count + 1;
    event::emit(MemoryWritten {
        memory_id: object::uid_to_address(&memory.id),
        blob_id: memory.blob_id,
        agent_id: memory.agent_id,
        namespace_id: memory.namespace_id,
        memory_type,
        content_hash: memory.content_hash,
        timestamp_ms: memory.timestamp_ms,
        max_uses,
        is_shared: true,
        parent_memories,
    });
    transfer::public_share_object(memory);
}

/// Atomically claim one use slot on a shared MemoryIndex.
/// Returns a ClaimTicket (transferred to caller) proving the claim.
/// Fails with EMemoryExhausted if max_uses > 0 and use_count >= max_uses.
/// Thread-safe: because MemoryIndex is a shared object, Sui sequences concurrent claim_memory
/// calls — no two callers can see the same use_count state simultaneously.
public fun claim_memory(
    memory: &mut MemoryIndex,
    clock: &Clock,
    ctx: &mut TxContext,
): ClaimTicket {
    if (memory.max_uses > 0) {
        assert!(memory.use_count < memory.max_uses, EMemoryExhausted);
    };
    memory.use_count = memory.use_count + 1;
    let ticket = ClaimTicket {
        id: object::new(ctx),
        memory_id: object::uid_to_address(&memory.id),
        claimer: ctx.sender(),
        namespace_id: memory.namespace_id,
        claimed_at_ms: clock.timestamp_ms(),
    };
    event::emit(MemoryClaimed {
        memory_id: object::uid_to_address(&memory.id),
        ticket_id: object::uid_to_address(&ticket.id),
        claimer: ctx.sender(),
        use_count: memory.use_count,
        max_uses: memory.max_uses,
        claimed_at_ms: clock.timestamp_ms(),
    });
    ticket
}

// === Getters ===

public fun owner(namespace: &Namespace): address { namespace.owner }
public fun name(namespace: &Namespace): vector<u8> { namespace.name }
public fun agent_count(namespace: &Namespace): u32 { namespace.agent_count }
public fun memory_count(namespace: &Namespace): u64 { namespace.memory_count }
public fun created_at(namespace: &Namespace): u64 { namespace.created_at_ms }

public fun blob_id(memory: &MemoryIndex): vector<u8> { memory.blob_id }
public fun agent_id(memory: &MemoryIndex): address { memory.agent_id }
public fun namespace_id(memory: &MemoryIndex): address { memory.namespace_id }
public fun memory_type(memory: &MemoryIndex): u8 { memory.memory_type }
public fun content_hash(memory: &MemoryIndex): vector<u8> { memory.content_hash }
public fun parent_count(memory: &MemoryIndex): u32 { memory.parent_count }
public fun timestamp_ms(memory: &MemoryIndex): u64 { memory.timestamp_ms }
public fun encrypted(memory: &MemoryIndex): bool { memory.is_encrypted }
public fun max_uses(memory: &MemoryIndex): u64 { memory.max_uses }
public fun use_count(memory: &MemoryIndex): u64 { memory.use_count }

public fun role(reg: &AgentRegistration): vector<u8> { reg.role }
public fun registered_at(reg: &AgentRegistration): u64 { reg.registered_at_ms }

public fun ticket_memory_id(ticket: &ClaimTicket): address { ticket.memory_id }
public fun ticket_claimer(ticket: &ClaimTicket): address { ticket.claimer }
public fun ticket_namespace_id(ticket: &ClaimTicket): address { ticket.namespace_id }
