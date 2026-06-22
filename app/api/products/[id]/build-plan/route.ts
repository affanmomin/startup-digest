import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateAndSaveBuildPlan } from "@/lib/buildplan";

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
    const plan = await generateAndSaveBuildPlan(id);
    if (!plan) {
      return NextResponse.json(
        { ok: false, error: "Could not generate build plan" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    console.error(`[api/products/${id}/build-plan] error:`, err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Build plan failed",
      },
      { status: 500 }
    );
  }
}
