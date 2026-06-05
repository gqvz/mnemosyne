import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { walrus, TESTNET_WALRUS_PACKAGE_CONFIG, WalrusClient } from "@mysten/walrus";
import type { MnemosyneClient } from "./client.js";
import type { Memory } from "./types.js";

let _walrusClient: WalrusClient | null = null;

export function getWalrusClient(client: MnemosyneClient): WalrusClient {
  if (_walrusClient) return _walrusClient;

  const walrusPlugin = walrus({
    packageConfig: client.network === "testnet"
      ? TESTNET_WALRUS_PACKAGE_CONFIG
      : undefined,
  });

  _walrusClient = walrusPlugin.register(client.client);
  return _walrusClient;
}

export async function storeMemoryOnWalrus(
  client: MnemosyneClient,
  content: string,
  deletable: boolean = false,
  epochs: number = 5,
): Promise<{ blobId: string; blobObjectId: string }> {
  const wClient = getWalrusClient(client);
  const bytes = new TextEncoder().encode(content);

  const result = await wClient.writeBlob({
    blob: bytes,
    deletable,
    epochs,
    signer: client.keypair,
    owner: client.address,
  });

  return {
    blobId: result.blobId,
    blobObjectId: result.blobObject.id,
  };
}

export async function readMemoryFromWalrus(
  client: MnemosyneClient,
  blobId: string,
): Promise<string> {
  const wClient = getWalrusClient(client);
  const bytes = await wClient.readBlob({ blobId });
  return new TextDecoder().decode(bytes);
}

export async function verifyBlobExists(
  client: MnemosyneClient,
  blobId: string,
): Promise<boolean> {
  try {
    await readMemoryFromWalrus(client, blobId);
    return true;
  } catch {
    return false;
  }
}
