import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

/**
 * Payment proofs stored as files on this server, under PROOF_STORAGE_DIR.
 *
 * The directory must be outside the app's release folder so deployments and
 * rollbacks never remove it, and it is never served directly: proofs are
 * streamed only through the authenticated /api/payment/proof route. Keys are
 * checked against the exact shape the upload API creates, so a key can never
 * reach a file outside the directory.
 */
const KEY_PATTERN = /^payment-proofs\/[a-z0-9-]{1,64}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/;
const PREFIX_PATTERN = /^payment-proofs\/[a-z0-9-]{1,64}\/$/;
const CONTENT_TYPES = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png" };

function notFound() {
  const error = new Error("Payment proof not found");
  error.statusCode = 404;
  return error;
}

export function storageRoot() {
  const dir = process.env.PROOF_STORAGE_DIR?.trim();
  if (!dir || !path.isAbsolute(dir)) throw new Error("PROOF_STORAGE_DIR must be an absolute path");
  return path.resolve(dir);
}

function fileFor(key) {
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) throw notFound();
  return path.join(storageRoot(), ...key.split("/"));
}

function contentTypeFor(key) {
  return CONTENT_TYPES[key.split(".").pop()];
}

export async function putProof(key, bytes) {
  const file = fileFor(key);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  // Write then rename, so a crash never leaves a half-written proof in place.
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, bytes, { mode: 0o600, flag: "wx" });
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

export async function headProof(key) {
  try {
    const info = await stat(fileFor(key));
    if (!info.isFile()) throw notFound();
    return { pathname: key, contentType: contentTypeFor(key), size: info.size };
  } catch (error) {
    if (error.code === "ENOENT") throw notFound();
    throw error;
  }
}

/** Returns { body: web ReadableStream, contentType, size }. */
export async function getProof(key) {
  const { contentType, size } = await headProof(key);
  return { body: Readable.toWeb(createReadStream(fileFor(key))), contentType, size };
}

export async function deleteProof(key) {
  try {
    await unlink(fileFor(key));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

/** Keys stored under `prefix`, e.g. "payment-proofs/iiit-kota/". */
export async function listProofs(prefix) {
  if (!PREFIX_PATTERN.test(prefix)) return [];
  try {
    const names = await readdir(path.join(storageRoot(), ...prefix.split("/").filter(Boolean)));
    return names.map((name) => prefix + name).filter((key) => KEY_PATTERN.test(key));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

/** Deployment preflight: the directory is persistent, private and writable. */
export async function checkStorage() {
  const root = storageRoot();
  const relative = path.relative(process.cwd(), root);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new Error("PROOF_STORAGE_DIR must be outside the app folder, or a deployment would delete the proofs");
  }
  await mkdir(root, { recursive: true, mode: 0o700 });
  const info = await stat(root);
  if (info.mode & 0o077) console.warn(`WARN ${root} is readable by other users; run chmod 700 on it`);
  const probe = path.join(root, `.env-check-${randomUUID()}.txt`);
  try {
    await writeFile(probe, "storage-ready", { mode: 0o600, flag: "wx" });
    if ((await readFile(probe, "utf8")) !== "storage-ready") throw new Error("Proof storage returned unexpected content");
  } finally {
    await rm(probe, { force: true });
  }
  return `server folder ${root}`;
}
