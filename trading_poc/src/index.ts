/**
 * Mnemosyne Trading PoC
 *
 * Thread-safe multi-agent trading simulation demonstrating:
 *  - Scout → Strategist → Executor memory pipeline
 *  - On-chain claim-slot enforcement (max_uses) via Sui sequencer
 *  - Deduplication via content-hash dynamic fields
 *  - SEAL-encrypted blobs stored on Walrus via MemWal
 *
 * Run from this directory:
 *   cp .env.example .env  # fill in your keys
 *   npm install
 *   npm run dev
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import dotenv from "dotenv";

import {
  MnemosyneClient,
  ScoutAgent,
  StrategistAgent,
  ExecutorAgent,
} from "@mnemosyne/sdk";


dotenv.config();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runPoC() {
  console.log("=========================================================");
  console.log("   Mnemosyne Thread-Safe Multi-Agent Trading Simulation  ");
  console.log("=========================================================\n");
  
  if (!process.env.SUI_PRIVATE_KEY || !process.env.MNEMOSYNE_PACKAGE_ID || !process.env.MEMWAL_ACCOUNT_ID || !process.env.MEMWAL_PRIVATE_KEY) {
    console.error("[-] Error: Missing necessary keys in .env\n");
    console.error("    Required: SUI_PRIVATE_KEY, MNEMOSYNE_PACKAGE_ID, MEMWAL_ACCOUNT_ID, MEMWAL_PRIVATE_KEY");
    console.error("    See .env.example for the full list of variables.");
    process.exit(1);
  }

  // 1. Initialize Master Client
  const masterKeypair = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY);
  const masterClient = new MnemosyneClient({
    privateKey: masterKeypair.getSecretKey(),
    network: (process.env.SUI_NETWORK as "testnet" | "mainnet") || "testnet",
    packageId: process.env.MNEMOSYNE_PACKAGE_ID,
    suiRpcUrl: process.env.SUI_RPC_URL,
  });

  const balance = await masterClient.client.getBalance({ owner: masterClient.address });
  const balanceVal = Number(balance.totalBalance);
  console.log(`[Master] Address: ${masterClient.address}`);
  console.log(`[Master] Balance: ${balanceVal / 1_000_000_000} SUI`);
  console.log(`[Master] Package: ${masterClient.packageId}\n`);

  // Dynamically scale agent swarm based on available balance
  let numScouts = 5;
  let numStrategists = 4;
  let numExecutors = 2;
  let fundAmount = 20_000_000; // 0.02 SUI default
  let buffer = 25_000_000;     // 0.025 SUI safety buffer
  
  if (balanceVal < 95_000_000) {
    console.log("[!] Extremely low SUI balance — scaling down to 2/2/2 swarm.");
    numScouts = 2;
    numStrategists = 2;
    numExecutors = 2;
    fundAmount = 1_800_000;
    buffer = 2_500_000;
  } else if (balanceVal < 400_000_000) {
    console.log("[!] Low SUI balance — scaling down to 3/3/2 swarm.");
    numScouts = 3;
    numStrategists = 3;
    numExecutors = 2;
    fundAmount = 10_000_000;
    buffer = 15_000_000;
  }

  const totalAgents = numScouts + numStrategists + numExecutors;
  const totalFundingNeeded = totalAgents * fundAmount;
  console.log(`[Swarm Plan]`);
  console.log(`  Scouts:       ${numScouts}`);
  console.log(`  Strategists:  ${numStrategists}`);
  console.log(`  Executors:    ${numExecutors}`);
  console.log(`  Total Agents: ${totalAgents}`);
  console.log(`  Fund/Agent:   ${fundAmount / 1_000_000_000} SUI`);
  console.log(`  Total Gas:    ${totalFundingNeeded / 1_000_000_000} SUI\n`);

  if (balanceVal < totalFundingNeeded + buffer) {
    console.error(`[-] Insufficient balance. Need at least ${(totalFundingNeeded + buffer) / 1_000_000_000} SUI.`);
    process.exit(1);
  }

  // 2. Create Mnemosyne Namespace
  const namespaceId = await masterClient.createNamespace(`Trading-PoC-${Date.now()}`);
  masterClient.namespaceId = namespaceId;
  console.log(`[Namespace] Created: ${namespaceId}\n`);

  // 3. Generate Agent Keypairs (unique keys per agent)
  console.log("--- 1. Generating Unique Keys for Agents ---");
  const agentKeypairs: Ed25519Keypair[] = [];
  const agentAddresses: string[] = [];
  const agentPrivateKeys: string[] = [];
  
  for (let i = 0; i < totalAgents; i++) {
    const kp = Ed25519Keypair.generate();
    agentKeypairs.push(kp);
    agentAddresses.push(kp.toSuiAddress());
    agentPrivateKeys.push(kp.getSecretKey());
  }

  console.log(`  Generated ${totalAgents} unique addresses:`);
  console.log(`    Scouts:      ${agentAddresses.slice(0, numScouts).map(a => a.slice(0, 8)).join(", ")}...`);
  console.log(`    Strategists: ${agentAddresses.slice(numScouts, numScouts + numStrategists).map(a => a.slice(0, 8)).join(", ")}...`);
  console.log(`    Executors:   ${agentAddresses.slice(numScouts + numStrategists, totalAgents).map(a => a.slice(0, 8)).join(", ")}...`);

  // 4. Fund All Agents via Batch PTB
  console.log("\n--- 2. Funding Agents with SUI (Batch PTB) ---");
  const fundTx = new Transaction();
  const coins = fundTx.splitCoins(
    fundTx.gas,
    Array(totalAgents).fill(null).map(() => fundTx.pure.u64(fundAmount))
  );
  for (let i = 0; i < totalAgents; i++) {
    fundTx.transferObjects([coins[i]], fundTx.pure.address(agentAddresses[i]));
  }
  const fundDigest = await masterClient.signAndExecute(fundTx);
  console.log(`  Funded all ${totalAgents} agents. Digest: ${fundDigest}`);

  // 5. Batch Register Agents On-Chain
  console.log("\n--- 3. Registering Agents on-chain (Batch PTB) ---");
  const regTx = new Transaction();
  for (let i = 0; i < totalAgents; i++) {
    const role = i < numScouts ? "scout" : i < (numScouts + numStrategists) ? "strategist" : "executor";
    const [reg] = regTx.moveCall({
      target: `${masterClient.packageId}::memory::register_agent`,
      arguments: [
        regTx.object(masterClient.namespaceId),
        regTx.pure.address(agentAddresses[i]),
        regTx.pure.vector("u8", Array.from(Buffer.from(role))),
        regTx.object.clock(),
      ],
    });
    regTx.transferObjects([reg], masterClient.address);
  }
  const regDigest = await masterClient.signAndExecute(regTx);
  console.log(`  Registered ${totalAgents} agents. Digest: ${regDigest}`);

  // Wait for balance to propagate before agents start spending gas
  console.log("  Waiting for on-chain balance propagation...");
  for (let attempt = 0; attempt < 15; attempt++) {
    const bal = await masterClient.client.getBalance({ owner: agentAddresses[0] });
    if (Number(bal.totalBalance) > 0) {
      console.log(`  [✓] Balance confirmed for Agent 0 (${Number(bal.totalBalance) / 1_000_000_000} SUI)`);
      break;
    }
    console.log(`  Retry ${attempt + 1}/15...`);
    await sleep(5000);
    if (attempt === 14) console.warn("[!] Balance propagation timeout — proceeding anyway.");
  }

  const sharedMemwalConfig = {
    key: process.env.MEMWAL_PRIVATE_KEY,
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl: process.env.MEMWAL_SERVER_URL,
  };

  /** Create a randomized market observation payload for a scout */
  const createRandomObservation = (i: number) => ({
    oracle: `PriceOracle-${i}`,
    svi_params: { a: Math.random() * 0.05, b: Math.random() * 0.4 },
    implied_vol: 25 + Math.random() * 60,
    notes: `Scout ${i} observation at ${new Date().toISOString()}`,
  });

  // 6. Instantiate Agent Objects
  const scouts: InstanceType<typeof ScoutAgent>[] = [];
  const strategists: InstanceType<typeof StrategistAgent>[] = [];
  const executors: InstanceType<typeof ExecutorAgent>[] = [];

  for (let i = 0; i < totalAgents; i++) {
    const agentClient = new MnemosyneClient({
      privateKey: agentPrivateKeys[i],
      network: masterClient.network,
      packageId: masterClient.packageId,
      namespaceId: masterClient.namespaceId,
      suiRpcUrl: process.env.SUI_RPC_URL,
    });

    if (i < numScouts) {
      scouts.push(new ScoutAgent({
        client: agentClient,
        pollIntervalMs: 15_000,
        memwalConfig: sharedMemwalConfig,
        observeFn: async () => createRandomObservation(i),
      }));
    } else if (i < numScouts + numStrategists) {
      strategists.push(new StrategistAgent({
        client: agentClient,
        pollIntervalMs: 6_000,
        memwalConfig: sharedMemwalConfig,
      }));
    } else {
      executors.push(new ExecutorAgent({
        client: agentClient,
        pollIntervalMs: 6_000,
        memwalConfig: sharedMemwalConfig,
      }));
    }
  }

  // 7. Start Agent Swarms in Thread-Safe Mode
  console.log("\n--- 4. Starting Strategist & Executor Agent Swarms ---");

  for (const strat of strategists) {
    strat.startThreadSafe(async (observations) => {
      const avgVol = observations.reduce((acc, o) => acc + ((o.content as Record<string,number>).implied_vol || 0), 0) / observations.length;
      return {
        action: avgVol > 50 ? "supply" : "mint_predict",
        confidence: Math.round(avgVol * 10) / 1000,
        rationale: `SVI pricing decision — avg implied vol: ${Math.round(avgVol * 100) / 100}`,
        parent_observations: observations.map(o => o.blob_id).sort(),
      };
    }, 1); // max_uses=1: only ONE executor can claim this decision
  }

  for (const exec of executors) {
    exec.startThreadSafe(async (decisions) => {
      const parentIds = decisions.map(d => d.blob_id).sort();
      const txSuffix = parentIds.map(id => id.slice(0, 4)).join("-");
      return {
        tx_digest: `simulated-tx-${txSuffix}-${Math.floor(Math.random() * 100_000)}`,
        action: "executed_trade",
        outcome: "Executed decision swarm (pnl tracked)",
        pnl: decisions.reduce((acc, d) =>
          acc + ((d.content as Record<string,number>).confidence || 0) * (Math.random() > 0.4 ? 1.8 : -0.8), 0),
      };
    });
  }

  // 8. Scout Writes Shared Observation (max_uses=2: only 2 strategists may analyze it)
  console.log("\n--- 5. Triggering Scout Observation (max_uses: 2) ---");
  console.log(`  1 shared observation with 2 claim slots — ${numStrategists} strategists competing.`);
  console.log(`  Sui's sequencer guarantees only 2 claims succeed (EMemoryExhausted for the rest).`);
  await scouts[0].recordSharedObservation(createRandomObservation(0), 2);

  // 9. Wait for Full Pipeline to Complete
  console.log("\n--- 6. Waiting for Pipeline Completion (observation → decision → artifact) ---");
  const targetCount = 3;
  for (let elapsed = 0; elapsed < 90; elapsed += 5) {
    try {
      const nsObj = await masterClient.client.getObject({
        id: masterClient.namespaceId,
        options: { showContent: true },
      });
      const memoryCount = Number((nsObj.data?.content as {fields?: {memory_count?: unknown}})?.fields?.memory_count || 0);
      console.log(`  memory_count: ${memoryCount}/${targetCount}  (${elapsed}s elapsed)`);
      if (memoryCount >= targetCount) {
        console.log(`  [✓] Full pipeline complete — all ${targetCount} memory writes on-chain!`);
        break;
      }
    } catch (err) {
      console.log(`  Could not query namespace: ${(err as Error).message}`);
    }
    await sleep(5000);
    if (elapsed + 5 >= 90) console.log("[!] Timeout — reporting current state.");
  }

  // 10. Stop Agent Loops
  console.log("\n--- 7. Stopping Swarms ---");
  for (const s of strategists) s.stop();
  for (const e of executors) e.stop();
  await sleep(3000);

  // 11. Thread-Safety Audit Report
  try {
    const claimedEvents = await masterClient.client.queryEvents({
      query: { MoveEventType: `${masterClient.packageId}::memory::MemoryClaimed` },
      limit: 50,
      order: "ascending",
    });

    console.log("\n=========================================================");
    console.log("         ON-CHAIN THREAD-SAFETY AUDIT REPORT            ");
    console.log("=========================================================");
    console.log(`MemoryClaimed events found: ${claimedEvents.data.length}\n`);

    // Group claims by memory object
    const claimsByMemory: Record<string, Record<string, unknown>[]> = {};
    for (const event of claimedEvents.data) {
      const p = event.parsedJson as Record<string, unknown>;
      const mid = String(p.memory_id);
      if (!claimsByMemory[mid]) claimsByMemory[mid] = [];
      claimsByMemory[mid].push(p);
    }

    for (const [memoryId, claims] of Object.entries(claimsByMemory)) {
      const maxUses = Number(claims[0].max_uses);
      console.log(`Memory: ${memoryId}`);
      console.log(`  max_uses: ${maxUses === 0 ? "unlimited" : maxUses}`);
      console.log(`  Claims:   ${claims.length}`);
      claims.forEach((c, idx) => {
        console.log(`    [${idx + 1}] claimer=${String(c.claimer).slice(0, 12)}...  slot=${c.use_count}/${c.max_uses}`);
      });
      if (maxUses > 0 && claims.length > maxUses) {
        console.log("  [!] THREAD SAFETY BREACH — limit exceeded!");
      } else {
        console.log("  [✓] ENFORCED — Sui sequencer prevented over-claiming.");
      }
      console.log("---------------------------------------------------------");
    }
  } catch (err) {
    console.error("[-] Failed to fetch claims report:", err);
  }

  console.log("\nPoC simulation complete.");
}

runPoC()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[-] PoC failed:", err);
    process.exit(1);
  });
