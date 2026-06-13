async function main() {
  const res = await fetch("https://publisher-staging.memory.walrus.xyz/v1/store?epochs=1", {
    method: "PUT",
    body: "test blob content"
  });
  console.log(res.status, await res.text());
}
main().catch(console.error);
