import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const client = new SuiJsonRpcClient({
  url: "https://fullnode.testnet.sui.io:443",
  network: "testnet",
});

async function main() {
  const packageId = "0x0c3727c0cded915935aa978cc3435b5d5a57f7015153ba4d3b75044ca4277fde";
  const namespaceId = "0xb9864fc401fe9a88f96a33f1703b97eef158077a1470ee9e4d2b9763755e5d40";

  console.log("Querying events for namespace:", namespaceId);
  const events = await client.queryEvents({
    query: { MoveEventType: `${packageId}::memory::MemoryWritten` },
    limit: 50,
    order: "descending",
  });
  
  const filtered = events.data.filter((e) => {
    const p = e.parsedJson as any;
    return String(p.namespace_id) === namespaceId;
  });
  
  console.log(`Found ${filtered.length} events for namespace ${namespaceId}:`);
  for (const e of filtered) {
    const p = e.parsedJson as any;
    console.log(`Memory ID: ${p.memory_id}, Type: ${p.memory_type}, Agent: ${p.agent_id}`);
  }
}

main().catch(console.error);
