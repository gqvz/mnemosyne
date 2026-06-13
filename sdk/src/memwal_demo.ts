import "dotenv/config";
import { MemWal } from "@mysten-incubation/memwal";

async function main() {
  console.log("=== MemWal Demo ===");
  const memwal = MemWal.create({
    key: process.env.MEMWAL_PRIVATE_KEY!,
    accountId: process.env.MEMWAL_ACCOUNT_ID!,
    serverUrl: process.env.MEMWAL_SERVER_URL!,
    namespace: "e2e-demo-namespace",
  });

  console.log("Checking health...");
  const health = await memwal.health();
  console.log("Health:", health);

  console.log("Storing and waiting for indexing...");
  const result = await memwal.rememberAndWait("Mnemosyne agent observed BTC implied volatility at 45.", undefined, { timeoutMs: 30000 });
  console.log("Stored memory:", result);

  console.log("Recalling memory...");
  const recalled = await memwal.recall("What is the BTC implied volatility?", { limit: 5 });
  console.log("Recalled:", recalled.results);

  console.log("Analyzing free-form text...");
  const analyzed = await memwal.analyzeAndWait("Strategist agent decides to mint predict because spread is 7%.", undefined, { timeoutMs: 30000 });
  console.log("Analyzed facts:", analyzed.facts);
}

main().catch(console.error);
