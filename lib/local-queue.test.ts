import { describe, expect, it } from "vitest";
import {
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
});
