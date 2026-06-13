import type { Memory, VerificationNode } from "./types.js";
import { verifyContentHash, deserializeMemory } from "./memory.js";
import type { MnemosyneClient } from "./client.js";
import { bytesToUtf8 } from "./client.js";
import { readMemoryFromWalrus } from "./walrus.js";

export interface ReplayResult {
  rootMemory: Memory;
  provenanceTree: VerificationNode;
  blobVerifications: Map<string, boolean>;
}

export async function replayFromDigest(
  client: MnemosyneClient,
  txDigest: string,
): Promise<ReplayResult | null> {
  const tx = await client.client.getTransactionBlock({
    digest: txDigest,
    options: { showEvents: true },
  });

  if (!tx.events) return null;

  const memoryEvent = tx.events.find(
    (e) => e.type === `${client.packageId}::memory::MemoryWritten`,
  );
  if (!memoryEvent) return null;

  const parsed = memoryEvent.parsedJson as Record<string, unknown>;
  const blobId = bytesToUtf8(parsed.blob_id);

  if (!blobId) return null;

  return replayFromBlobId(client, blobId);
}

export async function replayFromBlobId(
  client: MnemosyneClient,
  blobId: string,
  maxDepth: number = 20,
): Promise<ReplayResult | null> {
  const blobVerifications = new Map<string, boolean>();
  const fetched = new Map<string, Memory>();

  async function fetchAndVerify(bId: string, depth: number): Promise<Memory | null> {
    if (depth > maxDepth) return null;
    if (fetched.has(bId)) return fetched.get(bId)!;

    let raw: string;
    try {
      raw = await readMemoryFromWalrus(client, bId);
    } catch {
      blobVerifications.set(bId, false);
      return null;
    }

    let memory: Memory;
    try {
      memory = deserializeMemory(raw, bId);
    } catch (e) {
      console.error(`Deserialization failed for blob ${bId}:`, e);
      return null;
    }
    const verified = verifyContentHash(memory);
    blobVerifications.set(bId, verified);

    memory.verified = verified;
    fetched.set(bId, memory);

    for (const parentId of memory.parent_memories) {
      await fetchAndVerify(parentId, depth + 1);
    }

    return memory;
  }

  const rootMemory = await fetchAndVerify(blobId, 0);
  if (!rootMemory) return null;

  function buildTree(memory: Memory): VerificationNode {
    const children: VerificationNode[] = [];
    for (const parentId of memory.parent_memories) {
      const parentMem = fetched.get(parentId);
      if (parentMem) {
        children.push(buildTree(parentMem));
      }
    }
    return {
      memory,
      verified: blobVerifications.get(memory.blob_id) ?? false,
      children,
    };
  }

  return {
    rootMemory,
    provenanceTree: buildTree(rootMemory),
    blobVerifications,
  };
}
