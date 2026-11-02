// Verify mint + token contract source on BscScan/Sourcify.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${hre.network.name}.json`), "utf8"));
  const c = d.config;
  const supply = BigInt(c.targetShares) * (BigInt(c.tokensPerShare) + BigInt(c.poolTokensPerShare));
  await hre.run("verify:verify", { address: d.mint, constructorArguments: [c] }).catch((e) => console.log("mint:", e.message));
  await hre.run("verify:verify", { address: d.token, contract: "contracts/TianmingToken.sol:TianmingToken", constructorArguments: [c.name, c.symbol, supply.toString(), d.mint, c.treasury] }).catch((e) => console.log("token:", e.message));
}
main().catch((e) => { console.error(e); process.exit(1); });
