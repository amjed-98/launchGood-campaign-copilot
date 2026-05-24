"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  Mail,
  MessageSquareReply,
  Send,
  ShieldAlert,
  UserCog
} from "lucide-react";
import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useLocalQueue } from "@/components/use-local-queue";
import { emailEditBucketLabels } from "@/lib/email-edit-bucket";
import {
  applyReviewerAction,
  findQueuedCampaign,
  isAwaitingCreatorResponse,
  isResolvedCampaign,
  notifyLocalQueueChanged,
  readQueueFromStorage,
  writeQueueToStorage,
  type ReviewerQueueAction
} from "@/lib/local-queue";
import { formatMoney, getCurrentAssessment, hasReviewerOverride } from "@/lib/risk";
import type { Campaign, RecommendedAction, ReviewEventType, RiskTier, TriageResult } from "@/lib/types";

const actionLabels: Record<RecommendedAction, string> = {
  APPROVE_REVIEW: "Approval review",
  REQUEST_DOCUMENTS: "Request documents",
  SENIOR_REVIEW: "Senior review",
  ESCALATE_COMPLIANCE: "Compliance escalation"
};

const riskTierOptions: RiskTier[] = ["LOW", "MEDIUM", "HIGH", "ESCALATE"];
const recommendedActionOptions: RecommendedAction[] = [
  "APPROVE_REVIEW",
  "REQUEST_DOCUMENTS",
  "SENIOR_REVIEW",
  "ESCALATE_COMPLIANCE"
];

export function CampaignReviewView({ campaign }: { campaign: Campaign }) {
  const queue = useLocalQueue();
  const currentCampaign = findQueuedCampaign(queue, campaign.id) ?? campaign;
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
  const [aiEmailDraft, setAiEmailDraft] = useState("");
  const [resolutionReason, setResolutionReason] = useState("");
  const [creatorResponseNote, setCreatorResponseNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadingTriage, setLoadingTriage] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);

  const currentAssessment = getCurrentAssessment(currentCampaign);
  const isOverridden = hasReviewerOverride(currentCampaign);
  const [overrideTier, setOverrideTier] = useState<RiskTier>(currentAssessment.riskTier);
  const [overrideAction, setOverrideAction] = useState<RecommendedAction>(currentAssessment.recommendedAction);
  const [overrideReason, setOverrideReason] = useState("");
  const isOverrideChanged =
    overrideTier !== currentAssessment.riskTier || overrideAction !== currentAssessment.recommendedAction;

  const derivedEmailIntent = useMemo(() => {
    if (triage.recommended_action === "APPROVE_REVIEW") return "approval-ready note";
    if (triage.recommended_action === "ESCALATE_COMPLIANCE") return "internal escalation summary";
    if (triage.recommended_action === "SENIOR_REVIEW") return "senior reviewer handoff";
    return "document request";
  }, [triage.recommended_action]);

  const isResolved = isResolvedCampaign(currentCampaign);
  const hasMissingDocuments = currentCampaign.missingDocuments.length > 0;
  const hasComplianceClearanceGap = currentCampaign.missingDocuments.includes("compliance_clearance");
  const hasDocumentGapOverride =
    currentCampaign.reviewEvents?.some((event) => event.type === "DOCUMENT_GAP_OVERRIDE") ?? false;
  const isApprovalBlocked =
    hasMissingDocuments && (hasComplianceClearanceGap || !hasDocumentGapOverride);

  async function runTriage() {
    setLoadingTriage(true);
    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign: currentCampaign })
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
        campaign: currentCampaign,
        missingDocuments: triage.missing_documents,
        triage
      })
    });
    if (!response.ok) throw new Error("Unable to draft email");
    const data = (await response.json()) as { draft: string };
    return data.draft;
  }, [currentCampaign, triage]);

  useEffect(() => {
    let ignore = false;

    async function loadDraft() {
      try {
        const draft = await requestEmailDraft();
        if (!ignore) {
          setEmailDraft(draft);
          setAiEmailDraft(draft);
        }
      } catch {
        if (!ignore) {
          setEmailDraft("");
          setAiEmailDraft("");
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
      const draft = await requestEmailDraft();
      setEmailDraft(draft);
      setAiEmailDraft(draft);
    } finally {
      setLoadingEmail(false);
    }
  }

  function applyAction(action: ReviewerQueueAction) {
    try {
      const storedQueue = readQueueFromStorage(window.localStorage);
      const nextQueue = applyReviewerAction(storedQueue, currentCampaign.id, action);
      writeQueueToStorage(window.localStorage, nextQueue);
      notifyLocalQueueChanged();
      setActionError("");
      if (action.type === "REVIEWER_OVERRIDE") {
        setOverrideReason("");
      } else if (action.type === "CREATOR_RESPONSE") {
        setCreatorResponseNote("");
      } else if (action.type !== "REQUEST_DOCS") {
        setResolutionReason("");
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to record reviewer action.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardDescription>{currentCampaign.id}</CardDescription>
                  <h1 className="mt-2 text-3xl font-semibold tracking-normal">{currentCampaign.title}</h1>
                </div>
                <Button onClick={runTriage} disabled={loadingTriage || isResolved}>
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
                <Metric label="Creator" value={currentCampaign.creatorName} />
                <Metric label="Creator location" value={currentCampaign.creatorLocation} />
                <Metric label="Beneficiary location" value={currentCampaign.beneficiaryLocation} />
                <Metric label="Goal" value={formatMoney(currentCampaign.goalAmount)} />
                <Metric label="Category" value={currentCampaign.category} />
                <Metric label="Submitted" value={new Date(currentCampaign.submittedAt).toLocaleString()} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Review status" value={currentCampaign.status} />
                <Metric label="Account age" value={`${currentCampaign.accountAgeDays} days`} />
                <Metric label="Sanctions screen" value={currentCampaign.sanctionsScreen.replaceAll("_", " ")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaign Description</CardTitle>
              <CardDescription>Submission copy available to the reviewer.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{currentCampaign.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents Submitted</CardTitle>
              <CardDescription>Files included with the campaign submission.</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentList documents={currentCampaign.documentsSubmitted} emptyText="No documents were submitted." />
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>AI Risk Analysis</CardTitle>
                  <CardDescription>
                    {actionLabels[triage.recommended_action]} · original AI triage, preserved after any reviewer override
                  </CardDescription>
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Current Review Assessment</CardTitle>
                  <CardDescription>
                    {isOverridden
                      ? "Reviewer-adjusted assessment used for queue priority. The AI never approves, rejects, or decides."
                      : "Matches the AI triage until a reviewer records an override."}
                  </CardDescription>
                </div>
                <RiskBadge tier={currentAssessment.riskTier} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Current risk tier" value={currentAssessment.riskTier} />
                <Metric label="Current recommended action" value={actionLabels[currentAssessment.recommendedAction]} />
              </div>
              {isOverridden ? (
                <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  Adjusted by a reviewer. Original AI triage: {currentCampaign.riskTier} ·{" "}
                  {actionLabels[currentCampaign.recommendedAction]}.
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Override risk tier</span>
                  <select
                    value={overrideTier}
                    onChange={(event) => setOverrideTier(event.target.value as RiskTier)}
                    disabled={isResolved}
                    className="rounded-md border bg-white px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {riskTierOptions.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Override recommended action</span>
                  <select
                    value={overrideAction}
                    onChange={(event) => setOverrideAction(event.target.value as RecommendedAction)}
                    disabled={isResolved}
                    className="rounded-md border bg-white px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {recommendedActionOptions.map((option) => (
                      <option key={option} value={option}>
                        {actionLabels[option]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Textarea
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                className="min-h-[90px]"
                placeholder="Resolution reason for this reviewer override."
                disabled={isResolved}
              />
              <Button
                className="w-full"
                onClick={() =>
                  applyAction({
                    type: "REVIEWER_OVERRIDE",
                    riskTier: overrideTier,
                    recommendedAction: overrideAction,
                    reason: overrideReason
                  })
                }
                disabled={isResolved || !isOverrideChanged || !overrideReason.trim()}
              >
                <UserCog className="size-4" aria-hidden="true" />
                Record reviewer override
              </Button>
              <p className="text-xs text-muted-foreground">
                Overriding adjusts triage for human-led prioritization only. It does not approve, reject, or send anything.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Email Draft</CardTitle>
              <CardDescription>Editable {derivedEmailIntent} for human review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" onClick={generateEmail} disabled={loadingEmail || isResolved}>
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
                disabled={isResolved}
              />
              <div className="grid gap-2">
                <Button
                  variant="secondary"
                  onClick={() => applyAction({ type: "APPROVE" })}
                  disabled={isResolved || isApprovalBlocked}
                >
                  <ClipboardCheck className="size-4" aria-hidden="true" />
                  Approve Campaign
                </Button>
                <Button
                  variant="outline"
                  onClick={() => applyAction({ type: "REQUEST_DOCS", draft: emailDraft, aiDraft: aiEmailDraft })}
                  disabled={isResolved || !emailDraft.trim()}
                >
                  <Send className="size-4" aria-hidden="true" />
                  Send Document Request
                </Button>
                <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Sending records a Simulated Email Send event and moves the campaign to Waiting on creator. No external
                  email integration exists in this prototype.
                </p>
                <Button
                  variant="outline"
                  onClick={() => applyAction({ type: "DOCUMENT_GAP_OVERRIDE", reason: resolutionReason })}
                  disabled={isResolved || !hasMissingDocuments || hasComplianceClearanceGap}
                >
                  <FileCheck2 className="size-4" aria-hidden="true" />
                  Record Document Gap Override
                </Button>
                <Button
                  variant="outline"
                  onClick={() => applyAction({ type: "REJECT", reason: resolutionReason })}
                  disabled={isResolved}
                >
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  Reject Campaign
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => applyAction({ type: "ESCALATE", reason: resolutionReason })}
                  disabled={isResolved}
                >
                  <ShieldAlert className="size-4" aria-hidden="true" />
                  Escalate to Senior Reviewer
                </Button>
                <Textarea
                  value={resolutionReason}
                  onChange={(event) => setResolutionReason(event.target.value)}
                  className="min-h-[100px]"
                  placeholder="Resolution reason for rejection, escalation, or document gap override."
                  disabled={isResolved}
                />
                {isApprovalBlocked ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Approval is blocked until required document gaps are resolved or an allowed document gap override is
                    recorded. Compliance clearance cannot be overridden.
                  </p>
                ) : null}
                {actionError ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {actionError}
                  </p>
                ) : null}
                {isResolved ? (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Final action controls are disabled for resolved campaign records.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {isAwaitingCreatorResponse(currentCampaign) && !isResolved ? (
            <Card>
              <CardHeader>
                <CardTitle>Simulated Creator Response</CardTitle>
                <CardDescription>
                  Record whether the creator&apos;s reply to the document request was complete or incomplete.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={creatorResponseNote}
                  onChange={(event) => setCreatorResponseNote(event.target.value)}
                  className="min-h-[90px]"
                  placeholder="Optional reviewer note about the creator's response."
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      applyAction({ type: "CREATOR_RESPONSE", outcome: "complete", note: creatorResponseNote })
                    }
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Mark response complete
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      applyAction({ type: "CREATOR_RESPONSE", outcome: "incomplete", note: creatorResponseNote })
                    }
                  >
                    <MessageSquareReply className="size-4" aria-hidden="true" />
                    Mark response incomplete
                  </Button>
                </div>
                <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  This logs a Simulated Creator Response event only. The prototype has no real creator messaging or
                  document upload. A complete response returns the campaign to In review; an incomplete response keeps it
                  Waiting on creator.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {currentCampaign.reviewEvents && currentCampaign.reviewEvents.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Decision History</CardTitle>
                <CardDescription>Local prototype record with reviewer timestamps and reasons.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-md border">
                  {[...currentCampaign.reviewEvents].reverse().map((entry) => (
                    <div key={`${entry.timestamp}-${entry.type}`} className="p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{formatReviewEventType(entry.type)}</span>
                        <time className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </time>
                      </div>
                      <p className="mt-1 text-muted-foreground">{entry.note}</p>
                      {entry.emailEditBucket ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Email edit bucket: {emailEditBucketLabels[entry.emailEditBucket]}
                        </p>
                      ) : null}
                      {entry.creatorResponseOutcome ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Creator response: {entry.creatorResponseOutcome}
                        </p>
                      ) : null}
                      {entry.assessment ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Adjusted to {entry.assessment.riskTier} · {actionLabels[entry.assessment.recommendedAction]}
                        </p>
                      ) : null}
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

function formatReviewEventType(type: ReviewEventType) {
  const labels: Record<ReviewEventType, string> = {
    APPROVAL: "Approval",
    REJECTION: "Rejection",
    SIMULATED_EMAIL_SEND: "Simulated email send",
    SIMULATED_CREATOR_RESPONSE: "Simulated creator response",
    ESCALATION: "Escalation",
    DOCUMENT_GAP_OVERRIDE: "Document gap override",
    REVIEWER_OVERRIDE: "Reviewer override"
  };
  return labels[type];
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
