import { prisma } from "@/lib/prisma";
import type { FounderProfile } from "@prisma/client";
import { asStringArray } from "@/lib/utils";

const PROFILE_ID = "default";

/** Read the single founder profile, or null if it hasn't been set up. */
export async function getFounderProfile(): Promise<FounderProfile | null> {
  return prisma.founderProfile.findUnique({ where: { id: PROFILE_ID } });
}

export interface FounderProfileInput {
  skills: string[];
  preferredStack: string[];
  interests: string[];
  antiInterests: string[];
  weeklyHours: number;
  currentFocus: string;
}

/** Create or update the founder profile. */
export async function saveFounderProfile(
  input: FounderProfileInput
): Promise<FounderProfile> {
  const data = {
    skills: input.skills,
    preferredStack: input.preferredStack,
    interests: input.interests,
    antiInterests: input.antiInterests,
    weeklyHours: Number.isFinite(input.weeklyHours)
      ? Math.max(1, Math.min(168, Math.round(input.weeklyHours)))
      : 10,
    currentFocus: input.currentFocus,
  };
  return prisma.founderProfile.upsert({
    where: { id: PROFILE_ID },
    create: { id: PROFILE_ID, ...data },
    update: data,
  });
}

/**
 * Render the profile as a prompt fragment injected into analysis + build-plan
 * prompts so recommendations are personalized to this specific founder.
 * Returns "" when no profile exists (prompts stay generic).
 */
export function profilePromptBlock(profile: FounderProfile | null): string {
  if (!profile) return "";
  const skills = asStringArray(profile.skills);
  const stack = asStringArray(profile.preferredStack);
  const interests = asStringArray(profile.interests);
  const anti = asStringArray(profile.antiInterests);
  const focus = profile.currentFocus.trim();

  // Don't inject a personalization block for an effectively-empty profile
  // (just the default hours) — it would add noise without signal.
  const hasContent =
    skills.length || stack.length || interests.length || anti.length || focus;
  if (!hasContent) return "";

  const lines = [
    "Tailor your answer to THIS founder:",
    skills.length ? `- Skills: ${skills.join(", ")}` : "",
    stack.length ? `- Preferred stack: ${stack.join(", ")}` : "",
    interests.length ? `- Interested in: ${interests.join(", ")}` : "",
    anti.length ? `- NOT interested in (avoid recommending): ${anti.join(", ")}` : "",
    `- Has about ${profile.weeklyHours} hours/week to build.`,
    focus ? `- Current focus: ${focus}` : "",
    "Weight feasibility and fit to this founder accordingly.",
  ].filter(Boolean);

  return lines.join("\n");
}
