// $TICK website settings. This is the only file you need to edit.
// After deploying the contracts, paste the TickMint address below. Leave it empty to show "coming soon".
window.TICK_CONFIG = {
  // Address of the TickMint contract on Elysium mainnet (TickToken and TickLocker are read from it).
  tickMint: "",

  // Elysium mainnet
  chainId: 99901,
  // Public RPC works; for launch day use your own Alchemy/QuickNode Elysium URL.
  rpcUrl: "https://rpc.elysium.kinetiq.xyz",
  // Block explorer base URL (no trailing slash). Leave empty until the official explorer is live.
  explorerUrl: "",

  // Your X handle without @, e.g. "inscribetick". Leave empty to hide the X link.
  xHandle: "ticksdotcom",

  // Free-claim event
  // Web app URL of the Google Apps Script (tools/event-sheet.gs). Leave empty to show "opening soon".
  entryUrl: "https://script.google.com/macros/s/AKfycbzNngjV0BhQ0lJh_yrwBlroUZjIMXAXBxeHQvwePLldRn7FiOMZPb7rihxmZmWWBAw/exec",
  // The event post on X that people must repost and reply to.
  eventPostUrl: "https://x.com/ticksdotcom/status/2120063068680139123",
  // When entries close (UTC, ISO format), e.g. "2026-11-14T14:00:00Z". Empty = no countdown shown.
  eventClosesAt: "2026-11-12T14:00:00Z",
};
