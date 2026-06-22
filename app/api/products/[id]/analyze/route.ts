import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeAndSaveProduct } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireAuth(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json(
        { ok: false, error: "Product not found" },
        { status: 404 }
      );
    }

    const analysis = await analyzeAndSaveProduct(product);
    if (!analysis) {
      return NextResponse.json(
        { ok: false, error: "Analysis failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, analysis });
  } catch (err) {
    console.error(`[api/products/${id}/analyze] error:`, err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Analysis failed",
      },
      { status: 500 }
    );
  }
}
