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

/**
 * Decrypt data that was previously encrypted with SEAL.
 *
 * @param client      - A SuiJsonRpcClient connected to the correct network.
 * @param packageId   - The on-chain package ID that owns the SEAL policy.
 * @param encryptedData - The raw ciphertext bytes returned by `sealEncrypt`.
 * @param identityId  - The SEAL identity / policy object ID.
 * @param signer      - The signer whose address is authorised by the policy.
 * @param keyServers  - Key-server object IDs to use (defaults to testnet).
 * @param txBytes     - **Required for production use.** The BCS-serialised bytes
 *   of a Programmable Transaction Block (PTB) that has been built to reference
 *   (and thus approve) the SEAL session key for this identity. Without a valid
 *   PTB, the key-server will reject the request. Callers must construct this PTB
 *   using the `@mysten/seal` SDK's session-key helpers and pass the resulting
 *   bytes here. Defaults to an empty Uint8Array (which will fail on the key-
 *   server in real scenarios but allows the API surface to be exercised in tests).
 */
export async function sealDecrypt(
  client: SuiJsonRpcClient,
  packageId: string,
  encryptedData: Uint8Array,
  identityId: string,
  signer: Signer,
  keyServers: string[] = TESTNET_KEY_SERVERS,
  txBytes: Uint8Array = new Uint8Array(),
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
    txBytes,
  });

  return new TextDecoder().decode(plainBytes);
}

export function isSealConfigured(keyServers?: string[]): boolean {
  return (keyServers ?? TESTNET_KEY_SERVERS).length >= 2;
}
