import type {
  Product,
  ProductAnalysis,
  WeeklyDigest,
  BuildPlan,
  FounderProfile,
} from "@prisma/client";

export type { Product, ProductAnalysis, WeeklyDigest, BuildPlan, FounderProfile };

export type ProductWithAnalysis = Product & {
  analysis: ProductAnalysis | null;
};

export type ProductFull = Product & {
  analysis: ProductAnalysis | null;
  buildPlan: BuildPlan | null;
};

export type ProductStatus = "NEW" | "SAVED" | "BUILDING" | "PASSED";

export const PRODUCT_STATUSES: ProductStatus[] = [
  "NEW",
  "SAVED",
  "BUILDING",
  "PASSED",
];

/** Shape returned by the OpenRouter build-plan prompt. */
export interface BuildPlanResult {
  overview: string;
  targetNiche: string;
  differentiation: string[];
  coreFeatures: string[];
  techStack: string[];
  milestones: { week: string; title: string; detail: string }[];
  firstSteps: string[];
  risks: string[];
  monetization: string;
  estimatedTimeline: string;
}

/** Shape returned by the OpenRouter analysis prompt. */
export interface AnalysisResult {
  summary: string;
  whyInteresting: string;
  weaknesses: string[];
  cloneScore: number;
  buildDifficulty: number;
  demandSignal: number;
  monetizationPotential: number;
  mvpTime: string;
  betterVersions: string[];
  nicheVersions: string[];
  germanyVersion: string;
  aiVersion: string;
  founderTake: string;
  worthBuilding: boolean;
  recommendation: string;
}

/** Normalized Product Hunt post ready to persist. */
export interface NormalizedProduct {
  productHuntId: string;
  name: string;
  tagline: string;
  description: string | null;
  websiteUrl: string | null;
  productHuntUrl: string;
  thumbnailUrl: string | null;
  upvotes: number;
  topics: string[];
  launchDate: Date;
}

/** A compact product reference embedded in a digest's JSON columns. */
export interface DigestItem {
  productId: string;
  name: string;
  tagline: string;
  cloneScore: number;
  buildDifficulty: number;
  opportunityScore: number;
  mvpTime: string;
  founderTake: string;
  detailUrl: string;
}
