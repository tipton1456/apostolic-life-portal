import {
  buildConicGradient,
  polarToPercent,
  positionPieSegments,
  type PieSegment,
} from "@/app/projects/project-pie-chart-utils";

const SEGMENT_COLORS = {
  completed: "#a3e635",
  overdue: "#fb923c",
  atRisk: "#fbbf24",
  outstanding: "#7dd3fc",
} as const;

export default function TaskBreakdownPieCard({
  completedTasks,
  overdueTasks,
  atRiskTasks,
  openOutstandingTasks,
  totalTasks,
}: {
  completedTasks: number;
  overdueTasks: number;
  atRiskTasks: number;
  openOutstandingTasks: number;
  totalTasks: number;
}) {
  const segments: PieSegment[] = [
    {
      key: "completed",
      label: "Completed",
      value: completedTasks,
      color: SEGMENT_COLORS.completed,
    },
    {
      key: "overdue",
      label: "Overdue",
      value: overdueTasks,
      color: SEGMENT_COLORS.overdue,
      detail: "past due",
    },
    {
      key: "atRisk",
      label: "At Risk",
      value: atRiskTasks,
      color: SEGMENT_COLORS.atRisk,
      detail: "due soon",
    },
    {
      key: "outstanding",
      label: "Outstanding",
      value: openOutstandingTasks,
      color: SEGMENT_COLORS.outstanding,
      detail: "open tasks",
    },
  ];

  const positionedSegments = positionPieSegments(segments, totalTasks);
  const gradient = buildConicGradient(segments, totalTasks);

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-sky-400/[0.08] via-white/[0.03] to-transparent p-6 sm:p-8">
      <p className="text-center text-xs uppercase tracking-[0.22em] text-neutral-500">
        Task Breakdown
      </p>

      <div className="relative mx-auto mt-6 aspect-square w-full max-w-[22rem]">
        <div
          className="absolute inset-[14%] rounded-full shadow-[0_0_48px_rgba(125,211,252,0.12)]"
          style={{ background: gradient }}
          aria-hidden="true"
        />
        <div className="absolute inset-[30%] flex flex-col items-center justify-center rounded-full border border-white/10 bg-neutral-950/95 text-center shadow-inner">
          <span className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {totalTasks}
          </span>
          <span className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-500">
            Tasks
          </span>
        </div>

        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {positionedSegments.map((segment) => {
            const anchor = polarToPercent(segment.midAngle, 34);
            const callout = polarToPercent(segment.midAngle, 47);

            return (
              <line
                key={`${segment.key}-line`}
                x1={anchor.x}
                y1={anchor.y}
                x2={callout.x}
                y2={callout.y}
                stroke={segment.color}
                strokeOpacity={0.55}
                strokeWidth="0.6"
              />
            );
          })}
        </svg>

        {positionedSegments.map((segment) => {
          const callout = polarToPercent(segment.midAngle, 49);

          return (
            <div
              key={segment.key}
              className="absolute max-w-[9rem] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${callout.x}%`, top: `${callout.y}%` }}
            >
              <div className="rounded-2xl border border-white/10 bg-neutral-950/90 px-3 py-2 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                    {segment.label}
                  </span>
                </div>
                <p className="mt-1 text-lg font-bold tabular-nums text-white">
                  {segment.value}
                </p>
                {segment.detail ? (
                  <p className="text-[11px] text-neutral-500">{segment.detail}</p>
                ) : null}
              </div>
            </div>
          );
        })}

        {totalTasks === 0 ? (
          <p className="absolute inset-x-0 bottom-0 text-center text-sm text-neutral-500">
            No tasks on this project yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}