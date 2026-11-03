import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { getFixtures } from "@/lib/live/service";
import { boardQuerySchema } from "@/lib/live/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: the whole schedule and the pool tables. No sign-in. */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = boardQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
    const data = await getFixtures(parsed.data);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "public, max-age=10, stale-while-revalidate=20" } });
  } catch (error) {
    return errorResponse(error, "Unable to load fixtures");
  }
}
