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
  buildMemory,
  serializeMemory,
  storeMemoryOnWalrus,
  bytesToUtf8,
  readMemoryFromWalrus,
  deserializeMemory,
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

  // Configure exactly 1 Scout, 1 Strategist, and 1 Executor for the sequential run
  let numScouts = 1;
  let numStrategists = 1;
  let numExecutors = 1;
  let fundAmount = 200_000_000; // 0.2 SUI per agent (plenty of gas for all txs)
  let buffer = 120_000_000;    // 0.12 SUI safety buffer for master
  
  if (balanceVal < (numScouts + numStrategists + numExecutors) * fundAmount + buffer) {
    console.log("[!] Low SUI balance — dynamically adjusting agent funding.");
    fundAmount = Math.max(1_000_000, Math.floor((balanceVal - buffer) / (numScouts + numStrategists + numExecutors)));
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

  // 3. Generate or Load Agent Keypairs (persist keys in .env to reuse SUI funds)
  console.log("--- 1. Loading/Generating Unique Keys for Agents ---");
  const agentKeypairs: Ed25519Keypair[] = [];
  const agentAddresses: string[] = [];
  const agentPrivateKeys: string[] = [];
  
  const fs = await import("fs");
  for (let i = 0; i < totalAgents; i++) {
    const envKey = process.env[`AGENT_${i}_PRIVATE_KEY`];
    let kp: Ed25519Keypair;
    if (envKey) {
      kp = Ed25519Keypair.fromSecretKey(envKey);
      console.log(`  Loaded Agent ${i} from .env: ${kp.toSuiAddress()}`);
    } else {
      kp = Ed25519Keypair.generate();
      const secretKey = kp.getSecretKey(); // bech32 format
      fs.appendFileSync(".env", `\nAGENT_${i}_PRIVATE_KEY="${secretKey}"`);
      console.log(`  Generated new Agent ${i} and saved to .env: ${kp.toSuiAddress()}`);
    }
    agentKeypairs.push(kp);
    agentAddresses.push(kp.toSuiAddress());
    agentPrivateKeys.push(kp.getSecretKey());
  }

  console.log(`  Generated ${totalAgents} unique addresses:`);
  console.log(`    Scouts:      ${agentAddresses.slice(0, numScouts).map(a => a.slice(0, 8)).join(", ")}...`);
  console.log(`    Strategists: ${agentAddresses.slice(numScouts, numScouts + numStrategists).map(a => a.slice(0, 8)).join(", ")}...`);
  console.log(`    Executors:   ${agentAddresses.slice(numScouts + numStrategists, totalAgents).map(a => a.slice(0, 8)).join(", ")}...`);

  // 4. Fund All Agents via Batch PTB (delta-funding to preserve funds)
  console.log("\n--- 2. Funding Agents with SUI (Batch PTB) ---");
  const fundTx = new Transaction();
  let needsFunding = false;
  const fundTargets: { address: string; amount: number }[] = [];

  for (let i = 0; i < totalAgents; i++) {
    const bal = await masterClient.client.getBalance({ owner: agentAddresses[i] });
    const currentBal = Number(bal.totalBalance);
    if (currentBal < fundAmount) {
      const needed = fundAmount - currentBal;
      fundTargets.push({ address: agentAddresses[i], amount: needed });
      needsFunding = true;
    } else {
      console.log(`  Agent ${i} (${agentAddresses[i].slice(0, 10)}...) already has ${currentBal / 1_000_000_000} SUI.`);
    }
  }

  if (needsFunding) {
    const coins = fundTx.splitCoins(
      fundTx.gas,
      fundTargets.map(t => fundTx.pure.u64(t.amount))
    );
    for (let i = 0; i < fundTargets.length; i++) {
      fundTx.transferObjects([coins[i]], fundTx.pure.address(fundTargets[i].address));
    }
    const fundDigest = await masterClient.signAndExecute(fundTx);
    console.log(`  Funded ${fundTargets.length} agents. Digest: ${fundDigest}`);
  } else {
    console.log("  All agents are already fully funded.");
  }

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

  // Register the user's browser/viewer address so they have on-chain namespace access
  const userBrowserAddress = "0xe01bb616ffccafe6efe34f698fec841ddae64ffb69e896f558e5ee5f1cfeef0f";
  const [userReg] = regTx.moveCall({
    target: `${masterClient.packageId}::memory::register_agent`,
    arguments: [
      regTx.object(masterClient.namespaceId),
      regTx.pure.address(userBrowserAddress),
      regTx.pure.vector("u8", Array.from(Buffer.from("viewer"))),
      regTx.object.clock(),
    ],
  });
  regTx.transferObjects([userReg], masterClient.address);

  const regDigest = await masterClient.signAndExecute(regTx);
  console.log(`  Registered ${totalAgents} agents and browser address (${userBrowserAddress.slice(0, 10)}...). Digest: ${regDigest}`);

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
  const agentClients: MnemosyneClient[] = [];

  for (let i = 0; i < totalAgents; i++) {
    const agentClient = new MnemosyneClient({
      privateKey: agentPrivateKeys[i],
      network: masterClient.network,
      packageId: masterClient.packageId,
      namespaceId: masterClient.namespaceId,
      suiRpcUrl: process.env.SUI_RPC_URL,
    });
    agentClients.push(agentClient);

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
      
      let proposedAction: "mint_predict" | "skip" | "supply" | "redeem" = avgVol > 50 ? "supply" : "mint_predict";
      let confidence = Math.round(avgVol * 10) / 1000;
      let rationale = `SVI pricing decision — avg implied vol: ${Math.round(avgVol * 100) / 100}`;

      // Query recent reflections to learn from previous mistakes
      const maxReflectionsCount = 3;
      const recentReflections: any[] = [];
      try {
        console.log(`[Strategist:${strat.client.address.slice(0, 8)}] Fetching last ${maxReflectionsCount} reflections...`);
        const events = await strat.client.queryMemoryEvents(50, strat.client.namespaceId);
        const reflectionEvents = events.filter(e => e.memory_type === 3).slice(0, maxReflectionsCount);
        
        for (const re of reflectionEvents) {
          const blobId = bytesToUtf8(re.blob_id);
          if (blobId) {
            try {
              const raw = await readMemoryFromWalrus(strat.client, blobId, sharedMemwalConfig);
              const refMemory = deserializeMemory(raw, blobId);
              recentReflections.push(refMemory);
            } catch (err) {
              console.warn(`[Strategist] Failed to fetch/deserialize reflection blob ${blobId}:`, (err as Error).message);
            }
          }
        }

        if (recentReflections.length > 0) {
          console.log(`[Strategist:${strat.client.address.slice(0, 8)}] Retrieved ${recentReflections.length} previous reflections.`);
          for (const ref of recentReflections) {
            const perf = ref.content?.performance_score ?? 1.0;
            const learnings = ref.content?.key_learnings || [];
            console.log(`  - Reflection ${ref.blob_id.slice(0, 8)}: Score=${perf}, Learnings="${learnings.join(', ')}"`);
            
            if (perf < 0.5) {
              const notes = ref.content?.notes || "";
              // Check if notes indicate a failure of our proposed action
              if (notes.includes(`action ${proposedAction}`)) {
                console.log(`[Strategist:${strat.client.address.slice(0, 8)}] ⚠️ ALERT: Previous trade with action '${proposedAction}' was a mistake (Score: ${perf}). Learning from mistake: skipping trade.`);
                proposedAction = "skip";
                confidence = 0.0;
                rationale += ` | Adjusted to skip because previous '${proposedAction}' trade failed (Ref: ${ref.blob_id.slice(0, 8)}).`;
                break;
              }
            }
          }
        } else {
          console.log(`[Strategist:${strat.client.address.slice(0, 8)}] No previous reflections found yet.`);
        }
      } catch (err) {
        console.warn(`[Strategist:${strat.client.address.slice(0, 8)}] Failed to query or analyze reflections:`, (err as Error).message);
      }

      return {
        action: proposedAction,
        confidence,
        rationale,
        parent_observations: observations.map(o => o.blob_id).sort(),
        parent_reflections: recentReflections.map(r => r.blob_id).sort(),
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

  // 8. Run 10 Sequential Pipeline Iterations (Scout → Strategist → Executor → Reflector)
  console.log("\n--- 5. Running 10 Sequential Pipeline Iterations ---");
  console.log(`  Target: 10 Observations, 10 Decisions, 10 Artifacts, 10 Reflections`);

  const reflectedArtifacts = new Set<string>();

  const writeReflectionForArtifact = async (artifactEvent: Record<string, any>) => {
    const artifactBlobId = bytesToUtf8(artifactEvent.blob_id);
    if (reflectedArtifacts.has(artifactBlobId)) return;
    reflectedArtifacts.add(artifactBlobId);

    console.log(`  [Reflector] Reflecting on Artifact: ${artifactBlobId.slice(0, 16)}...`);
    
    // Retrieve the artifact memory from Walrus to get details (PnL, action)
    let pnl = 0;
    let action = "unknown";
    try {
      const rawArtifact = await readMemoryFromWalrus(masterClient, artifactBlobId, sharedMemwalConfig);
      const artifactMemory = deserializeMemory(rawArtifact, artifactBlobId);
      pnl = artifactMemory.content?.pnl ?? 0;
      
      // Traverse to parent decision memory to identify the target action
      if (artifactMemory.parent_memories && artifactMemory.parent_memories.length > 0) {
        const decisionBlobId = artifactMemory.parent_memories[0];
        try {
          const rawDecision = await readMemoryFromWalrus(masterClient, decisionBlobId, sharedMemwalConfig);
          const decisionMemory = deserializeMemory(rawDecision, decisionBlobId);
          action = decisionMemory.content?.action ?? "unknown";
        } catch (decErr) {
          console.warn(`  [Reflector] Failed to fetch decision memory ${decisionBlobId}:`, (decErr as Error).message);
        }
      }
      console.log(`  [Reflector] Retrieved artifact details: action=${action}, PnL=${pnl.toFixed(4)}`);
    } catch (err) {
      console.warn(`  [Reflector] Failed to fetch artifact details from Walrus:`, (err as Error).message);
    }

    // Determine performance score and learnings based on PnL
    const performanceScore = pnl >= 0 ? 0.95 : 0.2;
    const learnings = pnl >= 0
      ? [`Trade action '${action}' succeeded with positive PnL of ${pnl.toFixed(4)}.`]
      : [`Trade action '${action}' failed with negative PnL of ${pnl.toFixed(4)}. Avoid or reduce confidence for '${action}' under similar conditions.`];

    const reflectionPayload = {
      summary: `Strategy performance review for execution ${artifactBlobId.slice(0, 8)}`,
      key_learnings: learnings,
      performance_score: performanceScore,
      referenced_memories: [artifactBlobId],
      notes: `Reflected on action ${action} with PnL ${pnl.toFixed(4)}`,
    };

    const memory = buildMemory(
      "",
      masterClient.address,
      masterClient.namespaceId,
      "reflection",
      reflectionPayload,
      [artifactBlobId],
      3, // depth
      false, // encrypted
    );
    const serialized = serializeMemory(memory);
    const { blobId } = await storeMemoryOnWalrus(masterClient, serialized, false, 1, sharedMemwalConfig);
    await masterClient.writeMemoryIndex(blobId, memory.content_hash, 3, [artifactBlobId], false);
    console.log(`  [Reflector] [✓] Written Reflection: blob ${blobId.slice(0, 16)}...`);
  };

  for (let step = 1; step <= 10; step++) {
    console.log(`\n---------------------------------------------------------`);
    console.log(`              PIPELINE ITERATION ${step} / 10`);
    console.log(`---------------------------------------------------------`);

    // 1. Scout records shared observation
    console.log(`  [Scout] Recording observation ${step}...`);
    const obsBlobId = await scouts[0].recordSharedObservation(createRandomObservation(step), 1);

    // 2. Wait for strategist to make decision
    console.log(`  Waiting for decision referencing observation ${obsBlobId.slice(0, 8)}...`);
    let decisionBlobId = "";
    for (let attempt = 0; attempt < 30; attempt++) {
      await sleep(2500);
      const events = await masterClient.queryMemoryEvents(50, masterClient.namespaceId);
      const decisionEvt = events.find(e => e.memory_type === 1 && Array.isArray(e.parent_memories) && (e.parent_memories as any[]).some((p: any) => bytesToUtf8(p) === obsBlobId));
      if (decisionEvt) {
        decisionBlobId = bytesToUtf8(decisionEvt.blob_id);
        console.log(`  [✓] Decision found: ${decisionBlobId.slice(0, 16)}...`);
        break;
      }
    }
    if (!decisionBlobId) {
      console.warn(`  [!] Timeout waiting for decision — skipping iteration`);
      continue;
    }

    // 3. Wait for executor to execute artifact
    console.log(`  Waiting for artifact referencing decision ${decisionBlobId.slice(0, 8)}...`);
    let artifactBlobId = "";
    let artifactEvt: any = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      await sleep(2500);
      const events = await masterClient.queryMemoryEvents(50, masterClient.namespaceId);
      artifactEvt = events.find(e => e.memory_type === 2 && Array.isArray(e.parent_memories) && (e.parent_memories as any[]).some((p: any) => bytesToUtf8(p) === decisionBlobId));
      if (artifactEvt) {
        artifactBlobId = bytesToUtf8(artifactEvt.blob_id);
        console.log(`  [✓] Artifact found: ${artifactBlobId.slice(0, 16)}...`);
        break;
      }
    }
    if (!artifactBlobId || !artifactEvt) {
      console.warn(`  [!] Timeout waiting for artifact — skipping iteration`);
      continue;
    }

    // 4. Record reflection for this artifact
    await writeReflectionForArtifact(artifactEvt);
  }

  // 9. Verify the final memory count (10 of each type = 40 total)
  console.log("\n--- 6. Verifying Final Namespace Memory Count ---");
  const targetCount = 40;
  try {
    const nsObj = await masterClient.client.getObject({
      id: masterClient.namespaceId,
      options: { showContent: true },
    });
    const memoryCount = Number((nsObj.data?.content as {fields?: {memory_count?: unknown}})?.fields?.memory_count || 0);
    console.log(`  Final memory_count on-chain: ${memoryCount} / ${targetCount}`);
    if (memoryCount >= targetCount) {
      console.log(`  [✓] All ${targetCount} memory writes successfully stored on-chain!`);
    } else {
      console.warn(`  [!] Warning: Expected ${targetCount} memories, but found ${memoryCount}`);
    }
  } catch (err) {
    console.error(`  Could not query final namespace state: ${(err as Error).message}`);
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

  console.log("\n--- 8. Refunding Remaining SUI from Agents to Master Wallet ---");
  for (let i = 0; i < agentClients.length; i++) {
    try {
      const client = agentClients[i];
      const bal = await client.client.getBalance({ owner: client.address });
      const currentBal = Number(bal.totalBalance);
      if (currentBal > 10_000_000) {
        console.log(`  Refunding ${currentBal / 1_000_000_000} SUI from Agent ${i} (${client.address.slice(0, 10)}...)...`);
        const refundTx = new Transaction();
        refundTx.transferObjects([refundTx.gas], masterClient.address);
        const digest = await client.signAndExecute(refundTx);
        console.log(`  [✓] Refunded. Digest: ${digest}`);
      } else {
        console.log(`  Agent ${i} has insufficient SUI to refund (${currentBal / 1_000_000_000} SUI).`);
      }
    } catch (err: any) {
      console.error(`  [-] Failed to refund Agent ${i}:`, err.message || err);
    }
  }

  console.log("\nPoC simulation complete.");
}

runPoC()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[-] PoC failed:", err);
    process.exit(1);
  });
