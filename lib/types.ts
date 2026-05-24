export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "ESCALATE";

export type CampaignStatus = "New" | "In review" | "Waiting on creator" | "Escalated" | "Approved" | "Rejected";

export type RecommendedAction =
  | "APPROVE_REVIEW"
  | "REQUEST_DOCUMENTS"
  | "SENIOR_REVIEW"
  | "ESCALATE_COMPLIANCE";

export type ReviewAssessment = {
  riskTier: RiskTier;
  recommendedAction: RecommendedAction;
};

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
  currentReviewAssessment?: ReviewAssessment;
  reviewEvents?: ReviewEvent[];
};

export type ReviewEventType =
  | "APPROVAL"
  | "REJECTION"
  | "DOCUMENT_REQUEST"
  | "ESCALATION"
  | "DOCUMENT_GAP_OVERRIDE"
  | "REVIEWER_OVERRIDE";

export type ReviewEvent = {
  type: ReviewEventType;
  campaignId: string;
  note: string;
  timestamp: string;
  draft?: string;
  missingDocuments?: string[];
  assessment?: ReviewAssessment;
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
