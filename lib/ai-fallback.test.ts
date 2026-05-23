import { describe, expect, it } from "vitest";
import type { Campaign } from "@/lib/types";
import { fallbackTriage } from "@/lib/ai-fallback";

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
    documentsSubmitted: ["bank_verification", "quote_invoice", "trustee_id"],
    missingDocuments: [],
    riskSignals: [],
    positiveSignals: [],
    recommendedAction: "APPROVE_REVIEW",
    reviewerNote: "Seed note",
    ...overrides
  };
}

describe("Fallback Triage", () => {
  it("approves routine complete campaigns without copying seeded triage fields", () => {
    const result = fallbackTriage(
      campaign({
        riskTier: "ESCALATE",
        recommendedAction: "ESCALATE_COMPLIANCE",
        confidence: 0.1,
        riskSignals: ["stale seeded signal"],
        reviewerNote: "Stale seeded note"
      })
    );

    expect(result.risk_tier).toBe("LOW");
    expect(result.recommended_action).toBe("APPROVE_REVIEW");
    expect(result.missing_documents).toEqual([]);
    expect(result.positive_signals).toContain("Repeat creator history");
    expect(result.reviewer_note).toContain("Fallback triage");
  });

  it("requests documents when deterministic required documents are missing", () => {
    const result = fallbackTriage(
      campaign({
        category: "NGO project",
        documentsSubmitted: ["project_budget"],
        previousCampaigns: 0,
        accountAgeDays: 12
      })
    );

    expect(result.risk_tier).toBe("MEDIUM");
    expect(result.recommended_action).toBe("REQUEST_DOCUMENTS");
    expect(result.missing_documents).toEqual(
      expect.arrayContaining(["entity_registration", "bank_verification", "authorized_signatory_id"])
    );
    expect(result.risk_signals).toEqual(expect.arrayContaining(["First-time creator", "New account"]));
  });

  it("routes confirmed sanctions hits to compliance regardless of submitted ordinary documents", () => {
    const result = fallbackTriage(
      campaign({
        sanctionsScreen: "confirmed_hit",
        documentsSubmitted: ["bank_verification", "quote_invoice", "trustee_id"]
      })
    );

    expect(result.risk_tier).toBe("ESCALATE");
    expect(result.recommended_action).toBe("ESCALATE_COMPLIANCE");
    expect(result.missing_documents).toEqual(["compliance_clearance"]);
    expect(result.risk_signals).toContain("Confirmed sanctions screening hit");
  });

  it("routes high-risk contextual campaigns to senior review", () => {
    const result = fallbackTriage(
      campaign({
        category: "Emergency relief",
        beneficiaryLocation: "Gaza, Palestinian Territories",
        goalAmount: 80_000,
        accountAgeDays: 6,
        previousCampaigns: 0,
        sanctionsScreen: "pending",
        documentsSubmitted: ["creator_id"]
      })
    );

    expect(result.risk_tier).toBe("HIGH");
    expect(result.recommended_action).toBe("SENIOR_REVIEW");
    expect(result.risk_signals).toEqual(
      expect.arrayContaining([
        "Sensitive beneficiary location requires enhanced due diligence",
        "High goal amount needs additional verification",
        "Pending sanctions screening"
      ])
    );
  });
});
