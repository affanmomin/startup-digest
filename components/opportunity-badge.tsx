import { Badge } from "@/components/ui/badge";
import { opportunityTier } from "@/lib/scoring";

export function OpportunityBadge({
  score,
  showLabel = true,
}: {
  score: number;
  showLabel?: boolean;
}) {
  const tier = opportunityTier(score);
  return (
    <Badge variant={tier.variant} title="Opportunity score (0-100)">
      ⚡ {score}
      {showLabel ? ` · ${tier.label}` : ""}
    </Badge>
  );
}
