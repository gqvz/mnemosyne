import { storeMemoryOnWalrus, readMemoryFromWalrus } from "../core/walrus.js";
import type { MemWalConfig } from "../core/walrus.js";
import { buildMemory, serializeMemory, deserializeMemory } from "../core/memory.js";
import { bytesToUtf8 } from "../core/client.js";
import type { MnemosyneClient } from "../core/client.js";
import type { Memory, ArtifactPayload } from "../core/types.js";

interface ExecutorConfig {
  client: MnemosyneClient;
  pollIntervalMs?: number;
  memwalConfig?: MemWalConfig;
}

export class ExecutorAgent {
  private client: MnemosyneClient;
  private pollIntervalMs: number;
  private isRunning = false;
  private timer?: ReturnType<typeof setInterval>;
  private seenBlobs = new Set<string>();
  private memwalConfig?: MemWalConfig;

  constructor(config: ExecutorConfig) {
    this.client = config.client;
    this.pollIntervalMs = config.pollIntervalMs ?? 15_000;
    this.memwalConfig = config.memwalConfig;
  }

  private addToSeenBlobs(blobId: string) {
    if (this.seenBlobs.size >= 500) {
      const oldest = this.seenBlobs.values().next().value!;
      this.seenBlobs.delete(oldest);
    }
    this.seenBlobs.add(blobId);
  }

  async start(executeFn: (decisions: Memory[]) => Promise<ArtifactPayload | null>) {
    this.isRunning = true;
    console.log(`[Executor:${this.client.address.slice(0, 8)}] Started`);

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        const events = await this.client.queryMemoryEvents(50, this.client.namespaceId);
        const decisions: Memory[] = [];
        for (const evt of events) {
          if (evt.memory_type !== 1) continue;
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
            decisions.push(deserializeMemory(raw, blobId));
          } catch (err) {
            console.error(`[Executor] Failed to deserialize memory for blob ${blobId}:`, err);
          }
        }
        if (decisions.length === 0) return;
        const artifact = await executeFn(decisions);
        if (artifact) {
          const parentIds = decisions.map((d) => d.blob_id);
          const memory = buildMemory(
            "",
            this.client.address,
            this.client.namespaceId,
            "artifact",
            artifact,
            parentIds,
            2,
            false,
          );
          const serialized = serializeMemory(memory);
          const { blobId } = await storeMemoryOnWalrus(this.client, serialized, false, 1, this.memwalConfig);
          await this.client.writeMemoryIndex(blobId, memory.content_hash, 2, parentIds, false);
          console.log(`[Executor] Artifact: ${artifact.outcome}`);
        }
      } catch (err) {
        console.error(`[Executor] Error:`, (err as Error).message);
      }
    };

    await poll();
    this.timer = setInterval(poll, this.pollIntervalMs);
  }

  async startThreadSafe(executeFn: (decisions: Memory[]) => Promise<ArtifactPayload | null>) {
    this.isRunning = true;
    console.log(`[Executor:${this.client.address.slice(0, 8)}] Started Thread-Safe`);

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        const events = await this.client.queryMemoryEvents(50, this.client.namespaceId);
        const decisions: Memory[] = [];
        for (const evt of events) {
          if (evt.memory_type !== 1) continue;
          if (!evt.is_shared) continue;
          
          const blobId = bytesToUtf8(evt.blob_id);
          if (!blobId || this.seenBlobs.has(blobId)) continue;
          
          try {
            await this.client.claimMemory(String(evt.memory_id));
            console.log(`[Executor:${this.client.address.slice(0, 8)}] Successfully claimed shared decision ${blobId.slice(0, 8)}... (Authorized to execute)`);
          } catch (e) {
            console.log(`[Executor:${this.client.address.slice(0, 8)}] Failed to claim shared decision ${blobId.slice(0, 8)}...: ${(e as Error).message} (Prevented double-execution)`);
            this.addToSeenBlobs(blobId);
            continue;
          }
          
          this.addToSeenBlobs(blobId);
          let raw: string;
          try {
            raw = await readMemoryFromWalrus(this.client, blobId, this.memwalConfig);
          } catch {
            continue;
          }
          try {
            decisions.push(deserializeMemory(raw, blobId));
          } catch (err) {
            console.error(`[Executor] Failed to deserialize memory for blob ${blobId}:`, err);
          }
        }
        if (decisions.length === 0) return;
        const artifact = await executeFn(decisions);
        if (artifact) {
          const parentIds = decisions.map((d) => d.blob_id);
          const memory = buildMemory(
            "",
            this.client.address,
            this.client.namespaceId,
            "artifact",
            artifact,
            parentIds,
            2,
            false,
          );
          // Add random jitter (500ms to 6500ms) to serialize uploads and avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 6000 + 500));

          if (await this.client.hasContentHash(memory.content_hash)) {
            console.log(`[Executor] Artifact skipped: duplicate content hash found before upload`);
            return;
          }
          const serialized = serializeMemory(memory);
          const { blobId } = await storeMemoryOnWalrus(this.client, serialized, false, 1, this.memwalConfig);
          try {
            await this.client.writeMemoryDeduped(blobId, memory.content_hash, 2, parentIds, false, 0);
            console.log(`[Executor] Thread-Safe Artifact: ${artifact.outcome}`);
          } catch (e) {
            console.log(`[Executor] Artifact skipped: ${(e as Error).message}`);
          }
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
