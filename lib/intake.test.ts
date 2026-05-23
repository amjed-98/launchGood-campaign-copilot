import { describe, expect, it } from "vitest";
import { appendCampaignToQueue } from "@/lib/local-queue";
import { createCampaignFromIntake, prepareCampaignForTriage } from "@/lib/intake";
import type { TriageResult } from "@/lib/types";

describe("Simulated Campaign Intake", () => {
  const input = {
    title: "Emergency Food Parcels for Families in Gaza",
    creatorName: "Mercy Collective",
    creatorLocation: "Chicago, United States",
    beneficiaryLocation: "Gaza, Palestinian Territories",
    category: "Emergency relief",
    goalAmount: 64000,
    accountAgeDays: 12,
    previousCampaigns: 0,
    sanctionsScreen: "pending" as const,
    description: "Relief campaign with a local team coordinating parcels for displaced families.",
    documentsSubmitted: ["creator_id", "distribution_budget"]
  };

  it("prepares a campaign record with deterministic document gaps before AI triage", () => {
    const campaign = prepareCampaignForTriage(input, {
      id: "local-123",
      submittedAt: "2026-05-23T09:00:00.000Z"
    });

    expect(campaign).toMatchObject({
      id: "local-123",
      status: "New",
      currency: "USD",
      title: input.title,
      riskTier: "MEDIUM",
      recommendedAction: "REQUEST_DOCUMENTS"
    });
    expect(campaign.missingDocuments).toEqual([
      "entity_registration",
      "bank_verification",
      "partner_mou",
      "relationship_attestation",
      "high_goal_budget",
      "sanctions_screening_result"
    ]);
  });

  it("creates the queued campaign from advisory triage and appends it to the local queue", () => {
    const triage: TriageResult = {
      risk_tier: "HIGH",
      confidence: 0.86,
      risk_signals: ["Pending sanctions screening", "Sensitive beneficiary location"],
      positive_signals: ["Distribution budget provided"],
      missing_documents: ["bank_verification", "sanctions_screening_result"],
      recommended_action: "SENIOR_REVIEW",
      reviewer_note: "Hold for senior review before approval."
    };

    const campaign = createCampaignFromIntake(input, triage, {
      id: "local-124",
      submittedAt: "2026-05-23T09:05:00.000Z"
    });
    const queue = appendCampaignToQueue({ records: [] }, campaign);

    expect(queue.records).toHaveLength(1);
    expect(queue.records[0]).toMatchObject({
      id: "local-124",
      status: "New",
      riskTier: "HIGH",
      confidence: 0.86,
      missingDocuments: ["bank_verification", "sanctions_screening_result"],
      recommendedAction: "SENIOR_REVIEW",
      reviewerNote: "Hold for senior review before approval."
    });
  });
});
