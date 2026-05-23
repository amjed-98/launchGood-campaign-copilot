import { AppShell } from "@/components/app-shell";
import { LocalQueueDashboard } from "@/components/local-queue-dashboard";
import { campaigns } from "@/lib/mock-campaigns";

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

      <LocalQueueDashboard seedCampaigns={campaigns} />
    </AppShell>
  );
}
