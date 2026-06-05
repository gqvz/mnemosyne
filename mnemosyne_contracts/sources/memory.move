module mnemosyne_contracts::memory;

use sui::object::{Self, UID};
use sui::event;
use sui::clock::{Self, Clock};
use sui::tx_context::{Self, TxContext};
use sui::transfer;

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

#[allow(unused_const)]
const EAgentAlreadyRegistered: vector<u8> = b"Agent address already registered in this namespace";

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
}

/// Agent registration within a namespace
public struct AgentRegistration has key, store {
    id: UID,
    agent_address: address,
    namespace_id: address,
    role: vector<u8>,
    registered_at_ms: u64,
}

// === Events ===

public struct MemoryWritten has copy, drop {
    memory_id: address,
    blob_id: vector<u8>,
    agent_id: address,
    namespace_id: address,
    memory_type: u8,
    timestamp_ms: u64,
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
    parent_count: u32,
    is_encrypted: bool,
    clock: &Clock,
    ctx: &mut TxContext,
): MemoryIndex {
    assert!(memory_type <= 3, EInvalidMemoryType);

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
    };

    namespace.memory_count = namespace.memory_count + 1;

    event::emit(MemoryWritten {
        memory_id: object::uid_to_address(&memory.id),
        blob_id: memory.blob_id,
        agent_id: memory.agent_id,
        namespace_id: memory.namespace_id,
        memory_type,
        timestamp_ms: memory.timestamp_ms,
    });

    memory
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

public fun role(reg: &AgentRegistration): vector<u8> { reg.role }
public fun registered_at(reg: &AgentRegistration): u64 { reg.registered_at_ms }
