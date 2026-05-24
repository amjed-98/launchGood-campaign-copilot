import { classifyEmailEdit } from "@/lib/email-edit-bucket";
import { campaigns as seededCampaigns } from "@/lib/mock-campaigns";
import { getCurrentAssessment, getEffectiveRiskTier, riskWeight } from "@/lib/risk";
import type {
  Campaign,
  CampaignStatus,
  CreatorResponseOutcome,
  RecommendedAction,
  ReviewAssessment,
  ReviewEvent,
  RiskTier
} from "@/lib/types";

export const LOCAL_QUEUE_STORAGE_KEY = "launchgood-local-queue:v1";
export const LOCAL_QUEUE_UPDATED_EVENT = "launchgood-local-queue-updated";

export type QueueAction = "APPROVE" | "REJECT" | "REQUEST_DOCS" | "ESCALATE";

export type ReviewerQueueAction =
  | {
      type: "APPROVE";
      timestamp?: string;
    }
  | {
      type: "REJECT";
      reason?: string;
      timestamp?: string;
    }
  | {
      type: "REQUEST_DOCS";
      draft: string;
      aiDraft?: string;
      timestamp?: string;
    }
  | {
      type: "ESCALATE";
      reason?: string;
      timestamp?: string;
    }
  | {
      type: "DOCUMENT_GAP_OVERRIDE";
      reason?: string;
      timestamp?: string;
    }
  | {
      type: "REVIEWER_OVERRIDE";
      riskTier?: RiskTier;
      recommendedAction?: RecommendedAction;
      reason?: string;
      timestamp?: string;
    }
  | {
      type: "CREATOR_RESPONSE";
      outcome: CreatorResponseOutcome;
      note?: string;
      timestamp?: string;
    };

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
    const byRisk = riskWeight[getEffectiveRiskTier(b)] - riskWeight[getEffectiveRiskTier(a)];
    if (byRisk !== 0) return byRisk;
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });
}

export function isResolvedCampaign(campaign: Campaign) {
  return resolvedStatuses.has(campaign.status);
}

export function isAwaitingCreatorResponse(campaign: Campaign) {
  return campaign.status === "Waiting on creator";
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

export function applyReviewerAction(queue: LocalQueue, campaignId: string, action: ReviewerQueueAction): LocalQueue {
  return {
    records: queue.records.map((campaign) => {
      if (campaign.id !== campaignId) {
        return cloneCampaign(campaign);
      }

      if (isResolvedCampaign(campaign)) {
        throw new Error("Resolved campaigns cannot receive final reviewer actions.");
      }

      const nextCampaign = cloneCampaign(campaign);
      const timestamp = action.timestamp ?? new Date().toISOString();

      if (action.type === "REVIEWER_OVERRIDE") {
        const reason = requireReason(action.reason, "Resolution reason is required for reviewer override");
        const currentAssessment = getCurrentAssessment(nextCampaign);
        const nextAssessment = applyAssessmentOverride(currentAssessment, action);
        if (isSameAssessment(currentAssessment, nextAssessment)) {
          throw new Error("Reviewer override must change the risk tier or recommended action.");
        }
        return addReviewEvent(
          { ...nextCampaign, currentReviewAssessment: nextAssessment },
          {
            type: "REVIEWER_OVERRIDE",
            campaignId,
            note: reason,
            timestamp,
            assessment: nextAssessment
          }
        );
      }

      if (action.type === "DOCUMENT_GAP_OVERRIDE") {
        const reason = requireReason(action.reason, "Document gap override");
        if (nextCampaign.missingDocuments.includes("compliance_clearance")) {
          throw new Error("Compliance clearance cannot be bypassed by document gap override.");
        }
        return addReviewEvent(nextCampaign, {
          type: "DOCUMENT_GAP_OVERRIDE",
          campaignId,
          note: reason,
          timestamp,
          missingDocuments: [...nextCampaign.missingDocuments]
        });
      }

      if (action.type === "APPROVE") {
        if (hasMissingDocumentsBlockingApproval(nextCampaign)) {
          throw new Error("Approval is blocked by missing required documents.");
        }
        return addReviewEvent(
          { ...nextCampaign, status: "Approved" },
          {
            type: "APPROVAL",
            campaignId,
            note: "Campaign approved by reviewer.",
            timestamp
          }
        );
      }

      if (action.type === "REJECT") {
        const reason = requireReason(action.reason, "Resolution reason is required for rejection");
        return addReviewEvent(
          { ...nextCampaign, status: "Rejected" },
          {
            type: "REJECTION",
            campaignId,
            note: reason,
            timestamp
          }
        );
      }

      if (action.type === "ESCALATE") {
        const reason = requireReason(action.reason, "Resolution reason is required for escalation");
        return addReviewEvent(
          { ...nextCampaign, status: "Escalated" },
          {
            type: "ESCALATION",
            campaignId,
            note: reason,
            timestamp
          }
        );
      }

      if (action.type === "CREATOR_RESPONSE") {
        if (!isAwaitingCreatorResponse(nextCampaign)) {
          throw new Error("Simulated creator response is only available while waiting on the creator.");
        }
        const note = action.note?.trim() || `Creator response marked ${action.outcome}.`;
        const nextStatus: CampaignStatus = action.outcome === "complete" ? "In review" : "Waiting on creator";
        return addReviewEvent(
          { ...nextCampaign, status: nextStatus },
          {
            type: "SIMULATED_CREATOR_RESPONSE",
            campaignId,
            note,
            creatorResponseOutcome: action.outcome,
            timestamp
          }
        );
      }

      const emailEditBucket = classifyEmailEdit(action.aiDraft ?? "", action.draft).bucket;
      return addReviewEvent(
        { ...nextCampaign, status: "Waiting on creator" },
        {
          type: "SIMULATED_EMAIL_SEND",
          campaignId,
          note: "Simulated email send recorded the final draft. No external email was delivered.",
          draft: action.draft,
          emailEditBucket,
          timestamp
        }
      );
    })
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
    positiveSignals: [...campaign.positiveSignals],
    currentReviewAssessment: campaign.currentReviewAssessment
      ? { ...campaign.currentReviewAssessment }
      : undefined,
    reviewEvents: campaign.reviewEvents?.map((event) => ({
      ...event,
      missingDocuments: event.missingDocuments ? [...event.missingDocuments] : undefined,
      assessment: event.assessment ? { ...event.assessment } : undefined
    }))
  };
}

function applyAssessmentOverride(
  current: ReviewAssessment,
  override: { riskTier?: RiskTier; recommendedAction?: RecommendedAction }
): ReviewAssessment {
  return {
    riskTier: override.riskTier ?? current.riskTier,
    recommendedAction: override.recommendedAction ?? current.recommendedAction
  };
}

function isSameAssessment(a: ReviewAssessment, b: ReviewAssessment): boolean {
  return a.riskTier === b.riskTier && a.recommendedAction === b.recommendedAction;
}

function addReviewEvent(campaign: Campaign, event: ReviewEvent): Campaign {
  return {
    ...campaign,
    reviewEvents: [...(campaign.reviewEvents ?? []), event]
  };
}

function hasMissingDocumentsBlockingApproval(campaign: Campaign) {
  if (campaign.missingDocuments.length === 0) {
    return false;
  }

  if (campaign.missingDocuments.includes("compliance_clearance")) {
    return true;
  }

  return !campaign.reviewEvents?.some((event) => event.type === "DOCUMENT_GAP_OVERRIDE");
}

function requireReason(reason: string | undefined, label: string) {
  const trimmed = reason?.trim();
  if (!trimmed) {
    throw new Error(label.endsWith(".") ? label : `${label}.`);
  }
  return trimmed;
}
