import { getCurrentAssessment, getEffectiveRiskTier } from "@/lib/risk";
import type { Campaign, EmailEditBucket, ReviewEvent, ReviewEventType, RiskTier } from "@/lib/types";

export const riskTierOrder: RiskTier[] = ["ESCALATE", "HIGH", "MEDIUM", "LOW"];

const MILLISECONDS_PER_HOUR = 3_600_000;

const reviewerActionEventTypes = new Set<ReviewEventType>([
  "APPROVAL",
  "REJECTION",
  "ESCALATION",
  "SIMULATED_EMAIL_SEND",
  "REVIEWER_OVERRIDE",
  "DOCUMENT_GAP_OVERRIDE"
]);

const finalDecisionEventTypes = new Set<ReviewEventType>(["APPROVAL", "REJECTION"]);

function getReviewEvents(campaigns: Campaign[]): ReviewEvent[] {
  return campaigns.flatMap((campaign) => campaign.reviewEvents ?? []);
}

function byTimestampAscending(a: ReviewEvent, b: ReviewEvent): number {
  return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function toPercent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export type OverrideRateMetric = {
  overriddenCount: number;
  totalCount: number;
  rate: number;
};

function isReviewerOverridden(campaign: Campaign): boolean {
  const current = getCurrentAssessment(campaign);
  return current.riskTier !== campaign.riskTier || current.recommendedAction !== campaign.recommendedAction;
}

export function getOverrideRate(campaigns: Campaign[]): OverrideRateMetric {
  const overriddenCount = campaigns.filter(isReviewerOverridden).length;
  const totalCount = campaigns.length;
  return { overriddenCount, totalCount, rate: toPercent(overriddenCount, totalCount) };
}

export type EmailEditMetric = {
  totalSends: number;
  comparableSends: number;
  editedSends: number;
  editRate: number | null;
  byBucket: Record<EmailEditBucket, number>;
};

export function getEmailEditMetrics(campaigns: Campaign[]): EmailEditMetric {
  const byBucket: Record<EmailEditBucket, number> = {
    unchanged: 0,
    minor: 0,
    moderate: 0,
    major: 0,
    no_ai_draft: 0
  };

  for (const event of getReviewEvents(campaigns)) {
    if (event.type === "SIMULATED_EMAIL_SEND" && event.emailEditBucket) {
      byBucket[event.emailEditBucket] += 1;
    }
  }

  const totalSends = Object.values(byBucket).reduce((sum, count) => sum + count, 0);
  const comparableSends = totalSends - byBucket.no_ai_draft;
  const editedSends = byBucket.minor + byBucket.moderate + byBucket.major;

  return {
    totalSends,
    comparableSends,
    editedSends,
    editRate: comparableSends === 0 ? null : toPercent(editedSends, comparableSends),
    byBucket
  };
}

export type CreatorResponseMetric = {
  responseCount: number;
  completeCount: number;
  incompleteCount: number;
  firstContactResolutionRate: number | null;
  averageResponseHours: number | null;
};

export function getCreatorResponseMetrics(campaigns: Campaign[]): CreatorResponseMetric {
  let completeCount = 0;
  let incompleteCount = 0;
  const responseHours: number[] = [];

  for (const campaign of campaigns) {
    const events = [...(campaign.reviewEvents ?? [])].sort(byTimestampAscending);
    let lastSendAt: number | undefined;

    for (const event of events) {
      if (event.type === "SIMULATED_EMAIL_SEND") {
        lastSendAt = new Date(event.timestamp).getTime();
        continue;
      }
      if (event.type !== "SIMULATED_CREATOR_RESPONSE") continue;

      if (event.creatorResponseOutcome === "complete") completeCount += 1;
      else if (event.creatorResponseOutcome === "incomplete") incompleteCount += 1;

      if (lastSendAt !== undefined) {
        responseHours.push((new Date(event.timestamp).getTime() - lastSendAt) / MILLISECONDS_PER_HOUR);
      }
    }
  }

  const responseCount = completeCount + incompleteCount;

  return {
    responseCount,
    completeCount,
    incompleteCount,
    firstContactResolutionRate: responseCount === 0 ? null : toPercent(completeCount, responseCount),
    averageResponseHours: responseHours.length === 0 ? null : roundToTenth(average(responseHours))
  };
}

export function getReviewerThroughput(campaigns: Campaign[]): number {
  return getReviewEvents(campaigns).filter((event) => reviewerActionEventTypes.has(event.type)).length;
}

export type EscalationMetric = {
  escalatedCount: number;
  totalCount: number;
  rate: number;
  reasons: string[];
};

export function getEscalationMetrics(campaigns: Campaign[]): EscalationMetric {
  const reasons: string[] = [];
  let escalatedCount = 0;

  for (const campaign of campaigns) {
    const escalations = (campaign.reviewEvents ?? []).filter((event) => event.type === "ESCALATION");
    if (escalations.length === 0) continue;
    escalatedCount += 1;
    for (const escalation of escalations) reasons.push(escalation.note);
  }

  const totalCount = campaigns.length;
  return { escalatedCount, totalCount, rate: toPercent(escalatedCount, totalCount), reasons };
}

export type TierApprovalMetric = {
  tier: RiskTier;
  approvedCount: number;
  resolvedCount: number;
  rate: number | null;
};

export function getApprovalRateByTier(campaigns: Campaign[]): TierApprovalMetric[] {
  return riskTierOrder.map((tier) => {
    const decided = campaigns.filter(
      (campaign) =>
        getEffectiveRiskTier(campaign) === tier &&
        (campaign.status === "Approved" || campaign.status === "Rejected")
    );
    const approvedCount = decided.filter((campaign) => campaign.status === "Approved").length;
    const resolvedCount = decided.length;

    return {
      tier,
      approvedCount,
      resolvedCount,
      rate: resolvedCount === 0 ? null : toPercent(approvedCount, resolvedCount)
    };
  });
}

export type DecisionTimeMetric = {
  decidedCount: number;
  averageHours: number | null;
};

export function getDecisionTimeMetrics(campaigns: Campaign[]): DecisionTimeMetric {
  const decisionHours: number[] = [];

  for (const campaign of campaigns) {
    const finalEvent = (campaign.reviewEvents ?? []).find((event) => finalDecisionEventTypes.has(event.type));
    if (!finalEvent) continue;
    const elapsed =
      (new Date(finalEvent.timestamp).getTime() - new Date(campaign.submittedAt).getTime()) / MILLISECONDS_PER_HOUR;
    decisionHours.push(elapsed);
  }

  return {
    decidedCount: decisionHours.length,
    averageHours: decisionHours.length === 0 ? null : roundToTenth(average(decisionHours))
  };
}

export function getQueueDepthByTier(campaigns: Campaign[]) {
  return riskTierOrder.map((tier) => ({
    tier,
    count: campaigns.filter((campaign) => getEffectiveRiskTier(campaign) === tier).length
  }));
}

// Seeded Ops Metric: the prototype does not simulate retrospective fraud/compliance
// outcomes, so false-negative rate is a clearly labeled demo assumption, not measured.
export const SEEDED_FALSE_NEGATIVE_RATE = 2;

export function formatHours(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}
