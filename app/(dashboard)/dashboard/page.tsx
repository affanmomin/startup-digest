import { prisma } from "@/lib/prisma";
import { Header } from "@/components/header";
import { StatsCards } from "@/components/stats-cards";
import { DashboardActions } from "@/components/dashboard-actions";
import { ProductTable, type ProductRow } from "@/components/product-table";
import { asStringArray } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalProducts, totalAnalyses, worthBuildingCount, lastDigest, products] =
    await Promise.all([
      prisma.product.count(),
      prisma.productAnalysis.count(),
      prisma.productAnalysis.count({ where: { worthBuilding: true } }),
      prisma.weeklyDigest.findFirst({
        where: { emailSentAt: { not: null } },
        orderBy: { emailSentAt: "desc" },
        select: { emailSentAt: true },
      }),
      prisma.product.findMany({
        include: { analysis: true },
        orderBy: { launchDate: "desc" },
      }),
    ]);

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    upvotes: p.upvotes,
    opportunityScore: p.analysis?.opportunityScore ?? null,
    cloneScore: p.analysis?.cloneScore ?? null,
    buildDifficulty: p.analysis?.buildDifficulty ?? null,
    mvpTime: p.analysis?.mvpTime ?? null,
    worthBuilding: p.analysis?.worthBuilding ?? null,
    status: p.status,
    topics: asStringArray(p.topics),
    analyzed: !!p.analysis,
  }));

  return (
    <>
      <Header
        title="Dashboard"
        description="Sync launches, run analyses, and send your weekly digest."
      >
        <DashboardActions />
      </Header>

      <main className="flex-1 space-y-6 p-6">
        <StatsCards
          totalProducts={totalProducts}
          totalAnalyses={totalAnalyses}
          worthBuildingCount={worthBuildingCount}
          lastDigestSentAt={lastDigest?.emailSentAt ?? null}
        />

        <ProductTable products={rows} />
      </main>
    </>
  );
}
