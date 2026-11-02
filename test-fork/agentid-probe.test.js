// Probe: can a .ai Agent ID (SPACE ID registry) be moved between wallets? Reports only, never fails.
// FORK_URL=... npx hardhat test test-fork/agentid-probe.test.js
const { ethers, network } = require("hardhat");
const REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const TRANSFER = ethers.id("Transfer(address,address,uint256)");
const ABI = [
  "function balanceOf(address) view returns (uint256)", "function ownerOf(uint256) view returns (address)",
  "function supportsInterface(bytes4) view returns (bool)", "function transferFrom(address,address,uint256)",
  "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)", "function name() view returns (string)",
];
const say = (...a) => console.log("PROBE:", ...a);
const tryCall = async (f) => { try { return await f(); } catch (e) { return "ERR " + (e.shortMessage || e.message).slice(0, 120); } };
const getLogs = async (q) => { for (let i = 0; ; i++) { try { return await ethers.provider.getLogs(q); } catch (e) { if (i >= 5) throw e; await new Promise(r => setTimeout(r, 3000 * (i + 1))); } } };

describe("Agent ID probe", function () {
  this.timeout(600000);
  it("reports registry properties", async function () {
    if (!process.env.FORK_URL) this.skip();
    await network.provider.send("hardhat_mine", ["0x1"]);
    const reg = new ethers.Contract(REGISTRY, ABI, ethers.provider);
    say("name", await tryCall(() => reg.name()));
    const impl = await ethers.provider.getStorage(REGISTRY, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");
    say("EIP-1967 implementation slot", impl);
    say("ERC721", await tryCall(() => reg.supportsInterface("0x80ac58cd")));
    say("ERC721Enumerable", await tryCall(() => reg.supportsInterface("0x780e9d63")));
    const latest = await ethers.provider.getBlockNumber();
    let found = null;
    for (let to = latest; to > latest - 300000 && !found; to -= 2000) {
      const logs = await getLogs({ address: REGISTRY, topics: [TRANSFER], fromBlock: to - 1999, toBlock: to });
      for (const l of logs.reverse()) {
        if (l.topics.length !== 4) continue;
        const holder = ethers.getAddress("0x" + l.topics[2].slice(26)), id = BigInt(l.topics[3]);
        if (holder === ethers.ZeroAddress) continue;
        const own = await tryCall(() => reg.ownerOf(id));
        if (own === holder && (await ethers.provider.getCode(holder)) === "0x") { found = { holder, id }; break; }
      }
    }
    if (!found) return say("no EOA holder found");
    say("holder", found.holder, "tokenId", found.id.toString());
    say("tokenOfOwnerByIndex", await tryCall(() => reg.tokenOfOwnerByIndex(found.holder, 0)));
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [found.holder] });
    await network.provider.request({ method: "hardhat_setBalance", params: [found.holder, "0x56BC75E2D63100000"] });
    const s = await ethers.getSigner(found.holder);
    const other = ethers.Wallet.createRandom().address;
    const res = await tryCall(async () => { await (await reg.connect(s).transferFrom(found.holder, other, found.id)).wait(); return "ok"; });
    say("transferFrom", res);
    say("after: holder balance", (await reg.balanceOf(found.holder)).toString(), "other balance", (await reg.balanceOf(other)).toString());
    say("TRANSFERABLE =", res === "ok" && (await reg.balanceOf(other)) > 0n ? "YES" : "NO");
  });
});
