import { OpsDashboard } from "@/components/ops-dashboard";
import { campaigns } from "@/lib/mock-campaigns";

export default function OpsPage() {
  return <OpsDashboard seedCampaigns={campaigns} />;
}
