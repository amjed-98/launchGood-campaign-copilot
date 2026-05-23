import { hoursSinceSubmitted } from "@/lib/risk";
import type { Campaign, RiskTier } from "@/lib/types";

export const riskTierOrder: RiskTier[] = ["ESCALATE", "HIGH", "MEDIUM", "LOW"];

export function getQueueDepthByTier(campaigns: Campaign[]) {
  return riskTierOrder.map((tier) => ({
    tier,
    count: campaigns.filter((campaign) => campaign.riskTier === tier).length
  }));
}

export function getAverageTimeToDecisionHours(campaigns: Campaign[]) {
  const mockedResolvedHours = campaigns.map((campaign) => {
    const queueAge = hoursSinceSubmitted(campaign.submittedAt);
    if (campaign.riskTier === "ESCALATE") return Math.max(3.8, queueAge * 0.72);
    if (campaign.riskTier === "HIGH") return Math.max(2.9, queueAge * 0.58);
    if (campaign.riskTier === "MEDIUM") return Math.max(1.7, queueAge * 0.42);
    return Math.max(0.8, queueAge * 0.25);
  });

  return mockedResolvedHours.reduce((sum, hours) => sum + hours, 0) / mockedResolvedHours.length;
}

export function getAiOverrideRate(campaigns: Campaign[]) {
  const highTouchCount = campaigns.filter((campaign) =>
    campaign.status === "Escalated" || campaign.sanctionsScreen !== "pass" || campaign.missingDocuments.length >= 3
  ).length;

  return Math.round((highTouchCount / campaigns.length) * 100);
}

export function getRamadanSurge(campaigns: Campaign[]) {
  const baselineDailySubmissions = 12;
  const currentDailyRunRate = campaigns.length * 1.8;
  const surgePercent = Math.round(((currentDailyRunRate - baselineDailySubmissions) / baselineDailySubmissions) * 100);
  const elevatedRiskCount = campaigns.filter((campaign) => campaign.riskTier !== "LOW").length;

  return {
    baselineDailySubmissions,
    currentDailyRunRate,
    surgePercent,
    elevatedRiskCount,
    status: surgePercent >= 100 ? "Surge active" : "Monitoring"
  };
}

export function formatHours(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}
