import { campaigns as seededCampaigns } from "@/lib/mock-campaigns";
import { riskWeight } from "@/lib/risk";
import type { Campaign, CampaignStatus } from "@/lib/types";

export const LOCAL_QUEUE_STORAGE_KEY = "launchgood-local-queue:v1";
export const LOCAL_QUEUE_UPDATED_EVENT = "launchgood-local-queue-updated";

export type QueueAction = "APPROVE" | "REJECT" | "REQUEST_DOCS" | "ESCALATE";

export type LocalQueue = {
  records: Campaign[];
};

const resolvedStatuses = new Set<CampaignStatus>(["Approved", "Rejected"]);

export function createSeededQueue(seeds: Campaign[] = seededCampaigns): LocalQueue {
  return {
    records: seeds.map(cloneCampaign)
  };
}

export function resetQueue(_queue: LocalQueue, seeds: Campaign[] = seededCampaigns): LocalQueue {
  return createSeededQueue(seeds);
}

export function sortByQueuePriority(campaigns: Campaign[]) {
  return [...campaigns].sort((a, b) => {
    const byRisk = riskWeight[b.riskTier] - riskWeight[a.riskTier];
    if (byRisk !== 0) return byRisk;
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });
}

export function isResolvedCampaign(campaign: Campaign) {
  return resolvedStatuses.has(campaign.status);
}

export function getActiveCampaigns(queue: LocalQueue) {
  return sortByQueuePriority(queue.records.filter((campaign) => !isResolvedCampaign(campaign)));
}

export function getResolvedCampaigns(queue: LocalQueue) {
  return sortByQueuePriority(queue.records.filter(isResolvedCampaign));
}

export function updateCampaignStatus(campaign: Campaign, action: QueueAction): Campaign {
  const nextStatusByAction: Record<QueueAction, CampaignStatus> = {
    APPROVE: "Approved",
    REJECT: "Rejected",
    REQUEST_DOCS: "Waiting on creator",
    ESCALATE: "Escalated"
  };

  return {
    ...cloneCampaign(campaign),
    status: nextStatusByAction[action]
  };
}

export function updateQueueCampaign(queue: LocalQueue, campaignId: string, action: QueueAction): LocalQueue {
  return {
    records: queue.records.map((campaign) =>
      campaign.id === campaignId ? updateCampaignStatus(campaign, action) : cloneCampaign(campaign)
    )
  };
}

export function appendCampaignToQueue(queue: LocalQueue, campaign: Campaign): LocalQueue {
  return {
    records: [...queue.records.map(cloneCampaign), cloneCampaign(campaign)]
  };
}

export function findQueuedCampaign(queue: LocalQueue, campaignId: string) {
  return queue.records.find((campaign) => campaign.id === campaignId);
}

export function readQueueFromStorage(storage: Pick<Storage, "getItem">, seeds: Campaign[] = seededCampaigns): LocalQueue {
  const saved = storage.getItem(LOCAL_QUEUE_STORAGE_KEY);
  if (!saved) {
    return createSeededQueue(seeds);
  }

  try {
    const parsed = JSON.parse(saved) as LocalQueue;
    if (!parsed || !Array.isArray(parsed.records)) {
      return createSeededQueue(seeds);
    }
    return {
      records: parsed.records.map(cloneCampaign)
    };
  } catch {
    return createSeededQueue(seeds);
  }
}

export function writeQueueToStorage(storage: Pick<Storage, "setItem">, queue: LocalQueue) {
  storage.setItem(LOCAL_QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

export function ensureQueueInStorage(storage: Pick<Storage, "getItem" | "setItem">, seeds: Campaign[] = seededCampaigns) {
  if (!storage.getItem(LOCAL_QUEUE_STORAGE_KEY)) {
    writeQueueToStorage(storage, createSeededQueue(seeds));
  }
}

export function notifyLocalQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LOCAL_QUEUE_UPDATED_EVENT));
  }
}

export function subscribeToLocalQueue(onStoreChange: () => void) {
  window.addEventListener(LOCAL_QUEUE_UPDATED_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(LOCAL_QUEUE_UPDATED_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function cloneCampaign(campaign: Campaign): Campaign {
  return {
    ...campaign,
    documentsSubmitted: [...campaign.documentsSubmitted],
    missingDocuments: [...campaign.missingDocuments],
    riskSignals: [...campaign.riskSignals],
    positiveSignals: [...campaign.positiveSignals]
  };
}
