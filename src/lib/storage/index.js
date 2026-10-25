import * as local from "./local.js";
import * as neon from "./neon.js";

/**
 * Payment proof storage. PROOF_STORAGE selects where proofs live:
 * "local" (files on this server, under PROOF_STORAGE_DIR) or "neon"
 * (Neon Object Storage, the default). Both expose the same functions.
 */
export function storageMode() {
  const mode = (process.env.PROOF_STORAGE || "neon").trim().toLowerCase();
  if (mode !== "local" && mode !== "neon") throw new Error('PROOF_STORAGE must be "local" or "neon"');
  return mode;
}

function driver() {
  return storageMode() === "local" ? local : neon;
}

export const putProof = (key, bytes, contentType) => driver().putProof(key, bytes, contentType);
export const headProof = (key) => driver().headProof(key);
export const getProof = (key) => driver().getProof(key);
export const deleteProof = (key) => driver().deleteProof(key);
export const listProofs = (prefix) => driver().listProofs(prefix);
export const checkStorage = () => driver().checkStorage();
