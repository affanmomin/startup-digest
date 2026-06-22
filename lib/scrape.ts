import { fetchWithTimeout } from "@/lib/concurrency";

/**
 * Best-effort fetch of a page's visible text, for grounding AI generation in the
 * real product rather than just its tagline. Strips scripts/styles/markup and
 * collapses whitespace. Returns null on failure (never throws) so callers degrade
 * gracefully when a site blocks bots or is JS-only.
 */
export async function fetchPageText(
  url: string | null | undefined,
  maxChars = 6000
): Promise<string | null> {
  if (!url) return null;
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

  try {
    const res = await fetchWithTimeout(
      normalized,
      {
        headers: {
          // Look like a real browser so more sites return real HTML.
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        cache: "no-store",
      },
      9000
    );
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") ?? "";
    if (!ctype.includes("html") && !ctype.includes("text")) return null;

    const html = await res.text();
    const text = htmlToText(html);
    return text.length > 0 ? text.slice(0, maxChars) : null;
  } catch (err) {
    console.error("[scrape] failed for", normalized, err);
    return null;
  }
}

/** Pull a meta description / og:description out of raw HTML if present. */
function metaDescription(html: string): string {
  const patterns = [
    /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decode(m[1]).trim();
  }
  return "";
}

function htmlToText(html: string): string {
  const meta = metaDescription(html);
  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decode(titleMatch[1]).trim() : "";

  // Body text: drop non-content elements, then strip tags.
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<head[\s\S]*?<\/head>/i, " ")
    .replace(/<[^>]+>/g, " ");
  body = decode(body).replace(/\s+/g, " ").trim();

  const parts = [
    title ? `PAGE TITLE: ${title}` : "",
    meta ? `META DESCRIPTION: ${meta}` : "",
    body ? `PAGE TEXT: ${body}` : "",
  ].filter(Boolean);
  return parts.join("\n");
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}
