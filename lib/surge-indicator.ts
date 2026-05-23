export const SURGE_OVERRIDE_STORAGE_KEY = "launchgood-surge-override:v1";
export const SURGE_OVERRIDE_UPDATED_EVENT = "launchgood-surge-override-updated";

export type SurgeState = "Normal" | "Monitoring" | "Surge active";
export type SurgeOverride = SurgeState;

export type SurgeIndicator = {
  state: SurgeState;
  computedState: SurgeState;
  override: SurgeOverride | null;
  currentQueueDepth: number;
  baselineQueueDepth: number;
  queueDeltaPercent: number;
  operatingSignalOnly: true;
};

const surgeStates: SurgeState[] = ["Normal", "Monitoring", "Surge active"];

export function computeSurgeIndicator({
  activeQueueDepth,
  baselineQueueDepth,
  override = null
}: {
  activeQueueDepth: number;
  baselineQueueDepth: number;
  override?: SurgeOverride | null;
}): SurgeIndicator {
  const safeBaseline = Math.max(1, baselineQueueDepth);
  const queueDeltaPercent = Math.round(((activeQueueDepth - safeBaseline) / safeBaseline) * 100);
  const computedState = getComputedState(activeQueueDepth, safeBaseline);

  return {
    state: override ?? computedState,
    computedState,
    override,
    currentQueueDepth: activeQueueDepth,
    baselineQueueDepth: safeBaseline,
    queueDeltaPercent,
    operatingSignalOnly: true
  };
}

export function readSurgeOverrideFromStorage(storage: Pick<Storage, "getItem">): SurgeOverride | null {
  const saved = storage.getItem(SURGE_OVERRIDE_STORAGE_KEY);
  if (!saved) {
    return null;
  }

  try {
    const parsed = JSON.parse(saved) as unknown;
    return isSurgeState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSurgeOverrideToStorage(storage: Pick<Storage, "setItem">, override: SurgeOverride) {
  storage.setItem(SURGE_OVERRIDE_STORAGE_KEY, JSON.stringify(override));
}

export function clearSurgeOverrideFromStorage(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(SURGE_OVERRIDE_STORAGE_KEY);
}

export function notifySurgeOverrideChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SURGE_OVERRIDE_UPDATED_EVENT));
  }
}

export function subscribeToSurgeOverride(onStoreChange: () => void) {
  window.addEventListener(SURGE_OVERRIDE_UPDATED_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(SURGE_OVERRIDE_UPDATED_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getComputedState(activeQueueDepth: number, baselineQueueDepth: number): SurgeState {
  if (activeQueueDepth <= baselineQueueDepth) {
    return "Normal";
  }

  if (activeQueueDepth >= baselineQueueDepth * 2) {
    return "Surge active";
  }

  return "Monitoring";
}

function isSurgeState(value: unknown): value is SurgeState {
  return typeof value === "string" && surgeStates.includes(value as SurgeState);
}
