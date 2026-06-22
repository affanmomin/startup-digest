-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "productHuntId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT,
    "websiteUrl" TEXT,
    "productHuntUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "topics" JSONB NOT NULL DEFAULT '[]',
    "launchDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAnalysis" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "whyInteresting" TEXT NOT NULL,
    "weaknesses" JSONB NOT NULL DEFAULT '[]',
    "cloneScore" INTEGER NOT NULL,
    "buildDifficulty" INTEGER NOT NULL,
    "mvpTime" TEXT NOT NULL,
    "betterVersions" JSONB NOT NULL DEFAULT '[]',
    "nicheVersions" JSONB NOT NULL DEFAULT '[]',
    "germanyVersion" TEXT NOT NULL,
    "aiVersion" TEXT NOT NULL,
    "founderTake" TEXT NOT NULL,
    "worthBuilding" BOOLEAN NOT NULL,
    "recommendation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyDigest" (
    "id" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "topWorthBuilding" JSONB NOT NULL DEFAULT '[]',
    "topNicheIdeas" JSONB NOT NULL DEFAULT '[]',
    "topAiIdeas" JSONB NOT NULL DEFAULT '[]',
    "easyBuildIdeas" JSONB NOT NULL DEFAULT '[]',
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyDigest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_productHuntId_key" ON "Product"("productHuntId");

-- CreateIndex
CREATE INDEX "Product_launchDate_idx" ON "Product"("launchDate");

-- CreateIndex
CREATE INDEX "Product_upvotes_idx" ON "Product"("upvotes");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAnalysis_productId_key" ON "ProductAnalysis"("productId");

-- CreateIndex
CREATE INDEX "ProductAnalysis_worthBuilding_idx" ON "ProductAnalysis"("worthBuilding");

-- CreateIndex
CREATE INDEX "ProductAnalysis_cloneScore_idx" ON "ProductAnalysis"("cloneScore");

-- CreateIndex
CREATE INDEX "WeeklyDigest_createdAt_idx" ON "WeeklyDigest"("createdAt");

-- AddForeignKey
ALTER TABLE "ProductAnalysis" ADD CONSTRAINT "ProductAnalysis_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
