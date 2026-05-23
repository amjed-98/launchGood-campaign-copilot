import type { Campaign, TriageResult } from "@/lib/types";
import { checkDocumentGaps } from "@/lib/document-gap";

export function fallbackTriage(campaign: Campaign): TriageResult {
  const documentGaps = checkDocumentGaps(campaign);
  const riskSignals = [
    ...documentGaps.riskSignals,
    ...creatorRiskSignals(campaign)
  ];
  const positiveSignals = [
    ...documentGaps.positiveSignals,
    ...campaignCompletenessSignals(documentGaps.missingRequiredDocuments)
  ];
  const riskTier = getFallbackRiskTier(campaign, documentGaps.missingRequiredDocuments, riskSignals);

  return {
    risk_tier: riskTier,
    confidence: getFallbackConfidence(riskTier),
    risk_signals: riskSignals,
    positive_signals: positiveSignals,
    missing_documents: documentGaps.missingRequiredDocuments,
    recommended_action: getRecommendedAction(riskTier, documentGaps.missingRequiredDocuments),
    reviewer_note: getReviewerNote(riskTier, documentGaps.ruleExplanations)
  };
}

function creatorRiskSignals(campaign: Campaign) {
  const signals: string[] = [];

  if (campaign.previousCampaigns === 0) {
    signals.push("First-time creator");
  }

  if (campaign.accountAgeDays < 30) {
    signals.push("New account");
  }

  return signals;
}

function campaignCompletenessSignals(missingRequiredDocuments: string[]) {
  if (missingRequiredDocuments.length > 0) {
    return [];
  }

  return ["Required documents complete"];
}

function getFallbackRiskTier(
  campaign: Campaign,
  missingRequiredDocuments: string[],
  riskSignals: string[]
): TriageResult["risk_tier"] {
  if (campaign.sanctionsScreen === "confirmed_hit") {
    return "ESCALATE";
  }

  if (
    campaign.sanctionsScreen === "name_match" ||
    campaign.sanctionsScreen === "pending" ||
    riskSignals.includes("Sensitive beneficiary location requires enhanced due diligence") ||
    (campaign.goalAmount >= 50_000 && campaign.previousCampaigns === 0)
  ) {
    return "HIGH";
  }

  if (
    missingRequiredDocuments.length > 0 ||
    campaign.previousCampaigns === 0 ||
    campaign.accountAgeDays < 30
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

function getFallbackConfidence(riskTier: TriageResult["risk_tier"]) {
  const confidenceByTier: Record<TriageResult["risk_tier"], number> = {
    LOW: 0.82,
    MEDIUM: 0.78,
    HIGH: 0.84,
    ESCALATE: 0.93
  };

  return confidenceByTier[riskTier];
}

function getRecommendedAction(
  riskTier: TriageResult["risk_tier"],
  missingRequiredDocuments: string[]
): TriageResult["recommended_action"] {
  if (riskTier === "ESCALATE") {
    return "ESCALATE_COMPLIANCE";
  }

  if (riskTier === "HIGH") {
    return "SENIOR_REVIEW";
  }

  if (missingRequiredDocuments.length > 0) {
    return "REQUEST_DOCUMENTS";
  }

  return "APPROVE_REVIEW";
}

function getReviewerNote(riskTier: TriageResult["risk_tier"], ruleExplanations: string[]) {
  return `Fallback triage assigned ${riskTier} from deterministic prototype rules: ${ruleExplanations.join(" ")}`;
}

export function fallbackEmailDraft(campaign: Campaign, triage: TriageResult) {
  const docs = triage.missing_documents.map((document) => `- ${document.replaceAll("_", " ")}`).join("\n");

  if (triage.recommended_action === "ESCALATE_COMPLIANCE") {
    return `Subject: Compliance escalation required - ${campaign.title}

Internal note for Trust & Safety:

This campaign should be routed to compliance before any creator outreach.

Campaign: ${campaign.title}
Creator: ${campaign.creatorName}
Risk tier: ${triage.risk_tier}

Key signals:
${triage.risk_signals.map((signal) => `- ${signal}`).join("\n")}

Reviewer note:
${triage.reviewer_note}`;
  }

  return `Subject: Your LaunchGood fundraiser - additional review information

Assalamu Alaikum ${campaign.creatorName},

JazakAllah Khair for submitting "${campaign.title}" to LaunchGood. Our Trust & Safety team is reviewing the campaign so we can support your fundraiser responsibly.

To continue the review, please reply with the following:

${docs || "- No additional documents are currently required. We are completing a final human review."}

Once received, a reviewer will update the campaign record and continue the review. Please do not send original identity documents unless specifically requested by our team.

Warmly,
LaunchGood Trust & Safety`;
}
