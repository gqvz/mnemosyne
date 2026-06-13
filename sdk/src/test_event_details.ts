import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const client = new SuiJsonRpcClient({
  url: "https://fullnode.testnet.sui.io:443",
  network: "testnet",
});

async function main() {
  const digest = "VQYdQEHKko3FSSyXsV6hPkJxHLAhhTACav9BxQDA5jf";
  console.log("Querying transaction block events...");
  const tx = await client.getTransactionBlock({
    digest,
    options: { showEvents: true },
  });
  console.log(JSON.stringify(tx.events, null, 2));
}

main().catch(console.error);
