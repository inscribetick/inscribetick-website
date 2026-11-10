// Free-claim list. claims.json holds the published winners list; the Merkle tree is rebuilt here
// and must match both the root in the file and the root fixed in the contract.
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { isAddress, getAddress } from "viem";

export const ZERO_ROOT = "0x0000000000000000000000000000000000000000000000000000000000000000";

export function buildTree(addresses) {
  return StandardMerkleTree.of(addresses.map((a) => [getAddress(a)]), ["address"]);
}

/** Loads and checks claims.json. Returns { root, count, tree, has(addr), proof(addr) } or null if not published. */
export async function loadClaims(url) {
  let data;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    data = await res.json();
  } catch (_) {
    return null;
  }
  if (!data || !Array.isArray(data.addresses) || data.addresses.length === 0) return null;
  if (!data.addresses.every((a) => typeof a === "string" && isAddress(a))) throw new Error("claims.json has an invalid address.");
  const tree = buildTree(data.addresses);
  if (String(data.root).toLowerCase() !== tree.root.toLowerCase()) throw new Error("claims.json root does not match its list.");
  const index = new Map();
  for (const [i, v] of tree.entries()) index.set(v[0].toLowerCase(), i);
  return {
    root: tree.root,
    count: data.addresses.length,
    tree,
    has: (a) => index.has(String(a).toLowerCase()),
    proof: (a) => tree.getProof(index.get(String(a).toLowerCase())),
  };
}
