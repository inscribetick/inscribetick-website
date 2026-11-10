// Free-claim event form: sends entries to a Google Apps Script web app that writes them to a Google Sheet.
import { isAddress } from "viem";

const $ = (id) => document.getElementById(id);
const HANDLE = /^@?([A-Za-z0-9_]{1,15})$/;
const LINK = /^https:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})\/?(?:\?.*)?$/;
const SENT_KEY = "tick:event-entry";

const ERRORS = {
  bad_handle: "That X username doesn't look right.",
  bad_wallet: "That wallet address doesn't look right.",
  bad_link: "Paste the link to your reply (https://x.com/yourname/status/…).",
  link_not_yours: "The reply link must be from the same X account you entered.",
  duplicate_handle: "This X account has already entered.",
  duplicate_wallet: "This wallet has already entered.",
  duplicate_link: "This reply has already been submitted.",
  closed: "Entries are closed.",
  full: "Entries are full.",
  busy: "Lots of entries right now. Please try again in a few seconds.",
};

export function initEvent(C) {
  const form = $("eventForm");
  if (!form) return;
  const url = typeof C.entryUrl === "string" && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(C.entryUrl) ? C.entryUrl : "";
  const closesAt = C.eventClosesAt ? Date.parse(C.eventClosesAt) : NaN;
  const btn = $("evSubmit");
  const msg = $("evMsg");
  if (C.eventPostUrl && /^https:\/\/(x|twitter)\.com\//.test(C.eventPostUrl)) $("eventPostLink").href = C.eventPostUrl;

  let open = !!url;
  let busy = false;
  const isClosed = () => Number.isFinite(closesAt) && Date.now() >= closesAt;

  const say = (text, kind) => { msg.textContent = text; msg.className = "event-msg" + (kind ? " " + kind : ""); };
  const setCount = (n) => { if (Number.isFinite(n)) $("entryCount").textContent = Number(n).toLocaleString("en-US"); };

  function previous() {
    try { return JSON.parse(localStorage.getItem(SENT_KEY) || "null"); } catch (_) { return null; }
  }

  function renderButton() {
    if (!url) { btn.textContent = "Opening soon"; btn.disabled = true; return; }
    if (isClosed() || !open) { btn.textContent = "Entries closed"; btn.disabled = true; return; }
    btn.textContent = busy ? "Sending…" : "Submit my entry";
    btn.disabled = busy;
  }

  function renderClose() {
    const el = $("eventClose");
    if (!Number.isFinite(closesAt)) { el.textContent = ""; return; }
    const left = Math.floor((closesAt - Date.now()) / 1000);
    if (left <= 0) { el.textContent = "Entries are closed. Winners are being checked."; return; }
    const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
    const pad = (x) => String(x).padStart(2, "0");
    el.textContent = `Entries close in ${d ? d + "d " : ""}${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  }

  function field(id, ok) {
    $(id).setAttribute("aria-invalid", ok ? "false" : "true");
    return ok;
  }

  async function refreshCount() {
    if (!url) return;
    try {
      const r = await fetch(url, { method: "GET", cache: "no-store" });
      const j = await r.json();
      setCount(j.count);
      if (j.open === false) open = false;
      renderButton();
    } catch (_) {}
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (busy || !url || isClosed()) return;
    const hm = $("evHandle").value.trim().match(HANDLE);
    const wallet = $("evWallet").value.trim();
    const link = $("evLink").value.trim();
    const lm = link.match(LINK);
    const okH = field("evHandle", !!hm);
    const okW = field("evWallet", isAddress(wallet, { strict: true }) && !/^0x0{40}$/i.test(wallet));
    const okL = field("evLink", !!lm && !!hm && lm[1].toLowerCase() === hm[1].toLowerCase());
    if (!okH) return say(ERRORS.bad_handle, "err");
    if (!okW) return say("That wallet address doesn't look right. Copy it again from your wallet.", "err");
    if (!lm) return say(ERRORS.bad_link, "err");
    if (!okL) return say(ERRORS.link_not_yours, "err");
    if (!$("evConfirm").checked) return say("Please confirm you reposted the event post and have a blue check.", "err");

    busy = true;
    renderButton();
    say("");
    try {
      // text/plain keeps this a "simple" request (no CORS preflight), which Apps Script requires.
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ handle: hm[1], wallet, link: link.split("?")[0], website: $("evWebsite").value }),
      });
      const j = await r.json();
      if (j.ok) {
        setCount(j.count);
        try { localStorage.setItem(SENT_KEY, JSON.stringify({ handle: hm[1], wallet })); } catch (_) {}
        form.reset();
        say(`You're in, @${hm[1]}. Winners are checked by hand and announced on X. If you win, claim on this page when the mint opens.`, "ok");
      } else {
        if (j.error === "closed") open = false;
        say(ERRORS[j.error] || "Something went wrong. Please try again.", "err");
      }
    } catch (_) {
      say("Couldn't reach the entry list. Check your connection and try again.", "err");
    } finally {
      busy = false;
      renderButton();
    }
  });

  for (const id of ["evHandle", "evWallet", "evLink"]) $(id).addEventListener("input", () => $(id).removeAttribute("aria-invalid"));

  const prev = previous();
  if (prev && prev.handle) say(`This browser already sent an entry for @${prev.handle}.`, "ok");
  renderButton();
  renderClose();
  setInterval(() => { renderClose(); renderButton(); }, 1000);
  refreshCount();
  setInterval(refreshCount, 30000);
}
