import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import type { ElementType } from "react";
import { AppShell } from "@/components/app-shell";
import { CampaignQueueTable } from "@/components/campaign-queue-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { campaigns } from "@/lib/mock-campaigns";
import type { RiskTier } from "@/lib/types";

const summaryCards: Array<{ label: string; tier?: RiskTier; icon: ElementType }> = [
  { label: "Escalations", tier: "ESCALATE", icon: ShieldAlert },
  { label: "High risk", tier: "HIGH", icon: AlertTriangle },
  { label: "Medium risk", tier: "MEDIUM", icon: Clock3 },
  { label: "Low risk", tier: "LOW", icon: CheckCircle2 }
];

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-primary">Trust & Safety queue</p>
          <h1 className="text-3xl font-semibold tracking-normal">Campaign submissions</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            AI triage is advisory only. Reviewers own every approval, document request, and escalation.
          </p>
        </div>
        <div className="rounded-md border bg-white px-4 py-3 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="font-medium">Human decision required</p>
          <p className="text-muted-foreground">No campaign is approved or rejected automatically.</p>
        </div>
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(({ label, tier, icon: Icon }) => {
          const count = tier ? campaigns.filter((campaign) => campaign.riskTier === tier).length : campaigns.length;
          return (
            <Card key={label}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <CampaignQueueTable campaigns={campaigns} />
    </AppShell>
  );
}
