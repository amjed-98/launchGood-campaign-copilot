"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  createSeededQueue,
  ensureQueueInStorage,
  readQueueFromStorage,
  subscribeToLocalQueue,
  type LocalQueue
} from "@/lib/local-queue";
import type { Campaign } from "@/lib/types";

export function useLocalQueue(seedCampaigns?: Campaign[]): LocalQueue {
  const serverSnapshotRef = useRef<LocalQueue | null>(null);
  const clientSnapshotRef = useRef<LocalQueue | null>(null);

  useEffect(() => {
    ensureQueueInStorage(window.localStorage, seedCampaigns);
  }, [seedCampaigns]);

  return useSyncExternalStore(
    subscribeToLocalQueue,
    () => {
      const next = readQueueFromStorage(window.localStorage, seedCampaigns);
      // Only swap the reference if the contents actually changed
      if (
        clientSnapshotRef.current === null ||
        JSON.stringify(clientSnapshotRef.current) !== JSON.stringify(next)
      ) {
        clientSnapshotRef.current = next;
      }
      return clientSnapshotRef.current;
    },
    () => {
      if (!serverSnapshotRef.current) {
        serverSnapshotRef.current = createSeededQueue(seedCampaigns);
      }
      return serverSnapshotRef.current;
    }
  );
}
