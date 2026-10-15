import crypto from "crypto";
import { cookies } from "next/headers.js";

export const SESSION_COOKIE_NAME = "inter_iiit_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return secret;
}

/**
 * Sign a payload and return a secure token: base64(payload).signature
 */
export function signSessionToken(payload) {
  const secret = getSecret();
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Verify and decode a session token
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const secret = getSecret();

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  // Timing-safe comparison to prevent timing attacks
  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    if (!Number.isFinite(payload.exp) || Date.now() >= payload.exp) return null;
    if (!Number.isInteger(payload.userId) || !payload.username || !["iiit", "admin"].includes(payload.role)) return null;
    if (payload.role === "iiit" && !payload.iiitCode) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Creates and sets the session HTTP-only cookie on the response
 */
export async function createSessionCookie(user) {
  const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email || null,
    displayName: user.displayName || null,
    role: user.role, // 'iiit' | 'admin'
    iiitName: user.iiitName || null,
    iiitCode: user.iiitCode || null,
    exp,
  };

  const token = signSessionToken(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return payload;
}

/**
 * Reads and verifies the current session from incoming request cookies
 */
export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) {
    return null;
  }
  return verifySessionToken(sessionCookie.value);
}

/**
 * Clears the session cookie
 */
export async function destroySessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
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

  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(session.role)
  ) {
    const error = new Error("Forbidden. You do not have permission to perform this action.");
    error.statusCode = 403;
    throw error;
  }

  return session;
}
