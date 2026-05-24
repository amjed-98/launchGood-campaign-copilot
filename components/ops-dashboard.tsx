"use client";

import { Activity, AlertTriangle, BarChart3, Clock3, Mail, RotateCcw, Send, Users } from "lucide-react";
import type { ElementType } from "react";
import { AppShell } from "@/components/app-shell";
import { RiskBadge } from "@/components/risk-badge";
import { SurgeIndicatorControl } from "@/components/surge-indicator-control";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocalQueue } from "@/components/use-local-queue";
import { createSeededQueue, getActiveCampaigns } from "@/lib/local-queue";
import {
  formatHours,
  getApprovalRateByTier,
  getCreatorResponseMetrics,
  getDecisionTimeMetrics,
  getEmailEditMetrics,
  getEscalationMetrics,
  getOverrideRate,
  getQueueDepthByTier,
  getReviewerThroughput,
  SEEDED_FALSE_NEGATIVE_RATE
} from "@/lib/ops-metrics";
import { getCurrentAssessment, hoursSinceSubmitted } from "@/lib/risk";
import type { Campaign } from "@/lib/types";

type MetricSource = "local" | "seeded";

function percentOrDash(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function hoursOrDash(value: number | null): string {
  return value === null ? "—" : formatHours(value);
}

function effectiveAction(campaign: Campaign) {
  return getCurrentAssessment(campaign).recommendedAction;
}

export function OpsDashboard({ seedCampaigns }: { seedCampaigns: Campaign[] }) {
  const queue = useLocalQueue(seedCampaigns);
  const records = queue.records;
  const activeCampaigns = getActiveCampaigns(queue);
  const baselineActiveCampaigns = getActiveCampaigns(createSeededQueue(seedCampaigns));

  const queueDepth = getQueueDepthByTier(activeCampaigns);
  const overrideRate = getOverrideRate(records);
  const decisionTime = getDecisionTimeMetrics(records);
  const throughput = getReviewerThroughput(records);
  const emailEdit = getEmailEditMetrics(records);
  const creatorResponse = getCreatorResponseMetrics(records);
  const escalation = getEscalationMetrics(records);
  const approvalByTier = getApprovalRateByTier(records);

  const overdueCount = activeCampaigns.filter(
    (campaign) => hoursSinceSubmitted(campaign.submittedAt) > campaign.slaHours
  ).length;
  const seniorReviewCount = activeCampaigns.filter(
    (campaign) => effectiveAction(campaign) === "SENIOR_REVIEW" || effectiveAction(campaign) === "ESCALATE_COMPLIANCE"
  ).length;
  const maxDepth = Math.max(...queueDepth.map((item) => item.count), 1);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Operations summary</p>
        <h1 className="text-3xl font-semibold tracking-normal">Trust &amp; Safety control room</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Local Ops Metrics are computed from prototype campaign records and reviewer events. Metrics the prototype
          cannot measure are tagged <span className="font-medium text-amber-700">Seeded</span> and never presented as
          live behavior.
        </p>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsMetric
          label="Active queue depth"
          value={activeCampaigns.length.toString()}
          detail={`${overdueCount} past SLA`}
          icon={BarChart3}
          source="local"
        />
        <OpsMetric
          label="Avg. time-to-decision"
          value={hoursOrDash(decisionTime.averageHours)}
          detail={
            decisionTime.decidedCount === 0
              ? "No decisions logged yet"
              : `From ${decisionTime.decidedCount} local ${decisionTime.decidedCount === 1 ? "decision" : "decisions"}`
          }
          icon={Clock3}
          source="local"
        />
        <OpsMetric
          label="AI override rate"
          value={`${overrideRate.rate}%`}
          detail={`${overrideRate.overriddenCount} of ${overrideRate.totalCount} campaigns adjusted`}
          icon={RotateCcw}
          source="local"
        />
        <OpsMetric
          label="Reviewer throughput"
          value={throughput.toString()}
          detail="Local reviewer actions logged"
          icon={Users}
          source="local"
        />
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Event-derived review quality</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OpsMetric
            label="Email edit rate"
            value={percentOrDash(emailEdit.editRate)}
            detail={
              emailEdit.comparableSends === 0
                ? "No comparable sends yet"
                : `${emailEdit.editedSends} of ${emailEdit.comparableSends} drafts edited before send`
            }
            icon={Mail}
            source="local"
          />
          <OpsMetric
            label="Creator response time"
            value={hoursOrDash(creatorResponse.averageResponseHours)}
            detail={
              creatorResponse.responseCount === 0
                ? "No creator responses yet"
                : `Across ${creatorResponse.responseCount} simulated ${creatorResponse.responseCount === 1 ? "response" : "responses"}`
            }
            icon={Send}
            source="local"
          />
          <OpsMetric
            label="First-contact resolution"
            value={percentOrDash(creatorResponse.firstContactResolutionRate)}
            detail={
              creatorResponse.responseCount === 0
                ? "No creator responses yet"
                : `${creatorResponse.completeCount} of ${creatorResponse.responseCount} responses complete`
            }
            icon={Activity}
            source="local"
          />
          <OpsMetric
            label="False-negative rate"
            value={`${SEEDED_FALSE_NEGATIVE_RATE}%`}
            detail="Seeded Ops Metric — retrospective outcomes not simulated"
            icon={AlertTriangle}
            source="seeded"
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <Card>
          <CardHeader>
            <CardTitle>Queue Depth by Tier</CardTitle>
            <CardDescription>Active submissions ordered by operational severity (effective tier).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {queueDepth.map((item) => (
              <div key={item.tier} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_48px] sm:items-center">
                <RiskBadge tier={item.tier} />
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${item.count === 0 ? 0 : Math.max(8, (item.count / maxDepth) * 100)}%` }}
                  />
                </div>
                <p className="text-right text-sm font-semibold">{item.count}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <SurgeIndicatorControl
          activeQueueDepth={activeCampaigns.length}
          baselineQueueDepth={baselineActiveCampaigns.length}
          className="self-start"
        />
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approval Rate by Tier</CardTitle>
            <CardDescription>Share of resolved campaigns approved within each effective risk tier.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {approvalByTier.map((entry) => (
              <div key={entry.tier} className="grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-3">
                <RiskBadge tier={entry.tier} />
                <p className="text-sm text-muted-foreground">
                  {entry.resolvedCount === 0
                    ? "No decisions yet"
                    : `${entry.approvedCount} of ${entry.resolvedCount} approved`}
                </p>
                <p className="text-right text-sm font-semibold">{percentOrDash(entry.rate)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>Escalations</span>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {escalation.rate}% of {escalation.totalCount}
              </Badge>
            </CardTitle>
            <CardDescription>Local escalation events and the reasons reviewers recorded.</CardDescription>
          </CardHeader>
          <CardContent>
            {escalation.reasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No escalations logged in the current queue.</p>
            ) : (
              <ul className="space-y-2">
                {escalation.reasons.map((reason, index) => (
                  <li key={index} className="rounded-md border bg-primary/5 p-3 text-sm leading-6">
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reviewer Capacity Signals</CardTitle>
            <CardDescription>Local prototype signals for staffing and SLA planning.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Signal label="Senior review load" value={seniorReviewCount.toString()} />
            <Signal
              label="Document requests"
              value={activeCampaigns.filter((campaign) => effectiveAction(campaign) === "REQUEST_DOCUMENTS").length.toString()}
            />
            <Signal
              label="Compliance holds"
              value={activeCampaigns.filter((campaign) => effectiveAction(campaign) === "ESCALATE_COMPLIANCE").length.toString()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-primary" aria-hidden="true" />
              Operating Note
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Keep AI triage advisory. During surge, prioritize escalations and high-risk campaigns first, then
              document-request batches for medium-risk submissions.
            </p>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function OpsMetric({
  label,
  value,
  detail,
  icon: Icon,
  source
}: {
  label: string;
  value: string;
  detail: string;
  icon: ElementType;
  source: MetricSource;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-primary" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        <MetricSourceBadge source={source} />
      </CardContent>
    </Card>
  );
}

function MetricSourceBadge({ source }: { source: MetricSource }) {
  const isLocal = source === "local";
  return (
    <Badge
      variant="outline"
      className={`mt-3 ${isLocal ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}
    >
      {isLocal ? "Local Ops Metric" : "Seeded Ops Metric"}
    </Badge>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-primary/5 p-4">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
