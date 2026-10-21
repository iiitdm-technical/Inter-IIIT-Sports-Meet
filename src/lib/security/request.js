import { headers } from "next/headers.js";

/**
 * Client IP for rate limiting and audit.
 *
 * Behind a reverse proxy (nginx) the client address is the entry the proxy
 * appended to X-Forwarded-For, i.e. counted from the right. TRUSTED_PROXY_HOPS
 * is the number of proxies in front of the app (default 1). Entries further
 * left are client-supplied and ignored.
 */
export async function getClientIp() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const hops = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_HOPS || "1", 10) || 1);
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const candidate = parts[Math.max(0, parts.length - hops)];
    if (candidate) return candidate.slice(0, 64);
  }
  return (headerList.get("x-real-ip") || "unknown").slice(0, 64);
}

export async function getUserAgent() {
  const headerList = await headers();
  return (headerList.get("user-agent") || "").slice(0, 256) || null;
}

/** Throws a 4xx error with a statusCode, for route handlers to return. */
export function httpError(statusCode, message, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}
