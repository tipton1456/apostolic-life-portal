"use client";

import { useMemo, useState } from "react";
import CompletionPieCard from "@/app/projects/completion-pie-card";
import TaskBreakdownPieCard from "@/app/projects/task-breakdown-pie-card";

type PieCardsSectionProps = {
  completedTasks: number;
  completionPercent: number;
  totalTasks: number;
  overdueTasks: number;
  atRiskTasks: number;
  openOutstandingTasks: number;
};

export default function ProjectPieCardsSection({
  completedTasks,
  completionPercent,
  totalTasks,
  overdueTasks,
  atRiskTasks,
  openOutstandingTasks,
}: PieCardsSectionProps) {
  const [expanded, setExpanded] = useState({
    completion: false,
    breakdown: false,
  });

  const layoutClassName = useMemo(() => {
    if (expanded.completion && expanded.breakdown) {
      return "lg:grid-cols-2";
    }

    if (expanded.completion) {
      return "lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]";
    }

    if (expanded.breakdown) {
      return "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)]";
    }

    return "lg:grid-cols-2";
  }, [expanded.breakdown, expanded.completion]);

  return (
    <section className={`mt-6 grid gap-6 ${layoutClassName}`}>
      <CompletionPieCard
        completedTasks={completedTasks}
        isExpanded={expanded.completion}
        onToggle={() =>
          setExpanded((current) => ({
            ...current,
            completion: !current.completion,
          }))
        }
        percent={completionPercent}
        totalTasks={totalTasks}
      />
      <TaskBreakdownPieCard
        atRiskTasks={atRiskTasks}
        completedTasks={completedTasks}
        isExpanded={expanded.breakdown}
        onToggle={() =>
          setExpanded((current) => ({
            ...current,
            breakdown: !current.breakdown,
          }))
        }
        openOutstandingTasks={openOutstandingTasks}
        overdueTasks={overdueTasks}
        totalTasks={totalTasks}
      />
    </section>
  );
}