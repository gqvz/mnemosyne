import dotenv from "dotenv";
import { MnemosyneClient } from "@mnemosyne/sdk";
import { Transaction } from "@mysten/sui/transactions";

dotenv.config();

async function main() {
  const masterKey = process.env.SUI_PRIVATE_KEY;
  if (!masterKey) {
    console.error("Missing SUI_PRIVATE_KEY in environment");
    process.exit(1);
  }

  const masterClient = new MnemosyneClient({
    privateKey: masterKey,
    network: "testnet",
    packageId: process.env.MNEMOSYNE_PACKAGE_ID || "",
    suiRpcUrl: process.env.SUI_RPC_URL,
  });

  console.log(`Master Address: ${masterClient.address}`);

  const agentKeys = [
    process.env.AGENT_0_PRIVATE_KEY,
    process.env.AGENT_1_PRIVATE_KEY,
    process.env.AGENT_2_PRIVATE_KEY,
  ];

  for (let i = 0; i < agentKeys.length; i++) {
    const key = agentKeys[i];
    if (!key) continue;

    const agentClient = new MnemosyneClient({
      privateKey: key,
      network: "testnet",
      packageId: masterClient.packageId,
      suiRpcUrl: process.env.SUI_RPC_URL,
    });

    try {
      const bal = await agentClient.client.getBalance({ owner: agentClient.address });
      const currentBal = Number(bal.totalBalance);
      console.log(`Agent ${i} (${agentClient.address}): ${currentBal / 1_000_000_000} SUI`);
      if (currentBal > 10_000_000) {
        console.log(`  Refunding to master...`);
        const refundTx = new Transaction();
        refundTx.transferObjects([refundTx.gas], masterClient.address);
        const digest = await agentClient.signAndExecute(refundTx);
        console.log(`  [✓] Refunded. Digest: ${digest}`);
      } else {
        console.log(`  Insufficient SUI to refund.`);
      }
    } catch (err: any) {
      console.error(`  [-] Failed for Agent ${i}:`, err.message || err);
    }
  }

  const finalBal = await masterClient.client.getBalance({ owner: masterClient.address });
  console.log(`Final Master Balance: ${Number(finalBal.totalBalance) / 1_000_000_000} SUI`);
}

main().catch(console.error);
