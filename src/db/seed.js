import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import bcrypt from "bcryptjs";
import { createDatabasePool } from "./index.js";
import { users } from "./schema.js";
import { iiits } from "../data/iiits.js";

const credentialsPath = process.env.SEED_CREDENTIALS_PATH || ".private/seed-credentials.json";

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function credentials() {
  try {
    return JSON.parse(await readFile(credentialsPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  // IIIT accounts only. The organizer admin is created with `npm run db:set-admin`.
  const accounts = [
    ...iiits.map(({ name }) => ({ username: slugify(name), role: "iiit", iiitName: name, iiitCode: slugify(name) })),
  ].map((account) => ({ ...account, password: randomBytes(18).toString("base64url") }));

  await mkdir(dirname(credentialsPath), { recursive: true, mode: 0o700 });
  await writeFile(credentialsPath, JSON.stringify(accounts, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return accounts;
}

async function seed() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = createDatabasePool(process.env.DATABASE_URL);
  try {
    const accounts = await credentials();
    const db = drizzle(pool, { mode: "default" });
    let inserted = 0;
    let skipped = 0;
    await db.transaction(async (tx) => {
      for (const account of accounts.filter((item) => item.role === "iiit")) {
        const [existing] = await tx.select({ role: users.role })
          .from(users)
          .where(eq(users.iiitCode, account.iiitCode))
          .limit(1);
        if (existing) {
          if (existing.role !== account.role) {
            throw new Error(`Existing account for ${account.iiitCode} is not an IIIT account`);
          }
          skipped += 1;
          continue;
        }

        await tx.insert(users).values({
          username: account.username,
          passwordHash: await bcrypt.hash(account.password, 12),
          role: account.role,
          iiitName: account.iiitName,
          iiitCode: account.iiitCode,
        });
        inserted += 1;
      }
    });
    console.log(`Seeded ${inserted} IIIT account${inserted === 1 ? "" : "s"}; skipped ${skipped} existing account${skipped === 1 ? "" : "s"}. Credentials: ${credentialsPath}`);
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error("Account seed failed:", error.message);
  process.exitCode = 1;
});
