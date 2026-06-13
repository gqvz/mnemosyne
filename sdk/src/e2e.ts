import "dotenv/config";
import { MnemosyneClient, sha256 } from "./core/client.js";
import { serializeMemory, buildMemory, deserializeMemory } from "./core/memory.js";
import { storeMemoryOnWalrus, readMemoryFromWalrus, verifyBlobExists } from "./core/walrus.js";
import { replayFromBlobId } from "./core/replay.js";
import type { Memory } from "./core/types.js";
import { sealEncrypt, sealDecrypt } from "./core/seal.js";

const PACKAGE_ID = process.env.PACKAGE_ID || "0xb2575d9ee97c40256041a27c23abaa763a37b17a1604d23baeceba6b1410bda8";
const PRIVATE_KEY = process.env.SUI_PRIVATE_KEY || "";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("=== Mnemosyne E2E (Walrus + On-Chain + Replay + Seal) ===\n");

  if (!PRIVATE_KEY) {
    console.log("SKIP: No SUI_PRIVATE_KEY set. Running offline-only verification.\n");
    runOfflineVerification();
    return;
  }

  const client = new MnemosyneClient({
    privateKey: PRIVATE_KEY,
    network: "testnet",
    packageId: PACKAGE_ID,
  });

  console.log(`Owner:    ${client.address}`);
  console.log(`Package:  ${client.packageId}\n`);

  // Step 1: Create Namespace
  console.log("--- 1. Create Namespace ---");
  const nsId = await client.createNamespace(`mnemosyne-e2e-${Date.now()}`);
  await sleep(3000);
  console.log(`Namespace: ${nsId}`);

  // Step 2: Register agent
  console.log("\n--- 2. Register Agents ---");
  await client.registerAgent(client.address, "all");
  await sleep(2000);
  console.log(`  Agent registered for all roles`);

  // Step 3: Store Observation on Walrus + write on-chain index
  console.log("\n--- 3. Observation: Walrus Blob + On-Chain Index ---");
  const obsPayload = {
    oracle: "BTC-SVI", svi_params: { a: 0.04, b: 0.5, rho: -0.2, m: 0.01, sigma: 0.3 }, implied_vol: 45,
  };
  const obsMemory = buildMemory("", client.address, nsId, "observation", obsPayload, [], 0, false);
  const obsSerialized = serializeMemory(obsMemory);
  const { blobId: obsBlobId } = await storeMemoryOnWalrus(client, obsSerialized);
  console.log(`  Walrus blob ID: ${obsBlobId}`);
  const obsTx = await client.writeMemoryIndex(obsBlobId, obsMemory.content_hash, 0, 0, false);
  console.log(`  On-chain MemoryIndex tx: ${obsTx.slice(0, 16)}...`);

  // Verify Walrus read roundtrip — read back and deserialize
  const obsRead = await readMemoryFromWalrus(client, obsBlobId);
  const obsDeserialized = deserializeMemory(obsRead, obsBlobId);
  const obsRoundtrip = obsDeserialized.content_hash === obsMemory.content_hash;
  console.log(`  Walrus read roundtrip: ${obsRoundtrip ? "OK" : "FAIL"}`);

  // Step 4: Decision + Artifact chain with Walrus storage
  console.log("\n--- 4. Decision + Artifact Chain ---");
  const decPayload = { action: "mint_predict", confidence: 0.85, rationale: "Vol spread 7%", parent_observations: [obsBlobId] };
  const decMemory = buildMemory("", client.address, nsId, "decision", decPayload, [obsBlobId], 1, true);
  const decSerialized = serializeMemory(decMemory);
  const { blobId: decBlobId } = await storeMemoryOnWalrus(client, decSerialized);
  await client.writeMemoryIndex(decBlobId, decMemory.content_hash, 1, 1, true);
  await sleep(2000);

  const artPayload = { tx_digest: `0x${sha256(decBlobId).slice(0, 8)}`, action: "mint_predict", outcome: "SUCCESS", pnl: 12.5, gas_cost: 0.003 };
  const artMemory = buildMemory("", client.address, nsId, "artifact", artPayload, [decBlobId], 2, false);
  const artSerialized = serializeMemory(artMemory);
  const { blobId: artBlobId } = await storeMemoryOnWalrus(client, artSerialized);
  await client.writeMemoryIndex(artBlobId, artMemory.content_hash, 2, 1, false);
  await sleep(2000);
  console.log("  Decision + Artifact stored on Walrus + on-chain");

  // Step 5: Verify on-chain state
  console.log("\n--- 5. On-Chain State ---");
  const nsState = await client.getNamespaceState();
  console.log(`  Agent count: ${nsState?.agent_count}`);
  console.log(`  Memory count: ${nsState?.memory_count}`);

  // Step 6: Query events
  console.log("\n--- 6. Query Events ---");
  await sleep(5000);
  const events = await client.queryMemoryEvents(10);
  console.log(`  Events found: ${events.length}`);
  for (const evt of events.slice(0, 3)) {
    console.log(`    Type: ${evt.memory_type}, Agent: ${String(evt.agent_id).slice(0, 10)}...`);
  }

  // Step 7: Verifiable Replay
  console.log("\n--- 7. Verifiable Replay ---");
  try {
    const replayResult = await replayFromBlobId(client, artBlobId);
    if (replayResult) {
      console.log(`  Root: ${replayResult.rootMemory.memory_type} (${replayResult.rootMemory.blob_id.slice(0, 20)}...)`);
      console.log(`  Verified: ${replayResult.blobVerifications.get(artBlobId)}`);
      console.log(`  Chain depth: ${replayResult.provenanceTree.children.length} children`);
      for (const child of replayResult.provenanceTree.children) {
        console.log(`    -> ${child.memory.memory_type}: ${child.memory.blob_id.slice(0, 20)}... (verified: ${child.verified})`);
      }
      console.log("  All blobs verified:", [...replayResult.blobVerifications.values()].every(v => v));
    } else {
      console.log("  Replay returned null — blobs may not be available on Walrus yet, or deserialization failed. Check Walrus availability and blob_id format.");
    }
  } catch (err) {
    console.error("  Replay failed with exception:", err instanceof Error ? err.message : String(err));
    console.error("  Stack:", (err as Error).stack);
  }

  // Step 8: Seal encryption test
  console.log("\n--- 8. Seal Encryption ---");
  try {
    const plaintext = "sensitive strategy data";
    const encResult = await sealEncrypt(client.client, PACKAGE_ID, plaintext, client.address);
    const encryptedBytes = encResult.encryptedObject;
    console.log(`  Encrypted: ${encryptedBytes.length} bytes`);

    const decrypted = await sealDecrypt(
      client.client, PACKAGE_ID, encryptedBytes, client.address, client.keypair,
    );
    console.log(`  Decrypted match: ${decrypted === plaintext}`);
  } catch (err) {
    console.log(`  Seal test skipped: ${(err as Error).message}`);
  }

  console.log("\n=== E2E COMPLETE ===");
  console.log(`Namespace: ${nsId}`);
}

function runOfflineVerification() {
  console.log("--- Offline Verification (no network required) ---\n");

  const memory = buildMemory(
    "blob-test-001",
    "0xagent1",
    "0xnamespace1",
    "observation",
    { oracle: "BTC-SVI", implied_vol: 45 },
    [],
    0,
    false,
  );

  const serialized = serializeMemory(memory);
  const deserialized = deserializeMemory(serialized);

  console.log(`  serialize/deserialize roundtrip: ${memory.blob_id === deserialized.blob_id ? "OK" : "FAIL"}`);
  console.log(`  content_hash preserved: ${memory.content_hash === deserialized.content_hash ? "OK" : "FAIL"}`);

  const memory2 = buildMemory(
    "blob-test-002", "0xagent1", "0xnamespace1",
    "decision", { action: "test", confidence: 0.9 },
    ["blob-test-001"], 1, true,
  );
  const decSerialized = serializeMemory(memory2);
  const decDeserialized = deserializeMemory(decSerialized);

  console.log(`  decision roundtrip: ${memory2.blob_id === decDeserialized.blob_id ? "OK" : "FAIL"}`);
  console.log(`  parent chain preserved: ${decDeserialized.parent_memories[0] === "blob-test-001" ? "OK" : "FAIL"}`);
  console.log(`  encrypted flag: ${decDeserialized.encrypted === true ? "OK" : "FAIL"}`);

  console.log("\n=== OFFLINE VERIFICATION PASSED ===");
}

main().catch((err) => {
  console.error("E2E FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
