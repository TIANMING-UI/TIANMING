const fs = require("fs");
const path = require("path");

function saveDeployment(network, chainId, data) {
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network}.json`), JSON.stringify({ network, chainId, ...data }, null, 2));

  // The website reads web/deployments.json (keyed by chainId).
  const webFile = path.join(__dirname, "..", "web", chainId === 31337 ? "deployments.local.json" : "deployments.json");
  let web = {};
  try { web = JSON.parse(fs.readFileSync(webFile, "utf8")); } catch {}
  web[String(chainId)] = { network, mint: data.mint, token: data.token, usdt: data.usdt, treasury: data.treasury, agentIdRegistry: data.agentIdRegistry, deployBlock: data.deployBlock };
  fs.writeFileSync(webFile, JSON.stringify(web, null, 2) + "\n");

}

function toJSON(o) {
  return JSON.parse(JSON.stringify(o, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
}

module.exports = { saveDeployment, toJSON };
