# Startup Digest — Iteration 1: From Feed to Founder Workflow

**Date:** 2026-06-21
**Author:** Autonomous build (acting as product brain, per `/goal`)
**Status:** Approved by standing directive (user delegated full authority)

## Problem

The MVP discovers and analyzes Product Hunt launches but stops at "here's an
analysis." It pulls the *newest* posts (low signal), is read-only (forgets every
decision the founder makes), and offers no path from "this is worth building" to
"here's how I'd start." It's a feed, not a tool a founder returns to weekly.

## Goal

Make Startup Digest genuinely useful: a weekly workflow that surfaces the *best*
opportunities, lets the founder triage them, and turns a chosen idea into an
actionable MVP plan.

## Changes

### 1. Data quality (biggest lever)
- Product Hunt query: order by `VOTES`, `postedAfter` = last 7 days, fetch up to 40.
- Rationale: the analyzed pool must be high-signal or nothing downstream matters.

### 2. Opportunity Score (0–100)
- **Computed deterministically** at analysis-save time (no extra LLM cost, fully reliable):
  `score = round(cloneScore/10*40 + (10-buildDifficulty)/10*25 + (worthBuilding?35:0))`
- Stored on `ProductAnalysis.opportunityScore` (Int) so it is sortable in SQL.
- Surfaced as the primary ranking on Discover + a badge everywhere.
- Backfill existing rows via a one-off script.

### 3. Idea workflow / status
- `Product.status` (String, default `"NEW"`): one of `NEW | SAVED | BUILDING | PASSED`.
- Server action `setProductStatusAction(id, status)` + quick buttons on cards, table rows, detail.
- Dashboard filterable by status.

### 4. Filter & sort (dashboard)
- Client-side controls: filter by status, worth-building, topic; sort by opportunity / clone / difficulty / upvotes.
- Operates on data already loaded server-side (single-user, ≤40 rows — no pagination needed).

### 5. MVP Build Plan generator (headline feature)
- New model `BuildPlan` (1:1 with Product): overview, targetNiche, differentiation[],
  techStack[], coreFeatures[], milestones[] ({week,title,detail}), firstSteps[],
  monetization, estimatedTimeline, risks[], timestamps.
- `lib/buildplan.ts` → `generateBuildPlan(product, analysis)` calls OpenRouter with a
  focused "senior solo founder, write me a build plan for my differentiated version"
  prompt. Same robust JSON parsing + fallback discipline as `lib/ai.ts`.
- Server action `generateBuildPlanAction(id)`; button on detail page; rendered as a
  structured, skimmable plan when present.

### 6. UX polish
- Detail page: decision-first hierarchy (score + worth + MVP time + founder take up top;
  the 12 analysis sections below; build plan as its own prominent block).
- Discover: ranked by opportunity score, opportunity badge, topic chips, status control.
- Dashboard: opportunity column, status column, filter/sort bar.

## Non-goals (unchanged)
No auth, teams, payments, multi-user. Still single-user. No pagination/infra additions.

## Data model delta
```
Product.status            String  @default("NEW")
ProductAnalysis.opportunityScore Int @default(0)
model BuildPlan { ...1:1 with Product, cascade delete... }
```

## Testing & validation
1. Migrate, backfill opportunity scores, re-run a real sync to validate VOTES ordering.
2. Generate a real build plan via OpenRouter; verify JSON parsing + persistence.
3. Drive the UI in a headless browser; screenshot Discover / Dashboard (filtered) / Detail+plan.
4. Roast: fan out a product/UX critic + a code-reviewer + adversarial bug-hunter subagents; fix findings.
5. Iterate until critics return no material issues; final build + typecheck must pass.
```
