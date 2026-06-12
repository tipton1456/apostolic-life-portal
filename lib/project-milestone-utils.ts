import type { Project } from "@/lib/project-management";

export type ProjectMilestone = {
  id: string;
  projectId: string;
  name: string;
  milestoneDate: string;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskDueDateMode = "milestone" | "custom";

export function parseProjectDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T12:00:00`);
}

export function assertDateWithinProjectRange(
  project: Pick<Project, "startDate" | "targetEndDate">,
  dateValue: string | null,
  label: string,
) {
  if (!dateValue) return;

  const date = parseProjectDate(dateValue);
  if (!date) {
    throw new Error(`${label} must be a valid date.`);
  }

  if (project.startDate) {
    const start = parseProjectDate(project.startDate);
    if (start && date < start) {
      throw new Error(`${label} must be on or after the project start date.`);
    }
  }

  if (project.targetEndDate) {
    const end = parseProjectDate(project.targetEndDate);
    if (end && date > end) {
      throw new Error(`${label} must be on or before the project target end date.`);
    }
  }
}

export function calculateTimelineProgressPercent(
  startDate: string | null,
  targetEndDate: string | null,
  today = new Date(),
) {
  if (!startDate || !targetEndDate) return 0;

  const start = parseProjectDate(startDate);
  const end = parseProjectDate(targetEndDate);
  if (!start || !end) return 0;

  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 0;

  const elapsedMs = today.getTime() - start.getTime();
  const percent = (elapsedMs / totalMs) * 100;

  return Math.max(0, Math.min(100, Math.round(percent)));
}

export function getMilestoneTimelinePosition(
  startDate: string | null,
  targetEndDate: string | null,
  milestoneDate: string,
) {
  if (!startDate || !targetEndDate) return 0;

  const start = parseProjectDate(startDate);
  const end = parseProjectDate(targetEndDate);
  const milestone = parseProjectDate(milestoneDate);
  if (!start || !end || !milestone) return 0;

  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 0;

  const offsetMs = milestone.getTime() - start.getTime();
  const percent = (offsetMs / totalMs) * 100;

  return Math.max(0, Math.min(100, percent));
}

export function formatTaskDueLabel({
  dueDate,
  dueDateMode,
  milestoneName,
}: {
  dueDate: string | null;
  dueDateMode: TaskDueDateMode;
  milestoneName: string | null;
}) {
  if (dueDateMode === "milestone" && milestoneName) {
    return milestoneName;
  }

  if (!dueDate) return "Not set";
  return dueDate;
}