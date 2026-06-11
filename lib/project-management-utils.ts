import type {
  ProjectStatus,
  ProjectTask,
  TaskPriority,
  TaskStatus,
} from "@/lib/project-management";

export function formatProjectStatus(status: ProjectStatus) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getProjectStatusIconName(
  status: ProjectStatus,
): "active" | "onHold" | "check" | "cancelled" {
  switch (status) {
    case "active":
      return "active";
    case "on_hold":
      return "onHold";
    case "completed":
      return "check";
    case "cancelled":
      return "cancelled";
    default:
      return "active";
  }
}

export function formatTaskStatus(status: TaskStatus) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatTaskPriority(priority: TaskPriority) {
  return priority.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDisplayDate(value: string | null) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(`${value}T12:00:00`));
}

export type TaskBreakdownTask = Pick<ProjectTask, "status" | "dueDate">;

export function isTaskOverdue(task: TaskBreakdownTask) {
  if (task.status === "completed" || !task.dueDate) return false;

  return startOfDay(parseDueDate(task.dueDate)) < startOfToday();
}

export function isTaskAtRisk(task: TaskBreakdownTask) {
  if (task.status === "completed" || !task.dueDate || isTaskOverdue(task)) {
    return false;
  }

  const daysUntilDue = daysUntilDueDate(task.dueDate);
  return daysUntilDue >= 0 && daysUntilDue <= 2;
}

export function isTaskOpenOutstanding(task: TaskBreakdownTask) {
  if (task.status === "completed" || isTaskOverdue(task) || isTaskAtRisk(task)) {
    return false;
  }

  return true;
}

export function daysUntilDueDate(dueDate: string) {
  const today = startOfToday();
  const due = startOfDay(parseDueDate(dueDate));
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.round((due.getTime() - today.getTime()) / millisecondsPerDay);
}

function startOfToday() {
  return startOfDay(new Date());
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDueDate(dueDate: string) {
  return new Date(`${dueDate}T12:00:00`);
}