import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const client = new SuiJsonRpcClient({
  url: "https://fullnode.testnet.sui.io:443",
  network: "testnet",
});

async function main() {
  const digest = "GfadCm1t1m4WdzB98ecFuq4foczgTm1fzWh1986E9BzC";
  console.log("Querying transaction block details...");
  const tx = await client.getTransactionBlock({
    digest,
    options: { showInput: true, showEffects: true },
  });
  console.log(JSON.stringify(tx, null, 2));
}

main().catch(console.error);
