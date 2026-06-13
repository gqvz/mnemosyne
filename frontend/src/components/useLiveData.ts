import { useQuery } from "@tanstack/react-query";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import type { MemoryIndex } from "../types";

export const LIVE_PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || "0x0c3727c0cded915935aa978cc3435b5d5a57f7015153ba4d3b75044ca4277fde";

const network = (import.meta.env.VITE_SUI_NETWORK as "testnet" | "mainnet") || "testnet";
const rpcUrl = import.meta.env.VITE_SUI_RPC_URL || getJsonRpcFullnodeUrl(network);

const rpcClient = new SuiJsonRpcClient({
  url: rpcUrl,
  network,
});

function bytesToUtf8(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw.map((b: number) => String.fromCharCode(b)).join("");
  }
  return "";
}

export function useMemories(namespaceId?: string) {
  return useQuery<MemoryIndex[]>({
    queryKey: ["memories", namespaceId],
    queryFn: async () => {
      if (!namespaceId) return [];
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

        const filteredEvents = events.data.filter((e) => {
          const parsed = e.parsedJson as Record<string, unknown>;
          return String(parsed.namespace_id) === namespaceId;
        });

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
          const encrypted = true;

          const parentMemoriesBytes = (parsed.parent_memories as number[][]) || [];
          const parentMemories = parentMemoriesBytes.map(bytes => bytesToUtf8(bytes)).filter(Boolean);

          return {
            blob_id: blobId || `mem-${e.id.txDigest.slice(0, 8)}`,
            content_hash: contentHash,
            memory_type: memoryType,
            parent_memories: parentMemories,
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
    refetchInterval: 10_000, // Speed up polling for real-time live graph updates
    staleTime: 3_000,
  });
}
