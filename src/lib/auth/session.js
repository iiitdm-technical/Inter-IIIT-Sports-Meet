import crypto from "crypto";
import { cookies } from "next/headers.js";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { sessions, users } from "../../db/schema.js";

/**
 * Server-side sessions.
 *
 * The cookie carries a random 256-bit token. The database stores only a
 * hash of it (HMAC with SESSION_SECRET when set), so a database leak does
 * not yield usable cookies. Every request re-reads the user,
 * so deleting a user or a session takes effect immediately.
 *
 * Sessions slide: each use (at most once an hour) pushes the expiry forward
 * by the full lifetime. Several sessions per user are allowed (one per
 * device); signing in again never signs out other devices.
 */
const DAY_SECONDS = 24 * 60 * 60;
const RENEW_AFTER_MS = 60 * 60 * 1000;

const secureCookies = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production";

// __Host- cookies must be Secure, host-only and path=/, which blocks
// subdomains from setting or overwriting the session cookie.
export const SESSION_COOKIE_NAME = secureCookies ? "__Host-inter_iiit_session" : "inter_iiit_session";

function lifetimeSeconds(role) {
  const days = role === "admin"
    ? Number(process.env.ADMIN_SESSION_DAYS) || 60
    : Number(process.env.IIIT_SESSION_DAYS) || 30;
  return Math.round(days * DAY_SECONDS);
}

let warnedNoSecret = false;

/**
 * Hash stored for a session token. Tokens are 256 random bits, so a plain
 * SHA-256 is already irreversible; SESSION_SECRET (32+ characters), when
 * set, adds an HMAC key on top so a database copy alone cannot even be
 * matched against stolen cookies. Changing SESSION_SECRET signs everyone out.
 */
function hashToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) {
    return crypto.createHmac("sha256", secret).update(token).digest("hex");
  }
  if (!warnedNoSecret && process.env.NODE_ENV === "production") {
    warnedNoSecret = true;
    console.warn("SESSION_SECRET is not set (or shorter than 32 characters); session tokens are stored as SHA-256 hashes.");
  }
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function setCookie(token, maxAge) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

function toSession(row, sessionId) {
  return {
    sessionId,
    userId: row.id,
    username: row.username,
    email: row.email || null,
    displayName: row.displayName || null,
    role: row.role,
    iiitName: row.iiitName || null,
    iiitCode: row.iiitCode || null,
  };
}

/**
 * Creates a session for `user` and sets the cookie.
 */
export async function createSession(user, { ip = null, userAgent = null } = {}) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("base64url");
  const id = hashToken(token);
  const maxAge = lifetimeSeconds(user.role);
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  await db.insert(sessions).values({ id, userId: user.id, expiresAt, ip, userAgent });
  // Housekeeping: drop this user's expired sessions.
  await db.delete(sessions).where(and(eq(sessions.userId, user.id), lt(sessions.expiresAt, new Date())));
  await setCookie(token, maxAge);
  return toSession(user, id);
}

/**
 * Reads and validates the current session, or returns null.
 */
export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token || token.length > 128) return null;

  const id = hashToken(token);
  const db = getDb();
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      iiitName: users.iiitName,
      iiitCode: users.iiitCode,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row || !["iiit", "admin"].includes(row.role)) return null;
  if (row.role === "iiit" && !row.iiitCode) return null;

  if (Date.now() - new Date(row.lastSeenAt).getTime() > RENEW_AFTER_MS) {
    const maxAge = lifetimeSeconds(row.role);
    await db.update(sessions)
      .set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() + maxAge * 1000) })
      .where(eq(sessions.id, id));
    try {
      await setCookie(token, maxAge);
    } catch {
      // Cookies are read-only during rendering; the next API call renews it.
    }
  }

  return toSession(row, id);
}

/**
 * Ends the current session (this device only) and clears the cookie.
 */
export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token && token.length <= 128) {
    await getDb().delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Ends every session for a user, e.g. after a password change.
 */
export async function revokeUserSessions(userId) {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

/** Removes expired sessions. Cheap; called opportunistically. */
export async function purgeExpiredSessions() {
  await getDb().execute(sql`DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP(3)`);
}

/**
 * Enforces authentication and optional role check.
 * Throws an Error with statusCode if unauthorized.
 */
export async function requireAuth(allowedRoles = []) {
  const session = await getSession();
  if (!session) {
    const error = new Error("Authentication required. Please sign in.");
    error.statusCode = 401;
    throw error;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    const error = new Error("Forbidden. You do not have permission to perform this action.");
    error.statusCode = 403;
    throw error;
  }

  return session;
}
