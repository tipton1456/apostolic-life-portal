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
  const progressPercent = calculateTimelineProgressPercent(startDate, targetEndDate);
  const hasTimeline = Boolean(startDate && targetEndDate);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
        Timeline Progress
      </p>
      {!hasTimeline ? (
        <p className="mt-4 text-sm text-neutral-400">
          Add project start and target end dates to track timeline progress.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-4 text-sm text-neutral-400">
            <span>{formatDisplayDate(startDate)}</span>
            <span className="text-lg font-bold text-lime-300">{progressPercent}%</span>
            <span>{formatDisplayDate(targetEndDate)}</span>
          </div>
          <div className="relative mt-4 h-4 rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-lime-400 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
            {milestones.map((milestone) => {
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
            })}
          </div>
          <p className="mt-3 text-sm text-neutral-400">
            Calendar progress from project start to target end
            {milestones.length > 0
              ? ` with ${milestones.length} milestone${milestones.length === 1 ? "" : "s"} marked on the bar.`
              : "."}
          </p>
        </>
      )}
    </div>
  );
}