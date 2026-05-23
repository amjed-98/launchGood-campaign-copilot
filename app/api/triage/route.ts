import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { fallbackTriage } from "@/lib/ai-fallback";
import { getAnthropicApiKey } from "@/lib/server-env";
import type { Campaign, RecommendedAction, RiskTier, TriageResult } from "@/lib/types";

const model = "claude-sonnet-4-20250514";
const riskTiers: RiskTier[] = ["LOW", "MEDIUM", "HIGH", "ESCALATE"];
const recommendedActions: RecommendedAction[] = [
  "APPROVE_REVIEW",
  "REQUEST_DOCUMENTS",
  "SENIOR_REVIEW",
  "ESCALATE_COMPLIANCE"
];

const triageTool: Anthropic.Tool = {
  name: "submit_campaign_triage",
  description: "Submit the structured Trust & Safety triage result for one campaign.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      risk_tier: {
        type: "string",
        enum: riskTiers,
        description: "Overall risk tier for human reviewer prioritization."
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Model confidence from 0 to 1."
      },
      risk_signals: {
        type: "array",
        items: { type: "string" },
        description: "Specific risk indicators visible in the campaign data."
      },
      positive_signals: {
        type: "array",
        items: { type: "string" },
        description: "Specific trust or completeness indicators visible in the campaign data."
      },
      missing_documents: {
        type: "array",
        items: { type: "string" },
        description: "Required document keys that are missing from the submission."
      },
      recommended_action: {
        type: "string",
        enum: recommendedActions,
        description: "Next human workflow action."
      },
      reviewer_note: {
        type: "string",
        description: "Concise note for the reviewer explaining the triage."
      }
    },
    required: [
      "risk_tier",
      "confidence",
      "risk_signals",
      "positive_signals",
      "missing_documents",
      "recommended_action",
      "reviewer_note"
    ]
  }
};

export async function POST(request: Request) {
  const body = (await request.json()) as { campaign?: Campaign };
  const campaign = body.campaign;

  if (!campaign) {
    return NextResponse.json({ error: "campaign is required" }, { status: 400 });
  }

  const apiKey = getAnthropicApiKey();

  if (!apiKey) {
    return NextResponse.json(fallbackTriage(campaign));
  }

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model,
    max_tokens: 1200,
    system:
      "You are an internal Trust & Safety triage assistant for LaunchGood crowdfunding campaign review. You triage, identify document gaps, and write reviewer notes. You never approve, reject, send emails, or make final decisions. Use the provided tool to return the structured triage result.",
    tools: [triageTool],
    tool_choice: { type: "tool", name: "submit_campaign_triage" },
    messages: [
      {
        role: "user",
        content: `Risk-score this campaign for human review.

Use only evidence present in the campaign data. If documents are missing, use stable snake_case document keys. Keep signals short and specific.

Campaign:
${JSON.stringify(campaign, null, 2)}`
      }
    ]
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === "submit_campaign_triage"
  );

  if (!toolUse) {
    return NextResponse.json({ error: "Claude returned no structured triage result" }, { status: 502 });
  }

  const parsed = parseTriageResult(toolUse.input);
  if (!parsed) {
    return NextResponse.json({ error: "Claude returned an invalid triage result" }, { status: 502 });
  }

  return NextResponse.json(parsed);
}

function parseTriageResult(input: unknown): TriageResult | null {
  if (!isRecord(input)) {
    return null;
  }

  const riskTier = input.risk_tier;
  const confidence = input.confidence;
  const riskSignals = input.risk_signals;
  const positiveSignals = input.positive_signals;
  const missingDocuments = input.missing_documents;
  const recommendedAction = input.recommended_action;
  const reviewerNote = input.reviewer_note;

  if (!isRiskTier(riskTier) || !isRecommendedAction(recommendedAction)) {
    return null;
  }

  if (
    typeof confidence !== "number" ||
    confidence < 0 ||
    confidence > 1 ||
    !isStringArray(riskSignals) ||
    !isStringArray(positiveSignals) ||
    !isStringArray(missingDocuments) ||
    typeof reviewerNote !== "string"
  ) {
    return null;
  }

  return {
    risk_tier: riskTier,
    confidence,
    risk_signals: riskSignals,
    positive_signals: positiveSignals,
    missing_documents: missingDocuments,
    recommended_action: recommendedAction,
    reviewer_note: reviewerNote
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRiskTier(value: unknown): value is RiskTier {
  return typeof value === "string" && riskTiers.includes(value as RiskTier);
}

function isRecommendedAction(value: unknown): value is RecommendedAction {
  return typeof value === "string" && recommendedActions.includes(value as RecommendedAction);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
