import { Badge } from "@/components/ui/badge";

/** Clone score: higher is better (more worth cloning). */
export function CloneScoreBadge({ score }: { score: number }) {
  const variant = score >= 7 ? "success" : score >= 4 ? "warning" : "secondary";
  return <Badge variant={variant}>Clone {score}/10</Badge>;
}

/** Build difficulty: lower is better (easier to build). */
export function DifficultyBadge({ score }: { score: number }) {
  const variant = score <= 3 ? "success" : score <= 6 ? "warning" : "destructive";
  return <Badge variant={variant}>Difficulty {score}/10</Badge>;
}

export function WorthBuildingBadge({ worth }: { worth: boolean }) {
  return worth ? (
    <Badge variant="success">Worth building</Badge>
  ) : (
    <Badge variant="secondary">Skip</Badge>
  );
}
