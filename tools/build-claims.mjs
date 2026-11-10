// Builds public/claims.json (the free-claim winners list) and prints its Merkle root.
//
//   node tools/build-claims.mjs winners.txt
//   node tools/build-claims.mjs entries.csv --approved   (Google Sheet export: only rows marked "approved")
//
// winners.txt: one winner per line. Each line must contain one EVM address (0x + 40 hex characters);
// anything else on the line (an X handle, a comma, a link) is ignored. Duplicates are removed.
// Lines with no address, two addresses, or an address with a broken checksum are listed and skipped.
// Paste the printed root into the deploy console check (it reads claims.json itself) or into CLAIM_ROOT.
import { readFileSync, writeFileSync } from "node:fs";
import { getAddress, isAddress } from "viem";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

const file = process.argv[2];
const onlyApproved = process.argv.includes("--approved");
if (!file) {
  console.error("Usage: node tools/build-claims.mjs winners.txt");
  process.exit(1);
}
const lines = readFileSync(file, "utf8").split(/\r?\n/);
const seen = new Set();
const addresses = [];
const skipped = [];
let dupes = 0;
lines.forEach((line, i) => {
  if (!line.trim()) return;
  if (onlyApproved && !/(^|,)\s*"?approved"?\s*(,|$)/i.test(line)) return;
  const found = line.match(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g) || [];
  if (found.length !== 1) return skipped.push(`line ${i + 1}: ${found.length === 0 ? "no address" : "more than one address"} — ${line.trim()}`);
  // A mixed-case address carries a checksum; if it does not match, the address was mistyped.
  if (!isAddress(found[0], { strict: true })) return skipped.push(`line ${i + 1}: bad checksum (typo?) — ${line.trim()}`);
  const a = getAddress(found[0]);
  if (/^0x0{40}$/i.test(a)) return skipped.push(`line ${i + 1}: zero address`);
  if (seen.has(a)) { dupes++; return; }
  seen.add(a);
  addresses.push(a);
});

if (addresses.length === 0) { console.error("No valid addresses found."); process.exit(1); }
if (addresses.length > 500) {
  console.error(`${addresses.length} unique addresses: the contract allows at most 500 claims. Trim the list to 500.`);
  process.exit(1);
}
const tree = StandardMerkleTree.of(addresses.map((a) => [a]), ["address"]);
writeFileSync(new URL("../public/claims.json", import.meta.url), JSON.stringify({ root: tree.root, count: addresses.length, addresses }, null, 1) + "\n");

console.log(`Winners: ${addresses.length}   duplicates removed: ${dupes}   skipped lines: ${skipped.length}`);
for (const s of skipped) console.log("  skipped " + s);
console.log(`\nWrote public/claims.json\nClaim root: ${tree.root}`);
