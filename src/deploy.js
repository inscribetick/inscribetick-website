// $TICK deploy console. Temporary page used once to deploy TickMint from a browser wallet.
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  defineChain,
  parseEther,
  formatEther,
  isAddress,
  getAddress,
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
} from "viem";
import { TICK_MINT_ABI } from "./abi.js";
import { TICK_MINT_BYTECODE, TICK_LOCKER_ABI } from "./tickmint-artifact.js";

const C = window.TICK_CONFIG || {};
const POOL_MANAGER = "0xE2e105d3F7209A9DA11f83cCf3E7398a753823F1"; // Uniswap v4 on Elysium
const WHYPE = "0xbA876237B0F021A6c6D852d6c26E107997cC5E81"; // Elysium docs
const HISTORY_KEY = "tick:deployments";

const chain = defineChain({
  id: 99901,
  name: "Elysium",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: [C.rpcUrl || "https://rpc.elysium.kinetiq.xyz"] } },
});
const publicClient = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });

const $ = (id) => document.getElementById(id);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const st = { provider: null, account: null, chainId: null, mode: "soft", busy: false };

// ------------------------------------------------------------------ wallet

const providers = [];
window.addEventListener("eip6963:announceProvider", (ev) => {
  const d = ev.detail;
  if (d && d.info && d.provider && !providers.find((p) => p.info.uuid === d.info.uuid)) providers.push(d);
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

function log(text, kind) {
  const el = $("log");
  el.textContent = text;
  el.dataset.kind = kind || "";
}

function friendly(e) {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return "Cancelled in the wallet.";
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (r && r.data && r.data.errorName) return `The contract refused: ${r.data.errorName}.`;
    if (/insufficient funds/i.test(e.message)) return "Not enough HYPE on Elysium for this transaction.";
    return e.shortMessage || e.message;
  }
  if (e && e.code === 4001) return "Cancelled in the wallet.";
  return (e && e.message) || String(e);
}

async function pickWallet() {
  const list = $("walletPick");
  list.replaceChildren();
  const opts = providers.length ? providers : window.ethereum ? [{ info: { name: "Browser wallet" }, provider: window.ethereum }] : [];
  if (!opts.length) {
    log("No wallet detected. Install Rabby, MetaMask, OKX Wallet or Bitget Wallet and refresh.", "error");
    return null;
  }
  if (opts.length === 1) return opts[0].provider;
  return new Promise((resolve) => {
    for (const p of opts) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "b3d small";
      b.textContent = p.info.name;
      b.onclick = () => { list.replaceChildren(); resolve(p.provider); };
      list.appendChild(b);
    }
  });
}

async function ensureChain() {
  const hex = "0x" + chain.id.toString(16);
  try {
    await st.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (e) {
    if (e && (e.code === 4001 || e?.data?.originalError?.code === 4001)) throw e;
    await st.provider.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: hex, chainName: "Elysium", nativeCurrency: chain.nativeCurrency, rpcUrls: chain.rpcUrls.default.http }],
    });
    try { await st.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] }); } catch (_) {}
  }
  st.chainId = parseInt(await st.provider.request({ method: "eth_chainId" }), 16);
  if (st.chainId !== chain.id) throw new Error("Please switch the wallet to Elysium (chain ID 99901).");
}

async function connect() {
  try {
    const p = await pickWallet();
    if (!p) return;
    st.provider = p;
    const accs = await p.request({ method: "eth_requestAccounts" });
    st.account = getAddress(accs[0]);
    await ensureChain();
    if (p.on) {
      p.on("accountsChanged", (a) => { st.account = a && a[0] ? getAddress(a[0]) : null; refresh(); });
      p.on("chainChanged", (id) => { st.chainId = parseInt(id, 16); refresh(); });
    }
    if (!$("feeRecipient").value) $("feeRecipient").value = st.account;
    log("");
  } catch (e) {
    log(friendly(e), "error");
  }
  refresh();
}

const wallet = () => createWalletClient({ account: st.account, chain, transport: custom(st.provider) });

// ------------------------------------------------------------------ form

function setMode(mode) {
  st.mode = mode;
  $("modeSoft").setAttribute("aria-pressed", String(mode === "soft"));
  $("modeFinal").setAttribute("aria-pressed", String(mode === "final"));
  $("finalFields").hidden = mode !== "final";
  $("softNote").hidden = mode !== "soft";
  if (mode === "soft") {
    $("price").value = "0.0001";
  } else if ($("price").value === "0.0001") {
    $("price").value = "";
  }
  refresh();
}

function params() {
  const errors = [];
  let price = null;
  try {
    price = parseEther(($("price").value || "").trim());
    if (price <= 0n) throw new Error();
  } catch (_) {
    errors.push("Enter a valid price per inscribe in HYPE.");
    price = null;
  }
  let start;
  let duration;
  if (st.mode === "soft") {
    start = Math.floor(Date.now() / 1000) + 180;
    duration = 600;
  } else {
    const v = $("start").value;
    start = v ? Math.floor(new Date(v).getTime() / 1000) : NaN;
    duration = 72 * 3600;
    if (!Number.isFinite(start)) errors.push("Pick when the mint opens.");
    else if (start < Math.floor(Date.now() / 1000) + 300) errors.push("The mint must open at least 5 minutes from now.");
  }
  const fee = ($("feeRecipient").value || "").trim();
  if (!isAddress(fee)) errors.push("Enter a valid fee recipient address.");
  return { price, start, duration, fee: isAddress(fee) ? getAddress(fee) : null, errors };
}

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return "—";
  const d = new Date(sec * 1000);
  const local = d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const utc = d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return `${local} (your time) · ${utc}`;
}

function refresh() {
  $("connectLabel").textContent = !st.account ? "Connect wallet" : st.chainId !== chain.id ? "Switch to Elysium" : short(st.account);
  const p = params();
  $("sumMode").textContent = st.mode === "soft" ? "Soft launch (test, tiny amounts)" : "FINAL public launch";
  $("sumPrice").textContent = p.price != null ? `${formatEther(p.price)} HYPE per inscribe` : "—";
  $("sumStart").textContent = st.mode === "soft" ? "3 minutes after you deploy" : fmtTime(p.start);
  $("sumDuration").textContent = st.mode === "soft" ? "10 minutes" : "72 hours";
  $("sumFee").textContent = p.fee || "—";
  $("sumErrors").textContent = p.errors.join(" ");
  $("deployBtn").disabled = st.busy || !st.account || st.chainId !== chain.id || p.errors.length > 0
    || (st.mode === "final" && !$("confirmFinal").checked);
  $("deployBtn").textContent = st.busy ? "Working…" : st.mode === "soft" ? "Deploy soft launch" : "Deploy FINAL contracts";
}

$("usdHelper").addEventListener("input", () => {
  const usd = parseFloat($("usdHelper").value);
  if (usd > 0) $("price").value = (2 / usd).toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  refresh();
});

// ------------------------------------------------------------------ deploy

async function deploy() {
  const p = params();
  if (p.errors.length) return;
  st.busy = true;
  refresh();
  try {
    await ensureChain();
    log("Checking Uniswap v4 and WHYPE on Elysium…");
    const [pmCode, whypeCode] = await Promise.all([
      publicClient.getCode({ address: POOL_MANAGER }),
      publicClient.getCode({ address: WHYPE }),
    ]);
    if (!pmCode || pmCode === "0x" || !whypeCode || whypeCode === "0x") throw new Error("Uniswap v4 or WHYPE not found on this network. Stop and check.");
    // Re-compute the soft-launch start right before sending.
    const start = st.mode === "soft" ? Math.floor(Date.now() / 1000) + 180 : p.start;
    log("Confirm the deployment in your wallet…");
    const hash = await wallet().deployContract({
      abi: TICK_MINT_ABI,
      bytecode: TICK_MINT_BYTECODE,
      args: [p.price, BigInt(start), BigInt(p.duration), WHYPE, POOL_MANAGER, p.fee],
    });
    log(`Deploying… transaction ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("The deployment transaction failed.");
    const mint = getAddress(receipt.contractAddress);
    const read = (fn) => publicClient.readContract({ address: mint, abi: TICK_MINT_ABI, functionName: fn });
    const [token, locker] = await Promise.all([read("token"), read("locker")]);
    const entry = {
      mode: st.mode, mint, token, locker, tx: hash, price: p.price.toString(),
      start, end: start + p.duration, fee: p.fee, deployer: st.account, at: Math.floor(Date.now() / 1000),
    };
    saveHistory([entry, ...loadHistory()]);
    renderHistory();
    log(st.mode === "soft" ? "Soft launch deployed. Use the test buttons below." : "FINAL contracts deployed. Copy the three addresses below.", "ok");
  } catch (e) {
    log(friendly(e), "error");
  } finally {
    st.busy = false;
    refresh();
  }
}

// ------------------------------------------------------------------ history + soft-launch tests

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch (_) { return []; }
}
function saveHistory(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (_) {}
}

function row(label, value) {
  const div = document.createElement("div");
  div.className = "kv";
  const k = document.createElement("span");
  k.textContent = label;
  const v = document.createElement("code");
  v.textContent = value;
  div.append(k, v);
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "b3d small copy";
    c.textContent = "Copy";
    c.onclick = async () => {
      try { await navigator.clipboard.writeText(value); c.textContent = "Copied"; setTimeout(() => (c.textContent = "Copy"), 1200); } catch (_) {}
    };
    div.appendChild(c);
  }
  return div;
}

async function testAction(entry, action, out) {
  out.textContent = "Working…";
  try {
    await ensureChain();
    const w = wallet();
    let hash;
    if (action === "inscribe") {
      hash = await w.writeContract({ address: entry.mint, abi: TICK_MINT_ABI, functionName: "inscribe", args: [2n], value: BigInt(entry.price) * 2n, account: st.account, chain });
    } else if (action === "finalize") {
      hash = await w.writeContract({ address: entry.mint, abi: TICK_MINT_ABI, functionName: "finalize", args: [], account: st.account, chain });
    }
    if (hash) {
      out.textContent = `Waiting for ${short(hash)}…`;
      const r = await publicClient.waitForTransactionReceipt({ hash });
      if (r.status !== "success") throw new Error("Transaction failed.");
    }
    const read = (fn) => publicClient.readContract({ address: entry.mint, abi: TICK_MINT_ABI, functionName: fn });
    const [inscribed, finalized] = await Promise.all([read("inscribed"), read("finalized")]);
    const liq = await publicClient.readContract({ address: entry.locker, abi: TICK_LOCKER_ABI, functionName: "lockedLiquidity" });
    out.textContent = `Inscribed: ${inscribed} · Pool built: ${finalized ? "yes" : "no"} · Locked liquidity: ${liq}${finalized && liq > 0n ? "  ✓ soft launch passed" : ""}`;
  } catch (e) {
    out.textContent = friendly(e);
  }
}

function renderHistory() {
  const host = $("history");
  const list = loadHistory();
  host.replaceChildren();
  $("historyWrap").hidden = list.length === 0;
  for (const e of list) {
    const card = document.createElement("div");
    card.className = "deploy-card" + (e.mode === "final" ? " final" : "");
    const h = document.createElement("h3");
    h.textContent = e.mode === "final" ? "FINAL deployment" : "Soft launch (test — never share these addresses)";
    card.appendChild(h);
    card.append(
      row("TickMint", e.mint),
      row("TickToken", e.token),
      row("TickLocker", e.locker),
      row("Price", `${formatEther(BigInt(e.price))} HYPE per inscribe`),
      row("Mint opens", fmtTime(e.start)),
      row("Mint closes", fmtTime(e.end)),
      row("Fee recipient", e.fee),
      row("Deploy tx", e.tx),
    );
    if (e.mode === "soft") {
      const bar = document.createElement("div");
      bar.className = "test-bar";
      const out = document.createElement("p");
      out.className = "test-out";
      out.textContent = "Step 1: after it opens, mint 2. Step 2: after it closes, build the pool. Step 3: locked liquidity must be above 0.";
      const mk = (label, action) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "b3d small";
        b.textContent = label;
        b.onclick = () => testAction(e, action, out);
        return b;
      };
      bar.append(mk("1 · Mint 2", "inscribe"), mk("2 · Build the pool", "finalize"), mk("3 · Check", "check"));
      card.append(bar, out);
    }
    host.appendChild(card);
  }
}

// ------------------------------------------------------------------ boot

$("connectBtn").addEventListener("click", () => (!st.account || st.chainId !== chain.id ? connect() : null));
$("modeSoft").addEventListener("click", () => setMode("soft"));
$("modeFinal").addEventListener("click", () => setMode("final"));
for (const id of ["price", "start", "feeRecipient", "confirmFinal"]) $(id).addEventListener("input", refresh);
$("deployBtn").addEventListener("click", deploy);
setMode("soft");
renderHistory();
setInterval(refresh, 15000);
