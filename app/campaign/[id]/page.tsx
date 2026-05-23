import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CampaignReviewView } from "@/components/campaign-review-view";
import { getCampaign } from "@/lib/mock-campaigns";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = getCampaign(id);

  if (!campaign) {
    notFound();
  }

  return (
    <AppShell>
      <CampaignReviewView campaign={campaign} />
    </AppShell>
  );
}
