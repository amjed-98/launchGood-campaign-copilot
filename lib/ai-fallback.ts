import type { Campaign, TriageResult } from "@/lib/types";

export function fallbackTriage(campaign: Campaign): TriageResult {
  return {
    risk_tier: campaign.riskTier,
    confidence: campaign.confidence,
    risk_signals: campaign.riskSignals,
    positive_signals: campaign.positiveSignals,
    missing_documents: campaign.missingDocuments,
    recommended_action: campaign.recommendedAction,
    reviewer_note: campaign.reviewerNote
  };
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
