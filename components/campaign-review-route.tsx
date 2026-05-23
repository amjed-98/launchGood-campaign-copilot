"use client";

import Link from "next/link";
import { CampaignReviewView } from "@/components/campaign-review-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocalQueue } from "@/components/use-local-queue";
import { campaigns } from "@/lib/mock-campaigns";

export function CampaignReviewRoute({ campaignId }: { campaignId: string }) {
  const queue = useLocalQueue(campaigns);
  const campaign = queue.records.find((record) => record.id === campaignId);

  if (!campaign) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign not found</CardTitle>
          <CardDescription>
            This campaign is not present in the unified local queue. It may have been removed by resetting local demo
            state.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard">Back to queue</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <CampaignReviewView campaign={campaign} />;
}
