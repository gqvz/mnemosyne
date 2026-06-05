import { useQuery } from "@tanstack/react-query";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import type { DisplayMemory } from "./mockData";
import { getMockMemories } from "./mockData";

const LIVE_PACKAGE_ID = "0x0b10396f6bd626a307370f30cf7f2bd4ca5c484645ef069f7f94c4e7c802cf93";

const rpcClient = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});

export function useMemories(namespaceId?: string) {
  return useQuery<DisplayMemory[]>({
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
          return getMockMemories();
        }

        return events.data.map((e, i) => {
          const parsed = e.parsedJson as Record<string, unknown>;
          const blobBytes = (parsed.blob_id as number[]) || [];
          const blobId = blobBytes.map((b) => String.fromCharCode(b)).join("").slice(0, 16);

          const memoryTypeU8 = (parsed.memory_type as number) || 0;
          const typeLabels: DisplayMemory["memoryType"][] = [
            "observation", "decision", "artifact", "reflection",
          ];
          const roleLabels = ["Scout Agent", "Strategist Agent", "Executor Agent", "Reflection"];

          const agentAddr = String(parsed.agent_id || "").slice(0, 12);

          return {
            id: String(parsed.memory_id || `mem-${i}`),
            blobId: blobId,
            agentId: agentAddr,
            agentName: roleLabels[memoryTypeU8] || "Agent",
            memoryType: typeLabels[memoryTypeU8] || "observation",
            content: {
              oracle: `Memory type ${memoryTypeU8}`,
              blob_bytes: blobId,
            },
            parentIds: [],
            timestampMs: Number(parsed.timestamp_ms || Date.now()),
            verified: true,
            txDigest: e.id.txDigest,
          };
        });
      } catch (err) {
        console.error("Failed to fetch live data:", err);
        return getMockMemories();
      }
    },
    refetchInterval: 20_000,
    staleTime: 5_000,
  });
}

export function useNamespaceState(namespaceId?: string) {
  return useQuery({
    queryKey: ["namespace", namespaceId],
    queryFn: async () => {
      if (!namespaceId) return { agentCount: 0, memoryCount: 0 };
      try {
        const obj = await rpcClient.getObject({
          id: namespaceId,
          options: { showContent: true },
        });
        if (!obj.data?.content) return { agentCount: 0, memoryCount: 0 };
        const fields = (obj.data.content as { fields?: Record<string, unknown> }).fields;
        return {
          agentCount: Number(fields?.agent_count || 0),
          memoryCount: Number(fields?.memory_count || 0),
        };
      } catch {
        return { agentCount: 0, memoryCount: 0 };
      }
    },
    refetchInterval: 30_000,
  });
}
