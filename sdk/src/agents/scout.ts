import { storeMemoryOnWalrus } from "../core/walrus.js";
import { sha256 } from "../core/client.js";
import type { MnemosyneClient } from "../core/client.js";
import type { ObservationPayload } from "../core/types.js";

interface ScoutConfig {
  client: MnemosyneClient;
  pollIntervalMs?: number;
  observeFn: () => Promise<ObservationPayload | null>;
}

export class ScoutAgent {
  private client: MnemosyneClient;
  private isRunning = false;
  private timer?: ReturnType<typeof setInterval>;
  private observeFn: () => Promise<ObservationPayload | null>;
  private pollIntervalMs: number;

  constructor(config: ScoutConfig) {
    this.client = config.client;
    this.observeFn = config.observeFn;
    this.pollIntervalMs = config.pollIntervalMs ?? 10_000;
  }

  async start() {
    this.isRunning = true;
    console.log(`[Scout:${this.client.address.slice(0, 8)}] Started`);

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        const data = await this.observeFn();
        if (data) await this.recordObservation(data);
      } catch (err) {
        console.error(`[Scout] Error:`, (err as Error).message);
      }
    };

    await poll();
    this.timer = setInterval(poll, this.pollIntervalMs);
  }

  async recordObservation(data: ObservationPayload): Promise<string> {
    const contentStr = JSON.stringify(data);
    const { blobId } = await storeMemoryOnWalrus(this.client, contentStr);
    const contentHash = sha256(contentStr);
    await this.client.writeMemoryIndex(blobId, contentHash, 0, 0, false);
    console.log(`[Scout] Observation: blob ${blobId.slice(0, 16)}...`);
    return blobId;
  }

  stop() {
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
  }
}
