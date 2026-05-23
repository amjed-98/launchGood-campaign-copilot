"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  Mail,
  Send,
  ShieldAlert
} from "lucide-react";
import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/risk";
import type { Campaign, TriageResult } from "@/lib/types";

type DecisionLog = {
  campaignId: string;
  action: "APPROVE" | "REQUEST_DOCS" | "ESCALATE";
  note: string;
  draft?: string;
  timestamp: string;
};

const actionLabels = {
  APPROVE_REVIEW: "Approval review",
  REQUEST_DOCUMENTS: "Request documents",
  SENIOR_REVIEW: "Senior review",
  ESCALATE_COMPLIANCE: "Compliance escalation"
};

export function CampaignReviewView({ campaign }: { campaign: Campaign }) {
  const storageKey = `launchgood-review-log:${campaign.id}`;
  const [triage, setTriage] = useState<TriageResult>({
    risk_tier: campaign.riskTier,
    confidence: campaign.confidence,
    risk_signals: campaign.riskSignals,
    positive_signals: campaign.positiveSignals,
    missing_documents: campaign.missingDocuments,
    recommended_action: campaign.recommendedAction,
    reviewer_note: campaign.reviewerNote
  });
  const [emailDraft, setEmailDraft] = useState("");
  const [loadingTriage, setLoadingTriage] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [decisionLog, setDecisionLog] = useState<DecisionLog[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as DecisionLog[]) : [];
  });

  const derivedEmailIntent = useMemo(() => {
    if (triage.recommended_action === "APPROVE_REVIEW") return "approval-ready note";
    if (triage.recommended_action === "ESCALATE_COMPLIANCE") return "internal escalation summary";
    if (triage.recommended_action === "SENIOR_REVIEW") return "senior reviewer handoff";
    return "document request";
  }, [triage.recommended_action]);

  async function runTriage() {
    setLoadingTriage(true);
    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign })
      });
      if (!response.ok) throw new Error("Unable to run triage");
      const data = (await response.json()) as TriageResult;
      setTriage(data);
    } finally {
      setLoadingTriage(false);
    }
  }

  const requestEmailDraft = useCallback(async () => {
    const response = await fetch("/api/draft-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaign,
        missingDocuments: triage.missing_documents,
        triage
      })
    });
    if (!response.ok) throw new Error("Unable to draft email");
    const data = (await response.json()) as { draft: string };
    return data.draft;
  }, [campaign, triage]);

  useEffect(() => {
    let ignore = false;

    async function loadDraft() {
      try {
        const draft = await requestEmailDraft();
        if (!ignore) {
          setEmailDraft(draft);
        }
      } catch {
        if (!ignore) {
          setEmailDraft("");
        }
      }
    }

    void loadDraft();
    return () => {
      ignore = true;
    };
  }, [requestEmailDraft]);

  async function generateEmail() {
    setLoadingEmail(true);
    try {
      setEmailDraft(await requestEmailDraft());
    } finally {
      setLoadingEmail(false);
    }
  }

  function logDecision(action: DecisionLog["action"]) {
    const decisionNotes = {
      APPROVE: "Campaign approved by reviewer.",
      REQUEST_DOCS: "Document request sent to creator.",
      ESCALATE: "Campaign escalated to senior reviewer."
    };
    const nextLog = [
      {
        campaignId: campaign.id,
        action,
        note: decisionNotes[action],
        draft: action === "REQUEST_DOCS" ? emailDraft : undefined,
        timestamp: new Date().toISOString()
      },
      ...decisionLog
    ];
    setDecisionLog(nextLog);
    window.localStorage.setItem(storageKey, JSON.stringify(nextLog));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardDescription>{campaign.id}</CardDescription>
                  <h1 className="mt-2 text-3xl font-semibold tracking-normal">{campaign.title}</h1>
                </div>
                <Button onClick={runTriage} disabled={loadingTriage}>
                  {loadingTriage ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="size-4" aria-hidden="true" />
                  )}
                  Run AI triage
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label="Creator" value={campaign.creatorName} />
                <Metric label="Creator location" value={campaign.creatorLocation} />
                <Metric label="Beneficiary location" value={campaign.beneficiaryLocation} />
                <Metric label="Goal" value={formatMoney(campaign.goalAmount)} />
                <Metric label="Category" value={campaign.category} />
                <Metric label="Submitted" value={new Date(campaign.submittedAt).toLocaleString()} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Account age" value={`${campaign.accountAgeDays} days`} />
                <Metric label="Prior campaigns" value={`${campaign.previousCampaigns}`} />
                <Metric label="Sanctions screen" value={campaign.sanctionsScreen.replaceAll("_", " ")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaign Description</CardTitle>
              <CardDescription>Submission copy available to the reviewer.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{campaign.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents Submitted</CardTitle>
              <CardDescription>Files included with the campaign submission.</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentList documents={campaign.documentsSubmitted} emptyText="No documents were submitted." />
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>AI Risk Analysis</CardTitle>
                  <CardDescription>{actionLabels[triage.recommended_action]}</CardDescription>
                </div>
                <RiskBadge tier={triage.risk_tier} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">Confidence score</span>
                  <span className="font-semibold">{Math.round(triage.confidence * 100)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round(triage.confidence * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Reviewer note</p>
                <p className="mt-1 text-sm leading-6">{triage.reviewer_note}</p>
              </div>

              <SignalList
                title="Risk signals"
                icon={AlertTriangle}
                items={triage.risk_signals}
                emptyText="No major risk signals detected."
                compact
              />
              <SignalList
                title="Positive signals"
                icon={CheckCircle2}
                items={triage.positive_signals}
                emptyText="No positive signals captured."
                compact
              />

              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Missing documents checklist</p>
                {triage.missing_documents.length > 0 ? (
                  <ul className="mt-2 space-y-2 text-sm">
                    {triage.missing_documents.map((document) => (
                      <li key={document} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2">
                        <span className="size-4 rounded-sm border border-amber-300 bg-amber-50" aria-hidden="true" />
                        <span>{formatDocumentName(document)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2 flex items-center gap-2 rounded-md border bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    No missing documents.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Email Draft</CardTitle>
              <CardDescription>Editable {derivedEmailIntent} for human review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" onClick={generateEmail} disabled={loadingEmail}>
                {loadingEmail ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mail className="size-4" aria-hidden="true" />
                )}
                Regenerate draft
              </Button>
              <Textarea
                value={emailDraft}
                onChange={(event) => setEmailDraft(event.target.value)}
                className="min-h-[320px]"
                placeholder="AI-generated email draft will appear here."
              />
              <div className="grid gap-2">
                <Button variant="secondary" onClick={() => logDecision("APPROVE")}>
                  <ClipboardCheck className="size-4" aria-hidden="true" />
                  Approve Campaign
                </Button>
                <Button variant="outline" onClick={() => logDecision("REQUEST_DOCS")} disabled={!emailDraft.trim()}>
                  <Send className="size-4" aria-hidden="true" />
                  Send Document Request
                </Button>
                <Button variant="destructive" onClick={() => logDecision("ESCALATE")}>
                  <ShieldAlert className="size-4" aria-hidden="true" />
                  Escalate to Senior Reviewer
                </Button>
              </div>
            </CardContent>
          </Card>

          {decisionLog.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Decision Log</CardTitle>
                <CardDescription>Local prototype record with reviewer timestamps.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-md border">
                  {decisionLog.map((entry) => (
                    <div key={`${entry.timestamp}-${entry.action}`} className="p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{entry.action}</span>
                        <time className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </time>
                      </div>
                      <p className="mt-1 text-muted-foreground">{entry.note}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/35 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatDocumentName(document: string) {
  return document.replaceAll("_", " ");
}

function DocumentList({ documents, emptyText }: { documents: string[]; emptyText: string }) {
  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {documents.map((document) => (
        <li key={document} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
          <FileCheck2 className="size-4 text-emerald-700" aria-hidden="true" />
          <span>{formatDocumentName(document)}</span>
        </li>
      ))}
    </ul>
  );
}

function SignalList({
  title,
  icon: Icon,
  items,
  emptyText,
  compact = false
}: {
  title: string;
  icon: ElementType;
  items: string[];
  emptyText: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
          {title}
        </p>
        {items.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm">
            {items.map((item) => (
              <li key={item} className="rounded-md border bg-white px-3 py-2 text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {items.map((item) => (
              <li key={item} className="rounded-md border bg-white px-3 py-2 text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}
