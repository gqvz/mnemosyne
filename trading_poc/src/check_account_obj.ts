import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import dotenv from "dotenv";

dotenv.config();

async function checkObject() {
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  if (!accountId) {
    console.log("No MEMWAL_ACCOUNT_ID found in .env");
    return;
  }
  const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443" });
  try {
    const obj = await client.getObject({
      id: accountId,
      options: { showContent: true },
    });
    console.log("MemWalAccount Object:", JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error("Error fetching object:", err);
  }
}

checkObject();
