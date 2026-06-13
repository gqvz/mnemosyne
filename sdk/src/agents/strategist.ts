import { storeMemoryOnWalrus, readMemoryFromWalrus } from "../core/walrus.js";
import type { MemWalConfig } from "../core/walrus.js";
import { buildMemory, serializeMemory, deserializeMemory } from "../core/memory.js";
import { bytesToUtf8 } from "../core/client.js";
import type { MnemosyneClient } from "../core/client.js";
import type { Memory, DecisionPayload } from "../core/types.js";

interface StrategistConfig {
  client: MnemosyneClient;
  pollIntervalMs?: number;
  memwalConfig?: MemWalConfig;
}

export class StrategistAgent {
  private client: MnemosyneClient;
  private pollIntervalMs: number;
  private isRunning = false;
  private timer?: ReturnType<typeof setInterval>;
  private seenBlobs = new Set<string>();
  private memwalConfig?: MemWalConfig;

  constructor(config: StrategistConfig) {
    this.client = config.client;
    this.pollIntervalMs = config.pollIntervalMs ?? 30_000;
    this.memwalConfig = config.memwalConfig;
  }

  private addToSeenBlobs(blobId: string) {
    if (this.seenBlobs.size >= 500) {
      const oldest = this.seenBlobs.values().next().value as string;
      this.seenBlobs.delete(oldest);
    }
    this.seenBlobs.add(blobId);
  }

  async start(strategyFn: (observations: Memory[]) => Promise<DecisionPayload | null>) {
    this.isRunning = true;
    console.log(`[Strategist:${this.client.address.slice(0, 8)}] Started`);

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        const events = await this.client.queryMemoryEvents(50, this.client.namespaceId);
        const observations: Memory[] = [];
        for (const evt of events) {
          if (evt.memory_type !== 0) continue;
          const blobId = bytesToUtf8(evt.blob_id);
          if (!blobId || this.seenBlobs.has(blobId)) continue;
          this.addToSeenBlobs(blobId);
          let raw: string;
          try {
            raw = await readMemoryFromWalrus(this.client, blobId, this.memwalConfig);
          } catch {
            continue;
          }
          try {
            observations.push(deserializeMemory(raw, blobId));
          } catch (err) {
            console.error(`[Strategist] Failed to deserialize memory for blob ${blobId}:`, err);
          }
        }
        if (observations.length === 0) return;
        const decision = await strategyFn(observations);
        if (decision) {
          const parentIds = observations.map((o) => o.blob_id);
          const memory = buildMemory(
            "",
            this.client.address,
            this.client.namespaceId,
            "decision",
            decision,
            parentIds,
            1,
            false,
          );
          const serialized = serializeMemory(memory);
          const { blobId } = await storeMemoryOnWalrus(this.client, serialized, false, 1, this.memwalConfig);
          await this.client.writeMemoryIndex(blobId, memory.content_hash, 1, parentIds.length, false);
          console.log(`[Strategist] Decision: ${decision.action}`);
        }
      } catch (err) {
        console.error(`[Strategist] Error:`, (err as Error).message);
      }
    };

    await poll();
    this.timer = setInterval(poll, this.pollIntervalMs);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
  }
}
