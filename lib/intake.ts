import { checkDocumentGaps } from "@/lib/document-gap";
import type { Campaign, TriageResult } from "@/lib/types";

export type IntakeCampaignInput = {
  title: string;
  creatorName: string;
  creatorLocation: string;
  beneficiaryLocation: string;
  category: string;
  goalAmount: number;
  accountAgeDays: number;
  previousCampaigns: number;
  sanctionsScreen: Campaign["sanctionsScreen"];
  description: string;
  documentsSubmitted: string[];
};

export type IntakeCampaignOptions = {
  id?: string;
  submittedAt?: string;
};

export function prepareCampaignForTriage(input: IntakeCampaignInput, options: IntakeCampaignOptions = {}): Campaign {
  const baseCampaign = createBaseCampaign(input, options);
  const documentGaps = checkDocumentGaps(baseCampaign);

  return {
    ...baseCampaign,
    missingDocuments: documentGaps.missingRequiredDocuments,
    riskSignals: documentGaps.riskSignals,
    positiveSignals: documentGaps.positiveSignals,
    recommendedAction: documentGaps.missingRequiredDocuments.length > 0 ? "REQUEST_DOCUMENTS" : "APPROVE_REVIEW",
    reviewerNote: `Document Gap Check: ${documentGaps.ruleExplanations.join(" ")}`
  };
}

export function createCampaignFromIntake(
  input: IntakeCampaignInput,
  triage: TriageResult,
  options: IntakeCampaignOptions = {}
): Campaign {
  return {
    ...createBaseCampaign(input, options),
    riskTier: triage.risk_tier,
    confidence: triage.confidence,
    missingDocuments: [...triage.missing_documents],
    riskSignals: [...triage.risk_signals],
    positiveSignals: [...triage.positive_signals],
    recommendedAction: triage.recommended_action,
    reviewerNote: triage.reviewer_note
  };
}

export function parseSubmittedDocuments(value: string) {
  return value
    .split(/[\n,]/)
    .map((document) => document.trim().toLowerCase().replaceAll(/\s+/g, "_"))
    .filter(Boolean);
}

function createBaseCampaign(input: IntakeCampaignInput, options: IntakeCampaignOptions): Campaign {
  return {
    id: options.id ?? createLocalCampaignId(),
    title: input.title.trim(),
    creatorName: input.creatorName.trim(),
    creatorLocation: input.creatorLocation.trim(),
    beneficiaryLocation: input.beneficiaryLocation.trim(),
    category: input.category.trim(),
    goalAmount: input.goalAmount,
    currency: "USD",
    submittedAt: options.submittedAt ?? new Date().toISOString(),
    slaHours: 24,
    riskTier: "MEDIUM",
    confidence: 0,
    status: "New",
    accountAgeDays: input.accountAgeDays,
    previousCampaigns: input.previousCampaigns,
    sanctionsScreen: input.sanctionsScreen,
    description: input.description.trim(),
    documentsSubmitted: [...input.documentsSubmitted],
    missingDocuments: [],
    riskSignals: [],
    positiveSignals: [],
    recommendedAction: "REQUEST_DOCUMENTS",
    reviewerNote: "Awaiting AI triage."
  };
}

function createLocalCampaignId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
