import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { createHash } from "node:crypto";

export interface ClientConfig {
  privateKey: string;
  network: "testnet" | "mainnet";
  packageId: string;
  namespaceId?: string;
  suiRpcUrl?: string;
}

export function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function bytesToUtf8(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw.map((b: number) => String.fromCharCode(b)).join("");
  }
  if (raw instanceof Uint8Array) {
    return new TextDecoder().decode(raw);
  }
  return "";
}

export class MnemosyneClient {
  public client: SuiJsonRpcClient;
  public keypair: Ed25519Keypair;
  public packageId: string;
  public namespaceId: string;
  public network: "testnet" | "mainnet";

  constructor(config: ClientConfig) {
    this.packageId = config.packageId;
    this.namespaceId = config.namespaceId || "";
    this.network = config.network;
    this.keypair = Ed25519Keypair.fromSecretKey(config.privateKey);

    this.client = new SuiJsonRpcClient({
      url: config.suiRpcUrl || getJsonRpcFullnodeUrl(config.network),
      network: config.network,
    });
  }

  get address(): string {
    return this.keypair.toSuiAddress();
  }

  async signAndExecute(tx: Transaction): Promise<string> {
    try {
      const balance = await this.client.getBalance({ owner: this.address });
      const balanceVal = Number(balance.totalBalance);
      if (balanceVal < 200000000) {
        tx.setGasBudget(Math.max(1000000, Math.min(balanceVal - 5000000, 80000000)));
      }
    } catch {
      // ignore if budget already set or query fails
    }
    const r = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.keypair,
      options: { showEffects: true, showObjectChanges: true },
    });
    if (r.errors && r.errors.length > 0) throw new Error(`Tx failed: ${r.errors[0]}`);
    if (r.effects && r.effects.status && r.effects.status.status === "failure") {
      throw new Error(`Tx failed on-chain: ${r.effects.status.error}`);
    }
    await this.client.waitForTransaction({ digest: r.digest });
    return r.digest;
  }

  /**
   * Creates a new Namespace on-chain and sets this.namespaceId to the created object ID.
   * Subsequent calls will overwrite the stored namespaceId.
   * @returns The created Namespace object ID
   */
  async createNamespace(name: string): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::memory::create_namespace`,
      arguments: [
        tx.pure.vector("u8", Array.from(Buffer.from(name))),
        tx.object.clock(),
      ],
    });
    const digest = await this.signAndExecute(tx);

    const txDetails = await this.client.getTransactionBlock({
      digest,
      options: { showObjectChanges: true },
    });
    if (txDetails.objectChanges) {
      for (const c of txDetails.objectChanges) {
        if (c.type === "created") {
          const objType = (c as { objectType: string }).objectType;
          if (objType.includes("::memory::Namespace")) {
            this.namespaceId = (c as { objectId: string }).objectId;
            return this.namespaceId;
          }
        }
      }
    }
    throw new Error("Could not find Namespace in created objects");
  }

  async registerAgent(agentAddress: string, role: string): Promise<string> {
    const tx = new Transaction();
    const [reg] = tx.moveCall({
      target: `${this.packageId}::memory::register_agent`,
      arguments: [
        tx.object(this.namespaceId),
        tx.pure.address(agentAddress),
        tx.pure.vector("u8", Array.from(Buffer.from(role))),
        tx.object.clock(),
      ],
    });
    tx.transferObjects([reg], this.address);
    return this.signAndExecute(tx);
  }

  async writeMemoryIndex(
    blobId: string,
    contentHash: string,
    memoryType: number,
    parentMemories: string[],
    isEncrypted: boolean,
  ): Promise<string> {
    const tx = new Transaction();
    const [mem] = tx.moveCall({
      target: `${this.packageId}::memory::write_memory`,
      arguments: [
        tx.object(this.namespaceId),
        tx.pure.vector("u8", Array.from(Buffer.from(blobId))),
        tx.pure.vector("u8", Array.from(Buffer.from(contentHash, "hex"))),
        tx.pure.u8(memoryType),
        tx.pure.vector("vector<u8>", parentMemories.map((id) => Array.from(Buffer.from(id)))),
        tx.pure.bool(isEncrypted),
        tx.object.clock(),
      ],
    });
    tx.transferObjects([mem], this.address);
    return this.signAndExecute(tx);
  }

  async writeMemoryShared(
    blobId: string,
    contentHash: string,
    memoryType: number,
    parentMemories: string[],
    isEncrypted: boolean,
    maxUses: number,
  ): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::memory::write_memory_shared`,
      arguments: [
        tx.object(this.namespaceId),
        tx.pure.vector("u8", Array.from(Buffer.from(blobId))),
        tx.pure.vector("u8", Array.from(Buffer.from(contentHash, "hex"))),
        tx.pure.u8(memoryType),
        tx.pure.vector("vector<u8>", parentMemories.map((id) => Array.from(Buffer.from(id)))),
        tx.pure.bool(isEncrypted),
        tx.pure.u64(maxUses),
        tx.object.clock(),
      ],
    });
    return this.signAndExecute(tx);
  }

  async writeMemoryDeduped(
    blobId: string,
    contentHash: string,
    memoryType: number,
    parentMemories: string[],
    isEncrypted: boolean,
    maxUses: number = 0,
  ): Promise<string> {
    const tx = new Transaction();
    const [mem] = tx.moveCall({
      target: `${this.packageId}::memory::write_memory_deduped`,
      arguments: [
        tx.object(this.namespaceId),
        tx.pure.vector("u8", Array.from(Buffer.from(blobId))),
        tx.pure.vector("u8", Array.from(Buffer.from(contentHash, "hex"))),
        tx.pure.u8(memoryType),
        tx.pure.vector("vector<u8>", parentMemories.map((id) => Array.from(Buffer.from(id)))),
        tx.pure.bool(isEncrypted),
        tx.pure.u64(maxUses),
        tx.object.clock(),
      ],
    });
    tx.transferObjects([mem], this.address);
    return this.signAndExecute(tx);
  }

  async writeMemorySharedDeduped(
    blobId: string,
    contentHash: string,
    memoryType: number,
    parentMemories: string[],
    isEncrypted: boolean,
    maxUses: number = 0,
  ): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::memory::write_memory_shared_deduped`,
      arguments: [
        tx.object(this.namespaceId),
        tx.pure.vector("u8", Array.from(Buffer.from(blobId))),
        tx.pure.vector("u8", Array.from(Buffer.from(contentHash, "hex"))),
        tx.pure.u8(memoryType),
        tx.pure.vector("vector<u8>", parentMemories.map((id) => Array.from(Buffer.from(id)))),
        tx.pure.bool(isEncrypted),
        tx.pure.u64(maxUses),
        tx.object.clock(),
      ],
    });
    return this.signAndExecute(tx);
  }

  async claimMemory(memoryId: string): Promise<string> {
    const tx = new Transaction();
    const [ticket] = tx.moveCall({
      target: `${this.packageId}::memory::claim_memory`,
      arguments: [tx.object(memoryId), tx.object.clock()],
    });
    tx.transferObjects([ticket], this.address);
    return this.signAndExecute(tx);
  }

  async hasContentHash(contentHash: string): Promise<boolean> {
    try {
      const res = await this.client.getDynamicFieldObject({
        parentId: this.namespaceId,
        name: {
          type: `${this.packageId}::memory::ContentHashKey`,
          value: { hash: Array.from(Buffer.from(contentHash, "hex")) },
        },
      });
      return !res.error;
    } catch {
      return false;
    }
  }

  async getNamespaceState(): Promise<Record<string, unknown> | null> {
    const obj = await this.client.getObject({
      id: this.namespaceId,
      options: { showContent: true },
    });
    if (!obj.data?.content) return null;
    return (obj.data.content as { fields?: Record<string, unknown> }).fields || null;
  }

  async queryEventsWithRetry(params: { query: any; limit: number; order: "ascending" | "descending" }, retries = 5, delayMs = 1500): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.client.queryEvents(params);
      } catch (err: any) {
        if (attempt === retries) throw err;
        console.warn(`[Client] queryEvents failed (attempt ${attempt}/${retries}): ${err.message || err}. Retrying in ${delayMs * attempt}ms...`);
        await this.sleep(delayMs * attempt);
      }
    }
  }

  async queryMemoryEvents(limit: number = 20, namespaceId?: string): Promise<Array<Record<string, unknown>>> {
    const events = await this.queryEventsWithRetry({
      query: { MoveEventType: `${this.packageId}::memory::MemoryWritten` },
      limit,
      order: "descending",
    });
    let data = events.data.map((e: any) => e.parsedJson as Record<string, unknown>);
    if (namespaceId) {
      data = data.filter((e: any) => String(e.namespace_id) === namespaceId);
    }
    return data;
  }

  async queryClaimEvents(limit: number = 20, namespaceId?: string): Promise<Array<Record<string, unknown>>> {
    const events = await this.queryEventsWithRetry({
      query: { MoveEventType: `${this.packageId}::memory::MemoryClaimed` },
      limit,
      order: "descending",
    });
    let data = events.data.map((e: any) => e.parsedJson as Record<string, unknown>);
    if (namespaceId) {
      data = data.filter((e: any) => String(e.namespace_id) === namespaceId);
    }
    return data;
  }

  async getMemoryObject(memoryId: string): Promise<Record<string, unknown> | null> {
    const obj = await this.client.getObject({
      id: memoryId,
      options: { showContent: true },
    });
    if (!obj.data?.content) return null;
    return (obj.data.content as { fields?: Record<string, unknown> }).fields || null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
