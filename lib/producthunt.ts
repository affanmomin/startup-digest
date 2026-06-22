import { prisma } from "@/lib/prisma";
import type { NormalizedProduct } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/concurrency";

const PH_GRAPHQL_ENDPOINT = "https://api.producthunt.com/v2/api/graphql";

/**
 * GraphQL query for the week's Product Hunt launches, ordered by votes.
 * Top-voted is far higher signal than newest for finding ideas worth cloning.
 */
const LATEST_POSTS_QUERY = /* GraphQL */ `
  query TopPosts($first: Int!, $postedAfter: DateTime) {
    posts(order: VOTES, first: $first, postedAfter: $postedAfter) {
      edges {
        node {
          id
          name
          tagline
          description
          url
          website
          votesCount
          featuredAt
          createdAt
          thumbnail {
            url
          }
          topics(first: 10) {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    }
  }
`;

interface PHTopicEdge {
  node?: { name?: string | null } | null;
}

interface PHPostNode {
  id: string;
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  url?: string | null;
  website?: string | null;
  votesCount?: number | null;
  featuredAt?: string | null;
  createdAt?: string | null;
  thumbnail?: { url?: string | null } | null;
  topics?: { edges?: PHTopicEdge[] | null } | null;
}

interface PHResponse {
  data?: { posts?: { edges?: { node?: PHPostNode | null }[] | null } | null };
  errors?: { message: string }[];
}

/**
 * Normalize a raw Product Hunt post node into our persistence shape.
 * Defensively handles missing fields so a partial node never crashes the sync.
 */
export function normalizeProductHuntProduct(
  node: PHPostNode
): NormalizedProduct | null {
  if (!node?.id) return null;

  const topics =
    node.topics?.edges
      ?.map((e) => e?.node?.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0) ?? [];

  const launchRaw = node.featuredAt || node.createdAt;
  const launchDate = launchRaw ? new Date(launchRaw) : new Date();

  return {
    productHuntId: String(node.id),
    name: node.name?.trim() || "Untitled launch",
    tagline: node.tagline?.trim() || "",
    description: node.description?.trim() || null,
    websiteUrl: node.website?.trim() || null,
    productHuntUrl: node.url?.trim() || `https://www.producthunt.com/`,
    thumbnailUrl: node.thumbnail?.url?.trim() || null,
    upvotes:
      typeof node.votesCount === "number" && node.votesCount >= 0
        ? node.votesCount
        : 0,
    topics,
    launchDate: Number.isNaN(launchDate.getTime()) ? new Date() : launchDate,
  };
}

/**
 * Fetch the latest Product Hunt launches via the GraphQL API.
 * Returns a normalized list. Throws on auth/config errors so callers can surface them.
 */
export async function fetchLatestProducts(
  options: { first?: number; daysBack?: number } = {}
): Promise<NormalizedProduct[]> {
  const token = process.env.PRODUCT_HUNT_ACCESS_TOKEN;
  if (!token) {
    throw new Error("PRODUCT_HUNT_ACCESS_TOKEN is not configured.");
  }

  const first = Math.min(Math.max(options.first ?? 40, 1), 50);
  const daysBack = options.daysBack ?? 7;
  const postedAfter = new Date(
    Date.now() - daysBack * 24 * 60 * 60 * 1000
  ).toISOString();

  let json: PHResponse;
  try {
    const res = await fetchWithTimeout(
      PH_GRAPHQL_ENDPOINT,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: LATEST_POSTS_QUERY,
          variables: { first, postedAfter },
        }),
        // Never cache launch data.
        cache: "no-store",
      },
      15000
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Product Hunt API responded ${res.status} ${res.statusText}. ${text.slice(0, 300)}`
      );
    }

    json = (await res.json()) as PHResponse;
  } catch (err) {
    console.error("[producthunt] fetch failed:", err);
    throw err instanceof Error
      ? err
      : new Error("Unknown Product Hunt fetch error");
  }

  if (json.errors?.length) {
    const message = json.errors.map((e) => e.message).join("; ");
    console.error("[producthunt] GraphQL errors:", message);
    throw new Error(`Product Hunt GraphQL error: ${message}`);
  }

  const edges = json.data?.posts?.edges ?? [];
  const normalized: NormalizedProduct[] = [];
  for (const edge of edges) {
    if (!edge?.node) continue;
    const product = normalizeProductHuntProduct(edge.node);
    if (product) normalized.push(product);
  }

  return normalized;
}

/**
 * Persist normalized products, skipping duplicates by productHuntId.
 * Existing rows have their upvotes/metadata refreshed.
 * Returns counts of created vs updated.
 */
export async function saveProducts(
  products: NormalizedProduct[]
): Promise<{ created: number; updated: number; total: number }> {
  let created = 0;
  let updated = 0;

  for (const p of products) {
    try {
      const existing = await prisma.product.findUnique({
        where: { productHuntId: p.productHuntId },
        select: { id: true },
      });

      await prisma.product.upsert({
        where: { productHuntId: p.productHuntId },
        create: {
          productHuntId: p.productHuntId,
          name: p.name,
          tagline: p.tagline,
          description: p.description,
          websiteUrl: p.websiteUrl,
          productHuntUrl: p.productHuntUrl,
          thumbnailUrl: p.thumbnailUrl,
          upvotes: p.upvotes,
          topics: p.topics,
          launchDate: p.launchDate,
        },
        update: {
          // Refresh volatile fields; keep the original launch identity.
          name: p.name,
          tagline: p.tagline,
          description: p.description,
          websiteUrl: p.websiteUrl,
          thumbnailUrl: p.thumbnailUrl,
          upvotes: p.upvotes,
          topics: p.topics,
        },
      });

      if (existing) updated++;
      else created++;
    } catch (err) {
      console.error(
        `[producthunt] failed to save product ${p.productHuntId}:`,
        err
      );
    }
  }

  return { created, updated, total: products.length };
}
