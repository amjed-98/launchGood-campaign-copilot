import { AppShell } from "@/components/app-shell";
import { CampaignReviewRoute } from "@/components/campaign-review-route";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <CampaignReviewRoute campaignId={id} />
    </AppShell>
  );
}
