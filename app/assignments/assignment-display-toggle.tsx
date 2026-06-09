"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type AssignmentDisplay = "list" | "calendar";
type AssignmentView = "mine" | "family";

const DISPLAY_OPTIONS: Array<{ label: string; value: AssignmentDisplay }> = [
  { label: "List View", value: "list" },
  { label: "Calendar View", value: "calendar" },
];

export default function AssignmentDisplayToggle({
  count,
  display,
  view,
}: {
  count: number;
  display: AssignmentDisplay;
  view: AssignmentView;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingDisplay, setPendingDisplay] =
    useState<AssignmentDisplay | null>(null);
  const activeDisplay = pendingDisplay ?? display;
  const isNavigating = isPending || pendingDisplay !== null;

  function handleDisplayChange(nextDisplay: AssignmentDisplay) {
    if (nextDisplay === display || isNavigating) return;

    setPendingDisplay(nextDisplay);
    startTransition(() => {
      router.push(
        `/assignments?view=${view}&display=${nextDisplay}&count=${count}`,
      );
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {DISPLAY_OPTIONS.map((option) => {
        const isActive = option.value === activeDisplay;
        const isLoading = option.value === pendingDisplay;

        return (
          <button
            key={option.value}
            type="button"
            disabled={isNavigating}
            onClick={() => handleDisplayChange(option.value)}
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
