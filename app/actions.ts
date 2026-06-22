"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { fetchLatestProducts, saveProducts } from "@/lib/producthunt";
import { analyzeAndSaveProduct } from "@/lib/ai";
import { mapWithConcurrency } from "@/lib/concurrency";
import { generateAndSaveBuildPlan } from "@/lib/buildplan";
import { generateWeeklyDigest } from "@/lib/digest";
import { sendDigestEmail } from "@/lib/email";
import { saveFounderProfile } from "@/lib/founder";
import { PRODUCT_STATUSES, type ProductStatus } from "@/lib/types";

function parseList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type ActionResult = {
  ok: boolean;
  message: string;
};

/** Sync the latest Product Hunt launches into the database. */
export async function syncProductsAction(): Promise<ActionResult> {
  try {
    const products = await fetchLatestProducts({ first: 30, daysBack: 7 });
    const { created, updated } = await saveProducts(products);
    revalidatePath("/dashboard");
    revalidatePath("/");
    return {
      ok: true,
      message: `Synced ${products.length} launches — ${created} new, ${updated} updated.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Sync failed.",
    };
  }
}

/** Analyze every product that does not yet have an analysis (bounded per run). */
export async function analyzeAllAction(): Promise<ActionResult> {
  try {
    const pending = await prisma.product.findMany({
      where: { analysis: { is: null } },
      orderBy: [{ upvotes: "desc" }, { launchDate: "desc" }],
      take: 25,
    });

    const results = await mapWithConcurrency(pending, 5, (product) =>
      analyzeAndSaveProduct(product)
    );
    const success = results.filter(Boolean).length;
    const failed = pending.length - success;
    const remaining = await prisma.product.count({
      where: { analysis: { is: null } },
    });

    revalidatePath("/dashboard");
    revalidatePath("/");
    return {
      ok: true,
      message: pending.length
        ? `Analyzed ${success}${failed ? `, ${failed} failed` : ""}.` +
          (remaining ? ` ${remaining} left — run again.` : "")
        : "No products awaiting analysis.",
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Analysis failed.",
    };
  }
}

/** Analyze a single product by id (used from the product detail page). */
export async function analyzeProductAction(
  productId: string
): Promise<ActionResult> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) return { ok: false, message: "Product not found." };

    const saved = await analyzeAndSaveProduct(product);
    if (!saved) return { ok: false, message: "Analysis failed." };

    revalidatePath(`/products/${productId}`);
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { ok: true, message: `Analyzed "${product.name}".` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Analysis failed.",
    };
  }
}

/** Save the founder profile (used to personalize analysis + build plans). */
export async function saveFounderProfileAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    await saveFounderProfile({
      skills: parseList(formData.get("skills")),
      preferredStack: parseList(formData.get("preferredStack")),
      interests: parseList(formData.get("interests")),
      antiInterests: parseList(formData.get("antiInterests")),
      weeklyHours: Number(formData.get("weeklyHours")) || 10,
      currentFocus: String(formData.get("currentFocus") ?? "").trim(),
    });
    revalidatePath("/settings");
    return { ok: true, message: "Profile saved." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not save profile.",
    };
  }
}

/** Toggle completion of a build-plan milestone or first-step (by index). */
export async function toggleBuildPlanItemAction(
  productId: string,
  kind: "milestone" | "step",
  index: number,
  done: boolean
): Promise<ActionResult> {
  try {
    const plan = await prisma.buildPlan.findUnique({ where: { productId } });
    if (!plan) return { ok: false, message: "No build plan." };

    const field = kind === "milestone" ? "completedMilestones" : "completedFirstSteps";
    const current = Array.isArray(plan[field])
      ? (plan[field] as unknown[]).filter((n): n is number => typeof n === "number")
      : [];
    const set = new Set(current);
    if (done) set.add(index);
    else set.delete(index);

    await prisma.buildPlan.update({
      where: { productId },
      data: { [field]: Array.from(set).sort((a, b) => a - b) },
    });
    revalidatePath(`/products/${productId}`);
    revalidatePath("/");
    return { ok: true, message: "Saved." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not update.",
    };
  }
}

/** Save the founder's free-form notes on a build plan. */
export async function saveBuildPlanNotesAction(
  productId: string,
  notes: string
): Promise<ActionResult> {
  try {
    await prisma.buildPlan.update({
      where: { productId },
      data: { notes: notes.slice(0, 5000) },
    });
    revalidatePath(`/products/${productId}`);
    return { ok: true, message: "Notes saved." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not save notes.",
    };
  }
}

/** Set a product's triage status (NEW / SAVED / BUILDING / PASSED). */
export async function setProductStatusAction(
  productId: string,
  status: string
): Promise<ActionResult> {
  if (!PRODUCT_STATUSES.includes(status as ProductStatus)) {
    return { ok: false, message: "Invalid status." };
  }
  try {
    await prisma.product.update({
      where: { id: productId },
      data: { status },
    });
    revalidatePath("/dashboard");
    revalidatePath("/");
    revalidatePath(`/products/${productId}`);
    return { ok: true, message: `Marked as ${status.toLowerCase()}.` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not update status.",
    };
  }
}

/** Generate (or regenerate) an MVP build plan for a product. */
export async function generateBuildPlanAction(
  productId: string
): Promise<ActionResult> {
  try {
    const plan = await generateAndSaveBuildPlan(productId);
    if (!plan) {
      return {
        ok: false,
        message: "Could not generate a build plan (check OPENROUTER_API_KEY / logs).",
      };
    }
    revalidatePath(`/products/${productId}`);
    return { ok: true, message: "Build plan generated." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Build plan failed.",
    };
  }
}

/** Generate a digest now and send the test email. */
export async function sendTestDigestAction(): Promise<ActionResult> {
  try {
    const digest = await generateWeeklyDigest();
    if (!digest) {
      return {
        ok: false,
        message: "No analyzed products yet — sync and analyze some first.",
      };
    }
    const result = await sendDigestEmail(digest);

    if (result.sent) {
      await prisma.weeklyDigest.update({
        where: { id: digest.id },
        data: { emailSentAt: new Date() },
      });
      revalidatePath("/dashboard");
      revalidatePath("/digests");
      return { ok: true, message: "Test digest generated and email sent." };
    }

    revalidatePath("/digests");
    return {
      ok: false,
      message: `Digest saved but email failed: ${result.error ?? "unknown error"}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Test digest failed.",
    };
  }
}
