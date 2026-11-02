const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const E = (n) => ethers.parseEther(String(n));
const TREASURY_IDX = 19;

// Tests use a small target and a 1 USDT price.
async function setup({ target = 25, price = E(1) } = {}) {
  const signers = await ethers.getSigners();
  const [deployer, builder] = signers;
  const usdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
  const reg = await (await ethers.getContractFactory("MockAgentId")).deploy();
  const factory = await (await ethers.getContractFactory("MockFactory")).deploy();
  const Mint = await ethers.getContractFactory("TianmingMint");
  const mint = await Mint.deploy({
    agentIdRegistry: await reg.getAddress(),
    usdt: await usdt.getAddress(),
    factory: await factory.getAddress(),
    name: "Test Agent",
    symbol: "TAG",
    targetShares: target,
    price,
    tokensPerShare: E(50),
    poolTokensPerShare: E(40),
    duration: 30 * 86400,
    treasury: signers[TREASURY_IDX].address,
  });
  const token = await ethers.getContractAt("TianmingToken", await mint.token());
  const users = signers.slice(2, 12);
  for (const u of users) {
    await reg.give(u.address);
    await usdt.mint(u.address, E(1000));
    await usdt.connect(u).approve(await mint.getAddress(), ethers.MaxUint256);
  }
  return { mint, token, usdt, reg, factory, users, deployer, builder, signers };
}

describe("TianmingMint", () => {
  it("mints supply to the mint contract with transfers locked", async () => {
    const { mint, token } = await setup();
    expect(await token.balanceOf(await mint.getAddress())).to.equal(E(25 * 90));
    expect(await token.tradingOpen()).to.equal(false);
  });

  it("rejects wallets without an Agent ID", async () => {
    const { mint, signers } = await setup();
    await expect(mint.connect(signers[15]).mint(1)).to.be.revertedWithCustomError(mint, "NoAgent");
  });

  it("one fixed price: cost = shares x PRICE, no tiers", async () => {
    const { mint, usdt, users } = await setup({ price: E(2) });
    expect(await mint.PRICE()).to.equal(E(2));
    expect(await mint.costOf(5)).to.equal(E(10));
    await mint.connect(users[0]).mint(3);
    expect(await mint.currentPrice()).to.equal(E(2));
    const before = await usdt.balanceOf(users[1].address);
    await mint.connect(users[1]).mint(5);
    expect(before - (await usdt.balanceOf(users[1].address))).to.equal(E(10));
  });

  it("fixed quota of 5 per wallet", async () => {
    const { mint, users } = await setup({ target: 100 });
    await mint.connect(users[0]).mint(3);
    await mint.connect(users[0]).mint(2);
    await expect(mint.connect(users[0]).mint(1)).to.be.revertedWithCustomError(mint, "Quota");
    expect(await mint.quotaOf(users[0].address)).to.equal(5);
  });

  it("max 5 per tx and never exceeds target", async () => {
    const { mint, users } = await setup({ target: 7 });
    await expect(mint.connect(users[0]).mint(6)).to.be.revertedWithCustomError(mint, "BadShares");
    await expect(mint.connect(users[0]).mint(0)).to.be.revertedWithCustomError(mint, "BadShares");
    await mint.connect(users[0]).mint(5);
    await expect(mint.connect(users[1]).mint(3)).to.be.revertedWithCustomError(mint, "SoldOut");
    await mint.connect(users[1]).mint(2);
    expect(await mint.poolOpened()).to.equal(true);
  });

  it("auto pool at target: 95% pool, 5% treasury, LP to DEAD, minter tokens usable", async () => {
    const { mint, token, usdt, users, signers } = await setup({ target: 25 });
    for (let i = 0; i < 4; i++) await mint.connect(users[i]).mint(5);
    await expect(mint.connect(users[4]).mint(5)).to.emit(mint, "PoolOpened");

    // 25 shares × 1 USDT
    const total = E(25);
    const pair = await ethers.getContractAt("MockPair", await mint.pair());
    expect(await usdt.balanceOf(await pair.getAddress())).to.equal(total * 9500n / 10000n);
    expect(await usdt.balanceOf(signers[TREASURY_IDX].address)).to.equal(total * 500n / 10000n);
    expect(await token.balanceOf(await pair.getAddress())).to.equal(E(25 * 40));
    expect(await pair.balanceOf("0x000000000000000000000000000000000000dEaD")).to.be.gt(0n);
    expect(await usdt.balanceOf(await mint.getAddress())).to.equal(0n);
    expect(await token.tradingOpen()).to.equal(true);

    expect(await token.balanceOf(users[0].address)).to.equal(E(250));
    await token.connect(users[0]).transfer(users[5].address, E(1));
    await expect(mint.connect(users[5]).mint(1)).to.be.revertedWithCustomError(mint, "Ended");
  });

  it("mainnet-style config: 2 USDT per share, pool opens at target", async () => {
    const { mint, usdt, users, signers } = await setup({ target: 20, price: E(2) });
    expect(await mint.costOf(5)).to.equal(E(10));
    expect(await mint.currentPrice()).to.equal(E(2));
    await mint.connect(users[0]).mint(5);
    expect(await mint.currentPrice()).to.equal(E(2));
    const o = await mint.overview();
    expect(o.price).to.equal(E(2));
    for (let i = 1; i < 4; i++) await mint.connect(users[i]).mint(5);
    expect(await mint.poolOpened()).to.equal(true);
    expect(await usdt.balanceOf(signers[TREASURY_IDX].address)).to.equal(E(2));
  });

  it("tokens land in wallet on mint, locked until pool opens, then usable immediately", async () => {
    const { mint, token, users } = await setup({ target: 10 });
    await mint.connect(users[0]).mint(4);
    expect(await token.balanceOf(users[0].address)).to.equal(E(200));
    await expect(token.connect(users[0]).transfer(users[1].address, E(1))).to.be.revertedWithCustomError(token, "Locked");
    const st = await mint.walletStatus(users[0].address);
    expect(st.tokens).to.equal(E(200));
    await mint.connect(users[1]).mint(5);
    await mint.connect(users[2]).mint(1);
    expect(await token.tradingOpen()).to.equal(true);
    await token.connect(users[0]).transfer(users[6].address, E(1));
    expect(await token.balanceOf(users[6].address)).to.equal(E(1));
  });

  it("after listing: anyone can buy from the pool, including wallets without an Agent ID", async () => {
    const { mint, token, users, signers } = await setup({ target: 10 });
    await mint.connect(users[0]).mint(5);
    await mint.connect(users[3]).mint(5);
    const pair = await ethers.getContractAt("MockPair", await mint.pair());
    const human = signers[16];
    await pair.swapOut(await token.getAddress(), human.address, E(100));
    expect(await token.balanceOf(human.address)).to.equal(E(98));
    await token.connect(human).transfer(await pair.getAddress(), E(10));
  });

  it("2% buy/sell fee goes entirely to treasury, no burn; wallet transfers 0%", async () => {
    const { mint, token, users, signers } = await setup({ target: 10 });
    await mint.connect(users[0]).mint(5);
    await mint.connect(users[3]).mint(5);
    const pair = await ethers.getContractAt("MockPair", await mint.pair());
    const dev = signers[TREASURY_IDX].address;
    const t0 = await token.balanceOf(dev);
    const supply0 = await token.totalSupply();
    // agent buys 100 tokens
    await pair.swapOut(await token.getAddress(), users[1].address, E(100));
    expect(await token.balanceOf(users[1].address)).to.equal(E(98));
    expect((await token.balanceOf(dev)) - t0).to.equal(E(2));
    expect(await token.totalSupply()).to.equal(supply0);
    // sell 50 tokens
    const pairBefore = await token.balanceOf(await pair.getAddress());
    await token.connect(users[0]).transfer(await pair.getAddress(), E(50));
    expect((await token.balanceOf(await pair.getAddress())) - pairBefore).to.equal(E(49));
    expect((await token.balanceOf(dev)) - t0).to.equal(E(3));
    expect(await token.totalSupply()).to.equal(supply0);
    // wallet-to-wallet transfer, no fee
    await token.connect(users[0]).transfer(users[2].address, E(10));
    expect(await token.balanceOf(users[2].address)).to.equal(E(10));
    expect(await token.FEE_BPS()).to.equal(200n);
  });

  it("USDT donated to the pair before opening cannot block the pool", async () => {
    const { mint, usdt, factory, token, users, signers } = await setup({ target: 10 });
    await factory.createPair(await token.getAddress(), await usdt.getAddress());
    const p = await factory.getPair(await token.getAddress(), await usdt.getAddress());
    await usdt.mint(signers[15].address, E(5));
    await usdt.connect(signers[15]).transfer(p, E(5));
    await (await ethers.getContractAt("MockPair", p)).sync();
    await mint.connect(users[1]).mint(5);
    await expect(mint.connect(users[0]).mint(5)).to.emit(mint, "PoolOpened");
  });

  it("fails by deadline -> 100% refund of the price paid, treasury gets 0", async () => {
    const { mint, usdt, token, users, signers } = await setup({ target: 100 });
    await mint.connect(users[0]).mint(5);
    await mint.connect(users[1]).mint(3); // user0 pays 5, user1 pays 3
    await expect(mint.connect(users[0]).refund()).to.be.revertedWithCustomError(mint, "NotFailed");
    await time.increase(31 * 86400);
    await expect(mint.connect(users[1]).mint(1)).to.be.revertedWithCustomError(mint, "Ended");
    const before = await usdt.balanceOf(users[0].address);
    await mint.connect(users[0]).refund();
    expect((await usdt.balanceOf(users[0].address)) - before).to.equal(E(5));
    const b1 = await usdt.balanceOf(users[1].address);
    await mint.connect(users[1]).refund();
    expect((await usdt.balanceOf(users[1].address)) - b1).to.equal(E(3));
    expect(await usdt.balanceOf(signers[TREASURY_IDX].address)).to.equal(0n);
    await expect(mint.connect(users[0]).refund()).to.be.revertedWithCustomError(mint, "Nothing");
    // tokens from a failed mint stay locked forever (the pool will never open)
    await expect(token.connect(users[0]).transfer(users[1].address, 1n)).to.be.revertedWithCustomError(token, "Locked");
    expect(await token.tradingOpen()).to.equal(false);
  });

});
