export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "ESCALATE";

export type CampaignStatus = "New" | "In review" | "Waiting on creator" | "Escalated";

export type RecommendedAction =
  | "APPROVE_REVIEW"
  | "REQUEST_DOCUMENTS"
  | "SENIOR_REVIEW"
  | "ESCALATE_COMPLIANCE";

export type Campaign = {
  id: string;
  title: string;
  creatorName: string;
  creatorLocation: string;
  beneficiaryLocation: string;
  category: string;
  goalAmount: number;
  currency: "USD";
  submittedAt: string;
  slaHours: number;
  riskTier: RiskTier;
  confidence: number;
  status: CampaignStatus;
  accountAgeDays: number;
  previousCampaigns: number;
  sanctionsScreen: "pass" | "pending" | "name_match" | "confirmed_hit";
  description: string;
  documentsSubmitted: string[];
  missingDocuments: string[];
  riskSignals: string[];
  positiveSignals: string[];
  recommendedAction: RecommendedAction;
  reviewerNote: string;
};

export type TriageResult = {
  risk_tier: RiskTier;
  confidence: number;
  risk_signals: string[];
  positive_signals: string[];
  missing_documents: string[];
  recommended_action: RecommendedAction;
  reviewer_note: string;
};
