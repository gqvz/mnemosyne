import type { MnemosyneClient } from "./client.js";
import { MemWal } from "@mysten-incubation/memwal";

/** Optional per-call override for MemWal connection settings. When omitted, the
 *  functions fall back to the MEMWAL_* environment variables. */
export interface MemWalConfig {
  key?: string;
  accountId?: string;
  serverUrl?: string;
}

function createMemWal(client: MnemosyneClient, config?: MemWalConfig): ReturnType<typeof MemWal.create> {
  return MemWal.create({
    key: config?.key ?? process.env.MEMWAL_PRIVATE_KEY!,
    accountId: config?.accountId ?? process.env.MEMWAL_ACCOUNT_ID!,
    serverUrl: config?.serverUrl ?? process.env.MEMWAL_SERVER_URL!,
    namespace: client.namespaceId,
  });
}

export async function storeMemoryOnWalrus(
  client: MnemosyneClient,
  content: string,
  deletable: boolean = false,
  epochs: number = 1,
  memwalConfig?: MemWalConfig,
): Promise<{ blobId: string; blobObjectId: string }> {
  const memwal = createMemWal(client, memwalConfig);

  console.log(`[MemWal SDK] Uploading memory to MemWal Relayer...`);
  const result = await memwal.rememberAndWait(content, client.namespaceId, { timeoutMs: 90000, pollIntervalMs: 5000 });
  return {
    blobId: result.blob_id,
    blobObjectId: result.id,
  };
}

export async function readMemoryFromWalrus(
  client: MnemosyneClient,
  blobId: string,
  memwalConfig?: MemWalConfig,
): Promise<string> {
  // Fetch via MemWal recall to ensure the blob is decrypted by SEAL.
  // We use a generic query to fetch the latest memories in the namespace.

  // Fallback: search via MemWal recall using the blobId as the query term.
  const memwal = createMemWal(client, memwalConfig);

  const recalled = await memwal.recall(blobId, { limit: 200, namespace: client.namespaceId });
  const memory = recalled.results.find((m: any) => m.blob_id === blobId);
  if (!memory) {
    throw new Error(`Memory with blobId ${blobId} not found in Walrus aggregator or MemWal index`);
  }
  return memory.text;
}

export async function verifyBlobExists(
  client: MnemosyneClient,
  blobId: string,
  memwalConfig?: MemWalConfig,
): Promise<boolean> {
  try {
    await readMemoryFromWalrus(client, blobId, memwalConfig);
    return true;
  } catch {
    return false;
  }
}
