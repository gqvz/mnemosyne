import { storeMemoryOnWalrus, readMemoryFromWalrus } from "../core/walrus.js";
import { sha256 } from "../core/client.js";
import { deserializeMemory } from "../core/memory.js";
import type { MnemosyneClient } from "../core/client.js";
import type { Memory, DecisionPayload } from "../core/types.js";

interface StrategistConfig {
  client: MnemosyneClient;
  pollIntervalMs?: number;
}

export class StrategistAgent {
  private client: MnemosyneClient;
  private pollIntervalMs: number;
  private isRunning = false;
  private timer?: ReturnType<typeof setInterval>;
  private seenBlobs = new Set<string>();

  constructor(config: StrategistConfig) {
    this.client = config.client;
    this.pollIntervalMs = config.pollIntervalMs ?? 30_000;
  }

  async start(strategyFn: (observations: Memory[]) => Promise<DecisionPayload | null>) {
    this.isRunning = true;
    console.log(`[Strategist:${this.client.address.slice(0, 8)}] Started`);

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        const events = await this.client.queryMemoryEvents(20);
        const observations: Memory[] = [];
        for (const evt of events) {
          if (evt.memory_type !== 0) continue;
          const blobBytes = (evt.blob_id as number[]) || [];
          const blobId = blobBytes.map((b) => String.fromCharCode(b)).join("");
          if (!blobId || this.seenBlobs.has(blobId)) continue;
          this.seenBlobs.add(blobId);
          try {
            const raw = await readMemoryFromWalrus(this.client, blobId);
            observations.push(deserializeMemory(raw));
          } catch { /* blob not available yet */ }
        }
        if (observations.length === 0) return;
        const decision = await strategyFn(observations);
        if (decision) {
          const contentStr = JSON.stringify(decision);
          const { blobId } = await storeMemoryOnWalrus(this.client, contentStr);
          const contentHash = sha256(contentStr);
          const parentIds = observations.map((o) => o.blob_id);
          await this.client.writeMemoryIndex(blobId, contentHash, 1, parentIds.length, false);
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
