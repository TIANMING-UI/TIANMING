// Deploy to BSC testnet (or local hardhat) with a mock Agent ID registry + mock USDT.
//   npm run deploy:testnet          (BSC testnet, needs DEPLOYER_KEY + tBNB)
//   npm run node & npm run deploy:local
const { ethers, network } = require("hardhat");
const { ADDR, testParams } = require("./params");
const { saveDeployment, toJSON } = require("./lib");

async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();
  console.log(`Network ${network.name} (${chainId}) · deployer ${deployer.address}`);

  const agentId = await (await ethers.getContractFactory("MockAgentId")).deploy();
  await agentId.waitForDeployment();
  const usdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
  await usdt.waitForDeployment();

  let factory = ADDR[Number(chainId)]?.factory;
  if (!factory) {
    const f = await (await ethers.getContractFactory("MockFactory")).deploy();
    await f.waitForDeployment();
    factory = await f.getAddress();
  }

  const treasury = process.env.TREASURY || deployer.address;
  const cfg = { agentIdRegistry: await agentId.getAddress(), usdt: await usdt.getAddress(), factory, treasury, ...testParams() };

  const mint = await (await ethers.getContractFactory("TianmingMint")).deploy(cfg);
  const receipt = await (await mint.deploymentTransaction()).wait();
  const token = await mint.token();

  // Give the deployer an Agent ID + 1,000 test USDT right away so it can try things out.
  await (await agentId.give(deployer.address)).wait();
  await (await usdt.mint(deployer.address, ethers.parseEther("1000"))).wait();

  const out = { mint: await mint.getAddress(), token, usdt: cfg.usdt, agentIdRegistry: cfg.agentIdRegistry, factory, treasury, deployBlock: receipt.blockNumber, config: toJSON(cfg) };
  saveDeployment(network.name, Number(chainId), out);
  console.log(JSON.stringify(out, null, 2));
  console.log("\nAdd another wallet: ADDR=0x... npm run grant:testnet");
}

main().catch((e) => { console.error(e); process.exit(1); });
