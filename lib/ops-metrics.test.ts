import { describe, expect, it } from "vitest";
import { applyReviewerAction, createSeededQueue } from "@/lib/local-queue";
import {
  getApprovalRateByTier,
  getCreatorResponseMetrics,
  getDecisionTimeMetrics,
  getEmailEditMetrics,
  getEscalationMetrics,
  getOverrideRate,
  getReviewerThroughput
} from "@/lib/ops-metrics";
import type { RiskTier } from "@/lib/types";

function tierMetric(metrics: ReturnType<typeof getApprovalRateByTier>, tier: RiskTier) {
  const match = metrics.find((entry) => entry.tier === tier);
  if (!match) throw new Error(`Missing tier ${tier}`);
  return match;
}
import type { Campaign } from "@/lib/types";

function campaign(overrides: Partial<Campaign> & Pick<Campaign, "id" | "riskTier" | "submittedAt">): Campaign {
  return {
    title: `Campaign ${overrides.id}`,
    creatorName: "Creator",
    creatorLocation: "United States",
    beneficiaryLocation: "United States",
    category: "Food aid",
    goalAmount: 1000,
    currency: "USD",
    slaHours: 24,
    confidence: 0.8,
    status: "New",
    accountAgeDays: 30,
    previousCampaigns: 0,
    sanctionsScreen: "pass",
    description: "A local campaign.",
    documentsSubmitted: [],
    missingDocuments: [],
    riskSignals: [],
    positiveSignals: [],
    recommendedAction: "APPROVE_REVIEW",
    reviewerNote: "Ready for review.",
    ...overrides
  };
}

describe("getOverrideRate", () => {
  it("counts campaigns whose current assessment differs from AI triage", () => {
    // #given a queue where one of two campaigns has a reviewer override
    const seeds = [
      campaign({ id: "a", riskTier: "LOW", submittedAt: "2026-05-23T08:00:00+03:00" }),
      campaign({ id: "b", riskTier: "MEDIUM", submittedAt: "2026-05-23T09:00:00+03:00" })
    ];
    const queue = applyReviewerAction(createSeededQueue(seeds), "a", {
      type: "REVIEWER_OVERRIDE",
      riskTier: "HIGH",
      reason: "Inconsistent description warrants senior review."
    });

    // #when override rate is computed from local records
    const metric = getOverrideRate(queue.records);

    // #then it reflects the single overridden campaign out of two
    expect(metric.overriddenCount).toBe(1);
    expect(metric.totalCount).toBe(2);
    expect(metric.rate).toBe(50);
  });
});

describe("getEmailEditMetrics", () => {
  it("classifies simulated email sends by edit bucket and rates only comparable sends", () => {
    // #given three simulated email sends: one unchanged, one major rewrite, one with no AI draft
    const seeds = [
      campaign({ id: "unchanged", riskTier: "MEDIUM", submittedAt: "2026-05-23T08:00:00+03:00" }),
      campaign({ id: "rewritten", riskTier: "MEDIUM", submittedAt: "2026-05-23T08:30:00+03:00" }),
      campaign({ id: "manual", riskTier: "MEDIUM", submittedAt: "2026-05-23T09:00:00+03:00" })
    ];
    let queue = createSeededQueue(seeds);
    queue = applyReviewerAction(queue, "unchanged", {
      type: "REQUEST_DOCS",
      aiDraft: "please send your documents",
      draft: "please send your documents"
    });
    queue = applyReviewerAction(queue, "rewritten", {
      type: "REQUEST_DOCS",
      aiDraft: "please send your documents",
      draft: "totally different rewritten message entirely now thanks"
    });
    queue = applyReviewerAction(queue, "manual", {
      type: "REQUEST_DOCS",
      draft: "a fully hand-written note"
    });

    // #when email edit metrics are computed
    const metric = getEmailEditMetrics(queue.records);

    // #then no-AI-draft sends are excluded from the edit rate denominator
    expect(metric.totalSends).toBe(3);
    expect(metric.byBucket.unchanged).toBe(1);
    expect(metric.byBucket.major).toBe(1);
    expect(metric.byBucket.no_ai_draft).toBe(1);
    expect(metric.comparableSends).toBe(2);
    expect(metric.editedSends).toBe(1);
    expect(metric.editRate).toBe(50);
  });

  it("reports a null edit rate when there are no comparable sends", () => {
    // #given no simulated email sends have occurred
    const seeds = [campaign({ id: "fresh", riskTier: "LOW", submittedAt: "2026-05-23T08:00:00+03:00" })];

    // #when email edit metrics are computed
    const metric = getEmailEditMetrics(createSeededQueue(seeds).records);

    // #then the rate is null rather than a misleading zero
    expect(metric.totalSends).toBe(0);
    expect(metric.editRate).toBeNull();
  });
});

describe("getCreatorResponseMetrics", () => {
  it("pairs each creator response with its preceding send to measure response time and resolution", () => {
    // #given one complete response after 2h and one incomplete response after 4h
    const seeds = [
      campaign({ id: "complete", riskTier: "MEDIUM", submittedAt: "2026-05-23T07:00:00Z" }),
      campaign({ id: "incomplete", riskTier: "MEDIUM", submittedAt: "2026-05-23T07:00:00Z" })
    ];
    let queue = createSeededQueue(seeds);
    queue = applyReviewerAction(queue, "complete", {
      type: "REQUEST_DOCS",
      draft: "documents please",
      timestamp: "2026-05-23T08:00:00Z"
    });
    queue = applyReviewerAction(queue, "complete", {
      type: "CREATOR_RESPONSE",
      outcome: "complete",
      timestamp: "2026-05-23T10:00:00Z"
    });
    queue = applyReviewerAction(queue, "incomplete", {
      type: "REQUEST_DOCS",
      draft: "documents please",
      timestamp: "2026-05-23T08:00:00Z"
    });
    queue = applyReviewerAction(queue, "incomplete", {
      type: "CREATOR_RESPONSE",
      outcome: "incomplete",
      timestamp: "2026-05-23T12:00:00Z"
    });

    // #when creator response metrics are computed
    const metric = getCreatorResponseMetrics(queue.records);

    // #then response time averages the paired send/response gaps and resolution counts completes
    expect(metric.responseCount).toBe(2);
    expect(metric.completeCount).toBe(1);
    expect(metric.incompleteCount).toBe(1);
    expect(metric.firstContactResolutionRate).toBe(50);
    expect(metric.averageResponseHours).toBe(3);
  });

  it("reports null timing and resolution when no creator responses exist", () => {
    // #given a send with no creator response yet
    const seeds = [campaign({ id: "waiting", riskTier: "MEDIUM", submittedAt: "2026-05-23T07:00:00Z" })];
    const queue = applyReviewerAction(createSeededQueue(seeds), "waiting", {
      type: "REQUEST_DOCS",
      draft: "documents please",
      timestamp: "2026-05-23T08:00:00Z"
    });

    // #when creator response metrics are computed
    const metric = getCreatorResponseMetrics(queue.records);

    // #then nothing is fabricated
    expect(metric.responseCount).toBe(0);
    expect(metric.averageResponseHours).toBeNull();
    expect(metric.firstContactResolutionRate).toBeNull();
  });
});

describe("getReviewerThroughput", () => {
  it("counts reviewer-initiated actions and excludes simulated creator responses", () => {
    // #given a mix of reviewer actions plus one simulated creator response
    const seeds = [
      campaign({ id: "approve", riskTier: "LOW", submittedAt: "2026-05-23T07:00:00Z" }),
      campaign({ id: "reject", riskTier: "HIGH", submittedAt: "2026-05-23T07:00:00Z" }),
      campaign({ id: "escalate", riskTier: "ESCALATE", submittedAt: "2026-05-23T07:00:00Z" }),
      campaign({ id: "request", riskTier: "MEDIUM", submittedAt: "2026-05-23T07:00:00Z" }),
      campaign({ id: "override", riskTier: "MEDIUM", submittedAt: "2026-05-23T07:00:00Z" })
    ];
    let queue = createSeededQueue(seeds);
    queue = applyReviewerAction(queue, "approve", { type: "APPROVE" });
    queue = applyReviewerAction(queue, "reject", { type: "REJECT", reason: "Not approvable." });
    queue = applyReviewerAction(queue, "escalate", { type: "ESCALATE", reason: "Needs compliance." });
    queue = applyReviewerAction(queue, "request", { type: "REQUEST_DOCS", draft: "documents please" });
    queue = applyReviewerAction(queue, "request", { type: "CREATOR_RESPONSE", outcome: "complete" });
    queue = applyReviewerAction(queue, "override", {
      type: "REVIEWER_OVERRIDE",
      riskTier: "HIGH",
      reason: "Senior review warranted."
    });

    // #when reviewer throughput is computed
    const throughput = getReviewerThroughput(queue.records);

    // #then the simulated creator response is not counted as reviewer work
    expect(throughput).toBe(5);
  });
});

describe("getEscalationMetrics", () => {
  it("rates escalated campaigns against all campaigns and collects their reasons", () => {
    // #given two of three campaigns escalated with reasons
    const seeds = [
      campaign({ id: "first", riskTier: "HIGH", submittedAt: "2026-05-23T07:00:00Z" }),
      campaign({ id: "second", riskTier: "ESCALATE", submittedAt: "2026-05-23T07:00:00Z" }),
      campaign({ id: "third", riskTier: "LOW", submittedAt: "2026-05-23T07:00:00Z" })
    ];
    let queue = createSeededQueue(seeds);
    queue = applyReviewerAction(queue, "first", { type: "ESCALATE", reason: "Goal inconsistent with description." });
    queue = applyReviewerAction(queue, "second", { type: "ESCALATE", reason: "Sanctions name match." });

    // #when escalation metrics are computed
    const metric = getEscalationMetrics(queue.records);

    // #then rate and reasons reflect the local escalation events
    expect(metric.escalatedCount).toBe(2);
    expect(metric.totalCount).toBe(3);
    expect(metric.rate).toBe(67);
    expect(metric.reasons).toEqual([
      "Goal inconsistent with description.",
      "Sanctions name match."
    ]);
  });
});

describe("getApprovalRateByTier", () => {
  it("rates approvals against resolved decisions within each tier", () => {
    // #given LOW approved, one HIGH approved and one HIGH rejected, MEDIUM left unresolved
    const seeds = [
      campaign({ id: "low", riskTier: "LOW", submittedAt: "2026-05-23T07:00:00Z" }),
      campaign({ id: "high-yes", riskTier: "HIGH", submittedAt: "2026-05-23T07:00:00Z" }),
      campaign({ id: "high-no", riskTier: "HIGH", submittedAt: "2026-05-23T07:00:00Z" }),
      campaign({ id: "medium", riskTier: "MEDIUM", submittedAt: "2026-05-23T07:00:00Z" })
    ];
    let queue = createSeededQueue(seeds);
    queue = applyReviewerAction(queue, "low", { type: "APPROVE" });
    queue = applyReviewerAction(queue, "high-yes", { type: "APPROVE" });
    queue = applyReviewerAction(queue, "high-no", { type: "REJECT", reason: "Not approvable." });

    // #when approval rate by tier is computed
    const metrics = getApprovalRateByTier(queue.records);

    // #then resolved decisions drive the rate and unresolved tiers report null
    expect(tierMetric(metrics, "LOW")).toMatchObject({ approvedCount: 1, resolvedCount: 1, rate: 100 });
    expect(tierMetric(metrics, "HIGH")).toMatchObject({ approvedCount: 1, resolvedCount: 2, rate: 50 });
    expect(tierMetric(metrics, "MEDIUM")).toMatchObject({ resolvedCount: 0, rate: null });
    expect(tierMetric(metrics, "ESCALATE")).toMatchObject({ resolvedCount: 0, rate: null });
  });

  it("groups a decision under the effective tier after a reviewer override", () => {
    // #given a HIGH campaign overridden down to LOW and then approved
    const seeds = [campaign({ id: "overridden", riskTier: "HIGH", submittedAt: "2026-05-23T07:00:00Z" })];
    let queue = createSeededQueue(seeds);
    queue = applyReviewerAction(queue, "overridden", {
      type: "REVIEWER_OVERRIDE",
      riskTier: "LOW",
      reason: "Verified legitimate; original tier too high."
    });
    queue = applyReviewerAction(queue, "overridden", { type: "APPROVE" });

    // #when approval rate by tier is computed
    const metrics = getApprovalRateByTier(queue.records);

    // #then the approval is attributed to the effective tier, not the original AI tier
    expect(tierMetric(metrics, "LOW")).toMatchObject({ approvedCount: 1, resolvedCount: 1 });
    expect(tierMetric(metrics, "HIGH")).toMatchObject({ resolvedCount: 0 });
  });
});

describe("getDecisionTimeMetrics", () => {
  it("averages time from submission to the final decision event", () => {
    // #given one campaign approved after 2h and one rejected after 4h
    const seeds = [
      campaign({ id: "approved", riskTier: "LOW", submittedAt: "2026-05-23T06:00:00Z" }),
      campaign({ id: "rejected", riskTier: "HIGH", submittedAt: "2026-05-23T06:00:00Z" })
    ];
    let queue = createSeededQueue(seeds);
    queue = applyReviewerAction(queue, "approved", { type: "APPROVE", timestamp: "2026-05-23T08:00:00Z" });
    queue = applyReviewerAction(queue, "rejected", {
      type: "REJECT",
      reason: "Not approvable.",
      timestamp: "2026-05-23T10:00:00Z"
    });

    // #when decision time metrics are computed
    const metric = getDecisionTimeMetrics(queue.records);

    // #then only resolved campaigns contribute and the average is real
    expect(metric.decidedCount).toBe(2);
    expect(metric.averageHours).toBe(3);
  });

  it("reports null when no campaigns have a final decision", () => {
    // #given an escalated (non-final) campaign only
    const seeds = [campaign({ id: "open", riskTier: "ESCALATE", submittedAt: "2026-05-23T06:00:00Z" })];
    const queue = applyReviewerAction(createSeededQueue(seeds), "open", {
      type: "ESCALATE",
      reason: "Needs compliance."
    });

    // #when decision time metrics are computed
    const metric = getDecisionTimeMetrics(queue.records);

    // #then no decision time is fabricated
    expect(metric.decidedCount).toBe(0);
    expect(metric.averageHours).toBeNull();
  });
});
