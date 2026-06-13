import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const client = new SuiJsonRpcClient({
  url: "https://fullnode.testnet.sui.io:443",
  network: "testnet",
});

async function main() {
  const packageId = "0x0c3727c0cded915935aa978cc3435b5d5a57f7015153ba4d3b75044ca4277fde";
  const namespaceId = "0xb9864fc401fe9a88f96a33f1703b97eef158077a1470ee9e4d2b9763755e5d40";
  
  // Non-existent content hash
  const hash = "1122334455667788990011223344556677889900112233445566778899001122";
  
  console.log("Querying dynamic field...");
  try {
    const res = await client.getDynamicFieldObject({
      parentId: namespaceId,
      name: {
        type: `${packageId}::memory::ContentHashKey`,
        value: { hash: Array.from(Buffer.from(hash, "hex")) },
      },
    });
    console.log("Response:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.log("Threw error:", err);
  }
}

main().catch(console.error);
