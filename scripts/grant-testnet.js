// Give a wallet a fake test Agent ID + 1,000 test USDT. Testnet/local only.
//   ADDR=0xYourWallet npm run grant:testnet
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const to = process.env.ADDR;
  if (!to || !ethers.isAddress(to)) throw new Error("Set ADDR=<wallet address>");
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"));
  const agentId = await ethers.getContractAt("MockAgentId", d.agentIdRegistry);
  const usdt = await ethers.getContractAt("MockUSDT", d.usdt);
  await (await agentId.give(to)).wait();
  await (await usdt.mint(to, ethers.parseEther("1000"))).wait();
  console.log(`OK: ${to} has a test Agent ID + 1000 tUSDT on ${network.name}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
