"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GivingRange } from "@/lib/giving";

type GivingRangeOption = {
  label: string;
  value: GivingRange;
};

export default function GivingRangeFilter({
  currentRange,
  options,
}: {
  currentRange: GivingRange;
  options: GivingRangeOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingRange, setPendingRange] = useState<GivingRange | null>(null);

  const activeRange = pendingRange ?? currentRange;
  const isNavigating = isPending || pendingRange !== null;

  function handleRangeChange(range: GivingRange) {
    if (range === currentRange || isNavigating) {
      return;
    }

    setPendingRange(range);
    startTransition(() => {
      router.push(`/giving?range=${range}`);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.value === activeRange;
        const isLoading = option.value === pendingRange;

        return (
          <button
            key={option.value}
            type="button"
            disabled={isNavigating}
            onClick={() => handleRangeChange(option.value)}
            className={
              isActive
                ? "inline-flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition disabled:cursor-wait"
                : "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-lime-400/60 hover:text-lime-300 disabled:cursor-wait disabled:opacity-60"
            }
          >
            {isLoading ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950/30 border-t-neutral-950"
              />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
