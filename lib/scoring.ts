/**
 * Opportunity Score — a single 0-100 signal of how attractive an idea is for a
 * solo founder to build a sharper version of. Computed deterministically (no LLM
 * cost, fully reproducible) so the dashboard can sort on it reliably.
 *
 * A solo founder's success is driven mostly by DEMAND and the ability to CHARGE,
 * modified by how clonable and how easy the build is. The earlier model weighted
 * ease and a binary "worth building" too heavily and ignored money entirely, which
 * steered toward easy-but-worthless ideas. This version fixes that:
 *
 *  - 30 pts: demand (is anyone actually pulling for this?)
 *  - 25 pts: monetization potential (can a solo founder charge for it?)
 *  - 20 pts: clone potential (how clear/clonable the wedge is)
 *  - 15 pts: ease of build (lower difficulty = more points)
 *  - 10 pts: the founder verdict (worth building at all) — now a modifier, not a third of the score
 *
 * Recomputed on every analysis save, so no separate backfill is needed.
 */
export function computeOpportunityScore(input: {
  cloneScore: number;
  buildDifficulty: number;
  worthBuilding: boolean;
  demandSignal?: number;
  monetizationPotential?: number;
}): number {
  const demand = clamp10(input.demandSignal ?? 5);
  const money = clamp10(input.monetizationPotential ?? 5);
  const clone = clamp10(input.cloneScore);
  const difficulty = clamp10(input.buildDifficulty);

  const raw =
    (demand / 10) * 30 +
    (money / 10) * 25 +
    (clone / 10) * 20 +
    ((10 - difficulty) / 10) * 15 +
    (input.worthBuilding ? 10 : 0);

  return Math.max(0, Math.min(100, Math.round(raw)));
}

function clamp10(n: number): number {
  if (!Number.isFinite(n)) return 5;
  return Math.min(Math.max(n, 1), 10);
}

/** Tailwind-friendly tier for the opportunity badge. */
export function opportunityTier(score: number): {
  label: string;
  variant: "success" | "warning" | "secondary";
} {
  if (score >= 70) return { label: "High", variant: "success" };
  if (score >= 45) return { label: "Medium", variant: "warning" };
  return { label: "Low", variant: "secondary" };
}
