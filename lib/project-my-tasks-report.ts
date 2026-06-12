import { formatDisplayDate, formatTaskStatus } from "@/lib/project-management-utils";
import {
  loadAuthorizedProjectTaskReportData,
  ProjectTaskReportError,
} from "@/lib/project-task-report-data";
import {
  renderProjectTaskReportPdf,
  slugifyReportFileName,
  type TaskReportSection,
} from "@/lib/project-task-report-pdf";

export { ProjectTaskReportError as ProjectMyTasksReportError };

export async function buildProjectMyTasksReportPdf(projectId: string) {
  const context = await loadAuthorizedProjectTaskReportData(projectId);
  const myTasks = context.tasks.filter(
    (task) => task.assignedTo === context.currentUser.id,
  );
  const sections = buildMyTaskSections(myTasks, context.milestones);
  const buffer = await renderProjectTaskReportPdf({
    coverTitle: `${context.project.name.toUpperCase()} MY TASKS`,
    project: context.project,
    managerNames: context.managerNames,
    participantNames: context.participantNames,
    sections,
    generatedAt: new Date(),
    generatedBy: context.generatedBy,
    columns: { assigned: false },
  });
  const fileName = `${slugifyReportFileName(context.project.name)}-my-tasks.pdf`;

  return { buffer, fileName };
}

function buildMyTaskSections(
  tasks: Awaited<ReturnType<typeof loadAuthorizedProjectTaskReportData>>["tasks"],
  milestones: Awaited<ReturnType<typeof loadAuthorizedProjectTaskReportData>>["milestones"],
): TaskReportSection[] {
  const sections: TaskReportSection[] = milestones.map((milestone) => ({
    title: milestone.name,
    subtitle: `Milestone date: ${formatDisplayDate(milestone.milestoneDate)}`,
    tasks: tasks
      .filter((task) => task.milestoneId === milestone.id)
      .map((task) => ({
        title: task.title,
        dueLabel: milestone.name,
        status: formatTaskStatus(task.status),
      })),
  }));

  const customTasks = tasks.filter((task) => task.dueDateMode !== "milestone");

  sections.push({
    title: "Custom Due Dates",
    subtitle: "Tasks not tied to a milestone",
    tasks: customTasks.map((task) => ({
      title: task.title,
      dueLabel: formatDisplayDate(task.dueDate),
      status: formatTaskStatus(task.status),
    })),
  });

  return sections;
}