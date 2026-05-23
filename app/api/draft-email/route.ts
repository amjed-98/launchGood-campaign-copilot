import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { fallbackEmailDraft } from "@/lib/ai-fallback";
import { getAnthropicApiKey } from "@/lib/server-env";
import type { Campaign, TriageResult } from "@/lib/types";

const model = "claude-sonnet-4-20250514";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    campaign?: Campaign;
    missingDocuments?: string[];
    triage?: TriageResult;
  };
  const { campaign, triage, missingDocuments } = body;

  if (!campaign || !triage) {
    return NextResponse.json({ error: "campaign and triage are required" }, { status: 400 });
  }

  const draftTriage = {
    ...triage,
    missing_documents: missingDocuments ?? triage.missing_documents
  };

  const apiKey = getAnthropicApiKey();

  if (!apiKey) {
    return NextResponse.json({ draft: fallbackEmailDraft(campaign, draftTriage) });
  }

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model,
    max_tokens: 1000,
    system:
      "You draft warm, specific LaunchGood Trust & Safety reviewer emails. The human reviewer edits and sends; you do not send emails. If the recommended action is escalation or senior review, draft an internal handoff note instead of creator outreach.",
    messages: [
      {
        role: "user",
        content: `Draft the appropriate reviewer communication for this campaign.

Use a professional, human, faith-aligned tone. Reference exact missing documents. Do not imply approval. Do not say the email has been sent.

Campaign:
${JSON.stringify(campaign, null, 2)}

Triage:
${JSON.stringify(draftTriage, null, 2)}`
      }
    ]
  });

  const draft = message.content.find((block) => block.type === "text")?.text;
  if (!draft) {
    return NextResponse.json({ error: "Claude returned no draft" }, { status: 502 });
  }

  return NextResponse.json({ draft });
}
