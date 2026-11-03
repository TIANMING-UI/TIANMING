const { ethers } = require("hardhat"); const fs = require("fs"); const E = (n) => ethers.parseEther(String(n));
(async () => {
  const [d, t, a1] = await ethers.getSigners();
  const u = await (await ethers.getContractFactory("MockUSDT")).deploy();
  const r = await (await ethers.getContractFactory("MockAgentId")).deploy();
  const f = await (await ethers.getContractFactory("MockFactory")).deploy();
  const now = (await ethers.provider.getBlock("latest")).timestamp;
  const m = await (await ethers.getContractFactory("TianmingMint")).deploy({ agentIdRegistry: await r.getAddress(), usdt: await u.getAddress(), factory: await f.getAddress(), name: "Tianming", symbol: "MING", targetShares: 5000, price: E(2), tokensPerShare: E(16000000), poolTokensPerShare: E(4000000), openAt: now, duration: 2 * 86400, treasury: t.address });
  const rc = await (await m.deploymentTransaction()).wait();
  await r.give(a1.address); await u.mint(a1.address, E(100)); await u.connect(a1).approve(await m.getAddress(), ethers.MaxUint256);
  await (await m.connect(a1).mint(3)).wait();
  fs.writeFileSync("web/deployments.local.json", JSON.stringify({ "31337": { network: "localhost", mint: await m.getAddress(), token: await m.token(), usdt: await u.getAddress(), treasury: t.address, agentIdRegistry: await r.getAddress(), deployBlock: rc.blockNumber } }, null, 2));
  console.log("local live: minted", await m.totalMinted());
})().catch((e) => { console.error(e); process.exit(1); });
