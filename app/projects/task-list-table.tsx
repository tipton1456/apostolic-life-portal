"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProjectTask, TaskPriority, TaskStatus } from "@/lib/project-management";
import type { ProjectTaskUpdate } from "@/lib/project-task-updates";
import {
  formatDisplayDate,
  formatTaskPriority,
  formatTaskStatus,
  isTaskOverdue,
} from "@/lib/project-management-utils";

const TASK_GRID_COLUMNS =
  "grid-cols-[minmax(0,1.3fr)_0.8fr_0.7fr_0.7fr_0.8fr_4rem_auto]";

type SortKey = "title" | "assigned" | "status" | "priority" | "due" | "updates";
type SortDirection = "asc" | "desc";

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_RANK: Record<TaskStatus, number> = {
  todo: 0,
  in_progress: 1,
  blocked: 2,
  completed: 3,
};

export default function TaskListTable({
  tasks,
  projectId,
  currentUserId,
  canManageTasks,
  taskUpdatesByTaskId,
  highlightedTaskId,
}: {
  tasks: ProjectTask[];
  projectId: string;
  currentUserId: string;
  canManageTasks: boolean;
  taskUpdatesByTaskId: Record<string, ProjectTaskUpdate[]>;
  highlightedTaskId?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedTasks = useMemo(
    () => sortTasks(tasks, taskUpdatesByTaskId, sortKey, sortDirection),
    [tasks, taskUpdatesByTaskId, sortKey, sortDirection],
  );

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[920px]">
        <div
          className={`grid ${TASK_GRID_COLUMNS} items-center gap-x-3 border-b border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500`}
        >
          <SortableHeader
            active={sortKey === "title"}
            direction={sortDirection}
            label="Task"
            onClick={() => handleSort("title")}
          />
          <SortableHeader
            active={sortKey === "assigned"}
            direction={sortDirection}
            label="Assigned"
            onClick={() => handleSort("assigned")}
          />
          <SortableHeader
            active={sortKey === "status"}
            direction={sortDirection}
            label="Status"
            onClick={() => handleSort("status")}
          />
          <SortableHeader
            active={sortKey === "priority"}
            align="right"
            direction={sortDirection}
            label="Priority"
            onClick={() => handleSort("priority")}
          />
          <SortableHeader
            active={sortKey === "due"}
            align="right"
            direction={sortDirection}
            label="Due"
            onClick={() => handleSort("due")}
          />
          <SortableHeader
            active={sortKey === "updates"}
            align="right"
            direction={sortDirection}
            label="Updates"
            onClick={() => handleSort("updates")}
          />
          <span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-white/10">
          {sortedTasks.map((task) => {
            const updates = taskUpdatesByTaskId[task.id] ?? [];
            const canEdit =
              canManageTasks ||
              (task.assignedTo === currentUserId && task.status !== "completed");
            const overdue = isTaskOverdue(task);

            return (
              <div
                key={task.id}
                id={`task-${task.id}`}
                className={`grid ${TASK_GRID_COLUMNS} items-center gap-x-3 px-4 py-3 text-sm transition ${
                  highlightedTaskId === task.id ? "bg-lime-400/5" : "hover:bg-white/[0.04]"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-100">{task.title}</p>
                  {task.description ? (
                    <p className="mt-1 truncate text-xs text-neutral-500">
                      {task.description}
                    </p>
                  ) : null}
                </div>
                <p className="truncate text-neutral-300">
                  {task.assignedName ?? "Unassigned"}
                </p>
                <TaskStatusBadge status={task.status} />
                <p className="text-right text-neutral-300">
                  {formatTaskPriority(task.priority)}
                </p>
                <p
                  className={
                    overdue
                      ? "text-right font-semibold text-red-300"
                      : "text-right text-neutral-300"
                  }
                >
                  {formatDisplayDate(task.dueDate)}
                </p>
                <p className="text-right tabular-nums text-neutral-400">
                  {updates.length}
                </p>
                <div className="text-right">
                  <Link
                    href={`/projects/${projectId}?task=${task.id}`}
                    className="inline-flex rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-lime-300 transition hover:border-lime-300/60 hover:bg-lime-400/10"
                  >
                    {canEdit ? "Update Task" : "View Task"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        align === "right"
          ? "inline-flex items-center justify-end gap-1 text-right transition hover:text-lime-300"
          : "inline-flex items-center gap-1 text-left transition hover:text-lime-300"
      }
    >
      <span>{label}</span>
      <span className="text-[9px] text-lime-400">
        {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

function sortTasks(
  tasks: ProjectTask[],
  taskUpdatesByTaskId: Record<string, ProjectTaskUpdate[]>,
  sortKey: SortKey,
  sortDirection: SortDirection,
) {
  const multiplier = sortDirection === "asc" ? 1 : -1;

  return [...tasks].sort((left, right) => {
    const comparison = compareTasks(left, right, taskUpdatesByTaskId, sortKey);
    return comparison * multiplier;
  });
}

function compareTasks(
  left: ProjectTask,
  right: ProjectTask,
  taskUpdatesByTaskId: Record<string, ProjectTaskUpdate[]>,
  sortKey: SortKey,
) {
  switch (sortKey) {
    case "title":
      return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
    case "assigned":
      return (left.assignedName ?? "Unassigned").localeCompare(
        right.assignedName ?? "Unassigned",
        undefined,
        { sensitivity: "base" },
      );
    case "status":
      return STATUS_RANK[left.status] - STATUS_RANK[right.status];
    case "priority":
      return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    case "due":
      return compareDueDates(left.dueDate, right.dueDate);
    case "updates":
      return (
        (taskUpdatesByTaskId[left.id]?.length ?? 0) -
        (taskUpdatesByTaskId[right.id]?.length ?? 0)
      );
    default:
      return 0;
  }
}

function compareDueDates(left: string | null, right: string | null) {
  const leftValue = left ? Date.parse(left) : Number.POSITIVE_INFINITY;
  const rightValue = right ? Date.parse(right) : Number.POSITIVE_INFINITY;
  return leftValue - rightValue;
}

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const styles: Record<TaskStatus, string> = {
    todo: "border-white/10 bg-white/[0.04] text-neutral-300",
    in_progress: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    completed: "border-lime-400/30 bg-lime-400/10 text-lime-200",
    blocked: "border-red-400/30 bg-red-400/10 text-red-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {formatTaskStatus(status)}
    </span>
  );
}