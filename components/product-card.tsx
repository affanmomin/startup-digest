import Link from "next/link";
import { ArrowUpRight, ChevronUp } from "lucide-react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CloneScoreBadge, DifficultyBadge } from "@/components/score-badge";
import { OpportunityBadge } from "@/components/opportunity-badge";
import { StatusControl } from "@/components/status-control";
import { FavoriteButton } from "@/components/favorite-button";
import type { ProductWithAnalysis } from "@/lib/types";

export function ProductCard({ product }: { product: ProductWithAnalysis }) {
  const a = product.analysis;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug">
            {product.name}
          </CardTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            {a ? <OpportunityBadge score={a.opportunityScore} showLabel={false} /> : null}
            <Badge variant="outline" className="gap-1">
              <ChevronUp className="h-3 w-3" />
              {product.upvotes}
            </Badge>
            <FavoriteButton productId={product.id} favorite={product.favorite} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{product.tagline}</p>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {a ? (
          <>
            <div className="flex flex-wrap gap-2">
              <CloneScoreBadge score={a.cloneScore} />
              <DifficultyBadge score={a.buildDifficulty} />
              <Badge variant="outline">MVP: {a.mvpTime}</Badge>
            </div>
            {a.founderTake ? (
              <p className="line-clamp-3 text-sm italic text-foreground/80">
                &ldquo;{a.founderTake}&rdquo;
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Not analyzed yet.</p>
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2">
        <StatusControl productId={product.id} status={product.status} />
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/products/${product.id}`}>
            View details
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
