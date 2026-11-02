// MAINNET deploy. Run from your own machine:
//   1) fill in .env (DEPLOYER_KEY, TREASURY = treasury address)
//   2) npm run deploy:mainnet               -> prints a summary, does not deploy
//   3) CONFIRM=TIANMING npm run deploy:mainnet -> real deploy
const { ethers, network } = require("hardhat");
const { ADDR, mainnetParams } = require("./params");
const { saveDeployment, toJSON } = require("./lib");

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();
  if (Number(chainId) !== 56) throw new Error("Not BSC mainnet (chainId 56)");
  const { TREASURY } = process.env;
  if (!ethers.isAddress(TREASURY || "")) throw new Error("Set TREASURY (treasury wallet address)");

  const code = await ethers.provider.getCode(TREASURY);
  if (code === "0x") console.log("Treasury: regular wallet (EOA).");

  const cfg = { ...ADDR[56], treasury: TREASURY, ...mainnetParams() };
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("=== Mainnet deploy summary ===");
  console.log(JSON.stringify(toJSON(cfg), null, 2));
  console.log(`Deployer ${deployer.address} · balance ${ethers.formatEther(bal)} BNB`);

  if (process.env.CONFIRM !== "TIANMING") {
    console.log("\nDRY RUN: nothing deployed. Run again with confirm = TIANMING to deploy for real.");
    return;
  }

  if (bal < ethers.parseEther("0.005")) throw new Error(`Deployer ${deployer.address} balance too low (${ethers.formatEther(bal)} BNB). Fund at least 0.01 BNB.`);
  const mint = await (await ethers.getContractFactory("TianmingMint")).deploy(cfg);
  const receipt = await (await mint.deploymentTransaction()).wait(3);
  const out = { mint: await mint.getAddress(), token: await mint.token(), usdt: cfg.usdt, agentIdRegistry: cfg.agentIdRegistry, factory: cfg.factory, treasury: TREASURY, deployBlock: receipt.blockNumber, deployTx: receipt.hash, config: toJSON(cfg) };
  saveDeployment(network.name, 56, out);
  console.log(JSON.stringify(out, null, 2));
  console.log("\nNext: npm run verify:mainnet, then commit deployments/bsc.json + web/deployments.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
