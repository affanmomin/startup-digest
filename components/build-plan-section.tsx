"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  Square,
  Hammer,
  Loader2,
  Rocket,
  Target,
  Wrench,
  ListChecks,
  TriangleAlert,
  DollarSign,
  CalendarClock,
  Pencil,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  generateBuildPlanAction,
  saveBuildPlanNotesAction,
  toggleBuildPlanItemAction,
} from "@/app/actions";
import { asStringArray, asNumberArray, cn } from "@/lib/utils";
import type { BuildPlan } from "@/lib/types";

function Block({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="text-sm leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

function asMilestones(
  value: unknown
): { week: string; title: string; detail: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((m) =>
      m && typeof m === "object"
        ? {
            week: String((m as Record<string, unknown>).week ?? ""),
            title: String((m as Record<string, unknown>).title ?? ""),
            detail: String((m as Record<string, unknown>).detail ?? ""),
          }
        : null
    )
    .filter((m): m is { week: string; title: string; detail: string } => !!m);
}

/** Free-form founder notes on the plan, saved on blur. */
function PlanNotes({
  productId,
  initial,
}: {
  productId: string;
  initial: string;
}) {
  const [value, setValue] = React.useState(initial);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => setValue(initial), [initial]);

  async function save() {
    if (value === initial) return;
    const res = await saveBuildPlanNotesAction(productId, value);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
        <Pencil className="h-4 w-4 text-primary" />
        My notes
        {saved ? (
          <span className="text-xs font-normal text-emerald-600">Saved ✓</span>
        ) : null}
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        rows={3}
        placeholder="Your own thoughts, decisions, links… (saved when you click away)"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}

/** A persisted checkbox row. Optimistic, reverts on failure. */
function Checkable({
  productId,
  kind,
  index,
  initialDone,
  children,
}: {
  productId: string;
  kind: "milestone" | "step";
  index: number;
  initialDone: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [done, setDone] = React.useState(initialDone);
  const [pending, setPending] = React.useState(false);

  // Reconcile to server truth after router.refresh() / plan regeneration.
  React.useEffect(() => {
    setDone(initialDone);
  }, [initialDone]);

  async function toggle() {
    if (pending) return;
    const next = !done;
    setPending(true);
    setDone(next);
    const res = await toggleBuildPlanItemAction(productId, kind, index, next);
    if (!res.ok) setDone(!next);
    else router.refresh();
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="flex w-full items-start gap-2 text-left disabled:opacity-70"
    >
      {done ? (
        <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className={cn(done && "text-muted-foreground line-through")}>
        {children}
      </span>
    </button>
  );
}

export function BuildPlanSection({
  productId,
  plan,
}: {
  productId: string;
  plan: BuildPlan | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await generateBuildPlanAction(productId);
      if (!res.ok) setError(res.message);
      else router.refresh();
    } catch {
      setError("Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  const milestones = asMilestones(plan?.milestones);
  const firstSteps = asStringArray(plan?.firstSteps);
  const doneMilestones = new Set(asNumberArray(plan?.completedMilestones));
  const doneSteps = new Set(asNumberArray(plan?.completedFirstSteps));
  const totalCheckable = milestones.length + firstSteps.length;
  const doneCount =
    milestones.filter((_, i) => doneMilestones.has(i)).length +
    firstSteps.filter((_, i) => doneSteps.has(i)).length;
  const pct = totalCheckable ? Math.round((doneCount / totalCheckable) * 100) : 0;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Hammer className="h-5 w-5 text-primary" />
            Your MVP Build Plan
          </CardTitle>
          <div className="flex items-center gap-3">
            {plan && totalCheckable ? (
              <span className="text-xs font-medium text-muted-foreground">
                {doneCount}/{totalCheckable} done · {pct}%
              </span>
            ) : null}
            <Button
              size="sm"
              variant={plan ? "outline" : "default"}
              disabled={loading}
              onClick={generate}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {plan ? "Regenerate" : "Generate build plan"}
            </Button>
          </div>
        </div>
        {plan && totalCheckable ? (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardHeader>

      <CardContent>
        {!plan ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Turn this idea into action. Generate a concrete, week-by-week MVP plan
            for <span className="font-medium">your</span> sharper version — niche,
            features, stack, milestones, and the first 3 steps you can check off.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {plan.estimatedTimeline ? (
                <Badge variant="success" className="gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {plan.estimatedTimeline}
                </Badge>
              ) : null}
              {plan.targetNiche ? (
                <Badge variant="outline" className="gap-1">
                  <Target className="h-3 w-3" />
                  {plan.targetNiche}
                </Badge>
              ) : null}
            </div>

            {plan.overview ? (
              <p className="text-sm leading-relaxed">{plan.overview}</p>
            ) : null}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Block icon={Rocket} title="How it's sharper">
                <Bullets items={asStringArray(plan.differentiation)} />
              </Block>
              <Block icon={ListChecks} title="Core features (MVP)">
                <Bullets items={asStringArray(plan.coreFeatures)} />
              </Block>
              <Block icon={Wrench} title="Tech stack">
                <div className="flex flex-wrap gap-1.5">
                  {asStringArray(plan.techStack).length ? (
                    asStringArray(plan.techStack).map((t, i) => (
                      <Badge key={i} variant="secondary">
                        {t}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </Block>
              <Block icon={DollarSign} title="Monetization">
                {plan.monetization || "—"}
              </Block>
            </div>

            {milestones.length ? (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Milestones — check them off as you ship
                </div>
                <ol className="space-y-2">
                  {milestones.map((m, i) => (
                    <li
                      key={i}
                      className="flex gap-3 rounded-md border bg-muted/30 p-3"
                    >
                      <Badge variant="outline" className="h-fit shrink-0">
                        {m.week || `#${i + 1}`}
                      </Badge>
                      <Checkable
                        productId={productId}
                        kind="milestone"
                        index={i}
                        initialDone={doneMilestones.has(i)}
                      >
                        <span className="text-sm font-medium">{m.title}</span>
                        <span className="block text-sm text-muted-foreground">
                          {m.detail}
                        </span>
                      </Checkable>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Block icon={ListChecks} title="First steps (day 1)">
                {firstSteps.length ? (
                  <ul className="space-y-1.5">
                    {firstSteps.map((s, i) => (
                      <li key={i}>
                        <Checkable
                          productId={productId}
                          kind="step"
                          index={i}
                          initialDone={doneSteps.has(i)}
                        >
                          {s}
                        </Checkable>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Block>
              <Block icon={TriangleAlert} title="Risks to watch">
                <Bullets items={asStringArray(plan.risks)} />
              </Block>
            </div>

            <PlanNotes productId={productId} initial={plan.notes ?? ""} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
