import Link from "next/link";
import { ArrowUpRight, Hammer, Sparkles } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { asNumberArray } from "@/lib/utils";
import type { ProductFull, ProductWithAnalysis } from "@/lib/types";

export const dynamic = "force-dynamic";

function planProgress(plan: ProductFull["buildPlan"]): {
  done: number;
  total: number;
  pct: number;
} {
  if (!plan) return { done: 0, total: 0, pct: 0 };
  const milestones = Array.isArray(plan.milestones) ? plan.milestones.length : 0;
  const steps = Array.isArray(plan.firstSteps) ? plan.firstSteps.length : 0;
  const total = milestones + steps;
  const done =
    asNumberArray(plan.completedMilestones).filter((i) => i < milestones).length +
    asNumberArray(plan.completedFirstSteps).filter((i) => i < steps).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export default async function HomePage() {
  const [building, products] = await Promise.all([
    prisma.product.findMany({
      where: { status: "BUILDING" },
      include: { analysis: true, buildPlan: true, artifacts: true },
      orderBy: { updatedAt: "desc" },
    }) as Promise<ProductFull[]>,
    // Discover: analyzed, not passed, ranked by opportunity (don't hide borderline).
    prisma.product.findMany({
      where: { analysis: { isNot: null }, status: { not: "PASSED" } },
      include: { analysis: true },
      orderBy: [{ analysis: { opportunityScore: "desc" } }],
      take: 12,
    }) as Promise<ProductWithAnalysis[]>,
  ]);

  return (
    <>
      <Header
        title="Discover"
        description="Product Hunt launches ranked by opportunity — the best ideas to build a sharper version of."
      />

      <main className="flex-1 space-y-8 p-6">
        {/* Active builds — the reason to come back between weekly syncs */}
        {building.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Hammer className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Currently building
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {building.map((p) => {
                const prog = planProgress(p.buildPlan);
                return (
                  <Card key={p.id} className="border-primary/40 bg-primary/[0.03]">
                    <CardContent className="space-y-3 pt-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/products/${p.id}`}
                            className="font-semibold hover:underline"
                          >
                            {p.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {p.tagline}
                          </p>
                        </div>
                        <Badge variant="success" className="gap-1">
                          <Hammer className="h-3 w-3" />
                          Building
                        </Badge>
                      </div>

                      {p.buildPlan ? (
                        <>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${prog.pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {prog.total
                              ? `${prog.done}/${prog.total} steps done · ${prog.pct}%`
                              : "Build plan ready"}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No build plan yet — open it to generate one.
                        </p>
                      )}

                      <Button asChild variant="outline" size="sm">
                        <Link href={`/products/${p.id}`}>
                          Open build plan
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Discover grid */}
        {products.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="rounded-full bg-muted p-3">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Nothing to show yet</p>
                <p className="text-sm text-muted-foreground">
                  Head to the dashboard, sync Product Hunt, then analyze the
                  launches to populate this page.
                </p>
              </div>
              <Button asChild>
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <section className="space-y-3">
            {building.length > 0 ? (
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Top opportunities
              </h2>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
