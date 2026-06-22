// Client-safe artifact metadata (no server imports — safe to use in components).

export const ARTIFACT_TYPES = [
  "GAP_ANALYSIS",
  "FUTURE_SCOPE",
  "PRD",
  "HANDOFF",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_META: Record<
  ArtifactType,
  { label: string; short: string }
> = {
  GAP_ANALYSIS: {
    label: "Gap Analysis",
    short: "Where the original underserves the market — your opening.",
  },
  FUTURE_SCOPE: {
    label: "Future Scope",
    short: "A realistic Now → Next → Later roadmap for your version.",
  },
  PRD: {
    label: "PRD",
    short: "A product requirements doc — the what & why, no tech.",
  },
  HANDOFF: {
    label: "Claude Code Handoff",
    short: "A product brief + kickoff prompt that has Claude Code interview you, then build in your stack.",
  },
};

export function isArtifactType(v: string): v is ArtifactType {
  return (ARTIFACT_TYPES as readonly string[]).includes(v);
}
