import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const client = new SuiJsonRpcClient({
  url: "https://fullnode.testnet.sui.io:443",
  network: "testnet",
});

function bytesToUtf8(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw.map((b: number) => String.fromCharCode(b)).join("");
  }
  return "";
}

async function main() {
  const packageId = "0x0c3727c0cded915935aa978cc3435b5d5a57f7015153ba4d3b75044ca4277fde";
  console.log("Querying recent memory events...");
  const events = await client.queryEvents({
    query: { MoveEventType: `${packageId}::memory::MemoryWritten` },
    limit: 10,
    order: "descending",
  });
  
  for (const e of events.data) {
    const p = e.parsedJson as any;
    const blobId = bytesToUtf8(p.blob_id);
    console.log(`Namespace: ${p.namespace_id}`);
    console.log(`Blob ID:   ${blobId}`);
    console.log(`Type:      ${p.memory_type}`);
    console.log("----------------------------------------");
  }
}

main().catch(console.error);
