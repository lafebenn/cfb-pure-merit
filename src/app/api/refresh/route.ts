import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { CFBD_CACHE_TAG } from "@/lib/cfbd";
import { PREDICTIONS_CACHE_TAG } from "@/lib/predictions";

/**
 * Busts the CFBD + ML prediction caches. Called by the Sunday Vercel Cron and by the weekly
 * predictions GitHub Action, both with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (secret ? auth !== `Bearer ${secret}` : process.env.VERCEL === "1") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag(CFBD_CACHE_TAG, "max");
  revalidateTag(PREDICTIONS_CACHE_TAG, "max");
  revalidatePath("/");

  return NextResponse.json({
    ok: true,
    refreshedAt: new Date().toISOString(),
    tags: [CFBD_CACHE_TAG, PREDICTIONS_CACHE_TAG],
  });
}
