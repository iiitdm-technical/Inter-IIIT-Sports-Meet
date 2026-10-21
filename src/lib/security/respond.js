import { NextResponse } from "next/server";

/**
 * JSON error response for route handlers.
 *
 * Expected errors carry a 4xx statusCode and their message is shown to the
 * user. Anything else is logged and replaced by `fallback`, so database or
 * storage internals never reach the browser.
 */
export function errorResponse(error, fallback) {
  const status = Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 500
    ? error.statusCode
    : 500;
  const headers = { "Cache-Control": "no-store" };
  if (status === 429 && error.retryAfter) headers["Retry-After"] = String(error.retryAfter);
  const body = status < 500
    ? { error: error.message, ...(error.details ? { details: error.details } : {}) }
    : { error: fallback };
  return NextResponse.json(body, { status, headers });
}
