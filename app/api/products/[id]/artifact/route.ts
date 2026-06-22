import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  generateAndSaveArtifact,
  isArtifactType,
  ARTIFACT_TYPES,
} from "@/lib/artifacts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/products/[id]/artifact?type=PRD  (or HANDOFF | GAP_ANALYSIS | FUTURE_SCOPE)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireAuth(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const type = req.nextUrl.searchParams.get("type") ?? "";

  if (!isArtifactType(type)) {
    return NextResponse.json(
      { ok: false, error: `type must be one of: ${ARTIFACT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const content = await generateAndSaveArtifact(id, type);
    if (!content) {
      return NextResponse.json(
        { ok: false, error: "Generation failed" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, type, content });
  } catch (err) {
    console.error(`[api/products/${id}/artifact] error:`, err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "failed" },
      { status: 500 }
    );
  }
}
