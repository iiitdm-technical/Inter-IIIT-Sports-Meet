import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { storageMode } from "./index.js";
import { storageRoot } from "./local.js";

/**
 * Storage accounting for the institute's limit: the website (application
 * files, uploads and the database) may use at most STORAGE_LIMIT_MB in
 * total (3 GB). Payment proofs have their own, much smaller cap so uploads
 * can never fill the allocation.
 */
const MB = 1024 * 1024;
export const STORAGE_LIMIT_BYTES = (Number(process.env.STORAGE_LIMIT_MB) || 3072) * MB;
export const PROOF_STORAGE_MAX_BYTES = (Number(process.env.PROOF_STORAGE_MAX_MB) || 200) * MB;

/** Disk space used under `dir` (like `du`), without following symlinks. */
export async function directorySize(dir) {
  let bytes = 0;
  let files = 0;
  const walk = async (current) => {
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    bytes += info.blocks ? info.blocks * 512 : info.size;
    if (info.isDirectory()) {
      for (const name of await readdir(current)) await walk(path.join(current, name));
    } else if (info.isFile()) {
      files += 1;
    }
  };
  await walk(dir);
  return { bytes, files };
}

/** Space used by payment proofs on this server, or null when they live in Neon. */
export async function proofStorageUsage() {
  if (storageMode() !== "local") return null;
  return directorySize(path.join(storageRoot(), "payment-proofs"));
}

/** Data and index size of this app's MySQL database. */
export async function databaseSize() {
  const [rows] = await getDb().execute(sql`
    SELECT COALESCE(SUM(data_length + index_length), 0) AS bytes
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `);
  return Number(rows[0]?.bytes || 0);
}

/** Where `npm run storage:check` writes its last full measurement. */
export function storageReportFile() {
  if (process.env.STORAGE_REPORT_FILE) return process.env.STORAGE_REPORT_FILE;
  if (storageMode() === "local") return path.join(path.dirname(storageRoot()), "storage-usage.json");
  return null;
}

export async function readStorageReport() {
  const file = storageReportFile();
  if (!file) return null;
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

/** Summary for the admin dashboard; never throws. */
export async function getStorageSummary() {
  const [proofs, databaseBytes, report] = await Promise.all([
    proofStorageUsage().catch(() => null),
    databaseSize().catch(() => null),
    readStorageReport(),
  ]);
  return {
    limitBytes: STORAGE_LIMIT_BYTES,
    proofLimitBytes: PROOF_STORAGE_MAX_BYTES,
    proofs,
    databaseBytes,
    report: report && { totalBytes: report.totalBytes, measuredAt: report.measuredAt, parts: report.parts },
  };
}
