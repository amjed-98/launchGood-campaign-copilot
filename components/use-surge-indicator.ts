"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  clearSurgeOverrideFromStorage,
  notifySurgeOverrideChanged,
  readSurgeOverrideFromStorage,
  subscribeToSurgeOverride,
  writeSurgeOverrideToStorage,
  type SurgeOverride
} from "@/lib/surge-indicator";

export function useSurgeOverride() {
  const override = useSyncExternalStore(
    subscribeToSurgeOverride,
    () => readSurgeOverrideFromStorage(window.localStorage),
    () => null
  );

  const setOverride = useCallback((nextOverride: SurgeOverride | null) => {
    if (nextOverride) {
      writeSurgeOverrideToStorage(window.localStorage, nextOverride);
    } else {
      clearSurgeOverrideFromStorage(window.localStorage);
    }
    notifySurgeOverrideChanged();
  }, []);

  return { override, setOverride };
}
