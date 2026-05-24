import type { Campaign, ReviewAssessment, RiskTier } from "@/lib/types";

export const riskWeight: Record<RiskTier, number> = {
  ESCALATE: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export function getCurrentAssessment(campaign: Campaign): ReviewAssessment {
  return (
    campaign.currentReviewAssessment ?? {
      riskTier: campaign.riskTier,
      recommendedAction: campaign.recommendedAction
    }
  );
}

export function getEffectiveRiskTier(campaign: Campaign): RiskTier {
  return getCurrentAssessment(campaign).riskTier;
}

export function hasReviewerOverride(campaign: Campaign): boolean {
  return campaign.currentReviewAssessment !== undefined;
}

export const riskLabelClasses: Record<RiskTier, string> = {
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-800",
  HIGH: "border-rose-200 bg-rose-50 text-rose-700",
  ESCALATE: "border-zinc-800 bg-zinc-950 text-white"
};

export function sortByRisk(campaigns: Campaign[]) {
  return [...campaigns].sort((a, b) => {
    const byRisk = riskWeight[getEffectiveRiskTier(b)] - riskWeight[getEffectiveRiskTier(a)];
    if (byRisk !== 0) return byRisk;
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

export function hoursSinceSubmitted(submittedAt: string) {
  return Math.max(
    0,
    Math.round((Date.now() - new Date(submittedAt).getTime()) / 36_000) / 10
  );
}
