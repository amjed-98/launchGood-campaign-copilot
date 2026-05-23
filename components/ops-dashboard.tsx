"use client";

import { Activity, AlertTriangle, BarChart3, Clock3, RotateCcw } from "lucide-react";
import type { ElementType } from "react";
import { AppShell } from "@/components/app-shell";
import { RiskBadge } from "@/components/risk-badge";
import { SurgeIndicatorControl } from "@/components/surge-indicator-control";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocalQueue } from "@/components/use-local-queue";
import { createSeededQueue, getActiveCampaigns } from "@/lib/local-queue";
import {
  formatHours,
  getAiOverrideRate,
  getAverageTimeToDecisionHours,
  getQueueDepthByTier
} from "@/lib/ops-metrics";
import { hoursSinceSubmitted } from "@/lib/risk";
import type { Campaign } from "@/lib/types";

export function OpsDashboard({ seedCampaigns }: { seedCampaigns: Campaign[] }) {
  const queue = useLocalQueue(seedCampaigns);
  const activeCampaigns = getActiveCampaigns(queue);
  const baselineActiveCampaigns = getActiveCampaigns(createSeededQueue(seedCampaigns));
  const queueDepth = getQueueDepthByTier(activeCampaigns);
  const averageDecisionHours = getAverageTimeToDecisionHours(queue.records);
  const overrideRate = getAiOverrideRate(queue.records);
  const overdueCount = activeCampaigns.filter((campaign) => hoursSinceSubmitted(campaign.submittedAt) > campaign.slaHours).length;
  const seniorReviewCount = activeCampaigns.filter((campaign) =>
    campaign.recommendedAction === "SENIOR_REVIEW" || campaign.recommendedAction === "ESCALATE_COMPLIANCE"
  ).length;
  const maxDepth = Math.max(...queueDepth.map((item) => item.count), 1);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Operations summary</p>
        <h1 className="text-3xl font-semibold tracking-normal">Trust & Safety control room</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Local operating metrics for triage load, reviewer throughput, and surge readiness.
        </p>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsMetric
          label="Active queue depth"
          value={activeCampaigns.length.toString()}
          detail={`${overdueCount} past SLA`}
          icon={BarChart3}
        />
        <OpsMetric
          label="Avg. time-to-decision"
          value={formatHours(averageDecisionHours)}
          detail="Seeded estimate from local queue mix"
          icon={Clock3}
        />
        <OpsMetric
          label="AI override rate"
          value={`${overrideRate}%`}
          detail="Seeded proxy until overrides land"
          icon={RotateCcw}
        />
        <OpsMetric
          label="Senior review load"
          value={seniorReviewCount.toString()}
          detail="Active high-touch campaigns"
          icon={AlertTriangle}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <Card>
          <CardHeader>
            <CardTitle>Queue Depth by Tier</CardTitle>
            <CardDescription>Active submissions ordered by operational severity.</CardDescription>
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

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reviewer Capacity Signals</CardTitle>
            <CardDescription>Local prototype signals for staffing and SLA planning.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Signal label="Elevated-risk queue" value={activeCampaigns.filter((campaign) => campaign.riskTier !== "LOW").length.toString()} />
            <Signal label="Document requests" value={activeCampaigns.filter((campaign) => campaign.recommendedAction === "REQUEST_DOCUMENTS").length.toString()} />
            <Signal label="Compliance holds" value={activeCampaigns.filter((campaign) => campaign.recommendedAction === "ESCALATE_COMPLIANCE").length.toString()} />
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
              Keep AI triage advisory. During surge, prioritize escalations and high-risk campaigns first, then document-request batches for medium-risk submissions.
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
  icon: Icon
}: {
  label: string;
  value: string;
  detail: string;
  icon: ElementType;
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
      </CardContent>
    </Card>
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
