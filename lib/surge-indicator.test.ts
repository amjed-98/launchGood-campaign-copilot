import { describe, expect, it } from "vitest";
import {
  computeSurgeIndicator,
  readSurgeOverrideFromStorage,
  SURGE_OVERRIDE_STORAGE_KEY,
  writeSurgeOverrideToStorage
} from "@/lib/surge-indicator";
import type { SurgeOverride } from "@/lib/surge-indicator";

function storageWith(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) {
    values.set(SURGE_OVERRIDE_STORAGE_KEY, initial);
  }

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

describe("Surge Indicator", () => {
  it("computes normal, monitoring, and surge states from queue volume against the seeded baseline", () => {
    expect(computeSurgeIndicator({ activeQueueDepth: 5, baselineQueueDepth: 5 }).state).toBe("Normal");
    expect(computeSurgeIndicator({ activeQueueDepth: 7, baselineQueueDepth: 5 }).state).toBe("Monitoring");
    expect(computeSurgeIndicator({ activeQueueDepth: 10, baselineQueueDepth: 5 }).state).toBe("Surge active");
  });

  it("returns run-rate context without changing queue priority semantics", () => {
    const indicator = computeSurgeIndicator({ activeQueueDepth: 8, baselineQueueDepth: 5 });

    expect(indicator.currentQueueDepth).toBe(8);
    expect(indicator.baselineQueueDepth).toBe(5);
    expect(indicator.queueDeltaPercent).toBe(60);
    expect(indicator.operatingSignalOnly).toBe(true);
  });

  it("persists manual demo overrides and ignores invalid stored values", () => {
    const storage = storageWith();
    const override: SurgeOverride = "Surge active";

    writeSurgeOverrideToStorage(storage, override);

    expect(readSurgeOverrideFromStorage(storage)).toBe(override);
    expect(readSurgeOverrideFromStorage(storageWith('"Escalated"'))).toBeNull();
    expect(computeSurgeIndicator({ activeQueueDepth: 5, baselineQueueDepth: 5, override }).state).toBe("Surge active");
  });
});
