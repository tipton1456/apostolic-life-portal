import { formatTaskStatus } from "@/lib/project-management-utils";
import {
  loadAuthorizedProjectTaskReportData,
  ProjectTaskReportError,
} from "@/lib/project-task-report-data";
import {
  renderProjectTaskReportPdf,
  slugifyReportFileName,
  type TaskReportSection,
} from "@/lib/project-task-report-pdf";

export { ProjectTaskReportError as ProjectTasksByUserReportError };

export async function buildProjectTasksByUserReportPdf(projectId: string) {
  const context = await loadAuthorizedProjectTaskReportData(projectId);
  const sections = buildUserSections(context.tasks);
  const buffer = await renderProjectTaskReportPdf({
    coverTitle: `${context.project.name.toUpperCase()} TASKS BY USER`,
    project: context.project,
    managerNames: context.managerNames,
    participantNames: context.participantNames,
    sections,
    generatedAt: new Date(),
    generatedBy: context.generatedBy,
    columns: { assigned: false },
  });
  const fileName = `${slugifyReportFileName(context.project.name)}-tasks-by-user.pdf`;

  return { buffer, fileName };
}

function buildUserSections(
  tasks: Awaited<ReturnType<typeof loadAuthorizedProjectTaskReportData>>["tasks"],
): TaskReportSection[] {
  const groups = new Map<
    string,
    { title: string; sortKey: string; tasks: typeof tasks }
  >();

  for (const task of tasks) {
    const key = task.assignedTo ?? "__unassigned__";
    const title = task.assignedName;
    const existing = groups.get(key);

    if (existing) {
      existing.tasks.push(task);
      continue;
    }

    groups.set(key, {
      title,
      sortKey: key === "__unassigned__" ? `zzzz-${title}` : title.toLowerCase(),
      tasks: [task],
    });
  }

  return Array.from(groups.values())
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
    .map((group) => ({
      title: group.title,
      subtitle: `${group.tasks.length} task${group.tasks.length === 1 ? "" : "s"}`,
      tasks: group.tasks.map((task) => ({
        title: task.title,
        dueLabel: task.dueLabel,
        status: formatTaskStatus(task.status),
      })),
    }));
}