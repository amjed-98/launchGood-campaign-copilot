"use client";

import { AlertTriangle, CheckCircle2, Clock3, RotateCcw, ShieldAlert } from "lucide-react";
import { useMemo, useState, type ElementType } from "react";
import { CampaignQueueTable } from "@/components/campaign-queue-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocalQueue } from "@/components/use-local-queue";
import {
  getActiveCampaigns,
  notifyLocalQueueChanged,
  resetQueue,
  sortByQueuePriority,
  writeQueueToStorage
} from "@/lib/local-queue";
import type { Campaign, RiskTier } from "@/lib/types";

const summaryCards: Array<{ label: string; tier: RiskTier; icon: ElementType }> = [
  { label: "Escalations", tier: "ESCALATE", icon: ShieldAlert },
  { label: "High risk", tier: "HIGH", icon: AlertTriangle },
  { label: "Medium risk", tier: "MEDIUM", icon: Clock3 },
  { label: "Low risk", tier: "LOW", icon: CheckCircle2 }
];

type QueueView = "active" | "all";

export function LocalQueueDashboard({ seedCampaigns }: { seedCampaigns: Campaign[] }) {
  const queue = useLocalQueue(seedCampaigns);
  const [view, setView] = useState<QueueView>("active");

  const activeCampaigns = useMemo(() => getActiveCampaigns(queue), [queue]);
  const visibleCampaigns = useMemo(
    () => (view === "active" ? activeCampaigns : sortByQueuePriority(queue.records)),
    [activeCampaigns, queue.records, view]
  );

  function handleReset() {
    const nextQueue = resetQueue(queue, seedCampaigns);
    writeQueueToStorage(window.localStorage, nextQueue);
    notifyLocalQueueChanged();
    setView("active");
  }

  return (
    <>
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(({ label, tier, icon: Icon }) => {
          const count = activeCampaigns.filter((campaign) => campaign.riskTier === tier).length;
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

      <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-md border bg-muted/40 p-1">
          <Button
            type="button"
            variant={view === "active" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("active")}
          >
            Active queue
          </Button>
          <Button
            type="button"
            variant={view === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("all")}
          >
            All records
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <p className="text-sm text-muted-foreground">
            {activeCampaigns.length} active of {queue.records.length} local records
          </p>
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset
          </Button>
        </div>
      </div>

      <CampaignQueueTable campaigns={visibleCampaigns} showStatus={view === "all"} />
    </>
  );
}
