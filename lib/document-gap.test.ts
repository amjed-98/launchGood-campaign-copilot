import { describe, expect, it } from "vitest";
import type { Campaign } from "@/lib/types";
import {
  checkDocumentGaps,
  isComplianceClearanceMissing,
  isSensitiveBeneficiaryLocation
} from "@/lib/document-gap";

function campaign(overrides: Partial<Campaign>): Campaign {
  return {
    id: "test-campaign",
    title: "Test Campaign",
    creatorName: "Test Creator",
    creatorLocation: "London, United Kingdom",
    beneficiaryLocation: "London, United Kingdom",
    category: "Mosque renovation",
    goalAmount: 10_000,
    currency: "USD",
    submittedAt: "2026-05-23T04:10:00+03:00",
    slaHours: 24,
    riskTier: "LOW",
    confidence: 0.9,
    status: "New",
    accountAgeDays: 365,
    previousCampaigns: 2,
    sanctionsScreen: "pass",
    description: "A routine local campaign.",
    documentsSubmitted: [],
    missingDocuments: [],
    riskSignals: [],
    positiveSignals: [],
    recommendedAction: "APPROVE_REVIEW",
    reviewerNote: "Seed note",
    ...overrides
  };
}

describe("Document Gap Check", () => {
  it("requires mosque renovation project documents while keeping optional guidance non-blocking", () => {
    const result = checkDocumentGaps(
      campaign({
        category: "Mosque renovation",
        documentsSubmitted: ["bank_verification", "quote_invoice"]
      })
    );

    expect(result.requiredDocuments).toEqual(
      expect.arrayContaining(["bank_verification", "quote_invoice", "trustee_id"])
    );
    expect(result.optionalDocuments).toEqual(expect.arrayContaining(["board_authorization"]));
    expect(result.missingRequiredDocuments).toEqual(["trustee_id"]);
    expect(result.ruleExplanations).toContain("Mosque renovation campaigns require receiving account and project proof.");
  });

  it("adds enhanced due diligence for sensitive beneficiary locations", () => {
    const result = checkDocumentGaps(
      campaign({
        category: "Medical emergency",
        beneficiaryLocation: "Sana'a, Yemen",
        documentsSubmitted: ["creator_id", "medical_letter", "beneficiary_id", "bank_verification"]
      })
    );

    expect(isSensitiveBeneficiaryLocation("Gaza, Palestinian Territories")).toBe(true);
    expect(result.requiredDocuments).toEqual(expect.arrayContaining(["relationship_attestation"]));
    expect(result.missingRequiredDocuments).toEqual(["relationship_attestation"]);
    expect(result.riskSignals).toContain("Sensitive beneficiary location requires enhanced due diligence");
  });

  it("treats sanctions statuses as deterministic compliance blockers", () => {
    const nameMatch = checkDocumentGaps(
      campaign({
        sanctionsScreen: "name_match",
        documentsSubmitted: ["bank_verification", "quote_invoice", "trustee_id"]
      })
    );
    const confirmedHit = checkDocumentGaps(
      campaign({
        sanctionsScreen: "confirmed_hit",
        documentsSubmitted: ["bank_verification", "quote_invoice", "trustee_id"]
      })
    );

    expect(nameMatch.missingRequiredDocuments).toEqual(["name_match_attestation"]);
    expect(confirmedHit.missingRequiredDocuments).toEqual(["compliance_clearance"]);
    expect(isComplianceClearanceMissing(confirmedHit)).toBe(true);
    expect(confirmedHit.canOverrideMissingDocuments).toBe(false);
  });

  it("adds high-goal verification without forcing optional documents to block approval", () => {
    const result = checkDocumentGaps(
      campaign({
        category: "Emergency relief",
        goalAmount: 80_000,
        documentsSubmitted: [
          "entity_registration",
          "distribution_plan",
          "bank_verification",
          "partner_mou"
        ]
      })
    );

    expect(result.requiredDocuments).toEqual(expect.arrayContaining(["high_goal_budget"]));
    expect(result.optionalDocuments).toEqual(expect.arrayContaining(["field_photos"]));
    expect(result.missingRequiredDocuments).toEqual(["high_goal_budget"]);
    expect(result.riskSignals).toContain("High goal amount needs additional verification");
  });
});
