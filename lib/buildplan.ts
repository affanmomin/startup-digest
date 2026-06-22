import type { Product, ProductAnalysis, BuildPlan } from "@prisma/client";
import type { BuildPlanResult } from "@/lib/types";
import { asStringArray } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { fetchWithTimeout } from "@/lib/concurrency";
import { getFounderProfile, profilePromptBlock } from "@/lib/founder";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are a senior solo SaaS founder and full-stack engineer who has shipped many MVPs.

A founder wants to build their OWN sharper, more focused version of an existing Product Hunt product — not a clone, a better-targeted take. Write them a concrete, realistic MVP build plan they could start this week.

Return valid JSON only, matching exactly this shape:

{
  "overview": "2-3 sentences: what the founder should build and for whom",
  "targetNiche": "the specific niche/segment to win first",
  "differentiation": ["how this version is sharper than the original", "..."],
  "coreFeatures": ["the 4-6 features the MVP actually needs — no more", "..."],
  "techStack": ["concrete, solo-friendly choices e.g. Next.js, Postgres, Stripe", "..."],
  "milestones": [
    { "week": "Week 1", "title": "short title", "detail": "what gets done" }
  ],
  "firstSteps": ["the literal first 3 things to do on day 1", "..."],
  "risks": ["the real risks / why this might not work", "..."],
  "monetization": "how it makes money, with a concrete price point",
  "estimatedTimeline": "realistic time to a launchable MVP for one engineer"
}

Apply these founder instincts when planning (don't output them — let them shape the plan):
- Focus as subtraction: pick the SMALLEST wedge that wins ONE niche. Cut everything else.
- Sequence for proof: order milestones so demand/willingness-to-pay is tested as early as possible.
- Leverage: prefer automation, one sharp channel, and reused building blocks over breadth.
- Inversion: name the single risk most likely to kill it, and where the plan de-risks it.

Rules:
- Think like an indie hacker shipping solo. Be specific and realistic, never generic.
- Scope the MVP ruthlessly (YAGNI). 4-6 core features maximum.
- Prefer boring, proven, solo-friendly tech (Next.js, Postgres, Stripe, Resend, Vercel).
- milestones: 3-5 entries, week-by-week, each genuinely achievable solo.
- firstSteps: exactly the first concrete actions, not strategy.
- Ground everything in the specific product and its niche. No filler.
- Return JSON only. No markdown.`;

function extractJson(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1);
    }
  }
  return text;
}

function asMilestones(
  value: unknown
): { week: string; title: string; detail: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((m) => {
      if (!m || typeof m !== "object") return null;
      const o = m as Record<string, unknown>;
      return {
        week: typeof o.week === "string" ? o.week : "",
        title: typeof o.title === "string" ? o.title : "",
        detail: typeof o.detail === "string" ? o.detail : "",
      };
    })
    .filter(
      (m): m is { week: string; title: string; detail: string } =>
        !!m && (m.title.length > 0 || m.detail.length > 0)
    );
}

function normalize(parsed: Record<string, unknown>): BuildPlanResult {
  return {
    overview: typeof parsed.overview === "string" ? parsed.overview : "",
    targetNiche:
      typeof parsed.targetNiche === "string" ? parsed.targetNiche : "",
    differentiation: asStringArray(parsed.differentiation),
    coreFeatures: asStringArray(parsed.coreFeatures),
    techStack: asStringArray(parsed.techStack),
    milestones: asMilestones(parsed.milestones),
    firstSteps: asStringArray(parsed.firstSteps),
    risks: asStringArray(parsed.risks),
    monetization:
      typeof parsed.monetization === "string" ? parsed.monetization : "",
    estimatedTimeline:
      typeof parsed.estimatedTimeline === "string"
        ? parsed.estimatedTimeline
        : "",
  };
}

/**
 * Generate an MVP build plan for the founder's differentiated version of a
 * product. Returns null on failure (never throws) so the UI can show an error
 * without crashing.
 */
export async function generateBuildPlan(
  product: Product,
  analysis: ProductAnalysis | null
): Promise<BuildPlanResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[buildplan] OPENROUTER_API_KEY is not configured.");
    return null;
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const topics = Array.isArray(product.topics)
    ? (product.topics as unknown[]).filter((t) => typeof t === "string")
    : [];

  // Feed the analysis in so the plan builds on the niche/differentiation work
  // already done, rather than re-deriving it.
  const context = [
    `Original product: ${product.name}`,
    `Tagline: ${product.tagline}`,
    product.description ? `Description: ${product.description}` : "",
    topics.length ? `Topics: ${topics.join(", ")}` : "",
    analysis ? `Why interesting: ${analysis.whyInteresting}` : "",
    analysis ? `Suggested niche angles: ${asStringArray(analysis.nicheVersions).join("; ")}` : "",
    analysis ? `Suggested better versions: ${asStringArray(analysis.betterVersions).join("; ")}` : "",
    analysis ? `Founder take: ${analysis.founderTake}` : "",
    analysis ? `Clone score ${analysis.cloneScore}/10, build difficulty ${analysis.buildDifficulty}/10, rough MVP time ${analysis.mvpTime}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const profileBlock = profilePromptBlock(await getFounderProfile());
  const systemContent = profileBlock
    ? `${SYSTEM_PROMPT}\n\n${profileBlock}`
    : SYSTEM_PROMPT;

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
            { role: "system", content: systemContent },
            {
              role: "user",
              content: `Write my MVP build plan for a sharper version of this:\n\n${context}`,
            },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
        cache: "no-store",
      },
      18000
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[buildplan] OpenRouter responded ${res.status}: ${text.slice(0, 300)}`
      );
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    content = data.choices?.[0]?.message?.content ?? "";
    if (!content) {
      console.error("[buildplan] empty model response");
      return null;
    }
  } catch (err) {
    console.error("[buildplan] request failed:", err);
    return null;
  }

  try {
    const parsed = JSON.parse(extractJson(content)) as Record<string, unknown>;
    return normalize(parsed);
  } catch (err) {
    console.error("[buildplan] failed to parse JSON:", err);
    return null;
  }
}

/**
 * Generate + persist a build plan for a product id. Returns the saved plan or
 * null on failure. Never throws.
 */
export async function generateAndSaveBuildPlan(
  productId: string
): Promise<BuildPlan | null> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { analysis: true },
    });
    if (!product) return null;

    const plan = await generateBuildPlan(product, product.analysis);
    if (!plan) return null;

    return await prisma.buildPlan.upsert({
      where: { productId },
      create: { productId, ...plan },
      // Regenerating produces a structurally different plan, so reset progress —
      // old completed indexes would otherwise point at the wrong items.
      update: {
        ...plan,
        completedMilestones: [],
        completedFirstSteps: [],
      },
    });
  } catch (err) {
    console.error(`[buildplan] save failed for ${productId}:`, err);
    return null;
  }
}
