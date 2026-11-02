// Tianming parameters. All values are IMMUTABLE after deploy (no owner).
const { ethers } = require("hardhat");
const E = (n) => ethers.parseEther(String(n));

const ADDR = {
  56: {
    agentIdRegistry: "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F", // SPACE ID .ai Agent ID
    usdt: "0x55d398326f99059fF775485246999027B3197955",            // USDT BEP-20 (18 decimals)
    factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",         // PancakeSwap V2 factory
  },
  97: {
    factory: "0x6725F303b657a9451d8BA641348b6761A6CC7a17",         // PancakeSwap V2 factory (testnet)
  },
};

// Mainnet: 5,000 shares, fixed price 2 USDT, supply 100B (80% minters, 20% pool, 0% team).
function mainnetParams() {
  return {
    name: "Tianming",
    symbol: "MING",
    targetShares: 5000,
    basePrice: E(2),
    stepPrice: 0n,
    stepShares: 5000, // single tier: same price for every share
    tokensPerShare: E(16_000_000),
    poolTokensPerShare: E(4_000_000),
    duration: 10 * 86400,
  };
}

// Testnet/local: small target so the full flow can be tested solo.
function testParams() {
  const target = Number(process.env.TARGET || 10);
  return {
    ...mainnetParams(),
    name: "Tianming Test",
    symbol: "tMING",
    targetShares: target,
    stepShares: Math.max(1, Math.floor(target / 2)),
    duration: Number(process.env.DURATION || 3 * 86400),
  };
}

module.exports = { ADDR, mainnetParams, testParams, E };
