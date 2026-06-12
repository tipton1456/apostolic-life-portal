import ExpandablePieCard from "@/app/projects/expandable-pie-card";
import type { PieSegment } from "@/app/projects/project-pie-chart-utils";

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
  isExpanded,
  onToggle,
}: {
  completedTasks: number;
  overdueTasks: number;
  atRiskTasks: number;
  openOutstandingTasks: number;
  totalTasks: number;
  isExpanded: boolean;
  onToggle: () => void;
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

  return (
    <ExpandablePieCard
      centerLabel="Tasks"
      centerValue={String(totalTasks)}
      centerValueClassName="text-white"
      emptyMessage="No tasks on this project yet."
      glowClassName="shadow-[0_0_48px_rgba(125,211,252,0.12)]"
      isExpanded={isExpanded}
      onToggle={onToggle}
      segments={segments}
      shellClassName="from-sky-400/[0.08] via-white/[0.03] to-transparent"
      title="Task Breakdown"
      total={totalTasks}
    />
  );
}