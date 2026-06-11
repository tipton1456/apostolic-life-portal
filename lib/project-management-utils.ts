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

export function isTaskOverdue(task: ProjectTask) {
  if (task.status === "completed" || !task.dueDate) return false;

  return startOfDay(new Date(task.dueDate)) < startOfToday();
}

function startOfToday() {
  return startOfDay(new Date());
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}