// Fork-mainnet rehearsal against the DEPLOYED contracts. Run: FORK_URL=<bsc rpc> npx hardhat run scripts/prelaunch-sim.js
const { ethers, network } = require("hardhat");
const MINT = "0xE26a505CE2Ec77140D30f7b4684b31fbB5812f2b";
const HOLDER = "0xA7cc8Bb1f76FE6D33d58744eEb7EE274526a1688"; // EOA holding a .ai Agent ID (from the registry probe)
const say = (...a) => console.log("SIM:", ...a);
async function main() {
  await network.provider.send("hardhat_mine", ["0x1"]); // execute on a fresh block, not the fork block
  const mint = await ethers.getContractAt("TianmingMint", MINT);
  const token = await ethers.getContractAt("TianmingToken", await mint.token());
  const usdtAddr = await mint.usdt();
  const usdt = await ethers.getContractAt("IERC20", usdtAddr);
  const reg = new ethers.Contract(await mint.agentId(), ["function balanceOf(address) view returns (uint256)"], ethers.provider);
  const now = (await ethers.provider.getBlock("latest")).timestamp;
  const openAt = Number(await mint.OPEN_AT()), deadline = Number(await mint.DEADLINE());
  say("block time", new Date(now * 1000).toISOString(), "| OPEN_AT", new Date(openAt * 1000).toISOString(), "| DEADLINE", new Date(deadline * 1000).toISOString());
  say("price", ethers.formatEther(await mint.PRICE()), "USDT | target", (await mint.TARGET_SHARES()).toString(), "| minted", (await mint.totalMinted()).toString(), "| poolOpened", await mint.poolOpened());
  say("token supply", ethers.formatEther(await token.totalSupply()), "| held by mint", ethers.formatEther(await token.balanceOf(MINT)), "| tradingOpen", await token.tradingOpen());
  say("usdt", usdtAddr, "| treasury", await mint.treasury());
  say("holder has Agent ID:", (await reg.balanceOf(HOLDER)) > 0n);

  // fund holder with 20 USDT by writing the balance slot (BEP20 _balances at slot 1), then verify
  const slot = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [HOLDER, 1]));
  await network.provider.send("hardhat_setStorageAt", [usdtAddr, slot, ethers.toBeHex(ethers.parseEther("20"), 32)]);
  say("holder USDT", ethers.formatEther(await usdt.balanceOf(HOLDER)));
  await network.provider.request({ method: "hardhat_impersonateAccount", params: [HOLDER] });
  await network.provider.send("hardhat_setBalance", [HOLDER, "0x56BC75E2D63100000"]);
  const h = await ethers.getSigner(HOLDER);
  await (await usdt.connect(h).approve(MINT, ethers.parseEther("10"))).wait();

  const tryMint = async (signer, n) => { try { await mint.connect(signer).mint.staticCall(n); return "ok"; } catch (e) { return (e.revert && e.revert.name) || e.shortMessage || e.message.slice(0, 80); } };
  if (now < openAt) say("mint BEFORE open ->", await tryMint(h, 5), "(expected NotOpen)");
  await network.provider.send("evm_setNextBlockTimestamp", [Math.max(openAt, now + 1)]);
  await network.provider.send("evm_mine", []);
  const rnd = ethers.Wallet.createRandom().connect(ethers.provider);
  await network.provider.send("hardhat_setBalance", [rnd.address, "0x56BC75E2D63100000"]);
  say("mint AFTER open, no Agent ID ->", await tryMint(rnd, 1), "(expected NoAgent)");
  const rc = await (await mint.connect(h).mint(5)).wait();
  say("mint 5 AFTER open, Agent ID holder -> ok, gas", rc.gasUsed.toString());
  say("holder $MING", ethers.formatEther(await token.balanceOf(HOLDER)), "| USDT left", ethers.formatEther(await usdt.balanceOf(HOLDER)), "| minted", (await mint.totalMinted()).toString());
  let locked; try { await token.connect(h).transfer.staticCall(rnd.address, 1n); locked = "NOT locked"; } catch (e) { locked = "locked (" + ((e.revert && e.revert.name) || "revert") + ")"; }
  say("token transfer before listing:", locked);
  say("6th share for same wallet ->", await tryMint(h, 1), "(expected Quota)");
  say("RESULT: OK");
}
main().catch((e) => { console.error("SIM FAILED:", e); process.exit(1); });
