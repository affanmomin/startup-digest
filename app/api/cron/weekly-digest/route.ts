import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchLatestProducts, saveProducts } from "@/lib/producthunt";
import { analyzeAndSaveProduct } from "@/lib/ai";
import { mapWithConcurrency } from "@/lib/concurrency";
import { generateWeeklyDigest } from "@/lib/digest";
import { sendDigestEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
// Pro plan allows up to 300s. On Hobby this is capped at 60s, so we bound the
// work per run (see ANALYZE_CAP) to always finish and always reach the email step.
export const maxDuration = 300;

// Analyze at most this many products per cron run with this concurrency, so a
// single invocation stays within even Hobby's 60s budget:
// ceil(CAP/CONC) waves × 18s fetch timeout + PH fetch + email ≈ <55s.
// Backlog drains across runs / manual "Analyze All".
const ANALYZE_CAP = 10;
const ANALYZE_CONCURRENCY = 5;

/**
 * Vercel Cron entrypoint. Vercel sends a GET with the CRON_SECRET as a Bearer
 * token. We also support POST/?secret= for manual triggering.
 */
async function runPipeline(req: NextRequest) {
  const unauthorized = requireAuth(req);
  if (unauthorized) return unauthorized;

  const steps: Record<string, unknown> = {};

  try {
    // 1–3. Fetch + save latest launches.
    const products = await fetchLatestProducts({ first: 30, daysBack: 7 });
    const saved = await saveProducts(products);
    steps.sync = { fetched: products.length, ...saved };

    // 4. Analyze products that have no analysis yet (bounded per run + concurrent).
    const pending = await prisma.product.findMany({
      where: { analysis: { is: null } },
      orderBy: [{ upvotes: "desc" }, { launchDate: "desc" }],
      take: ANALYZE_CAP,
    });
    const analyses = await mapWithConcurrency(
      pending,
      ANALYZE_CONCURRENCY,
      (product) => analyzeAndSaveProduct(product)
    );
    const analyzed = analyses.filter(Boolean).length;
    steps.analyze = {
      pending: pending.length,
      analyzed,
      failed: pending.length - analyzed,
    };

    // 5–6. Generate + save the weekly digest.
    const digest = await generateWeeklyDigest();
    if (!digest) {
      steps.digest = { skipped: "no analyzed products" };
      return NextResponse.json({ ok: true, steps });
    }
    steps.digest = { id: digest.id, title: digest.title };

    // 7. Send the email.
    const emailResult = await sendDigestEmail(digest);
    steps.email = emailResult;

    if (emailResult.sent) {
      await prisma.weeklyDigest.update({
        where: { id: digest.id },
        data: { emailSentAt: new Date() },
      });
    }

    // 8. Return JSON result.
    return NextResponse.json({ ok: true, steps });
  } catch (err) {
    console.error("[api/cron/weekly-digest] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Cron pipeline failed",
        steps,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return runPipeline(req);
}

export async function POST(req: NextRequest) {
  return runPipeline(req);
}
