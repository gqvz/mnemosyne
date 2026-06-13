import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const packageId = "0x0c3727c0cded915935aa978cc3435b5d5a57f7015153ba4d3b75044ca4277fde";
const client = new SuiJsonRpcClient({
  url: "https://fullnode.testnet.sui.io:443",
  network: "testnet",
});

async function main() {
  console.log("Querying all MemoryWritten events...");
  const events = await client.queryEvents({
    query: { MoveEventType: `${packageId}::memory::MemoryWritten` },
    limit: 100,
    order: "descending",
  });
  console.log(`Total events returned: ${events.data.length}`);
  
  const namespaces: Record<string, number> = {};
  for (const event of events.data) {
    const p = event.parsedJson as any;
    namespaces[p.namespace_id] = (namespaces[p.namespace_id] || 0) + 1;
  }
  
  console.log("Namespace counts in latest 100 events:", namespaces);
}

main().catch(console.error);
