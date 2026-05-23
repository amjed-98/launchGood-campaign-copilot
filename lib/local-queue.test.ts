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
      type: "DOCUMENT_REQUEST",
      draft: "Please upload bank verification."
    });
  });
});
