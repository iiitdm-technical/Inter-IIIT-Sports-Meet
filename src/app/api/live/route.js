import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { getPublicBoard } from "@/lib/live/service";
import { boardQuerySchema } from "@/lib/live/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public live board: no sign-in. Cached in memory for a few seconds by the service. */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = boardQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
    const data = await getPublicBoard(parsed.data);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "public, max-age=3, stale-while-revalidate=5" } });
  } catch (error) {
    return errorResponse(error, "Unable to load live results");
  }
}
