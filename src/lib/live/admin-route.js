import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { requireAuth } from "@/lib/auth/session";
import { LIMITS, enforce } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { getClientIp, httpError } from "@/lib/security/request";

/**
 * Shared shape of the tournament admin routes: super admin only, rate
 * limited, body checked with a zod schema, every write audited.
 */

export const NO_STORE = { "Cache-Control": "private, no-store" };

export function parseTournamentId(raw) {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== raw) throw httpError(404, "Tournament not found");
  return id;
}

export async function readBody(request, schema) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message || "Check the values entered");
  return parsed.data;
}

/** Runs `handler({ session, id })` for the super admin; logs `action` when given. */
export function adminRoute(handler, { action, fallback, write = true, status = 200 } = {}) {
  return async (request, context) => {
    try {
      const session = await requireAuth(["admin"]);
      if (write) await enforce(`live:${session.userId}`, LIMITS.liveWrite);
      const params = context?.params ? await context.params : {};
      const id = params.id ? parseTournamentId(params.id) : null;
      const data = await handler({ request, session, id });
      if (action) {
        await audit({ actor: session.username, role: session.role, action, target: id ? String(id) : String(data?.id ?? ""), ip: await getClientIp() });
      }
      return NextResponse.json({ data: data ?? null }, { status, headers: NO_STORE });
    } catch (error) {
      if (!(error?.statusCode >= 400 && error?.statusCode < 500)) console.error(`${fallback}:`, error);
      return errorResponse(error, fallback || "Something went wrong");
    }
  };
}
