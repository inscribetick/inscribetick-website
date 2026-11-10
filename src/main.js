// $TICK website logic. Bundled with esbuild into public/app.js (no third-party scripts at runtime).
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  defineChain,
  formatEther,
  isAddress,
  getAddress,
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
} from "viem";
import { TICK_MINT_ABI, TICK_TOKEN_ABI } from "./abi.js";

const C = window.TICK_CONFIG || {};
const MAX_INSCRIBES = 8000;
const MAX_PER_WALLET = 10;
const TOKENS_PER_INSCRIBE = 100000;
const DRUM_BANDS = [[314, 370], [384, 442], [456, 514], [528, 586], [600, 654], [670, 726], [742, 794]];

const $ = (id) => document.getElementById(id);
const fmtInt = (n) => Number(n).toLocaleString("en-US");
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const chain = defineChain({
  id: Number(C.chainId || 99901),
  name: "Elysium",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: [C.rpcUrl] } },
  blockExplorers: C.explorerUrl ? { default: { name: "Explorer", url: C.explorerUrl } } : undefined,
});
const hasMint = typeof C.tickMint === "string" && isAddress(C.tickMint);
const mintAddress = hasMint ? getAddress(C.tickMint) : null;
const publicClient = createPublicClient({ chain, transport: http(C.rpcUrl) });

const state = {
  qty: 1,
  loaded: false,
  inscribed: 0,
  price: null,
  start: 0,
  end: 0,
  grace: 7 * 24 * 3600,
  finalized: false,
  token: null,
  locker: null,
  account: null,
  provider: null,
  walletChainId: null,
  mine: 0,
  balance: null,
  busy: false,
  showBalance: false,
};

// ------------------------------------------------------------------ counter (hero artwork)

const drums = [];
function buildDrums() {
  const host = $("drums");
  DRUM_BANDS.forEach(([a, b], i) => {
    const drum = document.createElement("div");
    drum.className = "drum" + (i === DRUM_BANDS.length - 1 ? " last" : "");
    drum.style.top = (a / 1168) * 100 + "%";
    drum.style.height = ((b - a) / 1168) * 100 + "%";
    const strip = document.createElement("div");
    strip.className = "strip";
    for (const d of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) {
      const s = document.createElement("span");
      s.textContent = String(d);
      strip.appendChild(s);
    }
    drum.appendChild(strip);
    host.appendChild(drum);
    drums.push({ strip, digit: 0 });
  });
}

let shown = -1;
function setCounter(value) {
  value = Math.max(0, Math.min(9999999, Math.floor(value)));
  if (value === shown) return;
  const step = value === shown + 1;
  drums.forEach((d, i) => {
    const digit = Math.floor(value / 10 ** (6 - i)) % 10;
    if (digit === d.digit) return;
    if (step && digit === 0 && d.digit === 9) {
      // roll forward past 9 onto the trailing 0, then snap back to the leading 0
      d.strip.classList.remove("snap");
      d.strip.style.transform = `translateY(-${(10 * 100) / 11}%)`;
      setTimeout(() => {
        d.strip.classList.add("snap");
        d.strip.style.transform = "translateY(0%)";
        void d.strip.offsetHeight;
        d.strip.classList.remove("snap");
      }, 560);
    } else {
      d.strip.classList.toggle("snap", !step);
      d.strip.style.transform = `translateY(-${(digit * 100) / 11}%)`;
      if (!step) requestAnimationFrame(() => d.strip.classList.remove("snap"));
    }
    d.digit = digit;
  });
  shown = value;
  $("receiptNo").textContent = "#" + String(value).padStart(7, "0");
}

let demoValue = 1;
function counterTick() {
  const live = hasMint && state.loaded && (state.inscribed > 0 || now() >= state.start);
  if (live) {
    $("receiptTitle").textContent = "Inscribed";
    setCounter(state.inscribed);
  } else {
    $("receiptTitle").textContent = "Inscription";
    setCounter(demoValue++);
  }
}

// ------------------------------------------------------------------ chain reads

const now = () => Math.floor(Date.now() / 1000);

async function readMint() {
  if (!hasMint) return;
  try {
    const r = (fn, args) => publicClient.readContract({ address: mintAddress, abi: TICK_MINT_ABI, functionName: fn, args });
    if (!state.loaded) {
      const [price, start, end, grace, token, locker] = await Promise.all([
        r("pricePerInscribe"), r("startTime"), r("endTime"), r("FINALIZE_GRACE"), r("token"), r("locker"),
      ]);
      Object.assign(state, {
        price,
        start: Number(start),
        end: Number(end),
        grace: Number(grace),
        token,
        locker,
      });
      showAddresses();
    }
    const [inscribed, finalized] = await Promise.all([r("inscribed"), r("finalized")]);
    state.inscribed = Number(inscribed);
    state.finalized = finalized;
    if (state.account) {
      const [mine, bal] = await Promise.all([
        r("inscribedBy", [state.account]),
        publicClient.readContract({ address: state.token, abi: TICK_TOKEN_ABI, functionName: "balanceOf", args: [state.account] }),
      ]);
      state.mine = Number(mine);
      state.balance = bal;
    }
    state.loaded = true;
  } catch (e) {
    console.warn("read failed", e);
  }
  render();
}

// ------------------------------------------------------------------ wallet

const providers = []; // EIP-6963
window.addEventListener("eip6963:announceProvider", (ev) => {
  const d = ev.detail;
  if (d && d.info && d.provider && !providers.find((p) => p.info.uuid === d.info.uuid)) providers.push(d);
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

// The four wallets most $TICK minters use. Matched by EIP-6963 rdns or name.
const KNOWN_WALLETS = [
  { key: "rabby", name: "Rabby", url: "https://rabby.io", match: /rabby/i },
  { key: "metamask", name: "MetaMask", url: "https://metamask.io", match: /metamask/i },
  { key: "okx", name: "OKX Wallet", url: "https://web3.okx.com", match: /okx|okex/i },
  { key: "bitget", name: "Bitget Wallet", url: "https://web3.bitget.com", match: /bitget|bitkeep/i },
];
const WALLET_KEY = "tick:wallet";
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function findKnown(p) {
  const id = `${p.info.rdns || ""} ${p.info.name || ""}`;
  return KNOWN_WALLETS.find((w) => w.match.test(id)) || null;
}
function rememberWallet(rdns) {
  try { if (rdns) localStorage.setItem(WALLET_KEY, rdns); } catch (_) {}
}
function lastWallet() {
  try { return localStorage.getItem(WALLET_KEY); } catch (_) { return null; }
}

function walletButton(label, icon, onClick, tag) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "b3d";
  if (icon && /^data:image\//.test(icon)) {
    const img = document.createElement("img");
    img.src = icon;
    img.alt = "";
    b.appendChild(img);
  }
  b.appendChild(document.createTextNode(label));
  if (tag) {
    const t = document.createElement("span");
    t.className = "wallet-tag";
    t.textContent = tag;
    b.appendChild(t);
  }
  b.addEventListener("click", onClick);
  return b;
}

function chooseProvider() {
  return new Promise((resolve) => {
    const dlg = $("walletDialog");
    const list = $("walletList");
    const hint = $("walletHint");
    list.replaceChildren();
    const done = (choice) => { resolve(choice); dlg.close(); };
    const used = new Set();

    for (const w of KNOWN_WALLETS) {
      const p = providers.find((x) => !used.has(x) && findKnown(x) === w);
      if (p) {
        used.add(p);
        list.appendChild(walletButton(w.name, p.info.icon, () => done({ provider: p.provider, rdns: p.info.rdns }), "Detected"));
      } else {
        const a = document.createElement("a");
        a.className = "b3d install";
        a.href = w.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = w.name;
        const t = document.createElement("span");
        t.className = "wallet-tag";
        t.textContent = "Install ↗";
        a.appendChild(t);
        list.appendChild(a);
      }
    }
    // Any other wallet the browser announced (Phantom, Coinbase, ...)
    for (const p of providers) {
      if (used.has(p)) continue;
      list.appendChild(walletButton(p.info.name, p.info.icon, () => done({ provider: p.provider, rdns: p.info.rdns }), "Detected"));
    }
    // Older wallets that only inject window.ethereum
    if (providers.length === 0 && window.ethereum) {
      list.appendChild(walletButton("Browser wallet", null, () => done({ provider: window.ethereum, rdns: null }), "Detected"));
    }

    hint.textContent = providers.length === 0 && !window.ethereum
      ? (isMobile()
        ? "On mobile, open inscribetick.com in the built-in browser of your wallet app (Rabby, MetaMask, OKX or Bitget), then connect."
        : "No wallet detected. Install one of the wallets above, then refresh this page.")
      : "";
    hint.hidden = !hint.textContent;

    $("walletClose").onclick = () => done(null);
    dlg.onclose = () => resolve(null); // Esc key; resolving twice is harmless
    dlg.showModal();
  });
}

async function connect() {
  const choice = await chooseProvider();
  if (!choice) return;
  const provider = choice.provider;
  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    rememberDisconnected(false);
    rememberWallet(choice.rdns);
    setProvider(provider);
    state.account = accounts[0] ? getAddress(accounts[0]) : null;
    state.walletChainId = parseInt(await provider.request({ method: "eth_chainId" }), 16);
    say("");
    // Ask the wallet to switch to (or add) Elysium right away.
    try {
      await ensureChain();
    } catch (e) {
      say(isRejection(e) ? "Switch your wallet to Elysium (chain ID 99901) to mint." : friendly(e));
    }
    await readMint();
  } catch (e) {
    say(friendly(e));
  }
}

const DISCONNECTED_KEY = "tick:disconnected";
function rememberDisconnected(on) {
  try {
    if (on) localStorage.setItem(DISCONNECTED_KEY, "1");
    else localStorage.removeItem(DISCONNECTED_KEY);
  } catch (_) {}
}
function wasDisconnected() {
  try { return localStorage.getItem(DISCONNECTED_KEY) === "1"; } catch (_) { return false; }
}

async function disconnect() {
  const p = state.provider;
  rememberDisconnected(true);
  state.provider = null; // stop reacting to this wallet's events
  if (p) {
    // Wallets that support it (MetaMask, Rabby, ...) revoke this site's access; others ignore it.
    try { await p.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }); } catch (_) {}
  }
  Object.assign(state, { account: null, walletChainId: null, mine: 0, balance: null, showBalance: false });
  say("Wallet disconnected.");
  render();
}

function isRejection(e) {
  return !!e && (e.code === 4001 || e?.data?.originalError?.code === 4001 || e instanceof UserRejectedRequestError);
}

let listening = null;
function setProvider(p) {
  state.provider = p;
  if (listening === p || !p.on) return;
  listening = p;
  p.on("accountsChanged", (accs) => {
    if (state.provider !== p) return;
    state.account = accs && accs[0] ? getAddress(accs[0]) : null;
    state.mine = 0;
    state.balance = null;
    readMint();
  });
  p.on("chainChanged", (id) => {
    if (state.provider !== p) return;
    state.walletChainId = parseInt(id, 16);
    render();
  });
}

async function ensureChain() {
  const p = state.provider;
  const hex = "0x" + chain.id.toString(16);
  if (state.walletChainId === chain.id) return true;
  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (e) {
    if (isRejection(e)) throw e;
    // Unknown network (4902 or a wallet-specific error): add Elysium, then switch to it.
    await p.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: hex,
        chainName: "Elysium",
        nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
        rpcUrls: [C.rpcUrl],
        blockExplorerUrls: C.explorerUrl ? [C.explorerUrl] : undefined,
      }],
    });
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (_) {}
  }
  state.walletChainId = parseInt(await p.request({ method: "eth_chainId" }), 16);
  return state.walletChainId === chain.id;
}

function wallet() {
  return createWalletClient({ account: state.account, chain, transport: custom(state.provider) });
}

// ------------------------------------------------------------------ actions

async function send(functionName, args, value, pending) {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    if (!(await ensureChain())) throw new Error("Please switch your wallet to Elysium.");
    const { request } = await publicClient.simulateContract({
      address: mintAddress, abi: TICK_MINT_ABI, functionName, args, value, account: state.account,
    });
    say("Confirm in your wallet…");
    const hash = await wallet().writeContract(request);
    say(pending, hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction failed.");
    return hash;
  } catch (e) {
    say(friendly(e));
    return null;
  } finally {
    state.busy = false;
    await readMint();
  }
}

async function onMintClick() {
  const phase = mintPhase();
  if (!state.account) return connect();
  if (state.walletChainId !== chain.id) {
    try { await ensureChain(); } catch (e) { say(friendly(e)); }
    return render();
  }
  if (phase === "open") {
    const qty = clampQty();
    const hash = await send("inscribe", [BigInt(qty)], state.price * BigInt(qty), `Minting ${qty} inscribe${qty > 1 ? "s" : ""}…`);
    if (hash) {
      state.showBalance = true;
      say(`Done! ${fmtInt(qty * TOKENS_PER_INSCRIBE)} $TICK inscribed to your wallet.`, hash);
    }
  } else if (phase === "finalize") {
    const hash = await send("finalize", [], 0n, "Building the pool…");
    if (hash) say("The pool is live and the liquidity is locked. Trading is open.", hash);
  } else if (phase === "refund") {
    const hash = await send("refund", [], 0n, "Refunding your HYPE…");
    if (hash) say("Your HYPE has been returned.", hash);
  }
}

async function onViewClick() {
  if (!state.account) return connect();
  if (!state.showBalance) {
    state.showBalance = true;
    return render();
  }
  try {
    await state.provider.request({
      method: "wallet_watchAsset",
      params: { type: "ERC20", options: { address: state.token, symbol: "TICK", decimals: 18 } },
    });
  } catch (e) {
    say(friendly(e));
  }
}

// ------------------------------------------------------------------ rendering

function mintPhase() {
  if (!hasMint || !state.loaded) return "soon";
  const t = now();
  if (state.finalized) return "done";
  if (t >= state.end + state.grace) return "refund";
  if (state.inscribed >= MAX_INSCRIBES || t >= state.end) return "finalize";
  if (t < state.start) return "upcoming";
  return "open";
}

function maxQty() {
  return Math.max(0, Math.min(MAX_PER_WALLET - state.mine, MAX_INSCRIBES - state.inscribed, MAX_PER_WALLET));
}
function clampQty() {
  const m = Math.max(1, maxQty());
  state.qty = Math.min(Math.max(1, state.qty), m);
  return state.qty;
}

function countdown(sec) {
  sec = Math.max(0, sec);
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return (d ? `${d}d ` : "") + `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

function hype(wei) {
  const s = formatEther(wei);
  const [i, f = ""] = s.split(".");
  const ft = f.slice(0, 6).replace(/0+$/, "");
  return ft ? `${i}.${ft}` : i;
}

function render() {
  const phase = mintPhase();
  const t = now();

  // count + progress
  $("mintCount").textContent = `${fmtInt(state.inscribed)} / ${fmtInt(MAX_INSCRIBES)}`;
  $("progressFill").style.width = (state.inscribed / MAX_INSCRIBES) * 100 + "%";
  $("progress").setAttribute("aria-valuenow", String(state.inscribed));

  const status = {
    soon: "Coming soon — the date drops on inscribetick.com",
    upcoming: `Opens in ${countdown(state.start - t)}`,
    open: `Open — closes in ${countdown(state.end - t)}`,
    finalize: state.inscribed >= MAX_INSCRIBES ? "Sold out — anyone can now build the pool" : "Mint closed — anyone can now build the pool",
    done: "Pool live — liquidity locked, trading open",
    refund: "The pool was not built in time — refunds are open",
  }[phase];
  $("mintStatus").textContent = status;

  // qty card
  const qty = clampQty();
  $("qty").textContent = String(qty);
  $("qtyTokens").textContent = `= ${fmtInt(qty * TOKENS_PER_INSCRIBE)} $TICK`;
  $("qtyCost").textContent = state.price != null ? `= ${hype(state.price * BigInt(qty))} HYPE` : `≈ $${qty * 2} in HYPE`;
  $("qtyDec").disabled = qty <= 1 || phase !== "open" && phase !== "soon" && phase !== "upcoming";
  $("qtyInc").disabled = qty >= Math.max(1, maxQty()) || phase === "done" || phase === "refund" || phase === "finalize";
  if (state.price != null) $("receiptPrice").textContent = `${hype(state.price)} HYPE`;

  // main button
  const btn = $("mintBtn");
  let label = "Mint — opens soon";
  let enabled = false;
  if (state.busy) {
    label = "Working…";
  } else if (phase === "soon") {
    label = "Mint — opens soon";
  } else if (!state.account) {
    label = "Connect wallet";
    enabled = phase !== "done";
  } else if (state.walletChainId !== chain.id) {
    label = "Switch to Elysium";
    enabled = true;
  } else if (phase === "upcoming") {
    label = "Opens soon";
  } else if (phase === "open") {
    if (maxQty() === 0) label = state.mine >= MAX_PER_WALLET ? "Wallet limit reached" : "Sold out";
    else { label = `Mint ${qty} — ${hype(state.price * BigInt(qty))} HYPE`; enabled = true; }
  } else if (phase === "finalize") {
    label = "Build the pool";
    enabled = true;
  } else if (phase === "refund") {
    if (state.mine > 0) { label = `Refund ${hype(state.price * BigInt(state.mine))} HYPE`; enabled = true; }
    else label = "Nothing to refund";
  } else if (phase === "done") {
    label = "Mint ended";
  }
  $("mintLabel").textContent = label;
  btn.disabled = !enabled;

  // view button
  const view = $("viewBtn");
  view.disabled = !(state.account && state.token) || state.busy;
  $("viewLabel").textContent = state.showBalance ? "Add $TICK to wallet" : "View my $TICK";
  if (state.showBalance && state.balance != null) {
    const whole = Number(state.balance / 10n ** 18n);
    $("successText").textContent = `You hold ${fmtInt(whole)} $TICK from ${state.mine} inscribe${state.mine === 1 ? "" : "s"}. ` +
      (state.finalized ? "Trading is open." : "Trading opens once the pool is built.");
  }

  // header
  $("disconnectBtn").hidden = !state.account;
  $("connectLabel").textContent = !state.account
    ? "Connect wallet"
    : state.walletChainId !== chain.id ? "Switch to Elysium" : short(state.account);
}

function showAddresses() {
  const set = (id, addr) => {
    const cell = $(id);
    cell.classList.remove("pending");
    cell.replaceChildren();
    if (C.explorerUrl) {
      const a = document.createElement("a");
      a.href = `${C.explorerUrl}/address/${addr}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = addr;
      cell.appendChild(a);
    } else {
      cell.textContent = addr;
    }
  };
  set("addrMint", mintAddress);
  set("addrToken", state.token);
  set("addrLocker", state.locker);
}

function say(text, hash) {
  const el = $("txStatus");
  el.replaceChildren(document.createTextNode(text));
  if (hash) {
    el.appendChild(document.createTextNode(" "));
    if (C.explorerUrl) {
      const a = document.createElement("a");
      a.href = `${C.explorerUrl}/tx/${hash}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "View transaction ↗";
      el.appendChild(a);
    } else {
      el.appendChild(document.createTextNode(`(tx ${short(hash)})`));
    }
  }
}

const ERROR_TEXT = {
  MintNotOpen: "The mint hasn't opened yet.",
  MintClosed: "The mint is closed.",
  InvalidCount: "Choose between 1 and 10 inscribes.",
  WalletLimit: "This wallet has reached the 10-inscribe limit.",
  SoldOut: "Not enough inscribes left. Try a smaller amount.",
  WrongPayment: "Payment amount didn't match the price. Please try again.",
  AlreadyFinalized: "The pool has already been built.",
  MintStillRunning: "The mint is still running.",
  FinalizeExpired: "The time to build the pool has passed. Refunds are open.",
  RefundNotAvailable: "Refunds are not available.",
  NothingToRefund: "This wallet has nothing to refund.",
};

function friendly(e) {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return "Transaction cancelled.";
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    const name = revert && revert.data && revert.data.errorName;
    if (name && ERROR_TEXT[name]) return ERROR_TEXT[name];
    if (/insufficient funds/i.test(e.message)) return "Not enough HYPE on Elysium for this mint plus gas.";
    return e.shortMessage || "Something went wrong. Please try again.";
  }
  if (e && e.code === 4001) return "Request cancelled.";
  return (e && e.message) || "Something went wrong. Please try again.";
}

// ------------------------------------------------------------------ boot

function boot() {
  // Refuse to run inside a frame (anti-clickjacking; GitHub Pages cannot send frame headers).
  if (window.top !== window.self) {
    document.documentElement.style.display = "none";
    try { window.top.location = window.self.location.href; } catch (_) {}
    return;
  }
  buildDrums();
  if (C.xHandle) {
    const handle = String(C.xHandle).replace(/^@/, "");
    const x = $("xLink");
    x.href = `https://x.com/${encodeURIComponent(handle)}`;
    x.textContent = `X @${handle}`;
    x.hidden = false;
    $("noticeX").textContent = ` and on X @${handle}`;
  }
  $("connectBtn").addEventListener("click", async () => {
    if (!state.account) return connect();
    if (state.walletChainId !== chain.id) {
      try { await ensureChain(); say(""); } catch (e) { say(friendly(e)); }
      render();
    }
  });
  $("disconnectBtn").addEventListener("click", disconnect);
  $("mintBtn").addEventListener("click", onMintClick);
  $("viewBtn").addEventListener("click", onViewClick);
  $("qtyDec").addEventListener("click", () => { state.qty = Math.max(1, state.qty - 1); render(); });
  $("qtyInc").addEventListener("click", () => { state.qty = Math.min(Math.max(1, maxQty()), state.qty + 1); render(); });

  counterTick();
  setInterval(counterTick, 1000);
  setInterval(render, 1000);
  render();
  readMint();
  if (hasMint) setInterval(readMint, 5000);

  // silently restore an already-authorised wallet
  setTimeout(async () => {
    if (wasDisconnected()) return;
    const last = lastWallet();
    const known = (last && providers.find((x) => x.info.rdns === last)) || (providers.length === 1 ? providers[0] : null);
    const p = known ? known.provider : (providers.length === 0 ? window.ethereum : null);
    if (!p) return;
    try {
      const accs = await p.request({ method: "eth_accounts" });
      if (accs && accs[0]) {
        setProvider(p);
        state.account = getAddress(accs[0]);
        state.walletChainId = parseInt(await p.request({ method: "eth_chainId" }), 16);
        readMint();
      }
    } catch (_) {}
  }, 300);
}

boot();
