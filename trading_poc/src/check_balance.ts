import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import dotenv from "dotenv";

dotenv.config();

async function check() {
  const pk = process.env.MEMWAL_PRIVATE_KEY;
  if (!pk) {
    console.log("No MEMWAL_PRIVATE_KEY found in .env");
    return;
  }
  const secretKey = new Uint8Array(Buffer.from(pk, "hex"));
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const address = keypair.toSuiAddress();
  console.log(`Delegate Address: ${address}`);

  const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443" });
  try {
    const balance = await client.getBalance({ owner: address });
    console.log(`Balance: ${Number(balance.totalBalance) / 1_000_000_000} SUI`);
  } catch (err) {
    console.error("Error fetching balance:", err);
  }
}

check();
