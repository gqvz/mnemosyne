import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const client = new SuiJsonRpcClient({
  url: "https://fullnode.testnet.sui.io:443",
  network: "testnet",
});

async function main() {
  const packageId = "0x0c3727c0cded915935aa978cc3435b5d5a57f7015153ba4d3b75044ca4277fde";
  console.log("Querying all events...");
  const events = await client.queryEvents({
    query: { MoveEventType: `${packageId}::memory::MemoryWritten` },
    limit: 100,
    order: "descending",
  });
  
  for (const e of events.data) {
    const p = e.parsedJson as any;
    console.log(`Tx: ${e.id.txDigest}, Namespace: ${p.namespace_id}, Type: ${p.memory_type}, Agent: ${p.agent_id}`);
  }
}

main().catch(console.error);
