// Tests against the REAL BSC mainnet contracts (fork): .ai Agent ID registry, USDT, PancakeSwap V2.
// Run: FORK_URL=https://bsc-rpc.publicnode.com npx hardhat test test-fork/fork.test.js
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const DEAD = "0x000000000000000000000000000000000000dEaD";
const E = (n) => ethers.parseEther(String(n));

const ERC20 = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)", "function transfer(address,uint256) returns (bool)", "function totalSupply() view returns (uint256)"];
const ROUTER_ABI = [
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)",
  "function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])",
];
const PAIR = ["function getReserves() view returns (uint112,uint112,uint32)", "function balanceOf(address) view returns (uint256)", "function token0() view returns (address)"];

async function impersonate(addr) {
  await network.provider.request({ method: "hardhat_impersonateAccount", params: [addr] });
  await network.provider.request({ method: "hardhat_setBalance", params: [addr, "0x56BC75E2D63100000"] }); // 100 BNB for gas
  return ethers.getSigner(addr);
}

// Fund USDT balance via storage (searches for the balances mapping slot).
async function giveUsdt(to, amount) {
  const usdt = new ethers.Contract(USDT, ERC20, ethers.provider);
  for (let slot = 0; slot < 10; slot++) {
    const key = ethers.solidityPackedKeccak256(["uint256", "uint256"], [to, slot]);
    const prev = await network.provider.request({ method: "eth_getStorageAt", params: [USDT, key, "latest"] });
    await network.provider.request({ method: "hardhat_setStorageAt", params: [USDT, key, ethers.toBeHex(amount, 32)] });
    if ((await usdt.balanceOf(to)) === amount) return;
    await network.provider.request({ method: "hardhat_setStorageAt", params: [USDT, key, prev] });
  }
  throw new Error("USDT balance slot not found");
}

// Find real .ai Agent ID holders from registry logs.
async function findAgents(n) {
  const reg = new ethers.Contract(REGISTRY, ["function balanceOf(address) view returns (uint256)"], ethers.provider);
  const latest = await ethers.provider.getBlockNumber();
  const found = new Set();
  // Public RPCs sometimes return 500/503 on getLogs: retry with backoff, small block ranges.
  const getLogs = async (fromBlock, toBlock) => {
    for (let i = 0; ; i++) {
      try { return await ethers.provider.getLogs({ address: REGISTRY, fromBlock, toBlock }); }
      catch (e) { if (i >= 5) throw e; await new Promise((r) => setTimeout(r, 3000 * (i + 1))); }
    }
  };
  for (let to = latest; to > latest - 200000 && found.size < n; to -= 2000) {
    const logs = await getLogs(to - 1999, to);
    for (const l of logs.reverse()) {
      for (const t of l.topics.slice(1)) {
        if (!t.startsWith("0x000000000000000000000000")) continue;
        const a = ethers.getAddress("0x" + t.slice(26));
        if (a === ethers.ZeroAddress || found.has(a)) continue;
        const code = await ethers.provider.getCode(a);
        if (code === "0x" && (await reg.balanceOf(a)) > 0n) found.add(a);
        if (found.size >= n) break;
      }
      if (found.size >= n) break;
    }
  }
  if (found.size < n) throw new Error(`only found ${found.size} Agent ID holders`);
  return [...found];
}

describe("Tianming on a BSC mainnet fork", function () {
  this.timeout(600000);
  let mint, token, usdt, router, pair, agents, human, treasury;

  before(async () => {
    if (!process.env.FORK_URL) this.skip();
    // Mine 1 block so execution runs on a local block (not the historical fork block).
    await network.provider.send("hardhat_mine", ["0x1"]);
    const [agentA, agentB] = await findAgents(2);
    agents = [await impersonate(agentA), await impersonate(agentB)];
    human = (await ethers.getSigners())[5];
    treasury = ethers.Wallet.createRandom().address;
    const reg = new ethers.Contract(REGISTRY, ["function balanceOf(address) view returns (uint256)"], ethers.provider);
    expect(await reg.balanceOf(human.address)).to.equal(0n);

    mint = await (await ethers.getContractFactory("TianmingMint")).deploy({
      agentIdRegistry: REGISTRY, usdt: USDT, factory: FACTORY,
      name: "Tianming", symbol: "MING",
      targetShares: 4, price: E(2),
      tokensPerShare: E(16_000_000), poolTokensPerShare: E(4_000_000), duration: 86400,
      treasury,
    });
    token = await ethers.getContractAt("TianmingToken", await mint.token());
    usdt = new ethers.Contract(USDT, ERC20, ethers.provider);
    router = new ethers.Contract(ROUTER, ROUTER_ABI, ethers.provider);
    for (const s of [...agents, human]) await giveUsdt(s.address, E(1000));
  });

  it("wallet without an Agent ID is rejected on mint", async () => {
    await expect(mint.connect(human).mint(1)).to.be.revertedWithCustomError(mint, "NoAgent");
  });

  it("real agent mints to target → real PancakeSwap pool created, LP burned", async () => {
    const a = agents[0];
    await usdt.connect(a).approve(await mint.getAddress(), ethers.MaxUint256);
    expect(await mint.costOf(4)).to.equal(E(8));
    await expect(mint.connect(a).mint(4)).to.emit(mint, "PoolOpened");
    pair = new ethers.Contract(await mint.pair(), PAIR, ethers.provider);
    expect(await pair.balanceOf(DEAD)).to.be.gt(0n);
    expect(await usdt.balanceOf(treasury)).to.equal(E(8) * 500n / 10000n);
    expect(await usdt.balanceOf(await mint.getAddress())).to.equal(0n);
    expect(await token.balanceOf(a.address)).to.equal(E(64_000_000));
  });

  it("agent can buy via the real PancakeSwap router, paying 2% fee to treasury", async () => {
    const b = agents[1];
    await usdt.connect(b).approve(ROUTER, ethers.MaxUint256);
    const supply0 = await token.totalSupply(), tr0 = await token.balanceOf(treasury);
    const dl = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await router.connect(b).swapExactTokensForTokensSupportingFeeOnTransferTokens(E(1), 0, [USDT, await token.getAddress()], b.address, dl);
    const got = await token.balanceOf(b.address);
    expect(got).to.be.gt(0n);
    const fee = (await token.balanceOf(treasury)) - tr0;
    expect(await token.totalSupply()).to.equal(supply0);
    expect(fee).to.be.gt(0n);
    expect(got * 100n / (got + fee)).to.equal(98n);
  });

  it("regular (non-supporting) swap also works for agent buys", async () => {
    const b = agents[1];
    const before = await token.balanceOf(b.address);
    const dl = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await router.connect(b).swapExactTokensForTokens(E(1), 0, [USDT, await token.getAddress()], b.address, dl);
    expect(await token.balanceOf(b.address)).to.be.gt(before);
  });

  it("after listing, wallets without an Agent ID can also buy from the pool", async () => {
    await usdt.connect(human).approve(ROUTER, ethers.MaxUint256);
    const dl = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await router.connect(human).swapExactTokensForTokensSupportingFeeOnTransferTokens(E(1), 0, [USDT, await token.getAddress()], human.address, dl);
    expect(await token.balanceOf(human.address)).to.be.gt(0n);
  });

  it("agent can sell via the router (fee-on-transfer function)", async () => {
    const a = agents[0];
    await token.connect(a).approve(ROUTER, ethers.MaxUint256);
    const u0 = await usdt.balanceOf(a.address);
    const dl = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await router.connect(a).swapExactTokensForTokensSupportingFeeOnTransferTokens(E(1_000_000), 0, [await token.getAddress(), USDT], a.address, dl);
    expect(await usdt.balanceOf(a.address)).to.be.gt(u0);
  });

  it("wallet without an Agent ID can sell", async () => {
    await token.connect(agents[0]).transfer(human.address, E(1_000_000));
    await token.connect(human).approve(ROUTER, ethers.MaxUint256);
    const u0 = await usdt.balanceOf(human.address);
    const dl = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await router.connect(human).swapExactTokensForTokensSupportingFeeOnTransferTokens(E(500_000), 0, [await token.getAddress(), USDT], human.address, dl);
    expect(await usdt.balanceOf(human.address)).to.be.gt(u0);
  });
});
