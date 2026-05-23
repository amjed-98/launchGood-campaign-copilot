import type { Campaign } from "@/lib/types";

export type DocumentGapResult = {
  requiredDocuments: string[];
  optionalDocuments: string[];
  missingRequiredDocuments: string[];
  ruleExplanations: string[];
  riskSignals: string[];
  positiveSignals: string[];
  canOverrideMissingDocuments: boolean;
};

const sensitiveBeneficiaryLocations = [
  "yemen",
  "gaza",
  "palestinian territories",
  "syria",
  "sudan",
  "afghanistan"
];

const categoryRules: Record<
  string,
  {
    required: string[];
    optional: string[];
    explanation: string;
  }
> = {
  "mosque renovation": {
    required: ["bank_verification", "quote_invoice", "trustee_id"],
    optional: ["board_authorization"],
    explanation: "Mosque renovation campaigns require receiving account and project proof."
  },
  accessibility: {
    required: ["bank_verification", "contractor_quote", "creator_id"],
    optional: ["board_authorization"],
    explanation: "Accessibility campaigns require receiving account and project proof."
  },
  "medical emergency": {
    required: ["creator_id", "medical_letter", "beneficiary_id", "bank_verification"],
    optional: ["hospital_estimate", "relationship_attestation"],
    explanation: "Medical emergency campaigns require identity, medical evidence, and receiving account proof."
  },
  "ngo project": {
    required: ["entity_registration", "project_budget", "bank_verification", "authorized_signatory_id"],
    optional: ["partner_mou"],
    explanation: "NGO campaigns require entity proof, budget, receiving account, and signatory proof."
  },
  education: {
    required: ["entity_registration", "project_budget", "bank_verification", "authorized_signatory_id"],
    optional: ["contractor_quote", "board_resolution"],
    explanation: "Education campaigns require entity proof, budget, receiving account, and signatory proof."
  },
  "emergency relief": {
    required: ["entity_registration", "distribution_plan", "bank_verification", "partner_mou"],
    optional: ["field_photos"],
    explanation: "Emergency relief campaigns require partner, distribution, and receiving account proof."
  },
  "disaster relief": {
    required: ["entity_registration", "distribution_plan", "bank_verification", "partner_mou"],
    optional: ["field_photos"],
    explanation: "Disaster relief campaigns require partner, distribution, and receiving account proof."
  },
  "orphan support": {
    required: ["entity_registration", "distribution_plan", "bank_verification", "partner_mou"],
    optional: ["casework_summary"],
    explanation: "Orphan support campaigns require partner, distribution, and receiving account proof."
  },
  "food aid": {
    required: ["entity_registration", "distribution_plan", "bank_verification", "partner_mou"],
    optional: ["food_permit"],
    explanation: "Food aid campaigns require partner, distribution, and receiving account proof."
  },
  "zakat distribution": {
    required: ["charity_registration", "zakat_policy", "bank_verification", "casework_summary"],
    optional: ["distribution_plan"],
    explanation: "Zakat campaigns require charity, policy, receiving account, and casework proof."
  }
};

const documentAliases: Record<string, string[]> = {
  entity_registration: ["ngo_incorporation", "beneficiary_org_registration", "charity_registration", "nonprofit_letter"],
  project_budget: ["budget", "distribution_budget"],
  distribution_plan: ["distribution_budget"],
  quote_invoice: ["contractor_quote"],
  medical_letter: ["hospital_estimate"]
};

export function checkDocumentGaps(campaign: Campaign): DocumentGapResult {
  const requiredDocuments: string[] = [];
  const optionalDocuments: string[] = [];
  const ruleExplanations: string[] = [];
  const riskSignals: string[] = [];
  const positiveSignals: string[] = [];
  const categoryRule = categoryRules[normalize(campaign.category)];

  if (categoryRule) {
    addUnique(requiredDocuments, categoryRule.required);
    addUnique(optionalDocuments, categoryRule.optional);
    ruleExplanations.push(categoryRule.explanation);
  } else {
    addUnique(requiredDocuments, ["creator_id", "bank_verification"]);
    ruleExplanations.push("Unmapped categories require baseline identity and receiving account proof.");
  }

  if (isSensitiveBeneficiaryLocation(campaign.beneficiaryLocation)) {
    addUnique(requiredDocuments, ["relationship_attestation"]);
    riskSignals.push("Sensitive beneficiary location requires enhanced due diligence");
    ruleExplanations.push("Sensitive beneficiary locations require enhanced due diligence documents.");
  }

  if (campaign.goalAmount >= 50_000) {
    addUnique(requiredDocuments, ["high_goal_budget"]);
    riskSignals.push("High goal amount needs additional verification");
    ruleExplanations.push("Campaigns at or above $50,000 require high-goal budget verification.");
  }

  if (campaign.sanctionsScreen === "pending") {
    addUnique(requiredDocuments, ["sanctions_screening_result"]);
    riskSignals.push("Pending sanctions screening");
    ruleExplanations.push("Pending sanctions screening must be resolved before routine approval.");
  }

  if (campaign.sanctionsScreen === "name_match") {
    addUnique(requiredDocuments, ["name_match_attestation"]);
    riskSignals.push("Unresolved sanctions name match");
    ruleExplanations.push("Name-match screening results require attestation or senior review.");
  }

  if (campaign.sanctionsScreen === "confirmed_hit") {
    addUnique(requiredDocuments, ["compliance_clearance"]);
    riskSignals.push("Confirmed sanctions screening hit");
    ruleExplanations.push("Confirmed sanctions hits require compliance clearance.");
  }

  if (campaign.previousCampaigns > 0) {
    positiveSignals.push("Repeat creator history");
  }

  if (campaign.accountAgeDays >= 180) {
    positiveSignals.push("Established account age");
  }

  if (campaign.sanctionsScreen === "pass") {
    positiveSignals.push("Sanctions screen passed");
  }

  const missingRequiredDocuments = requiredDocuments.filter(
    (document) => !hasSubmittedDocument(document, campaign.documentsSubmitted)
  );

  return {
    requiredDocuments,
    optionalDocuments,
    missingRequiredDocuments,
    ruleExplanations,
    riskSignals,
    positiveSignals,
    canOverrideMissingDocuments: !missingRequiredDocuments.includes("compliance_clearance")
  };
}

export function isSensitiveBeneficiaryLocation(location: string) {
  const normalizedLocation = normalize(location);
  return sensitiveBeneficiaryLocations.some((sensitiveLocation) =>
    normalizedLocation.includes(sensitiveLocation)
  );
}

export function isComplianceClearanceMissing(result: DocumentGapResult) {
  return result.missingRequiredDocuments.includes("compliance_clearance");
}

function hasSubmittedDocument(document: string, submittedDocuments: string[]) {
  if (submittedDocuments.includes(document)) {
    return true;
  }

  return (documentAliases[document] ?? []).some((alias) => submittedDocuments.includes(alias));
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function addUnique(target: string[], values: string[]) {
  for (const value of values) {
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}
