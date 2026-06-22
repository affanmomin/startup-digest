"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  analyzeAllAction,
  sendTestDigestAction,
  syncProductsAction,
  type ActionResult,
} from "@/app/actions";

type Pending = "sync" | "analyze" | "digest" | null;

export function DashboardActions() {
  const router = useRouter();
  const [pending, setPending] = React.useState<Pending>(null);
  const [feedback, setFeedback] = React.useState<ActionResult | null>(null);

  async function run(kind: Exclude<Pending, null>, fn: () => Promise<ActionResult>) {
    setPending(kind);
    setFeedback(null);
    try {
      const result = await fn();
      setFeedback(result);
      if (result.ok) router.refresh();
    } catch {
      setFeedback({ ok: false, message: "Unexpected error. Check logs." });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() => run("sync", syncProductsAction)}
        >
          {pending === "sync" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Sync Product Hunt
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() => run("analyze", analyzeAllAction)}
        >
          {pending === "analyze" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Analyze All
        </Button>

        <Button
          size="sm"
          disabled={pending !== null}
          onClick={() => run("digest", sendTestDigestAction)}
        >
          {pending === "digest" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MailCheck className="h-4 w-4" />
          )}
          Send Test Digest
        </Button>
      </div>

      {feedback ? (
        <p
          className={
            feedback.ok
              ? "text-xs text-emerald-600"
              : "text-xs text-destructive"
          }
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
