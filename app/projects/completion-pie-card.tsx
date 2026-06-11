export default function CompletionPieCard({
  percent,
  completedTasks,
  totalTasks,
}: {
  percent: number;
  completedTasks: number;
  totalTasks: number;
}) {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (clampedPercent / 100) * circumference;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
        Completion
      </p>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative shrink-0">
          <svg
            viewBox="0 0 100 100"
            className="h-24 w-24 -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="10"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#a3e635"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-lime-300">{clampedPercent}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-100">
            {completedTasks} of {totalTasks} tasks done
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            {totalTasks === 0
              ? "Add tasks to start tracking completion."
              : `${totalTasks - completedTasks} still open`}
          </p>
        </div>
      </div>
    </div>
  );
}