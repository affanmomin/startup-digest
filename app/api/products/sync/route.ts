import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fetchLatestProducts, saveProducts } from "@/lib/producthunt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const unauthorized = requireAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const products = await fetchLatestProducts({ first: 30, daysBack: 7 });
    const result = await saveProducts(products);

    return NextResponse.json({
      ok: true,
      fetched: products.length,
      created: result.created,
      updated: result.updated,
    });
  } catch (err) {
    console.error("[api/products/sync] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
