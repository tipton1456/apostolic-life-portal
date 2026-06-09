"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type EventsView = "list" | "calendar";

const VIEW_OPTIONS: Array<{ label: string; value: EventsView }> = [
  { label: "List View", value: "list" },
  { label: "Calendar View", value: "calendar" },
];

export default function EventsViewToggle({ view }: { view: EventsView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingView, setPendingView] = useState<EventsView | null>(null);
  const activeView = pendingView ?? view;
  const isNavigating = isPending || pendingView !== null;

  function handleViewChange(nextView: EventsView) {
    if (nextView === view || isNavigating) return;

    setPendingView(nextView);
    startTransition(() => {
      router.push(`/events?view=${nextView}`);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {VIEW_OPTIONS.map((option) => {
        const isActive = option.value === activeView;
        const isLoading = option.value === pendingView;

        return (
          <button
            key={option.value}
            type="button"
            disabled={isNavigating}
            onClick={() => handleViewChange(option.value)}
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
