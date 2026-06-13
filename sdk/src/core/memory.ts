import { createHash } from "node:crypto";
import type { Memory, VerificationNode } from "./types.js";
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

export function deserializeMemory(raw: string, blobId?: string): Memory {
  const parsed = JSON.parse(raw);
  if (blobId && (!parsed.blob_id || parsed.blob_id === "")) {
    parsed.blob_id = blobId;
  }
  return MemorySchema.parse(parsed);
}

export function verifyContentHash(memory: Memory): boolean {
  const expected = computeContentHash(memory.content);
  return expected === memory.content_hash;
}
