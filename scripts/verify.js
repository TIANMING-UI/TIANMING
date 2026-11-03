// Verify mint + token contract source on BscScan/Sourcify.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${hre.network.name}.json`), "utf8"));
  const c = d.config;
  const supply = BigInt(c.targetShares) * (BigInt(c.tokensPerShare) + BigInt(c.poolTokensPerShare));
  // Freshly created Etherscan keys are not propagated to every API node at once
  // ("Invalid API Key" on some requests only), so retry transient failures.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function verify(label, args) {
    for (let i = 1; i <= 6; i++) {
      try { await hre.run("verify:verify", args); console.log(`${label}: verified`); return; }
      catch (e) {
        const m = e.message || "";
        if (/already verified/i.test(m)) { console.log(`${label}: already verified`); return; }
        console.log(`${label}: attempt ${i} failed: ${m.split("\n")[0]}`);
        if (!/Invalid API Key|Failed to send|ECONN|timeout|pending/i.test(m)) return;
        await sleep(20000);
      }
    }
  }
  await verify("mint", { address: d.mint, constructorArguments: [c] });
  await verify("token", { address: d.token, contract: "contracts/TianmingToken.sol:TianmingToken", constructorArguments: [c.name, c.symbol, supply.toString(), d.mint, c.treasury] });
}
main().catch((e) => { console.error(e); process.exit(1); });
