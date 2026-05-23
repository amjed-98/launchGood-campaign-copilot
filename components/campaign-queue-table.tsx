import Link from "next/link";
import { Clock } from "lucide-react";
import { RiskBadge } from "@/components/risk-badge";
import { formatMoney, hoursSinceSubmitted, sortByRisk } from "@/lib/risk";
import type { Campaign } from "@/lib/types";

function formatQueueTime(hours: number) {
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))}m`;
  }

  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function CampaignQueueTable({
  campaigns,
  showStatus = false
}: {
  campaigns: Campaign[];
  showStatus?: boolean;
}) {
  const sortedCampaigns = sortByRisk(campaigns);

  if (sortedCampaigns.length === 0) {
    return (
      <div className="rounded-lg border bg-white px-4 py-10 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <p className="text-sm font-medium">No campaigns in this view</p>
        <p className="mt-1 text-sm text-muted-foreground">Switch views or reset the local demo queue.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
          <thead className="bg-primary/5 text-xs uppercase tracking-normal text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Campaign</th>
              <th className="px-4 py-3 font-semibold">Creator location</th>
              <th className="px-4 py-3 font-semibold">Goal</th>
              <th className="px-4 py-3 font-semibold">Risk tier</th>
              {showStatus ? <th className="px-4 py-3 font-semibold">Status</th> : null}
              <th className="px-4 py-3 font-semibold">Time in queue</th>
              <th className="px-4 py-3 font-semibold">AI summary</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedCampaigns.map((campaign) => {
              const elapsed = hoursSinceSubmitted(campaign.submittedAt);
              const isOverdue = elapsed > campaign.slaHours;

              return (
                <tr key={campaign.id} className="align-middle hover:bg-primary/5">
                  <td className="max-w-[300px] px-4 py-4">
                    <Link href={`/campaign/${campaign.id}`} className="font-medium text-foreground hover:text-primary">
                      {campaign.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{campaign.creatorName}</p>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{campaign.creatorLocation}</td>
                  <td className="px-4 py-4 font-medium">{formatMoney(campaign.goalAmount)}</td>
                  <td className="px-4 py-4">
                    <RiskBadge tier={campaign.riskTier} />
                  </td>
                  {showStatus ? <td className="px-4 py-4 text-muted-foreground">{campaign.status}</td> : null}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <Clock
                        className={isOverdue ? "size-4 text-rose-600" : "size-4 text-muted-foreground"}
                        aria-hidden="true"
                      />
                      <span className={isOverdue ? "font-medium text-rose-700" : undefined}>
                        {formatQueueTime(elapsed)}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-[420px] px-4 py-4 text-muted-foreground">
                    <p className="line-clamp-1">{campaign.reviewerNote}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
