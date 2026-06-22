import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronUp, ExternalLink, Globe, Clock } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalyzeButton } from "@/components/analyze-button";
import { BuildPlanSection } from "@/components/build-plan-section";
import { StatusControl } from "@/components/status-control";
import { OpportunityBadge } from "@/components/opportunity-badge";
import {
  CloneScoreBadge,
  DifficultyBadge,
  WorthBuildingBadge,
} from "@/components/score-badge";
import { asStringArray } from "@/lib/utils";
import type { ProductFull } from "@/lib/types";

export const dynamic = "force-dynamic";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-relaxed">{children}</CardContent>
    </Card>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length)
    return <p className="text-muted-foreground">None suggested.</p>;
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = (await prisma.product.findUnique({
    where: { id },
    include: { analysis: true, buildPlan: true },
  })) as ProductFull | null;

  if (!product) notFound();

  const a = product.analysis;
  const topics = asStringArray(product.topics);

  return (
    <>
      <Header title={product.name} description={product.tagline}>
        <AnalyzeButton productId={product.id} hasAnalysis={!!a} />
      </Header>

      <main className="flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/dashboard">← Back to dashboard</Link>
          </Button>
          <StatusControl productId={product.id} status={product.status} />
        </div>

        {/* Decision-first hero */}
        {a ? (
          <Card className="bg-muted/30">
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <OpportunityBadge score={a.opportunityScore} />
                <WorthBuildingBadge worth={a.worthBuilding} />
                <CloneScoreBadge score={a.cloneScore} />
                <DifficultyBadge score={a.buildDifficulty} />
                <Badge variant="secondary">Demand {a.demandSignal}/10</Badge>
                <Badge variant="secondary">
                  Monetization {a.monetizationPotential}/10
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  MVP: {a.mvpTime}
                </Badge>
              </div>
              {a.founderTake ? (
                <blockquote className="border-l-2 border-primary pl-4 text-base italic leading-relaxed">
                  {a.founderTake}
                </blockquote>
              ) : null}
              {a.recommendation ? (
                <p className="text-sm">
                  <span className="font-semibold">Recommendation: </span>
                  {a.recommendation}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Product info */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <ChevronUp className="h-3 w-3" />
                {product.upvotes} upvotes
              </Badge>
              {topics.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))}
            </div>

            {product.description ? (
              <p className="text-sm leading-relaxed text-foreground/90">
                {product.description}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {product.websiteUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={product.websiteUrl} target="_blank" rel="noreferrer">
                    <Globe className="h-4 w-4" />
                    Website
                  </a>
                </Button>
              ) : null}
              <Button asChild variant="outline" size="sm">
                <a href={product.productHuntUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Product Hunt
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Build plan — the action step */}
        {a ? (
          <BuildPlanSection productId={product.id} plan={product.buildPlan} />
        ) : null}

        {/* Full analysis */}
        {!a ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              This product hasn&apos;t been analyzed yet. Click{" "}
              <span className="font-medium">Analyze</span> above to generate the
              founder breakdown.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Full analysis
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Section title="1. Summary">{a.summary || "—"}</Section>
              <Section title="2. Why Interesting">
                {a.whyInteresting || "—"}
              </Section>
              <Section title="3. Weaknesses">
                <BulletList items={asStringArray(a.weaknesses)} />
              </Section>
              <Section title="4. Clone Score">
                <span className="text-2xl font-bold">{a.cloneScore}</span>
                <span className="text-muted-foreground"> / 10</span>
              </Section>
              <Section title="5. Build Difficulty">
                <span className="text-2xl font-bold">{a.buildDifficulty}</span>
                <span className="text-muted-foreground"> / 10</span>
              </Section>
              <Section title="6. MVP Time">{a.mvpTime || "—"}</Section>
              <Section title="7. Better Versions">
                <BulletList items={asStringArray(a.betterVersions)} />
              </Section>
              <Section title="8. Niche Versions">
                <BulletList items={asStringArray(a.nicheVersions)} />
              </Section>
              <Section title="9. Germany Version">
                {a.germanyVersion || "—"}
              </Section>
              <Section title="10. AI Version">{a.aiVersion || "—"}</Section>
              <Section title="11. Founder Take">
                <span className="italic">{a.founderTake || "—"}</span>
              </Section>
              <Section title="12. Recommendation">
                {a.recommendation || "—"}
              </Section>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
