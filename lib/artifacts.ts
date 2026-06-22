import type { Product, ProductAnalysis, BuildPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { asStringArray } from "@/lib/utils";
import { fetchWithTimeout } from "@/lib/concurrency";
import { getFounderProfile, profilePromptBlock } from "@/lib/founder";
import { ARTIFACT_TYPES, type ArtifactType } from "@/lib/artifact-meta";

export { ARTIFACT_TYPES, isArtifactType } from "@/lib/artifact-meta";
export type { ArtifactType } from "@/lib/artifact-meta";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

const SYSTEM_PROMPTS: Record<ArtifactType, string> = {
  GAP_ANALYSIS: `You are a sharp product strategist advising a solo founder.

Write a GAP ANALYSIS for the founder building a sharper version of the given Product Hunt product. Focus on OPPORTUNITY — where the original and the category underserve real users — not just the product's flaws.

Return GitHub-flavored Markdown only (no preamble, no code fences around the whole doc). Use this structure:

## Gap Analysis: <product>
**The space in one line:** ...

### Underserved segments
- who is poorly served today, and why

### Feature & capability gaps
- concrete missing capabilities (with the user pain each leaves on the table)

### UX & workflow gaps
- where the experience is clunky / high-friction

### Positioning & pricing gaps
- mismatches between what's offered and what a segment would pay for

### The wedge
2-3 sentences: the single sharpest gap a solo founder should attack first, and why it's winnable.

Be specific and realistic. No generic filler. Ground every gap in this product/category.`,

  FUTURE_SCOPE: `You are a pragmatic solo-founder advisor.

Write a REALISTIC FUTURE SCOPE / ROADMAP for the founder's sharper version of the given product. It must be achievable by ONE engineer. Be honest about time.

Return GitHub-flavored Markdown only. Structure:

## Future Scope: <your version>
**One-line vision:** ...

### Now (MVP — first launch)
- the smallest set that delivers real value; include a realistic timeframe

### Next (post-launch, weeks 4–12)
- what you add once people use it

### Later (the 12-month bet)
- where it goes if it works — the ambitious-but-grounded version

### Explicitly NOT doing
- scope you are deliberately cutting, and why

### Riskiest assumption
- the one thing that must be true for this to work, and how you'd test it cheaply

Be concrete and time-bound. No hand-waving.`,

  PRD: `You are a senior product manager writing for a solo founder + their AI coding agent.

Write a complete but TIGHT Product Requirements Document (PRD) for the founder's sharper version of the given product. It should be detailed enough to build from, not bloated.

Return GitHub-flavored Markdown only. Structure:

# PRD: <product name>
## 1. Problem & opportunity
## 2. Target user & primary use case
## 3. Goals & non-goals
## 4. User stories
- As a <user>, I want <capability> so that <benefit>  (cover the MVP)
## 5. Functional requirements
- numbered, specific, testable
## 6. Non-functional requirements
- performance, auth, privacy, reliability — only what matters for an MVP
## 7. Data model (high level)
- key entities + important fields
## 8. Success metrics
- how you'll know it's working
## 9. Out of scope (v1)
## 10. Open questions

Be specific to THIS product idea and its chosen niche. Realistic for a solo full-stack build.`,

  HANDOFF: `You are a staff engineer preparing a build brief to hand to Claude Code (an AI coding agent) so a solo founder can start building immediately.

Write a CLAUDE CODE HANDOFF for the founder's sharper version of the given product. It must be concrete and directly actionable by a coding agent.

Return GitHub-flavored Markdown only. Structure:

# Build Handoff: <product>
## What we're building
1-2 sentences + the target niche.

## Recommended stack
- concrete, solo-friendly choices (default to Next.js App Router + TypeScript, Tailwind + shadcn/ui, Prisma + Postgres, and add others only if needed). Justify briefly.

## Architecture
- key modules/services and how they fit (short).

## Data model
- the Prisma-style models to create.

## Build sequence
- numbered milestones an agent can execute end to end, each independently shippable.

## First tasks (do these first)
- the literal first 3-5 steps to scaffold and get something running.

## Kickoff prompt
Provide a single fenced code block containing a ready-to-paste prompt the founder can give Claude Code to begin. It should set context, stack, and the first milestone. Make it self-contained.

Be specific to this product and niche. Prefer boring, proven tech.`,
};

function userContext(
  product: Product,
  analysis: ProductAnalysis | null,
  buildPlan: BuildPlan | null
): string {
  const topics = Array.isArray(product.topics)
    ? (product.topics as unknown[]).filter((t) => typeof t === "string")
    : [];
  return [
    `Original product: ${product.name}`,
    `Tagline: ${product.tagline}`,
    product.description ? `Description: ${product.description}` : "",
    topics.length ? `Topics: ${topics.join(", ")}` : "",
    analysis ? `Why interesting: ${analysis.whyInteresting}` : "",
    analysis ? `Niche angles: ${asStringArray(analysis.nicheVersions).join("; ")}` : "",
    analysis ? `Better-version ideas: ${asStringArray(analysis.betterVersions).join("; ")}` : "",
    analysis ? `Founder take: ${analysis.founderTake}` : "",
    analysis
      ? `Scores — clone ${analysis.cloneScore}/10, difficulty ${analysis.buildDifficulty}/10, demand ${analysis.demandSignal}/10, monetization ${analysis.monetizationPotential}/10, MVP time ${analysis.mvpTime}.`
      : "",
    buildPlan ? `Chosen niche from build plan: ${buildPlan.targetNiche}` : "",
    buildPlan ? `Differentiation: ${asStringArray(buildPlan.differentiation).join("; ")}` : "",
    buildPlan ? `Planned tech stack: ${asStringArray(buildPlan.techStack).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Strip an accidental wrapping ```markdown fence if the model added one. */
function cleanMarkdown(raw: string): string {
  let t = raw.trim();
  const fence = t.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i);
  if (fence) t = fence[1].trim();
  return t;
}

/**
 * Generate a single Build Kit artifact (markdown). Returns null on failure
 * (never throws), so callers can surface an error without crashing.
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
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const profileBlock = profilePromptBlock(await getFounderProfile());
  const system = profileBlock
    ? `${SYSTEM_PROMPTS[type]}\n\n${profileBlock}`
    : SYSTEM_PROMPTS[type];

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
              content: `Here is the product and its analysis:\n\n${userContext(product, analysis, buildPlan)}`,
            },
          ],
          temperature: 0.7,
        }),
        cache: "no-store",
      },
      20000
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[artifacts] OpenRouter ${res.status}: ${text.slice(0, 200)}`);
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
