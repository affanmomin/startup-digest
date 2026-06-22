-- AlterTable
ALTER TABLE "BuildPlan" ADD COLUMN     "completedFirstSteps" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "completedMilestones" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ProductAnalysis" ADD COLUMN     "demandSignal" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "monetizationPotential" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "FounderProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "skills" JSONB NOT NULL DEFAULT '[]',
    "preferredStack" JSONB NOT NULL DEFAULT '[]',
    "interests" JSONB NOT NULL DEFAULT '[]',
    "antiInterests" JSONB NOT NULL DEFAULT '[]',
    "weeklyHours" INTEGER NOT NULL DEFAULT 10,
    "currentFocus" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FounderProfile_pkey" PRIMARY KEY ("id")
);
