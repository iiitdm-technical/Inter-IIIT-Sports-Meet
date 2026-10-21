import { NextResponse } from "next/server";

/**
 * Cross-site request protection for the API.
 *
 * The session cookie is SameSite=Lax, which already stops most cross-site
 * POSTs. As a second layer, state-changing API requests must come from this
 * site: browsers send Sec-Fetch-Site and Origin, and both must match.
 * Requests without these headers (curl, server-to-server) are not browser
 * CSRF vectors and still need a valid session.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function forbidden() {
  return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
}

export function proxy(request) {
  if (SAFE_METHODS.has(request.method)) return NextResponse.next();

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return forbidden();

  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      return forbidden();
    }
    if (!host || originHost !== host) return forbidden();
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
