"use client";

import { useState } from "react";
import {
  calculateTimelineProgressPercent,
  getMilestoneTimelinePosition,
  type ProjectMilestone,
} from "@/lib/project-milestone-utils";
import { formatDisplayDate } from "@/lib/project-management-utils";

export default function ProjectMilestoneTimelineProgress({
  startDate,
  targetEndDate,
  milestones,
}: {
  startDate: string | null;
  targetEndDate: string | null;
  milestones: ProjectMilestone[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const progressPercent = calculateTimelineProgressPercent(startDate, targetEndDate);
  const hasTimeline = Boolean(startDate && targetEndDate);

  return (
    <div
      className={`mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent transition-all duration-300 ${
        isExpanded ? "p-6 sm:p-8" : "p-0"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-2 ${
          isExpanded ? "" : "border-b border-white/10 px-3 py-1.5"
        }`}
      >
        <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">
          Timeline Progress
        </p>
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? "Collapse timeline progress details"
              : "Expand timeline progress details"
          }
          className={`inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-neutral-950/70 font-semibold text-lime-300 transition hover:border-lime-300/40 hover:bg-lime-400/10 ${
            isExpanded ? "h-8 w-8 text-lg" : "h-7 w-7 text-base"
          }`}
        >
          {isExpanded ? "−" : "+"}
        </button>
      </div>

      {!hasTimeline ? (
        isExpanded ? (
          <p className="mt-4 text-sm text-neutral-400">
            Add project start and target end dates to track timeline progress.
          </p>
        ) : null
      ) : (
        <>
          {isExpanded ? (
            <div className="mt-4 flex items-center justify-between gap-4 text-sm text-neutral-400">
              <span>{formatDisplayDate(startDate)}</span>
              <span>{formatDisplayDate(targetEndDate)}</span>
            </div>
          ) : null}

          <div
            className={`relative rounded-full bg-white/10 ${
              isExpanded ? "mt-4 h-4" : "mx-3 mb-2 mt-2 h-5"
            }`}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-lime-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
              {progressPercent}%
            </span>
            {isExpanded
              ? milestones.map((milestone) => {
                  const position = getMilestoneTimelinePosition(
                    startDate,
                    targetEndDate,
                    milestone.milestoneDate,
                  );

                  return (
                    <div
                      key={milestone.id}
                      className="group absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${position}%` }}
                      title={`${milestone.name} · ${formatDisplayDate(milestone.milestoneDate)}`}
                    >
                      <span className="block h-3 w-3 rounded-full border-2 border-neutral-950 bg-sky-300" />
                      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-neutral-900 px-2 py-1 text-[10px] font-medium text-neutral-200 group-hover:block">
                        {milestone.name}
                      </span>
                    </div>
                  );
                })
              : null}
          </div>

          {isExpanded ? (
            <p className="mt-3 text-sm text-neutral-400">
              Calendar progress from project start to target end
              {milestones.length > 0
                ? ` with ${milestones.length} milestone${milestones.length === 1 ? "" : "s"} marked on the bar.`
                : "."}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}