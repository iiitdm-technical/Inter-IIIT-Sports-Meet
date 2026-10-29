/**
 * Issues a fresh password to every IIIT account and writes the credentials
 * sheet for organizers to distribute.
 *
 *   npm run db:reset-iiit-passwords                      # all IIIT accounts
 *   npm run db:reset-iiit-passwords -- iiit-una iiit-pune  # only these
 *
 * - Creates any IIIT account from src/data/iiits.js that is missing.
 * - Resetting a password signs out all of that account's sessions.
 * - Writes .private/iiit-credentials.{json,csv} (git-ignored). Passwords are
 *   never stored anywhere else; rerun this script if the sheet is lost.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import pg from "pg";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import { auditLog, sessions, users } from "./schema.js";
import { iiits } from "../data/iiits.js";

const outDir = ".private";
const only = process.argv.slice(2).map((name) => name.trim().toLowerCase()).filter(Boolean);

// No 0/O, 1/l/I: these passwords are read off a sheet and typed by hand.
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function makePassword() {
  const chars = Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function csvCell(value) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL.");
  process.exit(1);
}

const known = iiits.map(({ name }) => ({ username: slugify(name), iiitName: name }));
const targets = only.length ? known.filter((account) => only.includes(account.username)) : known;
const unknown = only.filter((name) => !known.some((account) => account.username === name));
if (unknown.length) {
  console.error(`Unknown IIIT usernames: ${unknown.join(", ")}`);
  process.exit(1);
}

const hostname = new URL(process.env.DATABASE_URL).hostname;
const local = hostname === "localhost" || hostname === "127.0.0.1";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: local ? false : { rejectUnauthorized: true },
  max: 1,
});
const db = drizzle(pool);

try {
  const accounts = await Promise.all(targets.map(async (account) => {
    const password = makePassword();
    return { ...account, password, passwordHash: await bcrypt.hash(password, 12) };
  }));

  const created = await db.transaction(async (tx) => {
    const existing = await tx.select().from(users)
      .where(inArray(users.username, accounts.map((account) => account.username)));
    if (existing.some((user) => user.role !== "iiit")) {
      throw new Error("An IIIT username belongs to a non-IIIT account");
    }

    const added = [];
    for (const account of accounts) {
      const user = existing.find((row) => row.username === account.username);
      if (user) {
        await tx.update(users)
          .set({ passwordHash: account.passwordHash, updatedAt: new Date() })
          .where(eq(users.id, user.id));
        await tx.delete(sessions).where(eq(sessions.userId, user.id));
      } else {
        await tx.insert(users).values({
          username: account.username,
          passwordHash: account.passwordHash,
          role: "iiit",
          iiitName: account.iiitName,
          iiitCode: account.username,
        });
        added.push(account.username);
      }
    }

    await tx.insert(auditLog).values({
      actor: "reset-iiit-passwords script",
      role: "system",
      action: "iiit_passwords_reset",
      target: only.length ? only.join(",") : "all",
      details: { accounts: accounts.map((account) => account.username), created: added },
    });
    return added;
  });

  const sheet = accounts.map(({ iiitName, username, password }) => ({ iiitName, username, password }));
  await mkdir(outDir, { recursive: true, mode: 0o700 });
  await writeFile(`${outDir}/iiit-credentials.json`, JSON.stringify(sheet, null, 2) + "\n", { mode: 0o600 });
  await writeFile(
    `${outDir}/iiit-credentials.csv`,
    ["IIIT,Username,Password", ...sheet.map((row) => [row.iiitName, row.username, row.password].map(csvCell).join(","))].join("\n") + "\n",
    { mode: 0o600 },
  );

  console.log(`Reset ${accounts.length - created.length} and created ${created.length} IIIT accounts.`);
  console.log(`Credentials: ${outDir}/iiit-credentials.csv`);
} catch (error) {
  console.error(`Could not reset IIIT passwords: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
