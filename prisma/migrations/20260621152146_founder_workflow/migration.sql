-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "ProductAnalysis" ADD COLUMN     "opportunityScore" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BuildPlan" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "targetNiche" TEXT NOT NULL,
    "differentiation" JSONB NOT NULL DEFAULT '[]',
    "coreFeatures" JSONB NOT NULL DEFAULT '[]',
    "techStack" JSONB NOT NULL DEFAULT '[]',
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "firstSteps" JSONB NOT NULL DEFAULT '[]',
    "risks" JSONB NOT NULL DEFAULT '[]',
    "monetization" TEXT NOT NULL,
    "estimatedTimeline" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuildPlan_productId_key" ON "BuildPlan"("productId");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "ProductAnalysis_opportunityScore_idx" ON "ProductAnalysis"("opportunityScore");

-- AddForeignKey
ALTER TABLE "BuildPlan" ADD CONSTRAINT "BuildPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
