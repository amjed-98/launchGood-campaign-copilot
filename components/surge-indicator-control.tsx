"use client";

import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSurgeOverride } from "@/components/use-surge-indicator";
import { computeSurgeIndicator, type SurgeOverride, type SurgeState } from "@/lib/surge-indicator";
import { cn } from "@/lib/utils";

const states: SurgeState[] = ["Normal", "Monitoring", "Surge active"];

const stateStyles: Record<SurgeState, string> = {
  Normal: "border-emerald-200 bg-emerald-50 text-emerald-950",
  Monitoring: "border-amber-200 bg-amber-50 text-amber-950",
  "Surge active": "border-red-200 bg-red-50 text-red-950"
};

export function SurgeIndicatorControl({
  activeQueueDepth,
  baselineQueueDepth,
  className,
  compact = false
}: {
  activeQueueDepth: number;
  baselineQueueDepth: number;
  className?: string;
  compact?: boolean;
}) {
  const { override, setOverride } = useSurgeOverride();
  const indicator = computeSurgeIndicator({ activeQueueDepth, baselineQueueDepth, override });
  const deltaLabel = indicator.queueDeltaPercent >= 0 ? `+${indicator.queueDeltaPercent}%` : `${indicator.queueDeltaPercent}%`;

  return (
    <section className={cn("rounded-lg border p-4", stateStyles[indicator.state], className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Gauge className="size-4 shrink-0" aria-hidden="true" />
            <p className="text-sm font-semibold">Surge Indicator</p>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className={compact ? "text-2xl font-semibold" : "text-3xl font-semibold"}>{indicator.state}</p>
            <p className="text-sm opacity-75">
              {indicator.currentQueueDepth} active vs {indicator.baselineQueueDepth} baseline ({deltaLabel})
            </p>
          </div>
          <p className="mt-1 text-xs opacity-75">
            Operating signal only; queue order remains risk tier first, oldest within tier.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={override === null ? "default" : "outline"}
            size="sm"
            onClick={() => setOverride(null)}
          >
            Computed
          </Button>
          {states.map((state) => (
            <Button
              key={state}
              type="button"
              variant={override === state ? "default" : "outline"}
              size="sm"
              onClick={() => setOverride(state as SurgeOverride)}
            >
              {state}
            </Button>
          ))}
        </div>
      </div>
      {override ? (
        <p className="mt-3 text-xs opacity-75">Manual demo override active; computed state is {indicator.computedState}.</p>
      ) : null}
    </section>
  );
}
