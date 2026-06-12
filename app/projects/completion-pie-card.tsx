import ExpandablePieCard from "@/app/projects/expandable-pie-card";
import type { PieSegment } from "@/app/projects/project-pie-chart-utils";

export default function CompletionPieCard({
  percent,
  completedTasks,
  totalTasks,
  isExpanded,
  onToggle,
}: {
  percent: number;
  completedTasks: number;
  totalTasks: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const openTasks = Math.max(totalTasks - completedTasks, 0);
  const segments: PieSegment[] = [
    {
      key: "completed",
      label: "Completed",
      value: completedTasks,
      color: "#a3e635",
      detail: "tasks done",
    },
    {
      key: "open",
      label: "Open",
      value: openTasks,
      color: "rgba(255,255,255,0.14)",
      detail: "still open",
    },
  ];

  return (
    <ExpandablePieCard
      centerValue={`${clampedPercent}%`}
      centerValueClassName="text-lime-300"
      emptyMessage="Add tasks to start tracking completion."
      glowClassName="shadow-[0_0_48px_rgba(163,230,53,0.12)]"
      isExpanded={isExpanded}
      onToggle={onToggle}
      segments={segments}
      shellClassName="from-lime-400/[0.08] via-white/[0.03] to-transparent"
      title="Completion"
      total={totalTasks}
    />
  );
}