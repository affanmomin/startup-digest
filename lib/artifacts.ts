import type { Product, ProductAnalysis, BuildPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { asStringArray } from "@/lib/utils";
import { fetchWithTimeout } from "@/lib/concurrency";
import { fetchPageText } from "@/lib/scrape";
import { getFounderProfile, profilePromptBlock } from "@/lib/founder";
import { ARTIFACT_TYPES, type ArtifactType } from "@/lib/artifact-meta";

export { ARTIFACT_TYPES, isArtifactType } from "@/lib/artifact-meta";
export type { ArtifactType } from "@/lib/artifact-meta";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
// Build Kit docs are deep, on-demand artifacts — use a strong model by default.
const DEFAULT_ARTIFACT_MODEL = "anthropic/claude-sonnet-4.6";

const SHARED_RULES = `
QUALITY BAR — this must read like a sharp operator wrote it after actually studying the product, not a generic template:
- Be SPECIFIC to THIS product. Reference its real features, positioning, and category by name. Never write filler that could apply to any product.
- Use the provided website content and analysis as evidence. Quote or cite concrete details from them.
- Quantify wherever possible (market size logic, pricing $, timeframes, effort in days/weeks, conversion assumptions).
- Name real comparable products/competitors and real tools/services where relevant.
- Show reasoning: explain WHY, surface tradeoffs, call out assumptions and how you'd validate them.
- Prefer concrete examples, sample copy, sample data, and worked specifics over abstract advice.
- Depth over length, but do not be terse — be thorough. Use tables and lists where they add clarity.
- Never hedge with vague phrases ("it depends", "various features", "robust solution"). Commit to specifics.
Return GitHub-flavored Markdown only — no preamble, no surrounding code fence around the whole document.`;

const SYSTEM_PROMPTS: Record<ArtifactType, string> = {
  GAP_ANALYSIS: `You are a world-class product strategist (think a16z + top PM) writing a gap analysis for a solo founder who wants to build a sharper version of a Product Hunt product.

Write a RICH, evidence-grounded GAP ANALYSIS. Structure (use these sections, expand each substantially):

## Gap Analysis: <product>
**Category & one-line read:** what space this is in and the honest state of it.

### What the original actually does well
3-5 bullets grounded in the real product/website — be fair, this calibrates the gaps.

### Underserved segments (who is poorly served, and why)
For each: the segment, their specific unmet need, why incumbents ignore them, and rough size/willingness-to-pay.

### Feature & capability gaps
A table: | Gap | User pain it leaves | Evidence | How hard to close (1-5) |. At least 5 rows, specific to this product.

### UX & workflow gaps
Concrete friction points in the real product experience (onboarding, time-to-value, integrations, mobile, etc.).

### Positioning, pricing & GTM gaps
Where the offer/price/positioning leaves a segment open. Include the original's likely pricing and where a wedge exists.

### The wedge (your opening)
The single sharpest, most winnable gap for a solo founder — with a crisp thesis, the target user, and why it's defensible enough to matter.
${SHARED_RULES}`,

  FUTURE_SCOPE: `You are a pragmatic founder-operator who has shipped many solo MVPs. Write a RICH, realistic future scope / roadmap for the founder's sharper version of this product.

Structure (expand each substantially, be concrete and time-bound):

## Future Scope: <your version>
**Vision (12-18 months):** the ambitious-but-grounded destination, in 2-3 sentences.
**Strategy in one line:** the wedge → expansion path.

### Now — MVP (target: <realistic weeks>)
The smallest scope that delivers real value. A table: | Capability | Why it's in the MVP | Effort (days) |. Include the ONE metric that proves the MVP works.

### Next (weeks ~4–12)
What you add once people use it, and the signal from "Now" that unlocks each item.

### Later (the 6–18 month bet)
Where it goes if it works — platform/expansion moves, new segments, moats that compound.

### Explicitly NOT doing (and why)
Scope you deliberately cut. This section is as important as the rest.

### Sequencing logic & riskiest assumptions
Why this order. Then a table: | Assumption | Why it's risky | Cheapest test | Kill criteria |.

### Monetization evolution
How pricing/packaging changes across Now → Next → Later, with concrete price points.
${SHARED_RULES}`,

  PRD: `You are a senior PM at a top product company writing a complete, build-ready PRD for the founder's sharper version of this product. It will be handed to engineers and an AI coding agent, so it must be precise and unambiguous.

Structure (be thorough — this is a real PRD, not a sketch):

# PRD: <product name>
## 1. Overview & problem statement
The problem, who has it, why now, and the opportunity (grounded in the gap vs the original).
## 2. Target users & personas
1-2 concrete personas with goals, context, and current workarounds.
## 3. Goals, non-goals & success metrics
Measurable goals, explicit non-goals, and the north-star + supporting metrics with target numbers.
## 4. User stories & jobs-to-be-done
Grouped by epic. "As a <persona>, I want <capability>, so that <outcome>." Cover the full MVP.
## 5. Functional requirements
Numbered (FR-1, FR-2…), specific, testable, with acceptance criteria for each. This is the heart — be exhaustive for the MVP.
## 6. Detailed feature specs
For the 3-4 core features: behavior, edge cases, empty/error states, and key UI elements.
## 7. Data model
A markdown table per entity (field, type, notes) + relationships. Build-ready.
## 8. Non-functional requirements
Performance budgets, auth/permissions, privacy/compliance, reliability — concrete targets.
## 9. Out of scope (v1) & open questions
## 10. Rollout & first-week success criteria
${SHARED_RULES}`,

  HANDOFF: `You are a staff engineer writing a build handoff to give directly to Claude Code (an AI coding agent) so a solo founder can start building TODAY. It must be concrete enough that an agent can execute it with minimal back-and-forth.

Structure:

# Build Handoff: <product>
## What we're building & for whom
2-3 sentences + the precise target niche and the core value loop.
## Recommended stack (with rationale)
A table: | Layer | Choice | Why |. Default to Next.js App Router + TypeScript, Tailwind + shadcn/ui, Prisma + Postgres (Supabase), Vercel — and justify each, adding others (auth, payments, queues, AI APIs) only where this product needs them.
## Architecture
Modules/services, data flow, and any external integrations. A short diagram in a fenced code block (ASCII) is welcome.
## Data model
The full set of Prisma models to create, in a \`\`\`prisma fenced block.
## Core flows
Step-by-step for the 2-3 critical user flows (e.g. signup → first value), referencing the routes/components involved.
## Build sequence (milestones)
Numbered, each independently shippable and verifiable, with what "done" looks like for each.
## First tasks (literal day-1 steps)
The exact first 5-8 commands/steps to scaffold and get something rendering.
## Kickoff prompt
A single \`\`\` fenced code block containing a complete, self-contained prompt the founder pastes into Claude Code to begin — including product context, the chosen stack, conventions, and the first milestone with acceptance criteria. Make it genuinely ready to paste.
## Risks & gotchas for the agent
Specific things likely to trip up an AI agent on THIS build.
${SHARED_RULES}`,
};

async function buildContext(
  product: Product,
  analysis: ProductAnalysis | null,
  buildPlan: BuildPlan | null
): Promise<string> {
  const topics = Array.isArray(product.topics)
    ? (product.topics as unknown[]).filter((t) => typeof t === "string")
    : [];

  // Ground in the REAL product: fetch its website (and Product Hunt page as backup).
  const siteText = await fetchPageText(product.websiteUrl, 6000);
  const phText = siteText ? null : await fetchPageText(product.productHuntUrl, 4000);
  const scraped = siteText ?? phText;

  const lines = [
    `# ORIGINAL PRODUCT (from Product Hunt)`,
    `Name: ${product.name}`,
    `Tagline: ${product.tagline}`,
    product.description ? `Description: ${product.description}` : "",
    topics.length ? `Topics: ${topics.join(", ")}` : "",
    `Product Hunt upvotes: ${product.upvotes}`,
    product.websiteUrl ? `Website: ${product.websiteUrl}` : "",
    product.productHuntUrl ? `Product Hunt: ${product.productHuntUrl}` : "",
    "",
    scraped
      ? `# LIVE CONTENT SCRAPED FROM THE PRODUCT (use this heavily as ground truth)\n${scraped}`
      : `# NOTE: could not fetch live site content — reason about the product from the details above.`,
  ];

  if (analysis) {
    lines.push(
      "",
      `# PRIOR ANALYSIS (a solo-founder lens already applied)`,
      `Summary: ${analysis.summary}`,
      `Why interesting: ${analysis.whyInteresting}`,
      `Weaknesses: ${asStringArray(analysis.weaknesses).join("; ")}`,
      `Niche angles: ${asStringArray(analysis.nicheVersions).join("; ")}`,
      `Better-version ideas: ${asStringArray(analysis.betterVersions).join("; ")}`,
      `AI angle: ${analysis.aiVersion}`,
      `Founder take: ${analysis.founderTake}`,
      `Scores — clone ${analysis.cloneScore}/10, build difficulty ${analysis.buildDifficulty}/10, demand ${analysis.demandSignal}/10, monetization ${analysis.monetizationPotential}/10, opportunity ${analysis.opportunityScore}/100, MVP time ${analysis.mvpTime}.`
    );
  }
  if (buildPlan) {
    lines.push(
      "",
      `# CHOSEN DIRECTION (from the build plan)`,
      `Target niche: ${buildPlan.targetNiche}`,
      `Differentiation: ${asStringArray(buildPlan.differentiation).join("; ")}`,
      `Planned stack: ${asStringArray(buildPlan.techStack).join(", ")}`,
      `Monetization: ${buildPlan.monetization}`
    );
  }

  return lines.filter((l) => l !== undefined).join("\n");
}

function cleanMarkdown(raw: string): string {
  let t = raw.trim();
  const fence = t.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i);
  if (fence) t = fence[1].trim();
  return t;
}

/**
 * Generate a single Build Kit artifact (rich markdown), grounded in the real
 * product. Returns null on failure (never throws).
 */
export async function generateArtifact(
  product: Product,
  analysis: ProductAnalysis | null,
  buildPlan: BuildPlan | null,
  type: ArtifactType
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[artifacts] OPENROUTER_API_KEY is not configured.");
    return null;
  }
  const model =
    process.env.OPENROUTER_ARTIFACT_MODEL ||
    process.env.OPENROUTER_MODEL ||
    DEFAULT_ARTIFACT_MODEL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const profileBlock = profilePromptBlock(await getFounderProfile());
  const system = profileBlock
    ? `${SYSTEM_PROMPTS[type]}\n\n# FOUNDER CONTEXT\n${profileBlock}`
    : SYSTEM_PROMPTS[type];
  const context = await buildContext(product, analysis, buildPlan);

  let content: string;
  try {
    const res = await fetchWithTimeout(
      OPENROUTER_ENDPOINT,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": appUrl,
          "X-Title": "Startup Digest",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: `Produce the document for this product. Use every relevant detail below; be specific and rich.\n\n${context}`,
            },
          ],
          temperature: 0.6,
          // Output size governs generation time. Default 2000 (~7-8k chars) fits
          // Vercel Hobby's 60s cap; raise OPENROUTER_ARTIFACT_MAX_TOKENS to 4000+
          // locally or on Vercel Pro (300s) for the fullest, richest docs.
          max_tokens: Number(process.env.OPENROUTER_ARTIFACT_MAX_TOKENS) || 2000,
        }),
        cache: "no-store",
      },
      // Connection guard only; real generation length is bounded by max_tokens
      // and the function's maxDuration.
      60000
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[artifacts] OpenRouter ${res.status}: ${text.slice(0, 300)}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    content = data.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    console.error("[artifacts] request failed:", err);
    return null;
  }

  const md = cleanMarkdown(content);
  return md.length > 0 ? md : null;
}

/** Generate + persist an artifact for a product. Returns the markdown or null. */
export async function generateAndSaveArtifact(
  productId: string,
  type: ArtifactType
): Promise<string | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { analysis: true, buildPlan: true },
    });
    if (!product) return null;

    const content = await generateArtifact(
      product,
      product.analysis,
      product.buildPlan,
      type
    );
    if (!content) return null;

    await prisma.productArtifact.upsert({
      where: { productId_type: { productId, type } },
      create: { productId, type, content },
      update: { content },
    });
    return content;
  } catch (err) {
    console.error(`[artifacts] save failed (${productId}/${type}):`, err);
    return null;
  }
}
