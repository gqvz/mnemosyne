import { SealClient, SessionKey } from "@mysten/seal";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Signer } from "@mysten/sui/cryptography";

const TESTNET_KEY_SERVERS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];

export async function sealEncrypt(
  client: SuiJsonRpcClient,
  packageId: string,
  plaintext: string,
  identityId: string,
  keyServers: string[] = TESTNET_KEY_SERVERS,
) {
  const seal = new SealClient({
    suiClient: client as any,
    serverConfigs: keyServers.map((objectId) => ({ objectId, weight: 1 })),
  });

  return seal.encrypt({
    threshold: 2,
    packageId,
    id: identityId,
    data: new TextEncoder().encode(plaintext),
  });
}

export async function sealDecrypt(
  client: SuiJsonRpcClient,
  packageId: string,
  encryptedData: Uint8Array,
  identityId: string,
  signer: Signer,
  keyServers: string[] = TESTNET_KEY_SERVERS,
): Promise<string> {
  const seal = new SealClient({
    suiClient: client as any,
    serverConfigs: keyServers.map((objectId) => ({ objectId, weight: 1 })),
  });

  const sessionKey = await SessionKey.create({
    address: identityId,
    packageId,
    ttlMin: 10,
    signer,
    suiClient: client as any,
  });

  const plainBytes = await seal.decrypt({
    data: encryptedData,
    sessionKey,
    txBytes: new Uint8Array(),
  });

  return new TextDecoder().decode(plainBytes);
}

export function isSealConfigured(keyServers?: string[]): boolean {
  return (keyServers ?? TESTNET_KEY_SERVERS).length >= 2;
}
