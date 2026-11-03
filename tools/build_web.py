# Build web/index.html (the real dApp) from the demo: live mode when web/deployments.json has an address for the active chain.
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src).read()
def r(a, b, n=1):
    global s
    assert a in s, "MISSING: " + a[:90]
    s = s.replace(a, b) if n == 0 else s.replace(a, b, n)

r("const TARGET = 5000, STEP = 5000, BASE = 2, INC = 0, TPS = 16000000, POOL_TPS = 4000000, QUOTA = 5, FEE = 0.01;",
  "let TARGET = 5000, STEP = 5000, BASE = 2, INC = 0, TPS = 16000000, POOL_TPS = 4000000, QUOTA = 5;\nconst FEE = 0.01;")
r("const DEADLINE = Date.now()", "let DEADLINE = Date.now()")
r('const SITE = "https://tianming.xyz"; // official site', 'let SITE = "https://tianming.xyz"; // replaced with the page origin when live')
r("const MINT_ADDR = null;              // set after deploy", "let MINT_ADDR = null;                // loaded from deployments.json")
r('<script>', '<script src="vendor/ethers-6.17.0.umd.min.js"></script>\n<script>')

r('<small style="font-size:14px;color:var(--dim)"> / 5,000</small>', '<small style="font-size:14px;color:var(--dim)" id="targetLbl"> / 5,000</small>')
r('<div class="tick" style="left:50%"><span data-i="tick1"></span></div>', '<div class="tick" id="tickMid" style="left:50%"><span id="tick1" data-i="tick1"></span></div>')
r('<span id="tick1" data-i="tick1"></span></div>\n            <div class="tick end" style="right:0;left:auto"><span data-i="tick2"></span></div>',
  '<span id="tick1" data-i="tick1"></span></div>\n            <div class="tick end" style="right:0;left:auto"><span id="tick2" data-i="tick2"></span></div>')
r('<div class="row"><span data-i="rWallet"></span><span class="mono">you.ai · 0x7a3f…c91e</span></div>', '<div class="row"><span data-i="rWallet"></span><span class="mono" id="walletRow">you.ai · 0x7a3f…c91e</span></div>')
r('$("passHandle").textContent = S.wallet ? "you.ai" : "—.ai";', '$("passHandle").textContent = S.wallet ? (S.handle || "you.ai") : "—";')
r('    $("btnMint").disabled = S.paid >= QUOTA;', '    $("btnMint").disabled = S.paid >= QUOTA || (LIVE && !S.eligible) || busy;')
r('b.textContent = t({ live: "sLive", pool: "sPool", fail: "sFail" }[S.phase]);', 'b.textContent = t({ live: "sLive", pool: "sPool", fail: "sFail", soon: "sSoon", preopen: "sOpen" }[S.phase]);')
r('$("phaseTxt").textContent = S.phase === "live" ? t("live1", { b: nf(TARGET - S.minted) }) : t(S.phase === "pool" ? "phPool" : "phFail");',
  '$("phaseTxt").textContent = (S.phase === "soon" || S.phase === "preopen") ? "" : S.phase === "live" ? t("live1", { b: nf(TARGET - S.minted) }) : t(S.phase === "pool" ? "phPool" : "phFail");')
r('$("nextTier").textContent = S.phase !== "live" ? ""', '$("nextTier").textContent = S.phase !== "live" ? (S.phase === "soon" ? t("sSoon") : S.phase === "preopen" ? t("sOpen") : "")')
r(".state.fail{", ".state.soon{color:var(--dim)}\n.state.preopen{color:var(--gold)}\n.state.fail{")
r("function tickCount() {", "function tickCount() {\n  if (!DEADLINE) { [\"d\",\"h\",\"m\",\"s\"].forEach(k => { const el = $(\"c\" + k); if (el) el.textContent = \"--\"; }); return; }")
r("  let s = Math.max(0, Math.floor((DEADLINE - Date.now()) / 1000));",
  '''  const _tgt = (OPENS && Date.now() < OPENS) ? OPENS : DEADLINE;
  if (OPENS) { const _lab = document.querySelector('[data-i="endsIn"]'); if (_lab) _lab.textContent = (Date.now() < OPENS) ? t("opensIn") : t("endsIn"); const _o = document.getElementById("openAtLine"); if (_o) _o.hidden = !(Date.now() < OPENS); }
  let s = Math.max(0, Math.floor((_tgt - Date.now()) / 1000));''')
r('  $("lb").innerHTML = "";', '  $("lb").innerHTML = rows.length ? "" : `<li><span class="r">—</span><span class="h">${t("noMints")}</span><span></span></li>`;')

# extra i18n
r('  pPend:"MINT_ADDRESS (published at deploy)"\n},', '''  pPend:"MINT_ADDRESS (published at deploy)",
  mNoWallet:"Binance Wallet not found. Scan the QR code with the Binance Wallet app, or open this page inside it.", mWrongNet:"Switch your wallet to {n} first.",
  mNoUsdt:"Not enough USDT in this wallet.", mConfirm:"Confirm the mint in your wallet…", mErr:"Transaction failed: {e}", mPending:"Waiting for the block…",
  qrSoon:"Agent Wallet QR sign-in opens soon. For now, mint through your agent with the prompt below, or use a regular wallet.",
  pickLive:"Your .ai Agent ID lives in your Agentic Wallet, so you mint through your own agent. Copy the prompt and paste it into your agent.",
  sSoon:"Not live yet", sOpen:"Opens soon", opensIn:"Mint opens in", phSoon:"The mint contract is not deployed yet. The contract address will be published here and on X at launch.", mSoon:"Minting has not started. The contract address will be published here at launch.", noMints:"No mints yet", endsSoon:"Mint opens soon",
  footLive:"Independent project, not affiliated with Binance. Not an investment offer. Always check the contract address before you mint.", recent:"recent",
  qrIntro:"Scan with the Binance Wallet app that holds your .ai Agent ID. Wallets without an Agent ID are rejected.",
  qrHint:"Open Binance Wallet, tap the scanner, scan this QR code and approve the connection.", qrOpen:"Open in Binance Wallet", qrRegular:"Connect Binance Wallet in this browser", qrSave:"On this phone? Save the QR image, then scan it from your gallery in Binance Wallet",
  qrNote:"Only wallets that hold a .ai Agent ID can connect. The check runs on-chain.",
  qrSoon:"QR connect opens at launch. Until then, let your agent mint with the prompt below.",
  qrWaiting:"Waiting for approval in your wallet…", qrStarting:"Preparing QR…",
  mAgentOnly:"This wallet has no .ai Agent ID, so it was disconnected. Only Agentic Wallets can connect.", mQrTestOk:"QR test passed: {a} is connected and holds a .ai Agent ID.", mChecking:"Checking Agent ID on-chain…"
},''')
r('  pPend:"MINT_ADDRESS（部署时公布）"\n}};', '''  pPend:"MINT_ADDRESS（部署时公布）",
  mNoWallet:"未找到币安钱包。请用币安钱包 App 扫码，或在其中打开本页。", mWrongNet:"请先把钱包切换到 {n}。",
  mNoUsdt:"该钱包 USDT 余额不足。", mConfirm:"请在钱包中确认铸造……", mErr:"交易失败：{e}", mPending:"等待区块确认……",
  qrSoon:"Agent Wallet 扫码登录即将开放。现在可以用下方提示词让你的 Agent 铸造，或使用普通钱包。",
  pickLive:"你的 .ai Agent ID 存放在 Agentic Wallet 中，因此通过你自己的 Agent 铸造。复制下方提示词并粘贴给你的 Agent。",
  sSoon:"尚未开始", sOpen:"即将开放", opensIn:"铸造开始倒计时", phSoon:"铸造合约尚未部署。上线时会在此处和 X 上公布合约地址。", mSoon:"铸造尚未开始。上线时会在此公布合约地址。", noMints:"暂无铸造", endsSoon:"即将开放铸造",
  footLive:"独立项目，与币安无关。不构成投资要约。铸造前请务必核对合约地址。", recent:"最近",
  qrIntro:"用持有 .ai Agent ID 的币安钱包 App 扫码。没有 Agent ID 的钱包会被拒绝。",
  qrHint:"打开币安钱包，点击扫一扫，扫描此二维码并批准连接。", qrOpen:"在币安钱包中打开", qrRegular:"在此浏览器中连接币安钱包", qrSave:"在同一部手机上？保存二维码图片，再在币安钱包扫一扫中从相册选取",
  qrNote:"只有持有 .ai Agent ID 的钱包可以连接，检查在链上完成。",
  qrSoon:"扫码连接将在上线时开放。在此之前，可用下方提示词让 Agent 铸造。",
  qrWaiting:"等待你在钱包中批准……", qrStarting:"正在生成二维码……",
  mAgentOnly:"该钱包没有 .ai Agent ID，已断开连接。只有 Agentic Wallet 可以连接。", mQrTestOk:"扫码测试通过：{a} 已连接并持有 .ai Agent ID。", mChecking:"正在链上检查 Agent ID……"
}};''')

LIVE_JS = r'''
// ================= LIVE MODE (real contracts) =================
const NETS = {
  56: { name: "BNB Smart Chain", rpc: "https://bsc-dataseed.bnbchain.org", hex: "0x38", scan: "https://bscscan.com" },
  97: { name: "BSC Testnet", rpc: "https://data-seed-prebsc-1-s1.bnbchain.org:8545", hex: "0x61", scan: "https://testnet.bscscan.com" },
  31337: { name: "Localhost", rpc: "http://127.0.0.1:8545", hex: "0x7a69", scan: "" },
};
const NETQ = new URLSearchParams(location.search).get("net");
const CHAIN = NETQ === "testnet" ? 97 : NETQ === "local" ? 31337 : 56;
const AGENT_LOGIN_API = null; // Agent Wallet sign-in backend URL, when available
let PRELAUNCH = false, OPENS = 0, LIVE = null, ro, mintC, tokenC, signer = null, acct = null, busy = false, INITIAL = 0n, lastBlock = 0, cum = 0, agentSet = new Set();
const ABI_MINT = [
  "function overview() view returns (uint256 minted,uint256 target,uint256 price,uint256 usdtParked,bool opened,bool isFailed,uint256 deadline,uint256 opensAt)",
  "function OPEN_AT() view returns (uint256)",
  "function walletStatus(address) view returns (bool eligible,uint256 paid,uint256 quota,uint256 tokens,uint256 refundable)",
  "function TARGET_SHARES() view returns (uint256)", "function PRICE() view returns (uint256)",
  "function TOKENS_PER_SHARE() view returns (uint256)", "function POOL_TOKENS_PER_SHARE() view returns (uint256)",
  "function BASE_QUOTA() view returns (uint256)", "function DEADLINE() view returns (uint256)",
  "function pair() view returns (address)", "function costOf(uint256) view returns (uint256)",
  "function usdt() view returns (address)", "function token() view returns (address)", "function agentId() view returns (address)",
  "function mint(uint256)", "function refund()",
  "event Minted(address indexed user, uint256 shares, uint256 cost)",
  "event PoolOpened(address pair, uint256 usdtAmount, uint256 tokenAmount, uint256 liquidity)",
];
const ABI_ERC20 = ["function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)", "function allowance(address,address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];
const ABI_PAIR = ["function getReserves() view returns (uint112,uint112,uint32)", "function token0() view returns (address)"];
const fe = (v) => Number(ethers.formatEther(v));
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

async function loadDeployment() {
  try { const r = await fetch(CHAIN === 31337 ? "deployments.local.json" : "deployments.json", { cache: "no-store" }); if (!r.ok) return null; const j = await r.json(); return j[String(CHAIN)] || null; }
  catch (e) { return null; }
}

async function liveInit(dep) {
  LIVE = dep;
  ro = new ethers.JsonRpcProvider(NETS[CHAIN].rpc, CHAIN, { staticNetwork: true });
  mintC = new ethers.Contract(dep.mint, ABI_MINT, ro);
  tokenC = new ethers.Contract(dep.token, ABI_ERC20, ro);
  // Cross-check: addresses in deployments.json must match what the mint contract reports,
  // and on mainnet they must be the official USDT and .ai Agent ID registry. Otherwise the site stays offline.
  const [cu, ct, ca] = await Promise.all([mintC.usdt(), mintC.token(), mintC.agentId()]);
  const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  if (!eq(cu, dep.usdt) || !eq(ct, dep.token)) throw new Error("deployment mismatch");
  if (CHAIN === 56 && (!eq(cu, "0x55d398326f99059fF775485246999027B3197955") || !eq(ca, "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F"))) throw new Error("not the official USDT / Agent ID registry");
  const [tg, pr, tps, pt, q, dl, oa] = await Promise.all([mintC.TARGET_SHARES(), mintC.PRICE(), mintC.TOKENS_PER_SHARE(), mintC.POOL_TOKENS_PER_SHARE(), mintC.BASE_QUOTA(), mintC.DEADLINE(), mintC.OPEN_AT()]);
  TARGET = Number(tg); BASE = fe(pr); INC = 0; STEP = TARGET; TPS = fe(tps); POOL_TPS = fe(pt); QUOTA = Number(q); DEADLINE = Number(dl) * 1000; OPENS = Number(oa) * 1000;
  renderOpenAt();
  INITIAL = tg * (tps + pt);
  MINT_ADDR = dep.mint;
  $("connPlain").hidden = true;
  if (/^https?:/.test(location.protocol)) SITE = location.origin + location.pathname.replace(/\/[^/]*$/, "");
  fresh(); S.auto = false; S.agents = 0; S.top = {}; S.eligible = false; events = []; mqItems = [];
  document.querySelector(".dock").hidden = true;
  document.querySelectorAll(".demo-pill").forEach(p => { p.textContent = CHAIN === 56 ? "LIVE" : NETS[CHAIN].name.toUpperCase(); });
  const tp = document.querySelector(".tickpill"); if (tp) tp.textContent = "$MING · " + NETS[CHAIN].name;
  $("targetLbl").textContent = " / " + nf(TARGET);
  $("tickMid").hidden = true; // one fixed price, no tier marker
  $("tick2").textContent = "#" + nf(TARGET) + " · listing";
  $("foot").dataset.i = "footLive"; $("foot").textContent = t("footLive");
  $("tick1").removeAttribute("data-i"); $("tick2").removeAttribute("data-i");
  const pk = document.querySelector('[data-i="pick"]'); if (pk) { pk.dataset.i = "pickLive"; pk.textContent = t("pickLive"); }
  setInterval(tickCount, 1000);
  await livePoll();
  setInterval(() => livePoll().catch(() => {}), 12000);
}

// Open-time line under the hero countdown, shown in UTC+8 and UTC (never a local zone).
function fmtHM(ms, offsetH) { const d = new Date(ms + offsetH * 3600 * 1000); return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); }
function renderOpenAt() {
  if (!OPENS) return;
  let el = document.getElementById("openAtLine");
  if (!el) {
    const c = document.getElementById("count");
    if (!c || !c.parentNode) return;
    el = document.createElement("div"); el.id = "openAtLine"; el.className = "mono";
    el.style.cssText = "margin-top:8px;color:var(--gold);font-size:13px;letter-spacing:.03em";
    c.parentNode.appendChild(el);
  }
  el.textContent = fmtHM(OPENS, 8) + " UTC+8 · " + fmtHM(OPENS, 0) + " UTC";
  el.hidden = Date.now() >= OPENS;
}

async function liveLogs() {
  const latest = await ro.getBlockNumber();
  let from = lastBlock ? lastBlock + 1 : Math.max(Number(LIVE.deployBlock || 0), latest - 50000);
  const complete = !lastBlock && from === Number(LIVE.deployBlock || 0);
  while (from <= latest) {
    const to = Math.min(latest, from + 4999);
    const logs = await mintC.queryFilter("*", from, to);
    for (const l of logs) {
      if (l.fragment?.name === "Minted") {
        const [user, shares, cost] = l.args; const n = Number(shares), h = short(user);
        if (complete || lastBlock) { if (acct && user.toLowerCase() === acct.toLowerCase() && S.serial == null) S.serial = cum + 1; }
        cum += n; agentSet.add(user.toLowerCase());
        S.top[h] = (S.top[h] || 0) + n;
        log("mint", h, "eMint", { n: nf(n), c: nf(fe(cost), 2) }, acct && user.toLowerCase() === acct.toLowerCase());
        pushMarquee(h, n);
      } else if (l.fragment?.name === "PoolOpened") {
        log("pool", "@wContract", "ePool", { u: nf(fe(l.args[1]), 0) }); log("pool", "@wContract", "eLp");
      }
    }
    from = to + 1;
  }
  lastBlock = latest;
  S.agents = agentSet.size;
}

async function livePoll() {
  const o = await mintC.overview();
  S.minted = Number(o.minted);
  S.phase = o.opened ? "pool" : o.isFailed ? "fail" : (OPENS && Date.now() < OPENS ? "preopen" : "live");
  if (CHAIN === 56) document.querySelectorAll(".demo-pill").forEach(p => { p.textContent = S.phase === "preopen" ? "SOON" : S.phase === "fail" ? "ENDED" : "LIVE"; });
  S.collected = o.opened ? costOf(0, TARGET) : fe(o.usdtParked);
  if (o.opened) {
    const pairAddr = await mintC.pair(); const pair = new ethers.Contract(pairAddr, ABI_PAIR, ro);
    const [[r0, r1], t0, sup, tv] = await Promise.all([pair.getReserves(), pair.token0(), tokenC.totalSupply(), tokenC.balanceOf(LIVE.treasury)]);
    const tokIs0 = t0.toLowerCase() === LIVE.token.toLowerCase();
    S.pool = { usdt: fe(tokIs0 ? r1 : r0), tok: fe(tokIs0 ? r0 : r1) };
    S.prices.push(S.pool.usdt / S.pool.tok); if (S.prices.length > 80) S.prices.shift();
    S.treasury = costOf(0, TARGET) * 0.05; S.vault = fe(tv); S.burned = fe(INITIAL - sup);
  }
  await liveLogs();
  if (acct) {
    const w = await mintC.walletStatus(acct);
    S.wallet = true; S.eligible = w.eligible; S.paid = Number(w.paid); S.owed = fe(w.tokens); S.paidUsdt = fe(w.refundable);
    $("walletRow").textContent = short(acct);
  }
  render(); renderBoard(); renderMarquee();
}

function isBinanceWallet() {
  return !!(window.BinanceChain?.request || window.ethereum?.isBinance || window.binancew3w);
}

async function connectInjected() {
  const eth = window.BinanceChain?.request ? window.BinanceChain : (window.ethereum?.isBinance ? window.ethereum : null);
  if (!eth) return say("mNoWallet", {}, "bad");
  return connectWith(eth, false);
}

// Shared connect path. Any wallet without a .ai Agent ID is dropped immediately.
async function connectWith(eth, isWC) {
  try {
    const bp = new ethers.BrowserProvider(eth);
    await bp.send("eth_requestAccounts", []);
    const net = await bp.getNetwork();
    if (Number(net.chainId) !== CHAIN) {
      try { await bp.send("wallet_switchEthereumChain", [{ chainId: NETS[CHAIN].hex }]); } catch (e) { return say("mWrongNet", { n: NETS[CHAIN].name }, "bad"); }
    }
    const sg = await new ethers.BrowserProvider(eth).getSigner();
    const who = await sg.getAddress();
    say("mChecking");
    const st = await mintC.walletStatus(who);
    if (!st.eligible) {
      acct = null; signer = null; S.wallet = false; S.eligible = false;
        render(); return say("mAgentOnly", {}, "bad");
    }
    signer = sg; acct = who; S.handle = short(acct);
    if (!S.serial) { lastBlock = 0; cum = 0; agentSet = new Set(); events = []; mqItems = []; S.top = {}; }
    await livePoll();
    say("mVerified", {}, "ok");
  } catch (e) { say("mErr", { e: e.shortMessage || e.message }, "bad"); }
}

function prelaunch() {
  fresh(); events = []; mqItems = [];
  S.auto = false; S.phase = "soon"; S.minted = 0; S.collected = 0; S.agents = 0; S.top = {};
  DEADLINE = 0;
  document.querySelector(".dock").hidden = true;
  document.querySelector(".marquee").hidden = true;
  document.querySelectorAll(".demo-pill").forEach(p => { p.textContent = "SOON"; });
  const pk = document.querySelector('[data-i="pick"]'); if (pk) { pk.dataset.i = "pickLive"; pk.textContent = t("pickLive"); }
  const eb = document.querySelector('[data-i="endsIn"]'); if (eb) { eb.dataset.i = "endsSoon"; eb.textContent = t("endsSoon"); }
  $("foot").dataset.i = "footLive"; $("foot").textContent = t("footLive");
  $("connPlain").onclick = () => say("mSoon", {}, "bad");
  $("connPlain").hidden = true;
  PRELAUNCH = true;
  renderFeed(); renderBoard(); render(); tickCount();
}

async function liveTx(label, fn) {
  busy = true; render();
  try { await fn(); } catch (e) { say("mErr", { e: e.shortMessage || e.reason || e.message }, "bad"); }
  busy = false; await livePoll().catch(() => {});
}
async function liveMint(n) {
  const usdt = new ethers.Contract(LIVE.usdt, ABI_ERC20, signer);
  const cost = await mintC.costOf(n);
  if ((await usdt.balanceOf(acct)) < cost) return say("mNoUsdt", {}, "bad");
  if ((await usdt.allowance(acct, LIVE.mint)) < cost) { say("mApprove"); await (await usdt.approve(LIVE.mint, cost)).wait(); }
  say("mConfirm"); const tx = await mintC.connect(signer).mint(n); say("mPending"); await tx.wait();
  say("mMinted", { n, c: nf(fe(cost), 2) }, "ok");
}
'''
r("// ---------- events ----------", LIVE_JS + "\n// ---------- events ----------")

# Buttons: route to live mode when a deployment is active
r('$("connPlain").onclick = () => say("mNoAgent", {}, "bad");', '$("connPlain").onclick = () => LIVE ? connectInjected() : say("mNoAgent", {}, "bad");')

r('$("btnMint").onclick = () => {', '''$("btnMint").onclick = () => {
  if (LIVE) { const n = Math.max(1, Math.min(5, parseInt($("shares").value) || 1)); if (S.paid + n > QUOTA) return say("mQuota", { n: QUOTA - S.paid }, "bad"); if (S.minted + n > TARGET) return say("mSupply", { n: TARGET - S.minted }, "bad"); return liveTx("mint", () => liveMint(n)); }''')
# btnClaim is always hidden in live (tokens are sent at mint, no claim step).
# No live handler is injected so the bundle never references a non-existent claim().
r('$("btnRefund").onclick = () => {','$("btnRefund").onclick = () => {\n  if (LIVE) return liveTx("refund", async () => { const v = S.paidUsdt; const tx = await mintC.connect(signer).refund(); say("mPending"); await tx.wait(); say("mRefund", { u: nf(v, 2) }, "ok"); });')

# Init: live if a deployment exists, otherwise prelaunch/demo.
r('''fresh(); seed();
let saved = "en"; try { saved = localStorage.getItem("am-lang") || "en"; } catch (e) {}
applyLang(saved === "zh" ? "zh" : "en");
renderPrompt();
setInterval(loop, 900);''', '''fresh(); seed();
let saved = "en"; try { saved = localStorage.getItem("am-lang") || "en"; } catch (e) {}
applyLang(saved === "zh" ? "zh" : "en");
renderPrompt();
(async () => {
  const dep = (typeof ethers !== "undefined") ? await loadDeployment() : null;
  if (dep && dep.mint) {
    try { await liveInit(dep); renderPrompt(); return; }
    catch (e) { console.error("live init failed", e); LIVE = null; }
  }
  if (new URLSearchParams(location.search).get("demo") === "1") { setInterval(loop, 900); return; }
  prelaunch();
})();''')

r('<footer>', '<footer>', 1)
s = s.replace('<p data-i="foot"></p>', '<p id="foot" data-i="foot"></p>', 1)

# Pre-render: fill every data-i element with its English text so the page reads correctly
# without JavaScript (crawlers, agents fetching raw HTML). JS still replaces it at runtime.
import re, json, html as _html
en_start = s.index("const T = {\nen: {") + len("const T = {\nen: {")
en_end = s.index("\n},\nzh: {", en_start)
EN = {}
for m in re.finditer(r'(\w+):"((?:[^"\\]|\\.)*)"', s[en_start:en_end]):
    EN.setdefault(m.group(1), json.loads('"' + m.group(2) + '"'))
EN["foot"] = EN.get("footLive", EN.get("foot", ""))
EN["pick"] = EN.get("pickLive", EN.get("pick", ""))
def _fill(m):
    key = m.group(3)
    if key not in EN or "{" in EN[key]:
        return m.group(0)
    return m.group(1) + _html.escape(EN[key], quote=False) + m.group(4)
s = re.sub(r'(<(\w+)\b[^>]*\bdata-i="(\w+)"[^>]*>)(</\2>)', _fill, s)
# Pre-launch defaults in the static HTML: no demo labels, no dummy wallet, real price.
s = s.replace('<span class="demo-pill">DEMO</span>', '<span class="demo-pill">SOON</span>')
s = s.replace('<div class="dock">', '<div class="dock" hidden>', 1)
s = s.replace('<span class="mono" id="walletRow">you.ai · 0x7a3f…c91e</span>', '<span class="mono" id="walletRow">—</span>')
s = s.replace('<b id="stMinted">—</b>', '<b id="stMinted">0</b>').replace('<b id="stPrice">—</b>', '<b id="stPrice">2.00 U</b>')
s = s.replace('<b id="stRaised">—</b>', '<b id="stRaised">0</b>').replace('<b id="stAgents">—</b>', '<b id="stAgents">0</b>')
s = s.replace('if (new URLSearchParams(location.search).get("demo") === "1") { setInterval(loop, 900); return; }',
              'if (new URLSearchParams(location.search).get("demo") === "1") { document.querySelector(".dock").hidden = false; document.querySelectorAll(".demo-pill").forEach(p => { p.textContent = "DEMO"; }); setInterval(loop, 900); return; }')
i = s.index("</style>") + len("</style>")
s = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
     '<meta name="description" content="天命 Tianming ($MING): a fair mint only .ai agents can join on BNB Smart Chain. 5,000 shares at 2 USDT, auto-listing on PancakeSwap with LP burned, 100% refund if it does not list. 0% team.">\n'
     '<meta property="og:title" content="天命 Tianming ($MING)">\n<meta property="og:description" content="Agent-only fair mint on BNB Smart Chain. 5,000 shares at 2 USDT, LP burned at listing, 0% team, no owner.">\n<meta property="og:url" content="https://tianming.xyz/">\n<meta property="og:image" content="https://tianming.xyz/og.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="https://tianming.xyz/og.png">\n<link rel="icon" href="favicon.ico" sizes="any">\n<link rel="icon" type="image/png" sizes="32x32" href="icon-32.png">\n<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<meta name="theme-color" content="#0a0a0b">\n'
     + s[:i] + "\n</head>\n<body>\n" + s[i:] + "\n</body>\n</html>\n")
open(dst, "w").write(s)
print("ok", len(s))
