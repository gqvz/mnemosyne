import { createHash } from "node:crypto";
import type { Memory, MemoryEvent, VerificationNode, NamespaceConfig } from "./types.js";
import { MemorySchema } from "./types.js";

export function computeContentHash(content: unknown): string {
  const json = JSON.stringify(content);
  return createHash("sha256").update(json).digest("hex");
}

export function buildMemory(
  blobId: string,
  agentId: string,
  namespaceId: string,
  memoryType: Memory["memory_type"],
  content: unknown,
  parentMemories: string[],
  depth: number,
  encrypted: boolean,
  suiObjectId?: string,
  sealPolicyId?: string,
): Memory {
  const contentHash = computeContentHash(content);

  return MemorySchema.parse({
    blob_id: blobId,
    agent_id: agentId,
    namespace_id: namespaceId,
    memory_type: memoryType,
    content,
    content_hash: contentHash,
    parent_memories: parentMemories,
    depth,
    timestamp_ms: Date.now(),
    encrypted,
    sui_object_id: suiObjectId,
    seal_policy_id: sealPolicyId,
  });
}

export function serializeMemory(memory: Memory): string {
  return JSON.stringify({
    v: 1,
    blob_id: memory.blob_id,
    agent_id: memory.agent_id,
    namespace_id: memory.namespace_id,
    memory_type: memory.memory_type,
    content: memory.content,
    content_hash: memory.content_hash,
    parent_memories: memory.parent_memories,
    depth: memory.depth,
    timestamp_ms: memory.timestamp_ms,
    encrypted: memory.encrypted,
  });
}

export function deserializeMemory(raw: string): Memory {
  const parsed = JSON.parse(raw);
  return MemorySchema.parse(parsed);
}

export function verifyContentHash(memory: Memory): boolean {
  const expected = computeContentHash(memory.content);
  return expected === memory.content_hash;
}

export function walkCausalChain(
  memories: Map<string, Memory>,
  rootBlobId: string,
): VerificationNode | null {
  const root = memories.get(rootBlobId);
  if (!root) return null;

  const children: VerificationNode[] = [];
  for (const parentId of root.parent_memories) {
    const child = walkCausalChain(memories, parentId);
    if (child) children.push(child);
  }

  return {
    memory: root,
    verified: verifyContentHash(root),
    children,
  };
}

export function formatMemoryText(memory: Memory): string {
  const typePrefix = {
    observation: "[OBS]",
    decision: "[DEC]",
    artifact: "[ART]",
    reflection: "[REF]",
  }[memory.memory_type];

  const summary =
    typeof memory.content === "object" && memory.content !== null
      ? JSON.stringify(memory.content).slice(0, 120)
      : String(memory.content);

  return `${typePrefix} Agent ${memory.agent_id.slice(0, 8)}... | ${summary}`;
}

export function buildOnChainMemoryTxParams(
  namespaceAddress: string,
  blobId: string,
  contentHash: string,
  memoryTypeU8: number,
  parentCount: number,
  isEncrypted: boolean,
  packageId: string,
  clockObjectId: string,
) {
  return {
    target: `${packageId}::memory::write_memory`,
    arguments: [
      { kind: "object", id: namespaceAddress },
      { kind: "pure", value: Array.from(Buffer.from(blobId)) },
      { kind: "pure", value: Array.from(Buffer.from(contentHash, "hex")) },
      { kind: "pure", value: memoryTypeU8 },
      { kind: "pure", value: parentCount },
      { kind: "pure", value: isEncrypted },
      { kind: "object", id: clockObjectId },
    ],
  };
}
