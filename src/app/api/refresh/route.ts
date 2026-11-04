import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { CFBD_CACHE_TAG } from "@/lib/cfbd";

/**
 * Sunday Vercel Cron hits this to bust the CFBD cache and refresh rankings.
 * Auth: Bearer CRON_SECRET, or Vercel's x-vercel-cron header.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const bearerOk = Boolean(secret && auth === `Bearer ${secret}`);

  if (!isVercelCron && !bearerOk) {
    // Allow unauthenticated only when no secret is configured (local/dev).
    if (secret || process.env.VERCEL === "1") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  revalidateTag(CFBD_CACHE_TAG, "max");
  revalidatePath("/");

  return NextResponse.json({
    ok: true,
    refreshedAt: new Date().toISOString(),
    tag: CFBD_CACHE_TAG,
  });
}
