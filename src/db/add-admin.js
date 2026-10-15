import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { users } from "./schema.js";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
const displayName = process.env.ADMIN_NAME?.trim();
const emailResult = z.email().max(254).safeParse(email);

if (!process.env.DATABASE_URL || !emailResult.success ||
    !/^[a-z][a-z0-9._-]{2,63}$/.test(username || "") ||
    !displayName || displayName.length > 128) {
  console.error("Set DATABASE_URL, ADMIN_EMAIL, ADMIN_USERNAME (3–64 letters/numbers/._-), and ADMIN_NAME.");
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
const credentialsPath = path.resolve(process.env.ADMIN_CREDENTIALS_PATH || path.join(".private", "admin-accounts", `${username}.json`));

try {
  const [existing] = await db.select({ username: users.username }).from(users)
    .where(or(eq(users.username, username), eq(users.email, email))).limit(1);
  if (existing) throw new Error("Admin username or email is already in use");

  const password = randomBytes(24).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);
  await mkdir(path.dirname(credentialsPath), { recursive: true, mode: 0o700 });
  await writeFile(credentialsPath, JSON.stringify({ username, email, displayName, password }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  try {
    await db.insert(users).values({ username, email, displayName, passwordHash, role: "admin" });
  } catch (error) {
    await unlink(credentialsPath);
    throw error;
  }
  console.log(`Admin ${username} created. Credentials saved to ${credentialsPath}`);
} catch (error) {
  console.error(`Could not create admin: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
