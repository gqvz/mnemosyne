async function checkRelayer() {
  const serverUrl = "https://relayer-staging.memory.walrus.xyz";
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
