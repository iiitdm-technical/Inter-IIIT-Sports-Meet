/**
 * Creates or updates the organizer admin account.
 *
 *   ADMIN_EMAIL=sports@iiitdm.ac.in ADMIN_PASSWORD='…' npm run db:set-admin -- --remove-other-admins
 *
 * - Reads the password from ADMIN_PASSWORD (never stored in the repository).
 * - Updating an existing admin's password signs out all of its sessions.
 * - --remove-other-admins deletes every other admin account, leaving only
 *   this one; their sessions are removed with them. IIIT accounts are untouched.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

import pg from "pg";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, ne, or } from "drizzle-orm";
import { z } from "zod";
import { auditLog, sessions, users } from "./schema.js";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";
const username = (process.env.ADMIN_USERNAME || "sports-sac").trim().toLowerCase();
const displayName = (process.env.ADMIN_NAME || "Sports-SAC, IIITDM Kancheepuram").trim();
const removeOthers = process.argv.includes("--remove-other-admins");

if (!process.env.DATABASE_URL || !z.email().max(254).safeParse(email).success) {
  console.error("Set DATABASE_URL and a valid ADMIN_EMAIL.");
  process.exit(1);
}
if (password.length < 12 || password.length > 256) {
  console.error("ADMIN_PASSWORD must be 12–256 characters.");
  process.exit(1);
}
if (!/^[a-z][a-z0-9._-]{2,63}$/.test(username) || !displayName || displayName.length > 128) {
  console.error("ADMIN_USERNAME must be 3–64 letters/numbers/._- and ADMIN_NAME at most 128 characters.");
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
  const passwordHash = await bcrypt.hash(password, 12);
  const summary = await db.transaction(async (tx) => {
    const matches = await tx.select().from(users)
      .where(or(eq(users.email, email), eq(users.username, username)));
    if (matches.some((user) => user.role !== "admin")) {
      throw new Error("That email or username belongs to an IIIT account");
    }
    if (matches.length > 1) {
      throw new Error("The email and username belong to two different admin accounts; remove one first");
    }

    let admin = matches[0];
    if (admin) {
      [admin] = await tx.update(users)
        .set({ email, username, displayName, passwordHash, updatedAt: new Date() })
        .where(eq(users.id, admin.id))
        .returning();
      await tx.delete(sessions).where(eq(sessions.userId, admin.id));
    } else {
      [admin] = await tx.insert(users)
        .values({ username, email, displayName, passwordHash, role: "admin" })
        .returning();
    }

    let removed = [];
    if (removeOthers) {
      removed = await tx.delete(users)
        .where(and(eq(users.role, "admin"), ne(users.id, admin.id)))
        .returning({ username: users.username, email: users.email });
    }

    await tx.insert(auditLog).values({
      actor: "set-admin script",
      role: "system",
      action: matches.length ? "admin_updated" : "admin_created",
      target: admin.username,
      details: { email, removedAdmins: removed.map((user) => user.username) },
    });
    return { admin, created: matches.length === 0, removed };
  });

  console.log(`${summary.created ? "Created" : "Updated"} admin "${summary.admin.username}" <${summary.admin.email}>.`);
  if (removeOthers) {
    console.log(summary.removed.length
      ? `Removed other admin accounts: ${summary.removed.map((user) => `${user.username}${user.email ? ` <${user.email}>` : ""}`).join(", ")}`
      : "No other admin accounts existed.");
  }
  const remaining = await db.select({ username: users.username, email: users.email }).from(users).where(eq(users.role, "admin"));
  console.log(`Admin accounts now: ${remaining.map((user) => `${user.username} <${user.email || "no email"}>`).join(", ")}`);
} catch (error) {
  console.error(`Could not set admin: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
