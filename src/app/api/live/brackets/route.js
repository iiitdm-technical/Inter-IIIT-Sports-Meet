import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/security/respond";
import { getPublicBrackets } from "@/lib/live/tournaments";
import { bracketQuerySchema } from "@/lib/live/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: every tournament, and the chosen one's pools and bracket. No sign-in. */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = bracketQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Invalid tournament" }, { status: 400 });
    const data = await getPublicBrackets(parsed.data);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "public, max-age=5, stale-while-revalidate=10" } });
  } catch (error) {
    return errorResponse(error, "Unable to load the brackets");
  }
}
