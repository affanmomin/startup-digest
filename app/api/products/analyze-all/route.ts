import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeAndSaveProduct } from "@/lib/ai";
import { mapWithConcurrency } from "@/lib/concurrency";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Bound per request so a single invocation finishes within the function budget
// (even Hobby's 60s). "remaining" is returned so the UI can prompt another run.
const ANALYZE_CAP = 12;
const ANALYZE_CONCURRENCY = 5;

export async function POST(req: NextRequest) {
  const unauthorized = requireAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const pending = await prisma.product.findMany({
      where: { analysis: { is: null } },
      orderBy: [{ upvotes: "desc" }, { launchDate: "desc" }],
      take: ANALYZE_CAP,
    });

    const results = await mapWithConcurrency(
      pending,
      ANALYZE_CONCURRENCY,
      (product) => analyzeAndSaveProduct(product)
    );
    const success = results.filter(Boolean).length;
    const failed = pending.length - success;

    const remaining = await prisma.product.count({
      where: { analysis: { is: null } },
    });

    return NextResponse.json({
      ok: true,
      pending: pending.length,
      success,
      failed,
      remaining,
    });
  } catch (err) {
    console.error("[api/products/analyze-all] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Batch analysis failed",
      },
      { status: 500 }
    );
  }
}
