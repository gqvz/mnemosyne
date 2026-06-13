import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const client = new SuiJsonRpcClient({
  url: "https://fullnode.testnet.sui.io:443",
  network: "testnet",
});

async function main() {
  const address = "0x24e0ccdd78b6ba63fe0a8beb7d57d92b8419f9712507c7c0127ef8dde88e889e";
  console.log("Querying transactions for address:", address);
  const txs = await client.queryTransactionBlocks({
    filter: { ToAddress: address },
    limit: 10,
    order: "descending",
    options: { showEffects: true },
  });
  console.log("Transactions count:", txs.data.length);
  for (const tx of txs.data) {
    console.log(`Digest: ${tx.digest}, Status: ${tx.effects?.status.status}, Error: ${tx.effects?.status.error}`);
  }
}

main().catch(console.error);
