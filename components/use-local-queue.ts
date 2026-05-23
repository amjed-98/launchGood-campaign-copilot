"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  createSeededQueue,
  ensureQueueInStorage,
  readQueueFromStorage,
  subscribeToLocalQueue,
  type LocalQueue
} from "@/lib/local-queue";
import type { Campaign } from "@/lib/types";

export function useLocalQueue(seedCampaigns?: Campaign[]): LocalQueue {
  useEffect(() => {
    ensureQueueInStorage(window.localStorage, seedCampaigns);
  }, [seedCampaigns]);

  return useSyncExternalStore(
    subscribeToLocalQueue,
    () => readQueueFromStorage(window.localStorage, seedCampaigns),
    () => createSeededQueue(seedCampaigns)
  );
}
