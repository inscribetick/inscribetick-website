/**
 * $TICK free-claim event: receives entries from inscribetick.com and stores them in this Google Sheet.
 *
 * Setup (once): Extensions → Apps Script → paste this file → Deploy → New deployment → Web app,
 *   Execute as: Me, Who has access: Anyone → Deploy → copy the Web app URL into config.js (entryUrl).
 *
 * Sheet columns: Time (UTC) | X handle | Wallet | Reply link | Status
 * Mark winners by typing "approved" in the Status column, then File → Download → CSV.
 */
const SHEET_NAME = "Entries";
const CLOSES_AT = "2026-11-12T14:00:00Z"; // 12 Nov 2026, 21:00 WIB. After this time new entries are refused.
const MAX_ENTRIES = 20000;

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

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["Time (UTC)", "X handle", "Wallet", "Reply link", "Status"]);
    sh.setFrozenRows(1);
    sh.getRange("A:E").setNumberFormat("@"); // store everything as plain text (no formulas)
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
