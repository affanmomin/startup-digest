import { prisma } from "@/lib/prisma";
import type { DigestItem, ProductWithAnalysis } from "@/lib/types";
import { asStringArray, formatDate } from "@/lib/utils";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

function toDigestItem(p: ProductWithAnalysis): DigestItem {
  const a = p.analysis!;
  return {
    productId: p.id,
    name: p.name,
    tagline: p.tagline,
    cloneScore: a.cloneScore,
    buildDifficulty: a.buildDifficulty,
    opportunityScore: a.opportunityScore,
    mvpTime: a.mvpTime,
    founderTake: a.founderTake,
    detailUrl: `${appUrl()}/products/${p.id}`,
  };
}

/**
 * Core ranking signal for "worth building": the precomputed opportunity score,
 * with a small bonus for a substantive founder take to break ties toward the
 * ideas with real reasoning behind them.
 */
function worthBuildingRank(a: ProductWithAnalysis): number {
  const an = a.analysis!;
  // Opportunity score is the primary signal (×100 to dominate), with a small
  // tie-break toward ideas that have a substantive founder take.
  let score = an.opportunityScore * 100;
  if (an.founderTake && an.founderTake.trim().length > 20) score += 1;
  return score;
}

/**
 * Generate (and persist) the weekly digest from all analyzed products.
 * Selects four top-5 lists and saves a WeeklyDigest row.
 */
export async function generateWeeklyDigest() {
  const now = new Date();
  const weekStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Pull every analyzed product; ranking is cheap and dataset is single-user scale.
  const analyzed = (await prisma.product.findMany({
    where: { analysis: { isNot: null } },
    include: { analysis: true },
    orderBy: { launchDate: "desc" },
  })) as ProductWithAnalysis[];

  // Nothing analyzed → no useful digest. Return null so callers skip emailing.
  if (analyzed.length === 0) return null;

  // Top 5 Products Worth Building
  const topWorthBuilding = [...analyzed]
    .filter((p) => p.analysis?.worthBuilding)
    .sort((a, b) => worthBuildingRank(b) - worthBuildingRank(a))
    .slice(0, 5)
    .map(toDigestItem);

  // Top 5 Niche Opportunities (must actually have niche suggestions)
  const topNicheIdeas = [...analyzed]
    .filter((p) => asStringArray(p.analysis?.nicheVersions).length > 0)
    .sort((a, b) => worthBuildingRank(b) - worthBuildingRank(a))
    .slice(0, 5)
    .map(toDigestItem);

  // Top 5 AI Upgrade Opportunities (must have an AI angle)
  const topAiIdeas = [...analyzed]
    .filter((p) => (p.analysis?.aiVersion ?? "").trim().length > 0)
    .sort((a, b) => worthBuildingRank(b) - worthBuildingRank(a))
    .slice(0, 5)
    .map(toDigestItem);

  // Top 5 Easy MVP Builds — only quality ideas (worth building or decent score),
  // then easiest first, then best opportunity. Avoids surfacing easy-but-junk.
  const easyBuildIdeas = [...analyzed]
    .filter(
      (p) =>
        p.analysis?.worthBuilding || (p.analysis?.opportunityScore ?? 0) >= 45
    )
    .sort((a, b) => {
      const an = a.analysis!;
      const bn = b.analysis!;
      if (an.buildDifficulty !== bn.buildDifficulty) {
        return an.buildDifficulty - bn.buildDifficulty;
      }
      return bn.opportunityScore - an.opportunityScore;
    })
    .slice(0, 5)
    .map(toDigestItem);

  const title = `Startup Digest — Week of ${formatDate(weekStartDate)}`;
  const summary =
    `${analyzed.length} analyzed launches this cycle. ` +
    `${topWorthBuilding.length} worth building, ` +
    `${topNicheIdeas.length} niche openings, ` +
    `${topAiIdeas.length} AI-upgrade angles, ` +
    `${easyBuildIdeas.length} quick MVP wins.`;

  const digest = await prisma.weeklyDigest.create({
    data: {
      weekStartDate,
      weekEndDate: now,
      title,
      summary,
      topWorthBuilding: topWorthBuilding as unknown as object,
      topNicheIdeas: topNicheIdeas as unknown as object,
      topAiIdeas: topAiIdeas as unknown as object,
      easyBuildIdeas: easyBuildIdeas as unknown as object,
    },
  });

  return digest;
}
