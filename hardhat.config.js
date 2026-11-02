require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

// Use solc from npm (no compiler download needed during build / CI).
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  if (args.solcVersion === "0.8.24") {
    return { compilerPath: require.resolve("solc/soljson.js"), isSolcJs: true, version: "0.8.24", longVersion: require("solc").version() };
  }
  return runSuper();
});

const accounts = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [];

module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" } },
  networks: {
    // Mainnet fork test: FORK_URL=<rpc bsc> npx hardhat test test-fork/fork.test.js
    hardhat: process.env.FORK_URL
      ? { chainId: 56, forking: { url: process.env.FORK_URL }, hardfork: "cancun", chains: { 56: { hardforkHistory: { berlin: 0, london: 0, arrowGlacier: 0, grayGlacier: 0, merge: 0, shanghai: 0, cancun: 0 } } } }
      : {},
    bsc: { url: process.env.BSC_RPC || "https://bsc-dataseed.bnbchain.org", chainId: 56, accounts },
    bscTestnet: { url: process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.bnbchain.org:8545", chainId: 97, accounts },
  },
  etherscan: { apiKey: process.env.BSCSCAN_API_KEY || "" },
  sourcify: { enabled: true },
};
