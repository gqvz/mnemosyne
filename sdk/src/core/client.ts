import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { createHash } from "node:crypto";
import type { Memory } from "./types.js";
import { MemoryTypeU8 } from "./types.js";

const GRPC_URLS: Record<string, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
};

export interface ClientConfig {
  privateKey: string;
  network: "testnet" | "mainnet";
  packageId: string;
  namespaceId?: string;
  grpcUrl?: string;
}

export function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function memoryTypeToString(t: number): Memory["memory_type"] {
  const map: Record<number, Memory["memory_type"]> = {
    0: "observation",
    1: "decision",
    2: "artifact",
    3: "reflection",
  };
  return map[t] || "observation";
}

function stringToMemoryType(s: Memory["memory_type"]): number {
  return MemoryTypeU8[s];
}

export class MnemosyneClient {
  public client: SuiJsonRpcClient;
  public keypair: Ed25519Keypair;
  public packageId: string;
  public namespaceId: string;
  public network: "testnet" | "mainnet";
  public grpcBaseUrl: string;

  constructor(config: ClientConfig) {
    this.packageId = config.packageId;
    this.namespaceId = config.namespaceId || "";
    this.network = config.network;
    this.keypair = Ed25519Keypair.fromSecretKey(config.privateKey);
    this.grpcBaseUrl = config.grpcUrl || GRPC_URLS[config.network];

    this.client = new SuiJsonRpcClient({
      url: getJsonRpcFullnodeUrl(config.network),
      network: config.network,
    });
  }

  get address(): string {
    return this.keypair.toSuiAddress();
  }

  async signAndExecute(tx: Transaction): Promise<string> {
    const r = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.keypair,
      options: { showEffects: true, showObjectChanges: true },
    });
    if (r.errors && r.errors.length > 0) throw new Error(`Tx failed: ${r.errors[0]}`);
    await this.client.waitForTransaction({ digest: r.digest });
    return r.digest;
  }

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
    await this.sleep(3000);

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
    parentCount: number,
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
        tx.pure.u32(parentCount),
        tx.pure.bool(isEncrypted),
        tx.object.clock(),
      ],
    });
    tx.transferObjects([mem], this.address);
    return this.signAndExecute(tx);
  }

  async getNamespaceState(): Promise<Record<string, unknown> | null> {
    const obj = await this.client.getObject({
      id: this.namespaceId,
      options: { showContent: true },
    });
    if (!obj.data?.content) return null;
    return (obj.data.content as { fields?: Record<string, unknown> }).fields || null;
  }

  async queryMemoryEvents(limit: number = 20): Promise<Array<Record<string, unknown>>> {
    const events = await this.client.queryEvents({
      query: { MoveEventType: `${this.packageId}::memory::MemoryWritten` },
      limit,
      order: "descending",
    });
    return events.data.map((e) => e.parsedJson as Record<string, unknown>);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
