// Audit PoC: the three launch guarantees, with mainnet-shaped parameters
// (scheduled open, 2-day refund window, 2 USDT per share, 5 per wallet).
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const E = (n) => ethers.parseEther(String(n));
const TWO_DAYS = 2 * 86400;

async function deploy({ target = 100, openIn = 3600 } = {}) {
  const signers = await ethers.getSigners();
  const treasury = signers[19];
  const usdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
  const reg = await (await ethers.getContractFactory("MockAgentId")).deploy();
  const factory = await (await ethers.getContractFactory("MockFactory")).deploy();
  const openAt = (await time.latest()) + openIn;
  const mint = await (await ethers.getContractFactory("TianmingMint")).deploy({
    agentIdRegistry: await reg.getAddress(),
    usdt: await usdt.getAddress(),
    factory: await factory.getAddress(),
    name: "Tianming", symbol: "MING",
    targetShares: target, price: E(2),
    tokensPerShare: E(16_000_000), poolTokensPerShare: E(4_000_000),
    openAt, duration: TWO_DAYS,
    treasury: treasury.address,
  });
  const token = await ethers.getContractAt("TianmingToken", await mint.token());
  const agents = signers.slice(2, 6);   // hold a .ai Agent ID
  const humans = signers.slice(10, 13); // no Agent ID, but have USDT + approval
  for (const a of agents) await reg.give(a.address);
  for (const w of [...agents, ...humans]) {
    await usdt.mint(w.address, E(100));
    await usdt.connect(w).approve(await mint.getAddress(), ethers.MaxUint256);
  }
  return { mint, token, usdt, reg, agents, humans, treasury, openAt };
}

describe("Audit: launch guarantees", () => {
  it("1. only .ai Agent ID holders can mint (before and after open)", async () => {
    const { mint, agents, humans, openAt } = await deploy();
    // before open: nobody can mint, holder or not
    await expect(mint.connect(agents[0]).mint(1)).to.be.revertedWithCustomError(mint, "NotOpen");
    await expect(mint.connect(humans[0]).mint(1)).to.be.revertedWithCustomError(mint, "NotOpen");
    await time.increaseTo(openAt);
    // after open: a funded, approved wallet without an Agent ID is still rejected
    await expect(mint.connect(humans[0]).mint(1)).to.be.revertedWithCustomError(mint, "NoAgent");
    await expect(mint.connect(humans[1]).mint(5)).to.be.revertedWithCustomError(mint, "NoAgent");
    expect((await mint.walletStatus(humans[0].address)).eligible).to.equal(false);
    // holder mints fine, within the 5-share quota
    await mint.connect(agents[0]).mint(5);
    expect((await mint.walletStatus(agents[0].address)).eligible).to.equal(true);
    await expect(mint.connect(agents[0]).mint(1)).to.be.revertedWithCustomError(mint, "Quota");
    expect(await mint.totalMinted()).to.equal(5);
  });

  it("2. refund: 100% USDT back once 2 days pass without hitting target; nothing to treasury", async () => {
    const { mint, usdt, agents, treasury, openAt } = await deploy({ target: 100 });
    expect(await mint.DEADLINE()).to.equal(openAt + TWO_DAYS);
    await time.increaseTo(openAt);
    await mint.connect(agents[0]).mint(5); // 10 USDT
    await mint.connect(agents[1]).mint(3); // 6 USDT
    const a0Before = await usdt.balanceOf(agents[0].address);
    const a1Before = await usdt.balanceOf(agents[1].address);

    // one second before the deadline: still live, refund not available
    await time.increaseTo(openAt + TWO_DAYS - 1);
    expect(await mint.failed()).to.equal(false);
    await expect(mint.connect(agents[0]).refund()).to.be.revertedWithCustomError(mint, "NotFailed");

    // deadline passed, target missed: mint closed, refund open
    await time.increaseTo(openAt + TWO_DAYS + 1);
    expect(await mint.failed()).to.equal(true);
    await expect(mint.connect(agents[2]).mint(1)).to.be.revertedWithCustomError(mint, "Ended");
    expect((await mint.walletStatus(agents[0].address)).refundable).to.equal(E(10));

    await mint.connect(agents[0]).refund();
    await mint.connect(agents[1]).refund();
    expect((await usdt.balanceOf(agents[0].address)) - a0Before).to.equal(E(10));
    expect((await usdt.balanceOf(agents[1].address)) - a1Before).to.equal(E(6));
    expect(await usdt.balanceOf(treasury.address)).to.equal(0);
    expect(await usdt.balanceOf(await mint.getAddress())).to.equal(0); // nothing left stuck
    expect(await mint.parkedUsdt()).to.equal(0);
  });

  it("3. refund only for wallets that minted; no double refund", async () => {
    const { mint, agents, humans, openAt } = await deploy({ target: 100 });
    await time.increaseTo(openAt);
    await mint.connect(agents[0]).mint(2);
    await time.increaseTo(openAt + TWO_DAYS + 1);
    expect(await mint.failed()).to.equal(true);
    // never minted (with or without Agent ID): nothing to refund
    await expect(mint.connect(humans[0]).refund()).to.be.revertedWithCustomError(mint, "Nothing");
    await expect(mint.connect(agents[1]).refund()).to.be.revertedWithCustomError(mint, "Nothing");
    expect((await mint.walletStatus(humans[0].address)).refundable).to.equal(0);
    // minter refunds once, then nothing
    await mint.connect(agents[0]).refund();
    await expect(mint.connect(agents[0]).refund()).to.be.revertedWithCustomError(mint, "Nothing");
  });

  it("4. no refund once the pool opened (target reached), even after 2 days", async () => {
    const { mint, agents, openAt } = await deploy({ target: 10 });
    await time.increaseTo(openAt);
    await mint.connect(agents[0]).mint(5);
    await mint.connect(agents[1]).mint(5); // hits target -> pool opens
    expect(await mint.poolOpened()).to.equal(true);
    await time.increaseTo(openAt + TWO_DAYS + 10);
    expect(await mint.failed()).to.equal(false);
    await expect(mint.connect(agents[0]).refund()).to.be.revertedWithCustomError(mint, "NotFailed");
    await expect(mint.connect(agents[2]).mint(1)).to.be.revertedWithCustomError(mint, "Ended");
  });

  it("5. $MING only reaches minters, at mint time; there is no claim/owner/pause/withdraw", async () => {
    const { mint, token, agents, humans, openAt } = await deploy({ target: 100 });
    await time.increaseTo(openAt);
    await mint.connect(agents[0]).mint(3);
    expect(await token.balanceOf(agents[0].address)).to.equal(E(3 * 16_000_000));
    expect(await token.balanceOf(humans[0].address)).to.equal(0);
    expect(await token.balanceOf(agents[1].address)).to.equal(0);
    // locked until the pool opens (and forever if it never does)
    await expect(token.connect(agents[0]).transfer(humans[0].address, 1)).to.be.revertedWithCustomError(token, "Locked");
    await time.increaseTo(openAt + TWO_DAYS + 1);
    await expect(token.connect(agents[0]).transfer(humans[0].address, 1)).to.be.revertedWithCustomError(token, "Locked");
    // no privileged or extra entry points in the ABI
    const names = mint.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
    for (const bad of ["claim", "owner", "pause", "unpause", "withdraw", "rescue", "setTreasury", "setPrice", "transferOwnership"]) {
      expect(names, bad).to.not.include(bad);
    }
    const tnames = token.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
    for (const bad of ["owner", "pause", "mint", "burnFrom", "setFee", "setPair", "blacklist", "transferOwnership"]) {
      expect(tnames, bad).to.not.include(bad);
    }
  });
});
