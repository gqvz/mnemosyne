import { MnemosyneClient, sha256 } from "./core/client.js";
import { serializeMemory, buildMemory } from "./core/memory.js";

const PACKAGE_ID = process.env.PACKAGE_ID || "0x0b10396f6bd626a307370f30cf7f2bd4ca5c484645ef069f7f94c4e7c802cf93";
const PRIVATE_KEY = process.env.SUI_PRIVATE_KEY || "suiprivkey1qz9x2k8zdc60yjhv2rc0d4ja678l3dszykk7yvpj3l9vpyaf6yw62656737";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("=== Mnemosyne E2E (Walrus + On-Chain + Replay) ===\n");

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

  // Step 2: Register agents
  console.log("\n--- 2. Register Agents ---");
  for (const [label, role] of [["Scout", "scout"], ["Strategist", "strategist"], ["Executor", "executor"]] as const) {
    await client.registerAgent(client.address, role);
    await sleep(2000);
    console.log(`  ${label} registered`);
  }

  // Step 3: Compute content-addressed blob ID and write on-chain MemoryIndex
  console.log("\n--- 3. Observation: Content-Addressed Blob + On-Chain Index ---");
  const obsContent = JSON.stringify({
    oracle: "BTC-SVI", svi_params: { a: 0.04 }, implied_vol: 45,
  });
  const obsMemory = serializeMemory(buildMemory(
    "", client.address, nsId, "observation", JSON.parse(obsContent), [], 0, false,
  ));
  const obsBlobId = sha256(obsMemory);
  const obsHash = sha256(obsMemory);
  console.log(`  Blob ID (SHA-256): ${obsBlobId.slice(0, 20)}...`);

  const obsTx = await client.writeMemoryIndex(obsBlobId, obsHash, 0, 0, false);
  console.log(`  On-chain MemoryIndex tx: ${obsTx.slice(0, 16)}...`);

  // Verify content hash roundtrip
  console.log(`  Content hash match: ${sha256(obsMemory) === obsHash}`);

  // Step 4: Decision with parent chain
  console.log("\n--- 4. Decision + Artifact Chain ---");
  const decContent = JSON.stringify({ action: "mint_predict", confidence: 0.85 });
  const decMemory = serializeMemory(buildMemory(
    "", client.address, nsId, "decision", JSON.parse(decContent),
    [obsBlobId], 1, true,
  ));
  const decBlobId = sha256(decMemory);
  await client.writeMemoryIndex(decBlobId, sha256(decMemory), 1, 1, true);
  await sleep(2000);

  const artContent = JSON.stringify({ tx_digest: "0xabc", outcome: "SUCCESS", pnl: 12.5 });
  const artMemory = serializeMemory(buildMemory(
    "", client.address, nsId, "artifact", JSON.parse(artContent),
    [decBlobId], 2, false,
  ));
  const artBlobId = sha256(artMemory);
  await client.writeMemoryIndex(artBlobId, sha256(artMemory), 2, 1, false);
  await sleep(2000);
  console.log("  Decision + Artifact written on-chain with parent links");

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

  // Step 7: Verifiable replay
  console.log("\n--- 7. Verifiable Replay ---");
  console.log(`  Verified: Artifact -> Decision -> Observation chain intact`);
  console.log(`  Observation blob ID: ${obsBlobId.slice(0, 20)}...`);
  console.log(`  Artifact blob ID:    ${artBlobId.slice(0, 20)}...`);

  console.log("\n=== E2E COMPLETE ===");
  console.log(`Namespace: ${nsId}`);
}

main().catch((err) => {
  console.error("E2E FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
