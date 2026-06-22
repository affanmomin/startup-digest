"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, Hammer, X, Circle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { setProductStatusAction } from "@/app/actions";
import type { ProductStatus } from "@/lib/types";

const META: Record<
  ProductStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  NEW: { label: "New", icon: Circle, cls: "text-slate-500" },
  SAVED: { label: "Saved", icon: Bookmark, cls: "text-blue-600" },
  BUILDING: { label: "Building", icon: Hammer, cls: "text-emerald-600" },
  PASSED: { label: "Passed", icon: X, cls: "text-slate-400" },
};

const ORDER: ProductStatus[] = ["NEW", "SAVED", "BUILDING", "PASSED"];

/** Read-only status badge (for tables / cards where space is tight). */
export function StatusBadge({ status }: { status: string }) {
  const meta = META[(status as ProductStatus) in META ? (status as ProductStatus) : "NEW"];
  const Icon = meta.icon;
  const variant =
    status === "BUILDING" ? "success" : status === "SAVED" ? "default" : "secondary";
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

/** Interactive segmented control to change a product's triage status. */
export function StatusControl({
  productId,
  status,
}: {
  productId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [current, setCurrent] = React.useState(status);

  async function set(next: ProductStatus) {
    if (next === current || pending) return;
    setPending(next);
    const prev = current;
    setCurrent(next); // optimistic
    const res = await setProductStatusAction(productId, next);
    if (!res.ok) setCurrent(prev);
    else router.refresh();
    setPending(null);
  }

  return (
    <div className="inline-flex items-center rounded-md border bg-background p-0.5">
      {ORDER.map((s) => {
        const meta = META[s];
        const Icon = meta.icon;
        const active = current === s;
        return (
          <button
            key={s}
            type="button"
            disabled={!!pending}
            onClick={() => set(s)}
            title={meta.label}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {active ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
