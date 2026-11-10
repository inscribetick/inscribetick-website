/**
 * $TICK early supporters: receives entries from inscribetick.com, stores them in this Google Sheet,
 * and (optionally) checks them against the X API.
 *
 * Setup (once): Extensions → Apps Script → paste this file → Deploy → New deployment → Web app,
 *   Execute as: Me, Who has access: Anyone → Deploy → copy the Web app URL into config.js (entryUrl).
 * After changing this code: Deploy → Manage deployments → ✏️ → Version: New version → Deploy (the URL stays the same).
 *
 * Sheet "Entries": Time (UTC) | X handle | Wallet | Reply link | Status | Check | Verified | Reply | Repost | Checked at
 * Mark selected wallets by typing "approved" in Status, then File → Download → CSV.
 *
 * X checks (menu "TICK" in the sheet):
 *   1. TICK → Set X bearer token (stored privately in this script's properties; never share it).
 *   2. TICK → Update repost list (reads who reposted the event post; run once near or after the close).
 *   3. TICK → Check next 50 entries (repeat until every row is checked). Costs X API credits.
 *   4. TICK → Approve rows marked OK (writes "approved" in Status for rows where every check passed).
 */
const SHEET_NAME = "Entries";
const REPOSTERS_SHEET = "Reposters";
const CLOSES_AT = "2026-11-12T14:00:00Z"; // 12 Nov 2026, 21:00 WIB. After this time new entries are refused.
const MAX_ENTRIES = 20000;
const EVENT_POST_ID = "2120063068680139123"; // https://x.com/ticksdotcom/status/2120063068680139123
const CHECK_BATCH = 50;
const HEADERS = ["Time (UTC)", "X handle", "Wallet", "Reply link", "Status", "Check", "Verified", "Reply", "Repost", "Checked at"];

// ------------------------------------------------------------------ web app (website form)

function doGet() {
  return json_({ ok: true, count: count_(), open: isOpen_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return json_({ ok: false, error: "busy" });
  try {
    if (!isOpen_()) return json_({ ok: false, error: "closed" });
    let d;
    try { d = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (_) { return json_({ ok: false, error: "bad_request" }); }
    if (d.website) return json_({ ok: true, count: count_() }); // honeypot field filled by a bot: pretend success

    const handle = String(d.handle || "").trim().replace(/^@/, "");
    const wallet = String(d.wallet || "").trim();
    const link = String(d.link || "").trim().split("?")[0];
    if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return json_({ ok: false, error: "bad_handle" });
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet) || /^0x0{40}$/i.test(wallet)) return json_({ ok: false, error: "bad_wallet" });
    const m = link.match(/^https:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})\/?$/);
    if (!m) return json_({ ok: false, error: "bad_link" });
    if (m[1].toLowerCase() !== handle.toLowerCase()) return json_({ ok: false, error: "link_not_yours" });

    const sh = sheet_();
    const last = sh.getLastRow();
    if (last - 1 >= MAX_ENTRIES) return json_({ ok: false, error: "full" });
    if (last > 1) {
      const rows = sh.getRange(2, 2, last - 1, 3).getValues(); // handle, wallet, link
      const h = "@" + handle.toLowerCase(), w = wallet.toLowerCase(), l = link.toLowerCase();
      for (const r of rows) {
        if (String(r[0]).toLowerCase() === h) return json_({ ok: false, error: "duplicate_handle" });
        if (String(r[1]).toLowerCase() === w) return json_({ ok: false, error: "duplicate_wallet" });
        if (String(r[2]).toLowerCase() === l) return json_({ ok: false, error: "duplicate_link" });
      }
    }
    sh.appendRow([new Date().toISOString(), "@" + handle, wallet, link, ""]);
    return json_({ ok: true, count: last }); // last = header + previous rows, so this is the new total
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------ sheet menu (owner only)

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("TICK")
    .addItem("Set X bearer token", "setToken")
    .addItem("Update repost list", "updateReposters")
    .addItem("Check next " + CHECK_BATCH + " entries", "checkEntries")
    .addItem("Approve rows marked OK", "approveOk")
    .addToUi();
}

function setToken() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt("X bearer token", "Paste the Bearer Token of your X developer app. It is stored privately in this script.", ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const t = r.getResponseText().trim();
  if (!t) return;
  PropertiesService.getScriptProperties().setProperty("X_BEARER", t);
  ui.alert("Saved.");
}

/** Reads every account that reposted the event post into the "Reposters" sheet (one paid read per account). */
function updateReposters() {
  const ui = SpreadsheetApp.getUi();
  const names = [];
  let token = "";
  for (let page = 0; page < 200; page++) {
    const url = "https://api.x.com/2/tweets/" + EVENT_POST_ID + "/retweeted_by?max_results=100" + (token ? "&pagination_token=" + encodeURIComponent(token) : "");
    const res = x_(url);
    if (res.error) { ui.alert("Stopped: " + res.error + (names.length ? "\nSaved " + names.length + " reposters so far." : "")); break; }
    (res.body.data || []).forEach(function (u) { names.push([String(u.username).toLowerCase()]); });
    token = res.body.meta && res.body.meta.next_token;
    if (!token) break;
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(REPOSTERS_SHEET) || ss.insertSheet(REPOSTERS_SHEET);
  sh.clear();
  sh.getRange(1, 1, 1, 2).setValues([["username (lowercase)", "Updated " + new Date().toISOString()]]);
  if (names.length) sh.getRange(2, 1, names.length, 1).setValues(names);
  ui.alert("Repost list updated: " + names.length + " accounts.");
}

/** Checks the next unchecked rows: blue/gold/grey check, reply from that account to the event post containing the wallet, repost. */
function checkEntries() {
  const ui = SpreadsheetApp.getUi();
  const sh = sheet_();
  ensureHeaders_(sh);
  const last = sh.getLastRow();
  if (last < 2) return ui.alert("No entries yet.");
  const values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const todo = [];
  for (let i = 0; i < values.length && todo.length < CHECK_BATCH; i++) {
    if (!values[i][5] && values[i][3]) todo.push(i);
  }
  if (!todo.length) return ui.alert("Every entry is already checked.");

  const reposters = loadReposters_();
  const ids = todo.map(function (i) { const m = String(values[i][3]).match(/status\/(\d+)/); return m ? m[1] : ""; });
  const url = "https://api.x.com/2/tweets?ids=" + ids.filter(String).join(",") +
    "&tweet.fields=author_id,conversation_id,referenced_tweets,text&expansions=author_id&user.fields=username,verified,verified_type";
  const res = x_(url);
  if (res.error) return ui.alert("Stopped: " + res.error);
  const tweets = {};
  (res.body.data || []).forEach(function (t) { tweets[t.id] = t; });
  const users = {};
  ((res.body.includes && res.body.includes.users) || []).forEach(function (u) { users[u.id] = u; });

  const now = new Date().toISOString();
  let ok = 0;
  todo.forEach(function (i, k) {
    const handle = String(values[i][1]).replace(/^@/, "").toLowerCase();
    const wallet = String(values[i][2]).toLowerCase();
    const t = tweets[ids[k]];
    let verified = "?", reply = "", repost = "";
    if (!t) {
      reply = "post not found";
    } else {
      const u = users[t.author_id] || {};
      const vt = u.verified_type || (u.verified ? "blue" : "none");
      verified = vt === "none" ? "no" : vt;
      const isReply = t.conversation_id === EVENT_POST_ID ||
        (t.referenced_tweets || []).some(function (r) { return r.type === "replied_to" && r.id === EVENT_POST_ID; });
      if (String(u.username || "").toLowerCase() !== handle) reply = "different account";
      else if (!isReply) reply = "not a reply to the event post";
      else if (String(t.text || "").toLowerCase().indexOf(wallet) === -1) reply = "wallet not in reply";
      else reply = "ok";
    }
    repost = reposters === null ? "not checked" : (reposters[handle] ? "ok" : "no");
    const pass = verified !== "no" && verified !== "?" && reply === "ok" && repost === "ok";
    if (pass) ok++;
    sh.getRange(i + 2, 6, 1, 5).setValues([[pass ? "OK" : "FAIL", verified, reply, repost, now]]);
  });
  ui.alert("Checked " + todo.length + " entries: " + ok + " OK." + (reposters === null ? "\nRun 'Update repost list' first to check reposts." : ""));
}

function approveOk() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return;
  const range = sh.getRange(2, 5, last - 1, 2); // Status, Check
  const v = range.getValues();
  let n = 0;
  v.forEach(function (r) { if (r[1] === "OK" && !r[0]) { r[0] = "approved"; n++; } });
  range.setValues(v);
  SpreadsheetApp.getUi().alert("Marked " + n + " rows as approved. Review them before exporting.");
}

// ------------------------------------------------------------------ helpers

function x_(url) {
  const tokenValue = PropertiesService.getScriptProperties().getProperty("X_BEARER");
  if (!tokenValue) return { error: "no bearer token. Use TICK → Set X bearer token." };
  const r = UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + tokenValue }, muteHttpExceptions: true });
  const code = r.getResponseCode();
  let body = {};
  try { body = JSON.parse(r.getContentText()); } catch (_) {}
  if (code === 429) return { error: "X rate limit reached. Wait 15 minutes and run it again." };
  if (code === 402) return { error: "X API credits are used up. Add credits at developer.x.com." };
  if (code === 401 || code === 403) return { error: "X rejected the token (" + code + "). Check the bearer token and the app's access." };
  if (code >= 400) return { error: "X API error " + code + ": " + (body.title || body.detail || r.getContentText().slice(0, 200)) };
  return { body: body };
}

function loadReposters_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REPOSTERS_SHEET);
  if (!sh || sh.getLastRow() < 2) return null;
  const map = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { if (r[0]) map[String(r[0]).toLowerCase()] = true; });
  return map;
}

function ensureHeaders_(sh) {
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange("A:J").setNumberFormat("@"); // store everything as plain text (no formulas)
  }
  return sh;
}

function count_() {
  return Math.max(0, sheet_().getLastRow() - 1);
}

function isOpen_() {
  return !CLOSES_AT || Date.now() < Date.parse(CLOSES_AT);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
