import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import type { MemoryIndex } from "../types";

export const LIVE_PACKAGE_ID = "0xe50149a76bd364b170ece5bbefbdebda614cf7f34c82965e15eb0d8eb19048aa";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";

const rpcClient = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});

function bytesToUtf8(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw.map((b: number) => String.fromCharCode(b)).join("");
  }
  return "";
}

async function fetchParentMemories(blobId: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${WALRUS_AGGREGATOR}/${blobId}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return [];
    const raw = await response.text();
    const parsed = JSON.parse(raw);
    if (parsed.parent_memories && Array.isArray(parsed.parent_memories)) {
      return parsed.parent_memories;
    }
    return [];
  } catch {
    return [];
  }
}

export function useMemories(namespaceId?: string) {
  return useQuery<MemoryIndex[]>({
    queryKey: ["memories", namespaceId],
    queryFn: async () => {
      try {
        const events = await rpcClient.queryEvents({
          query: {
            MoveEventType: `${LIVE_PACKAGE_ID}::memory::MemoryWritten`,
          },
          limit: 50,
          order: "descending",
        });

        if (events.data.length === 0) {
          return [];
        }

        let filteredEvents = events.data;
        if (namespaceId) {
          filteredEvents = filteredEvents.filter((e) => {
            const parsed = e.parsedJson as Record<string, unknown>;
            return parsed.namespace_id === namespaceId;
          });
        }

        if (filteredEvents.length === 0 && namespaceId) {
          return []; // If they typed a namespace but no events match, return empty rather than mock
        }

        return filteredEvents.map((e) => {
          const parsed = e.parsedJson as Record<string, unknown>;
          const blobId = bytesToUtf8(parsed.blob_id);
          const contentHashBytes = (parsed.content_hash as number[]) || [];
          const contentHash = contentHashBytes.length > 0
            ? contentHashBytes.map((b) => b.toString(16).padStart(2, "0")).join("")
            : "0x...";
          const memoryType = (parsed.memory_type as number) ?? 0;
          const agentAddr = String(parsed.agent_id || "unknown");
          const ts = Number(parsed.timestamp_ms || Date.now());
          const encrypted = Boolean(parsed.is_encrypted);

          return {
            blob_id: blobId || `mem-${e.id.txDigest.slice(0, 8)}`,
            content_hash: contentHash,
            memory_type: memoryType,
            parent_memories: [],
            is_encrypted: encrypted,
            agent_address: agentAddr,
            timestamp: ts,
          };
        });
      } catch (err) {
        console.error("Failed to fetch live data:", err);
        return [];
      }
    },
    refetchInterval: 20_000,
    staleTime: 5_000,
  });
}

export function useResolvedParents(memories: MemoryIndex[] | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["resolved-parents", memories?.map((m) => m.blob_id).join(",")],
    queryFn: async () => {
      if (!memories || memories.length === 0) return null;
      const results: Record<string, string[]> = {};

      for (const mem of memories) {
        const parents = await fetchParentMemories(mem.blob_id);
        if (parents.length > 0) {
          results[mem.blob_id] = parents;
        }
      }

      if (Object.keys(results).length > 0) {
        queryClient.setQueriesData<MemoryIndex[]>({ queryKey: ["memories"] }, (old) => {
          if (!old) return old;
          return old.map((mem) => {
            const parents = results[mem.blob_id];
            if (parents && parents.length > 0) {
              return { ...mem, parent_memories: parents };
            }
            return mem;
          });
        });
      }

      return results;
    },
    enabled: !!memories && memories.length > 0,
    refetchInterval: 20_000,
    staleTime: 5_000,
  });
}
