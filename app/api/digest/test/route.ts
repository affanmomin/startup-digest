import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWeeklyDigest } from "@/lib/digest";
import { sendDigestEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const unauthorized = requireAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const digest = await generateWeeklyDigest();
    if (!digest) {
      return NextResponse.json(
        { ok: false, error: "No analyzed products — nothing to digest." },
        { status: 409 }
      );
    }
    const emailResult = await sendDigestEmail(digest);

    if (emailResult.sent) {
      await prisma.weeklyDigest.update({
        where: { id: digest.id },
        data: { emailSentAt: new Date() },
      });
    }

    return NextResponse.json({
      ok: true,
      digestId: digest.id,
      title: digest.title,
      email: emailResult,
    });
  } catch (err) {
    console.error("[api/digest/test] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Test digest failed",
      },
      { status: 500 }
    );
  }
}
