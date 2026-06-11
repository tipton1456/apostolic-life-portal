import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PortalIcon } from "@/app/icons";
import HighlightTask from "@/app/projects/highlight-task";
import ProjectSettingsModal from "@/app/projects/project-settings-modal";
import ProjectTaskModals from "@/app/projects/project-task-modals";
import ProjectTeamPanel from "@/app/projects/project-team-panel";
import CompletionPieCard from "@/app/projects/completion-pie-card";
import ProjectTaskGrid from "@/app/projects/project-task-grid";
import { getCurrentSessionUser } from "@/lib/demo";
import { listProjectFiles } from "@/lib/project-files";
import type { ProjectTaskFile } from "@/lib/project-files";
import { getCurrentPortalUser } from "@/lib/portal-users";
import {
  canCurrentUserAccessProjects,
  getProjectDashboard,
  listAssignablePortalUsers,
  listProjectManagersForAssignee,
} from "@/lib/project-management";
import {
  listProjectTaskUpdates,
  type ProjectTaskUpdate,
} from "@/lib/project-task-updates";
import {
  formatDisplayDate,
  formatProjectStatus,
  getProjectStatusIconName,
} from "@/lib/project-management-utils";

export default async function ProjectDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ task?: string }>;
}) {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login?next=/projects");
  }

  if (user.isDemo) {
    redirect("/projects");
  }

  const canAccessProjects = await canCurrentUserAccessProjects();

  if (!canAccessProjects) {
    redirect("/dashboard");
  }

  const { projectId } = await params;
  const { task: highlightedTaskId } = await searchParams;
  const [dashboard, portalUser, projectFiles, taskUpdates] = await Promise.all([
    getProjectDashboard(projectId),
    getCurrentPortalUser(),
    listProjectFiles(projectId).catch(() => [] as ProjectTaskFile[]),
    listProjectTaskUpdates(projectId).catch((error) => {
      console.error("Project task updates lookup failed:", error);
      return [];
    }),
  ]);
  const filesByTaskId = new Map<string, ProjectTaskFile[]>();
  const updatesByTaskId = new Map<string, ProjectTaskUpdate[]>();

  for (const file of projectFiles) {
    const existing = filesByTaskId.get(file.taskId) ?? [];
    existing.push(file);
    filesByTaskId.set(file.taskId, existing);
  }

  for (const update of taskUpdates) {
    const existing = updatesByTaskId.get(update.taskId) ?? [];
    existing.push(update);
    updatesByTaskId.set(update.taskId, existing);
  }
  const [assignableUsers, projectManagers] = dashboard?.permissions.canManageMembers
    ? await Promise.all([
        listAssignablePortalUsers(),
        listProjectManagersForAssignee(),
      ])
    : [[], await listProjectManagersForAssignee().catch(() => [])];

  if (!dashboard || !portalUser) {
    notFound();
  }

  const { project, members, tasks, stats, permissions } = dashboard;
  const isProjectCompleted = project.status === "completed";
  const memberIds = new Set(members.map((member) => member.userId));
  const availableUsers = assignableUsers.filter((candidate) => !memberIds.has(candidate.id));
  const assigneeOptions = [
    { value: "", label: "Unassigned" },
    ...members.map((member) => ({
      value: member.userId,
      label: member.fullName,
    })),
  ];
  const participantAssigneeOptions = buildParticipantAssigneeOptions(
    projectManagers,
    members,
    portalUser.id,
  );
  const taskFilesByTaskId = Object.fromEntries(filesByTaskId.entries());
  const taskUpdatesByTaskId = Object.fromEntries(updatesByTaskId.entries());

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <HighlightTask taskId={highlightedTaskId} />
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Project Dashboard
          </p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,15rem)] xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,18rem)] lg:items-start">
            <div className="shrink-0">
              {project.imageUrl ? (
                <img
                  src={project.imageUrl}
                  alt={`${project.name} project`}
                  className="h-40 w-40 rounded-2xl border border-white/10 object-cover sm:h-48 sm:w-48"
                />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] text-sm text-neutral-500 sm:h-48 sm:w-48">
                  No project image yet
                </div>
              )}
            </div>
            <div className="min-w-0 text-left">
              <h1 className="text-4xl font-bold tracking-tight">{project.name}</h1>
              <p className="mt-3 text-neutral-400">
                {project.description ||
                  "Track tasks, deadlines, and project completion."}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-neutral-400">
                <span className="inline-flex items-center gap-1.5">
                  <PortalIcon
                    className="h-4 w-4 text-lime-400"
                    name={getProjectStatusIconName(project.status)}
                  />
                  {formatProjectStatus(project.status)}
                </span>
                <span>Start: {formatDisplayDate(project.startDate)}</span>
                <span>Target End: {formatDisplayDate(project.targetEndDate)}</span>
                <span className="inline-flex items-center gap-1.5">
                  <PortalIcon
                    className="h-4 w-4 text-lime-400"
                    name={permissions.isManager ? "manager" : "worker"}
                  />
                  {permissions.isManager ? "Project Manager" : "Project Participant"}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm font-semibold">
                {permissions.canManageProject ? (
                  <Link
                    href={`/projects/${project.id}?settings=1`}
                    className="inline-flex items-center gap-2 text-lime-400 transition hover:text-lime-300"
                  >
                    <PortalIcon className="h-4 w-4" name="settings" />
                    Project Settings
                  </Link>
                ) : null}
                <Link
                  href={`/projects/${project.id}/files`}
                  className="inline-flex items-center gap-2 text-lime-400 transition hover:text-lime-300"
                >
                  <PortalIcon className="h-4 w-4" name="files" />
                  Project Files ({projectFiles.length})
                </Link>
              </div>
            </div>
            <ProjectTeamPanel
              availableUsers={availableUsers.map((candidate) => ({
                id: candidate.id,
                fullName: candidate.fullName,
                email: candidate.email,
              }))}
              canManageMembers={permissions.canManageMembers}
              managerNames={projectManagers.map((manager) => manager.fullName)}
              participantNames={members.map((member) => member.fullName)}
              projectId={project.id}
            />
          </div>
        </header>

        {isProjectCompleted ? (
          <section className="mt-8 rounded-2xl border border-lime-400/30 bg-lime-400/10 p-6">
            <h2 className="text-2xl font-semibold text-lime-200">Project Completed</h2>
            <p className="mt-3 max-w-3xl text-sm text-neutral-200">
              This project is complete. Download all task files as a zip, upload them
              to Dropbox manually, then add the archived folder link in Project
              Settings.
            </p>
            <div className="mt-5 flex flex-wrap gap-4">
              {projectFiles.length > 0 ? (
                <a
                  href={`/api/projects/${project.id}/files/download-all`}
                  className="inline-flex rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300"
                >
                  Download All Files (.zip)
                </a>
              ) : (
                <p className="text-sm text-neutral-300">No files were attached to this project.</p>
              )}
              {project.archivedFilesUrl ? (
                <a
                  href={project.archivedFilesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-lime-300 transition hover:border-lime-300/60 hover:bg-lime-400/10"
                >
                  Open Archived Project Files
                </a>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CompletionPieCard
            completedTasks={stats.completedTasks}
            percent={stats.completionPercent}
            totalTasks={stats.totalTasks}
          />
          <MetricCard
            label="Outstanding"
            value={String(stats.outstandingTasks)}
            detail="Tasks not yet completed"
          />
          <MetricCard
            label="Overdue"
            value={String(stats.overdueTasks)}
            detail="Past due and still open"
            highlight={stats.overdueTasks > 0}
          />
          <MetricCard
            label="Participants"
            value={String(members.length)}
            detail="People on this project"
          />
        </section>

        <ProjectTaskGrid
          assigneeOptions={assigneeOptions}
          canManageTasks={permissions.canManageTasks}
          currentUserId={portalUser.id}
          highlightedTaskId={highlightedTaskId}
          isProjectCompleted={isProjectCompleted}
          projectId={project.id}
          taskUpdatesByTaskId={taskUpdatesByTaskId}
          tasks={tasks}
        />
      </div>

      <Suspense fallback={null}>
        <ProjectSettingsModal
          canManageProject={permissions.canManageProject}
          project={project}
        />
        <ProjectTaskModals
          assigneeOptions={assigneeOptions}
          canManageTasks={permissions.canManageTasks}
          canReassignTasks={permissions.canReassignTasks}
          currentUserId={portalUser.id}
          isProjectCompleted={isProjectCompleted}
          participantAssigneeOptions={participantAssigneeOptions}
          projectId={project.id}
          taskFilesByTaskId={taskFilesByTaskId}
          taskUpdatesByTaskId={taskUpdatesByTaskId}
          tasks={tasks}
        />
      </Suspense>
    </main>
  );
}

function buildParticipantAssigneeOptions(
  managers: Array<{ id: string; fullName: string }>,
  members: Array<{ userId: string; fullName: string }>,
  currentUserId: string,
) {
  const options = new Map<string, string>([
    [currentUserId, "Keep assigned to me"],
  ]);

  for (const manager of managers) {
    if (manager.id !== currentUserId) {
      options.set(manager.id, `${manager.fullName} (Project Manager)`);
    }
  }

  for (const member of members) {
    if (member.userId !== currentUserId) {
      options.set(member.userId, member.fullName);
    }
  }

  return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
}

function MetricCard({
  label,
  value,
  detail,
  highlight = false,
}: {
  label: string;
  value: string;
  detail: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      <p
        className={
          highlight
            ? "mt-2 text-3xl font-bold text-red-300"
            : "mt-2 text-3xl font-bold text-lime-300"
        }
      >
        {value}
      </p>
      <p className="mt-2 text-sm text-neutral-400">{detail}</p>
    </div>
  );
}

