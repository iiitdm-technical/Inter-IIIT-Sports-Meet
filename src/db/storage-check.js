import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

import { mkdir, readdir, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getPool } from "./index.js";
import { STORAGE_LIMIT_BYTES, databaseSize, directorySize, storageReportFile } from "../lib/storage/usage.js";

/**
 * Measures everything the website uses against the institute's 3 GB limit:
 * the deployment folder (releases, uploads, backups), the Git checkout used
 * for deployments, and the MySQL database. Prints a summary, writes it to
 * the report file the admin dashboard reads, warns at 80% and, with
 * --strict, exits non-zero when the limit is exceeded.
 */
const home = os.homedir();
const deployRoot = process.env.UPDATE_DEPLOY_ROOT || path.join(home, ".local", "share", "inter-iiit");
const checkout = process.env.STORAGE_CHECKOUT_DIR || path.join(home, "allindiaiiitsportsmeet.iiitdm.ac.in");
const strict = process.argv.includes("--strict");
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function main() {
  const parts = [];
  let entries = [];
  try {
    entries = await readdir(deployRoot);
  } catch {}
  for (const name of entries.sort()) {
    const { bytes } = await directorySize(path.join(deployRoot, name));
    parts.push({ name: `deploy/${name}`, bytes });
  }
  parts.push({ name: "checkout", bytes: (await directorySize(checkout)).bytes });
  try {
    parts.push({ name: "database", bytes: await databaseSize() });
  } catch (error) {
    console.warn(`WARN could not measure the database: ${error.message}`);
  }

  const totalBytes = parts.reduce((sum, part) => sum + part.bytes, 0);
  const percent = Math.round((totalBytes / STORAGE_LIMIT_BYTES) * 1000) / 10;
  const report = { measuredAt: new Date().toISOString(), limitBytes: STORAGE_LIMIT_BYTES, totalBytes, percent, parts };

  for (const part of parts) console.log(`  ${part.name.padEnd(22)} ${mb(part.bytes).padStart(10)}`);
  console.log(`  ${"TOTAL".padEnd(22)} ${mb(totalBytes).padStart(10)}  of ${mb(STORAGE_LIMIT_BYTES)} (${percent}%)`);

  const file = storageReportFile() || path.join(deployRoot, "storage-usage.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  await rename(`${file}.tmp`, file);

  if (totalBytes > STORAGE_LIMIT_BYTES) {
    console.error(`OVER LIMIT: the website uses ${mb(totalBytes)}, above the ${mb(STORAGE_LIMIT_BYTES)} allocation.`);
    if (strict) process.exitCode = 2;
  } else if (percent >= 80) {
    console.warn(`WARN storage is at ${percent}% of the allocation.`);
  } else {
    console.log("PASS storage within the allocation");
  }
}

main()
  .catch((error) => {
    console.error(`Storage check failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {}
  });
