"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { analyzeProductAction } from "@/app/actions";

export function AnalyzeButton({
  productId,
  hasAnalysis,
}: {
  productId: string;
  hasAnalysis: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeProductAction(productId);
      if (!result.ok) setError(result.message);
      else router.refresh();
    } catch {
      setError("Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" disabled={loading} onClick={handleClick}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {hasAnalysis ? "Re-analyze" : "Analyze"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
