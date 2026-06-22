import Link from "next/link";
import { Mail, MailCheck } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { DigestItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function asItems(value: unknown): DigestItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is DigestItem =>
      !!v && typeof v === "object" && "productId" in v && "name" in v
  );
}

function DigestList({ label, items }: { label: string; items: DigestItem[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((it) => (
            <li key={it.productId}>
              <Link
                href={`/products/${it.productId}`}
                className="hover:underline"
              >
                {it.name}
              </Link>{" "}
              <span className="text-muted-foreground">
                {typeof it.opportunityScore === "number"
                  ? `· ⚡${it.opportunityScore}`
                  : ""}{" "}
                · clone {it.cloneScore}/10 · diff {it.buildDifficulty}/10
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function DigestsPage() {
  const digests = await prisma.weeklyDigest.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Header
        title="Digest History"
        description="Every weekly digest that's been generated."
      />

      <main className="flex-1 p-6">
        {digests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="rounded-full bg-muted p-3">
                <Mail className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">No digests yet</p>
              <p className="text-sm text-muted-foreground">
                Generate one from the dashboard with “Send Test Digest”, or wait
                for the Monday cron job.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {digests.map((d) => (
              <Card key={d.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{d.title}</CardTitle>
                    {d.emailSentAt ? (
                      <Badge variant="success" className="gap-1">
                        <MailCheck className="h-3 w-3" />
                        Sent {formatDate(d.emailSentAt)}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not emailed</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(d.weekStartDate)} – {formatDate(d.weekEndDate)}
                  </p>
                  <p className="text-sm">{d.summary}</p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <DigestList
                    label="Worth Building"
                    items={asItems(d.topWorthBuilding)}
                  />
                  <DigestList
                    label="Niche Ideas"
                    items={asItems(d.topNicheIdeas)}
                  />
                  <DigestList label="AI Upgrades" items={asItems(d.topAiIdeas)} />
                  <DigestList label="Easy Builds" items={asItems(d.easyBuildIdeas)} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
