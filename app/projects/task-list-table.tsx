import Link from "next/link";
import type { ProjectTask, TaskStatus } from "@/lib/project-management";
import type { ProjectTaskUpdate } from "@/lib/project-task-updates";
import {
  formatDisplayDate,
  formatTaskPriority,
  formatTaskStatus,
  isTaskOverdue,
} from "@/lib/project-management-utils";

const TASK_GRID_COLUMNS =
  "grid-cols-[minmax(0,1.3fr)_0.8fr_0.7fr_0.7fr_0.8fr_4rem_auto]";

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
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[920px]">
        <div
          className={`grid ${TASK_GRID_COLUMNS} items-center gap-x-3 border-b border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500`}
        >
          <span>Task</span>
          <span>Assigned</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Due</span>
          <span className="text-right">Updates</span>
          <span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-white/10">
          {tasks.map((task) => {
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
                <p className="text-neutral-300">{formatTaskPriority(task.priority)}</p>
                <p
                  className={
                    overdue ? "font-semibold text-red-300" : "text-neutral-300"
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