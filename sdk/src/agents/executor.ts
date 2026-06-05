import { storeMemoryOnWalrus, readMemoryFromWalrus } from "../core/walrus.js";
import { sha256 } from "../core/client.js";
import { deserializeMemory } from "../core/memory.js";
import type { MnemosyneClient } from "../core/client.js";
import type { Memory, ArtifactPayload } from "../core/types.js";

interface ExecutorConfig {
  client: MnemosyneClient;
  pollIntervalMs?: number;
}

export class ExecutorAgent {
  private client: MnemosyneClient;
  private pollIntervalMs: number;
  private isRunning = false;
  private timer?: ReturnType<typeof setInterval>;
  private seenBlobs = new Set<string>();

  constructor(config: ExecutorConfig) {
    this.client = config.client;
    this.pollIntervalMs = config.pollIntervalMs ?? 15_000;
  }

  async start(executeFn: (decisions: Memory[]) => Promise<ArtifactPayload | null>) {
    this.isRunning = true;
    console.log(`[Executor:${this.client.address.slice(0, 8)}] Started`);

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        const events = await this.client.queryMemoryEvents(20);
        const decisions: Memory[] = [];
        for (const evt of events) {
          if (evt.memory_type !== 1) continue;
          const blobBytes = (evt.blob_id as number[]) || [];
          const blobId = blobBytes.map((b) => String.fromCharCode(b)).join("");
          if (!blobId || this.seenBlobs.has(blobId)) continue;
          this.seenBlobs.add(blobId);
          try {
            const raw = await readMemoryFromWalrus(this.client, blobId);
            decisions.push(deserializeMemory(raw));
          } catch { /* blob not available yet */ }
        }
        if (decisions.length === 0) return;
        const artifact = await executeFn(decisions);
        if (artifact) {
          const contentStr = JSON.stringify(artifact);
          const { blobId } = await storeMemoryOnWalrus(this.client, contentStr);
          const contentHash = sha256(contentStr);
          const parentIds = decisions.map((d) => d.blob_id);
          await this.client.writeMemoryIndex(blobId, contentHash, 2, parentIds.length, false);
          console.log(`[Executor] Artifact: ${artifact.outcome}`);
        }
      } catch (err) {
        console.error(`[Executor] Error:`, (err as Error).message);
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
