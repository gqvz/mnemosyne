import dotenv from "dotenv";

dotenv.config();

async function checkRelayer() {
  const serverUrl = process.env.MEMWAL_SERVER_URL || "https://relayer.staging.memwal.ai";
  console.log(`Relayer URL: ${serverUrl}`);
  try {
    const healthRes = await fetch(`${serverUrl}/health`);
    const health = await healthRes.json();
    console.log("Health:", JSON.stringify(health, null, 2));
  } catch (err) {
    console.error("Error fetching health:", err);
  }

  try {
    const configRes = await fetch(`${serverUrl}/config`);
    const config = await configRes.json();
    console.log("Config:", JSON.stringify(config, null, 2));
  } catch (err) {
    console.error("Error fetching config:", err);
  }
}

checkRelayer();
