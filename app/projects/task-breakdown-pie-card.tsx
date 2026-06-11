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
  const segments = [
    {
      key: "completed",
      label: "Completed",
      value: completedTasks,
      color: SEGMENT_COLORS.completed,
    },
    { key: "overdue", label: "Overdue", value: overdueTasks, color: SEGMENT_COLORS.overdue },
    { key: "atRisk", label: "At Risk", value: atRiskTasks, color: SEGMENT_COLORS.atRisk },
    {
      key: "outstanding",
      label: "Outstanding",
      value: openOutstandingTasks,
      color: SEGMENT_COLORS.outstanding,
    },
  ] as const;

  const gradient = buildConicGradient(segments, totalTasks);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
        Task Breakdown
      </p>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0">
          <div
            className="h-full w-full rounded-full"
            style={{ background: gradient }}
            aria-hidden="true"
          />
          <div className="absolute inset-[14px] flex items-center justify-center rounded-full bg-neutral-950">
            <span className="text-sm font-bold text-neutral-100">{totalTasks}</span>
          </div>
        </div>
        <div className="min-w-0 space-y-2">
          {segments.map((segment) => (
            <div key={segment.key} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-neutral-300">{segment.label}</span>
              </div>
              <span className="font-semibold tabular-nums text-neutral-100">
                {segment.value}
              </span>
            </div>
          ))}
          <p className="pt-1 text-xs text-neutral-500">
            {totalTasks === 0
              ? "No tasks on this project yet."
              : "At Risk tasks are open and due within two days."}
          </p>
        </div>
      </div>
    </div>
  );
}

function buildConicGradient(
  segments: ReadonlyArray<{ value: number; color: string }>,
  total: number,
) {
  if (total <= 0) {
    return "conic-gradient(rgba(255,255,255,0.1) 0deg 360deg)";
  }

  let currentPercent = 0;
  const stops: string[] = [];

  for (const segment of segments) {
    if (segment.value <= 0) continue;

    const slicePercent = (segment.value / total) * 100;
    const nextPercent = currentPercent + slicePercent;
    stops.push(`${segment.color} ${currentPercent}% ${nextPercent}%`);
    currentPercent = nextPercent;
  }

  if (stops.length === 0) {
    return "conic-gradient(rgba(255,255,255,0.1) 0deg 360deg)";
  }

  if (currentPercent < 100) {
    stops.push(`rgba(255,255,255,0.1) ${currentPercent}% 100%`);
  }

  return `conic-gradient(${stops.join(", ")})`;
}