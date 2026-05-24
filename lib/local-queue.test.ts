import { describe, expect, it } from "vitest";
import {
  applyReviewerAction,
  createSeededQueue,
  getActiveCampaigns,
  getResolvedCampaigns,
  resetQueue,
  sortByQueuePriority,
  updateCampaignStatus
} from "@/lib/local-queue";
import { getCurrentAssessment, getEffectiveRiskTier } from "@/lib/risk";
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

describe("Unified Local Queue", () => {
  const seeds = [
    campaign({ id: "low-new", riskTier: "LOW", submittedAt: "2026-05-23T08:00:00+03:00" }),
    campaign({ id: "high-newer", riskTier: "HIGH", submittedAt: "2026-05-23T09:00:00+03:00" }),
    campaign({ id: "high-older", riskTier: "HIGH", submittedAt: "2026-05-23T07:00:00+03:00" }),
    campaign({ id: "escalated", riskTier: "ESCALATE", submittedAt: "2026-05-23T10:00:00+03:00" })
  ];

  it("initializes records from seeded campaigns without sharing mutable references", () => {
    const queue = createSeededQueue(seeds);

    expect(queue.records.map((record) => record.id)).toEqual(["low-new", "high-newer", "high-older", "escalated"]);

    queue.records[0].title = "Changed locally";

    expect(seeds[0].title).toBe("Campaign low-new");
  });

  it("orders active review work by queue priority and oldest submission within tier", () => {
    const queue = createSeededQueue(seeds);

    expect(getActiveCampaigns(queue).map((record) => record.id)).toEqual([
      "escalated",
      "high-older",
      "high-newer",
      "low-new"
    ]);
  });

  it("keeps approved and rejected records inspectable but out of the active queue", () => {
    const approved = updateCampaignStatus(seeds[1], "APPROVE");
    const rejected = updateCampaignStatus(seeds[2], "REJECT");
    const queue = createSeededQueue([seeds[0], approved, rejected]);

    expect(getActiveCampaigns(queue).map((record) => record.id)).toEqual(["low-new"]);
    expect(getResolvedCampaigns(queue).map((record) => record.id)).toEqual(["high-older", "high-newer"]);
  });

  it("updates non-final review statuses while keeping work active", () => {
    const waiting = updateCampaignStatus(seeds[0], "REQUEST_DOCS");
    const escalated = updateCampaignStatus(seeds[1], "ESCALATE");

    expect(waiting.status).toBe("Waiting on creator");
    expect(escalated.status).toBe("Escalated");
    expect(getActiveCampaigns(createSeededQueue([waiting, escalated])).map((record) => record.id)).toEqual([
      "high-newer",
      "low-new"
    ]);
  });

  it("resetQueue restores the seeded demo state", () => {
    const changedQueue = createSeededQueue([
      updateCampaignStatus(seeds[0], "APPROVE"),
      campaign({ id: "local-extra", riskTier: "MEDIUM", submittedAt: "2026-05-23T06:00:00+03:00" })
    ]);

    expect(resetQueue(changedQueue, seeds)).toEqual(createSeededQueue(seeds));
  });

  it("exposes the queue priority sorter for UI summaries", () => {
    expect(sortByQueuePriority([seeds[0], seeds[2], seeds[1]]).map((record) => record.id)).toEqual([
      "high-older",
      "high-newer",
      "low-new"
    ]);
  });

  it("records resolved lifecycle actions with required reasons and approval blockers", () => {
    const missingDocs = campaign({
      id: "missing-docs",
      riskTier: "MEDIUM",
      submittedAt: "2026-05-23T06:00:00+03:00",
      missingDocuments: ["bank_verification"]
    });
    const complianceBlocked = campaign({
      id: "compliance-blocked",
      riskTier: "ESCALATE",
      submittedAt: "2026-05-23T05:00:00+03:00",
      missingDocuments: ["compliance_clearance"]
    });

    const queue = createSeededQueue([missingDocs, complianceBlocked]);

    expect(() =>
      applyReviewerAction(queue, "missing-docs", {
        type: "APPROVE",
        timestamp: "2026-05-23T09:00:00+03:00"
      })
    ).toThrow("Approval is blocked by missing required documents.");

    const overridden = applyReviewerAction(queue, "missing-docs", {
      type: "DOCUMENT_GAP_OVERRIDE",
      reason: "Reviewer verified the receiving account in the internal KYC tool.",
      timestamp: "2026-05-23T09:05:00+03:00"
    });
    const approved = applyReviewerAction(overridden, "missing-docs", {
      type: "APPROVE",
      timestamp: "2026-05-23T09:10:00+03:00"
    });

    expect(approved.records.find((record) => record.id === "missing-docs")?.status).toBe("Approved");
    expect(approved.records.find((record) => record.id === "missing-docs")?.reviewEvents?.map((event) => event.type)).toEqual([
      "DOCUMENT_GAP_OVERRIDE",
      "APPROVAL"
    ]);
    expect(getActiveCampaigns(approved).map((record) => record.id)).toEqual(["compliance-blocked"]);

    expect(() =>
      applyReviewerAction(queue, "compliance-blocked", {
        type: "DOCUMENT_GAP_OVERRIDE",
        reason: "Trying to override compliance clearance.",
        timestamp: "2026-05-23T09:15:00+03:00"
      })
    ).toThrow("Compliance clearance cannot be bypassed by document gap override.");

    expect(() =>
      applyReviewerAction(queue, "missing-docs", {
        type: "REJECT",
        timestamp: "2026-05-23T09:20:00+03:00"
      })
    ).toThrow("Resolution reason is required for rejection.");
  });

  it("records non-final lifecycle actions as active history and rejection as resolved history", () => {
    const queue = createSeededQueue([
      campaign({ id: "needs-docs", riskTier: "MEDIUM", submittedAt: "2026-05-23T06:00:00+03:00" }),
      campaign({ id: "needs-senior", riskTier: "HIGH", submittedAt: "2026-05-23T05:00:00+03:00" }),
      campaign({ id: "not-eligible", riskTier: "LOW", submittedAt: "2026-05-23T04:00:00+03:00" })
    ]);

    const waiting = applyReviewerAction(queue, "needs-docs", {
      type: "REQUEST_DOCS",
      draft: "Please upload bank verification.",
      timestamp: "2026-05-23T09:00:00+03:00"
    });
    const escalated = applyReviewerAction(waiting, "needs-senior", {
      type: "ESCALATE",
      reason: "Large goal needs senior reviewer context.",
      timestamp: "2026-05-23T09:05:00+03:00"
    });
    const rejected = applyReviewerAction(escalated, "not-eligible", {
      type: "REJECT",
      reason: "Campaign purpose is outside supported categories.",
      timestamp: "2026-05-23T09:10:00+03:00"
    });

    expect(rejected.records.find((record) => record.id === "needs-docs")?.status).toBe("Waiting on creator");
    expect(rejected.records.find((record) => record.id === "needs-senior")?.status).toBe("Escalated");
    expect(rejected.records.find((record) => record.id === "not-eligible")?.status).toBe("Rejected");
    expect(getActiveCampaigns(rejected).map((record) => record.id)).toEqual(["needs-senior", "needs-docs"]);
    expect(getResolvedCampaigns(rejected).map((record) => record.id)).toEqual(["not-eligible"]);
    expect(rejected.records.find((record) => record.id === "needs-docs")?.reviewEvents?.[0]).toMatchObject({
      type: "SIMULATED_EMAIL_SEND",
      draft: "Please upload bank verification."
    });
  });
});

describe("Simulated Email Send with Email Edit Buckets", () => {
  const needsDocs = campaign({
    id: "needs-docs",
    riskTier: "MEDIUM",
    submittedAt: "2026-05-23T06:00:00+03:00"
  });

  it("records a simulated email send with the final draft and waiting status while staying active", () => {
    const queue = createSeededQueue([needsDocs]);

    const sent = applyReviewerAction(queue, "needs-docs", {
      type: "REQUEST_DOCS",
      aiDraft: "Please upload your bank verification document",
      draft: "Please upload your bank verification document today as soon as possible",
      timestamp: "2026-05-23T09:00:00+03:00"
    });

    const record = sent.records.find((entry) => entry.id === "needs-docs");
    expect(record?.status).toBe("Waiting on creator");
    expect(record?.reviewEvents?.at(-1)).toMatchObject({
      type: "SIMULATED_EMAIL_SEND",
      draft: "Please upload your bank verification document today as soon as possible",
      emailEditBucket: "moderate"
    });
    expect(getActiveCampaigns(sent).map((entry) => entry.id)).toEqual(["needs-docs"]);
  });

  it("classifies an unedited send as an unchanged edit bucket", () => {
    const queue = createSeededQueue([needsDocs]);
    const draft = "Please upload your bank verification document.";

    const sent = applyReviewerAction(queue, "needs-docs", {
      type: "REQUEST_DOCS",
      aiDraft: draft,
      draft,
      timestamp: "2026-05-23T09:00:00+03:00"
    });

    expect(sent.records.find((entry) => entry.id === "needs-docs")?.reviewEvents?.at(-1)?.emailEditBucket).toBe(
      "unchanged"
    );
  });

  it("records a no_ai_draft bucket when no AI baseline is supplied", () => {
    const queue = createSeededQueue([needsDocs]);

    const sent = applyReviewerAction(queue, "needs-docs", {
      type: "REQUEST_DOCS",
      draft: "Reviewer wrote this request manually.",
      timestamp: "2026-05-23T09:00:00+03:00"
    });

    expect(sent.records.find((entry) => entry.id === "needs-docs")?.reviewEvents?.at(-1)?.emailEditBucket).toBe(
      "no_ai_draft"
    );
  });
});

describe("Reviewer Override and Current Review Assessment", () => {
  const aiTriaged = campaign({
    id: "ai-medium",
    riskTier: "MEDIUM",
    submittedAt: "2026-05-23T08:00:00+03:00",
    recommendedAction: "REQUEST_DOCUMENTS"
  });

  it("records a reviewer override as the current review assessment while preserving the original AI triage", () => {
    const queue = createSeededQueue([aiTriaged]);

    const overridden = applyReviewerAction(queue, "ai-medium", {
      type: "REVIEWER_OVERRIDE",
      riskTier: "HIGH",
      reason: "Beneficiary region escalated by latest sanctions guidance.",
      timestamp: "2026-05-23T09:00:00+03:00"
    });

    const record = overridden.records.find((entry) => entry.id === "ai-medium");

    expect(record?.riskTier).toBe("MEDIUM");
    expect(record?.recommendedAction).toBe("REQUEST_DOCUMENTS");
    expect(record?.currentReviewAssessment).toEqual({
      riskTier: "HIGH",
      recommendedAction: "REQUEST_DOCUMENTS"
    });
    expect(getCurrentAssessment(record!)).toEqual({
      riskTier: "HIGH",
      recommendedAction: "REQUEST_DOCUMENTS"
    });
    expect(record?.reviewEvents?.at(-1)).toMatchObject({
      type: "REVIEWER_OVERRIDE",
      note: "Beneficiary region escalated by latest sanctions guidance.",
      assessment: { riskTier: "HIGH", recommendedAction: "REQUEST_DOCUMENTS" }
    });
  });

  it("requires a resolution reason for every reviewer override", () => {
    const queue = createSeededQueue([aiTriaged]);

    expect(() =>
      applyReviewerAction(queue, "ai-medium", {
        type: "REVIEWER_OVERRIDE",
        riskTier: "HIGH",
        timestamp: "2026-05-23T09:00:00+03:00"
      })
    ).toThrow("Resolution reason is required for reviewer override.");
  });

  it("rejects an override that does not change the current review assessment", () => {
    const queue = createSeededQueue([aiTriaged]);

    expect(() =>
      applyReviewerAction(queue, "ai-medium", {
        type: "REVIEWER_OVERRIDE",
        reason: "No actual change requested.",
        timestamp: "2026-05-23T09:00:00+03:00"
      })
    ).toThrow("Reviewer override must change the risk tier or recommended action.");

    expect(() =>
      applyReviewerAction(queue, "ai-medium", {
        type: "REVIEWER_OVERRIDE",
        riskTier: "MEDIUM",
        recommendedAction: "REQUEST_DOCUMENTS",
        reason: "Same values as the AI triage.",
        timestamp: "2026-05-23T09:00:00+03:00"
      })
    ).toThrow("Reviewer override must change the risk tier or recommended action.");
  });

  it("compounds successive overrides from the latest current review assessment", () => {
    const queue = createSeededQueue([aiTriaged]);

    const tierOverride = applyReviewerAction(queue, "ai-medium", {
      type: "REVIEWER_OVERRIDE",
      riskTier: "HIGH",
      reason: "Escalated risk after manual review.",
      timestamp: "2026-05-23T09:00:00+03:00"
    });
    const actionOverride = applyReviewerAction(tierOverride, "ai-medium", {
      type: "REVIEWER_OVERRIDE",
      recommendedAction: "SENIOR_REVIEW",
      reason: "Route to a senior reviewer.",
      timestamp: "2026-05-23T09:10:00+03:00"
    });

    const record = actionOverride.records.find((entry) => entry.id === "ai-medium");

    expect(getCurrentAssessment(record!)).toEqual({
      riskTier: "HIGH",
      recommendedAction: "SENIOR_REVIEW"
    });
    expect(record?.reviewEvents?.filter((event) => event.type === "REVIEWER_OVERRIDE")).toHaveLength(2);
  });

  it("prioritizes the active queue by the current review assessment when an override raises the tier", () => {
    const queue = createSeededQueue([
      campaign({ id: "ai-low", riskTier: "LOW", submittedAt: "2026-05-23T08:00:00+03:00" }),
      campaign({ id: "ai-high", riskTier: "HIGH", submittedAt: "2026-05-23T07:00:00+03:00" })
    ]);

    expect(getActiveCampaigns(queue).map((record) => record.id)).toEqual(["ai-high", "ai-low"]);

    const escalated = applyReviewerAction(queue, "ai-low", {
      type: "REVIEWER_OVERRIDE",
      riskTier: "ESCALATE",
      reason: "Late-breaking sanctions concern raised by analyst.",
      timestamp: "2026-05-23T09:00:00+03:00"
    });

    const ranked = getActiveCampaigns(escalated);
    expect(ranked.map((record) => record.id)).toEqual(["ai-low", "ai-high"]);
    expect(getEffectiveRiskTier(ranked[0])).toBe("ESCALATE");
  });
});
