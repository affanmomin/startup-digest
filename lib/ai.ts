import type { Product, ProductAnalysis } from "@prisma/client";
import type { AnalysisResult } from "@/lib/types";
import { asStringArray } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { computeOpportunityScore } from "@/lib/scoring";
import { fetchWithTimeout } from "@/lib/concurrency";
import { getFounderProfile, profilePromptBlock } from "@/lib/founder";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are an experienced solo SaaS founder.

Analyze this Product Hunt launch for product inspiration.

Return valid JSON only.

{
  "summary": "",
  "whyInteresting": "",
  "weaknesses": [],
  "cloneScore": 1,
  "buildDifficulty": 1,
  "demandSignal": 1,
  "monetizationPotential": 1,
  "mvpTime": "",
  "betterVersions": [],
  "nicheVersions": [],
  "germanyVersion": "",
  "aiVersion": "",
  "founderTake": "",
  "worthBuilding": true,
  "recommendation": ""
}

Apply these founder instincts when judging (don't output them — let them shape your answer):
- Premise challenge: is this a painkiller or a vitamin? Real, recurring pain — or a nice demo?
- Inversion: what would make a sharper clone FAIL (entrenched incumbent, no distribution, no willingness to pay)?
- Proxy skepticism: upvotes ≠ demand ≠ willingness to pay. Judge real pull, not launch-day hype.
- Focus as subtraction: the best version does LESS, for a NARROWER user who'll pay.
- Leverage: where does small effort create outsized output (a wedge, one channel, automation)?

Rules:
- Think like an indie hacker.
- Think like a solo founder.
- Avoid generic startup advice.
- Focus on realistic products a solo full-stack engineer can build.
- Consider React, Next.js, Node.js, AI, SaaS, scraping, automation and dashboards.
- Suggest sharper, more focused, or more niche versions.
- Be practical and direct.
- cloneScore must be 1-10 (how clonable / how clear the wedge is).
- buildDifficulty must be 1-10 (1 = trivial weekend build, 10 = very hard).
- demandSignal must be 1-10 (how much real, paying demand exists for this).
- monetizationPotential must be 1-10 (how realistically a solo founder can charge for it).
- Return JSON only. No markdown.`;

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
}

function extractJson(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1);
    }
  }
  return text;
}

/** Validate + coerce arbitrary parsed JSON into a well-formed AnalysisResult. */
function normalizeAnalysis(parsed: Record<string, unknown>): AnalysisResult {
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    whyInteresting:
      typeof parsed.whyInteresting === "string" ? parsed.whyInteresting : "",
    weaknesses: asStringArray(parsed.weaknesses),
    cloneScore: clampInt(parsed.cloneScore, 1, 10, 5),
    buildDifficulty: clampInt(parsed.buildDifficulty, 1, 10, 5),
    demandSignal: clampInt(parsed.demandSignal, 1, 10, 5),
    monetizationPotential: clampInt(parsed.monetizationPotential, 1, 10, 5),
    mvpTime: typeof parsed.mvpTime === "string" ? parsed.mvpTime : "Unknown",
    betterVersions: asStringArray(parsed.betterVersions),
    nicheVersions: asStringArray(parsed.nicheVersions),
    germanyVersion:
      typeof parsed.germanyVersion === "string" ? parsed.germanyVersion : "",
    aiVersion: typeof parsed.aiVersion === "string" ? parsed.aiVersion : "",
    founderTake:
      typeof parsed.founderTake === "string" ? parsed.founderTake : "",
    worthBuilding:
      typeof parsed.worthBuilding === "boolean" ? parsed.worthBuilding : false,
    recommendation:
      typeof parsed.recommendation === "string" ? parsed.recommendation : "",
  };
}

/**
 * Analyze a single product with OpenRouter.
 * Returns null on ANY failure (missing key, HTTP/429/5xx, empty, unparseable) so
 * the caller does NOT persist a junk row — the product stays in the pending queue
 * and gets retried on the next run. Never throws.
 */
export async function analyzeProduct(
  product: Product
): Promise<AnalysisResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[ai] OPENROUTER_API_KEY is not configured.");
    return null;
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const topics = Array.isArray(product.topics)
    ? (product.topics as unknown[]).filter((t) => typeof t === "string")
    : [];

  const profileBlock = profilePromptBlock(await getFounderProfile());
  const systemContent = profileBlock
    ? `${SYSTEM_PROMPT}\n\n${profileBlock}`
    : SYSTEM_PROMPT;

  const userContent = `Product to analyze:

Name: ${product.name}
Tagline: ${product.tagline}
Description: ${product.description ?? "(none provided)"}
Website: ${product.websiteUrl ?? "(none)"}
Topics: ${topics.length ? topics.join(", ") : "(none)"}
Upvotes: ${product.upvotes}`;

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
            { role: "user", content: userContent },
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
        `[ai] OpenRouter responded ${res.status} ${res.statusText}: ${text.slice(0, 300)}`
      );
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    content = data.choices?.[0]?.message?.content ?? "";
    if (!content) {
      console.error("[ai] OpenRouter returned empty content.");
      return null;
    }
  } catch (err) {
    console.error("[ai] OpenRouter request failed:", err);
    return null;
  }

  try {
    const parsed = JSON.parse(extractJson(content)) as Record<string, unknown>;
    return normalizeAnalysis(parsed);
  } catch (err) {
    console.error(
      "[ai] Failed to parse model JSON:",
      err,
      "\nRaw content:",
      content.slice(0, 500)
    );
    return null;
  }
}

/**
 * Analyze a product and upsert its ProductAnalysis row.
 * Returns the saved analysis, or null if analysis failed (no row is written, so
 * the product remains eligible for retry). Never throws.
 */
export async function analyzeAndSaveProduct(
  product: Product
): Promise<ProductAnalysis | null> {
  try {
    const result = await analyzeProduct(product);
    if (!result) return null; // do not persist failures
    const opportunityScore = computeOpportunityScore(result);
    const saved = await prisma.productAnalysis.upsert({
      where: { productId: product.id },
      create: { productId: product.id, ...result, opportunityScore },
      update: { ...result, opportunityScore },
    });
    return saved;
  } catch (err) {
    console.error(
      `[ai] failed to analyze/save product ${product.id} (${product.name}):`,
      err
    );
    return null;
  }
}
