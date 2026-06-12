import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PortalIcon } from "@/app/icons";
import HighlightTask from "@/app/projects/highlight-task";
import ProjectMilestoneTimelineProgress from "@/app/projects/project-milestone-timeline-progress";
import ProjectSettingsModal from "@/app/projects/project-settings-modal";
import ProjectTaskModals from "@/app/projects/project-task-modals";
import ProjectTeamPanel from "@/app/projects/project-team-panel";
import CompletionPieCard from "@/app/projects/completion-pie-card";
import ProjectExpenseModals from "@/app/projects/project-expense-modals";
import ProjectFinancialsSection from "@/app/projects/project-financials-section";
import ProjectReportsDropdown from "@/app/projects/project-reports-dropdown";
import ProjectRevenueModals from "@/app/projects/project-revenue-modals";
import ProjectTaskGrid from "@/app/projects/project-task-grid";
import TaskBreakdownPieCard from "@/app/projects/task-breakdown-pie-card";
import { getCurrentSessionUser } from "@/lib/demo";
import { listProjectFiles } from "@/lib/project-files";
import type { ProjectTaskFile } from "@/lib/project-files";
import { getCurrentPortalUser } from "@/lib/portal-users";
import {
  buildManagerTaskAssigneeOptions,
  buildParticipantHandoffOptions,
  buildPortalUserPickerOptions,
} from "@/lib/project-assignee-options";
import {
  calculateProjectFinancialStats,
  formatCurrency,
} from "@/lib/project-financial-utils";
import { listProjectExpenses } from "@/lib/project-expenses";
import { listProjectRevenue } from "@/lib/project-revenue";
import {
  canCurrentUserAccessProjects,
  getProjectDashboard,
  listEligibleManagersToAdd,
  listPortalParticipantRoleUsers,
  listPortalUsersAvailableForProject,
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
  searchParams: Promise<{ task?: string; expense?: string; revenue?: string }>;
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
  const [availablePortalUsers, eligibleManagers, portalParticipants] =
    dashboard?.permissions.canManageMembers
      ? await Promise.all([
          listPortalUsersAvailableForProject(projectId),
          listEligibleManagersToAdd(projectId),
          listPortalParticipantRoleUsers(),
        ])
      : [[], [], await listPortalParticipantRoleUsers().catch(() => [])];

  if (!dashboard || !portalUser) {
    notFound();
  }

  const { project, members, managers, milestones, tasks, stats, permissions } =
    dashboard;
  const canViewFinancials = permissions.isManager;
  const [expenses, revenue] = canViewFinancials
    ? await Promise.all([
        listProjectExpenses(projectId).catch((error) => {
          console.error("Project expenses lookup failed:", error);
          return [];
        }),
        listProjectRevenue(projectId).catch((error) => {
          console.error("Project revenue lookup failed:", error);
          return [];
        }),
      ])
    : [[], []];
  const isProjectCompleted = project.status === "completed";
  const assigneeOptions = buildManagerTaskAssigneeOptions({
    members,
    managers: managers.map((manager) => ({
      id: manager.userId,
      fullName: manager.fullName,
    })),
    portalParticipants: portalParticipants.map((participant) => ({
      id: participant.id,
      fullName: participant.fullName,
    })),
  });
  const portalUserOptions = buildPortalUserPickerOptions(
    availablePortalUsers.map((user) => ({
      id: user.id,
      fullName: `${user.fullName} (${user.email})`,
    })),
  );
  const participantAssigneeOptions = buildParticipantHandoffOptions({
    currentUserId: portalUser.id,
    members,
    managers: managers.map((manager) => ({
      id: manager.userId,
      fullName: manager.fullName,
    })),
    portalParticipants: portalParticipants.map((participant) => ({
      id: participant.id,
      fullName: participant.fullName,
    })),
  });
  const taskFilesByTaskId = Object.fromEntries(filesByTaskId.entries());
  const taskUpdatesByTaskId = Object.fromEntries(updatesByTaskId.entries());
  const financialStats = canViewFinancials
    ? calculateProjectFinancialStats(expenses, revenue)
    : null;

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
                <ProjectReportsDropdown
                  canViewFinancialReports={canViewFinancials}
                  projectId={project.id}
                />
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
              availableUsers={availablePortalUsers.map((candidate) => ({
                id: candidate.id,
                fullName: candidate.fullName,
                email: candidate.email,
              }))}
              canManageMembers={permissions.canManageMembers}
              managerNames={managers.map((manager) => manager.fullName)}
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

        <section className="mt-8">
          <ProjectMilestoneTimelineProgress
            milestones={milestones}
            startDate={project.startDate}
            targetEndDate={project.targetEndDate}
          />
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          <TaskBreakdownPieCard
            atRiskTasks={stats.atRiskTasks}
            completedTasks={stats.completedTasks}
            openOutstandingTasks={stats.openOutstandingTasks}
            overdueTasks={stats.overdueTasks}
            totalTasks={stats.totalTasks}
          />
        </section>

        <ProjectTaskGrid
          assigneeOptions={assigneeOptions}
          milestones={milestones}
          portalUserOptions={portalUserOptions}
          canManageTasks={permissions.canManageTasks}
          currentUserId={portalUser.id}
          highlightedTaskId={highlightedTaskId}
          isProjectCompleted={isProjectCompleted}
          projectEndDate={project.targetEndDate}
          projectId={project.id}
          projectStartDate={project.startDate}
          taskUpdatesByTaskId={taskUpdatesByTaskId}
          tasks={tasks}
        />

        {canViewFinancials && financialStats ? (
          <>
            <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                label="Gross Revenue"
                value={formatCurrency(financialStats.grossRevenue)}
                detail={`${financialStats.revenueStats.activeEntries} active income entr${financialStats.revenueStats.activeEntries === 1 ? "y" : "ies"}`}
              />
              <MetricCard
                label="Committed Revenue"
                value={formatCurrency(financialStats.committedRevenue)}
                detail="Income not yet received"
              />
              <MetricCard
                label="Expenses"
                value={formatCurrency(financialStats.expenses)}
                detail={`${financialStats.expenseStats.activeExpenses} active expense${financialStats.expenseStats.activeExpenses === 1 ? "" : "s"}`}
              />
              <MetricCard
                label="Outstanding Expenses"
                value={formatCurrency(financialStats.outstandingExpenses)}
                detail="Committed costs"
                highlight={financialStats.outstandingExpenses > 0}
              />
              <MetricCard
                label="Net Revenue"
                value={formatCurrency(financialStats.netRevenue)}
                detail="Gross revenue - expenses - committed revenue + outstanding expenses"
                highlight={financialStats.netRevenue < 0}
              />
            </section>

            <ProjectFinancialsSection
              canManageFinancials={permissions.canManageTasks}
              expenses={expenses}
              isProjectCompleted={isProjectCompleted}
              projectId={project.id}
              revenue={revenue}
            />
          </>
        ) : null}
      </div>

      <Suspense fallback={null}>
        <ProjectSettingsModal
          canManageProject={permissions.canManageProject}
          eligibleManagers={eligibleManagers.map((manager) => ({
            id: manager.id,
            fullName: manager.fullName,
            email: manager.email,
          }))}
          managers={managers}
          milestones={milestones}
          project={project}
        />
        <ProjectTaskModals
          assigneeOptions={assigneeOptions}
          milestones={milestones}
          portalUserOptions={portalUserOptions}
          canManageTasks={permissions.canManageTasks}
          canReassignTasks={permissions.canReassignTasks}
          currentUserId={portalUser.id}
          isProjectCompleted={isProjectCompleted}
          participantAssigneeOptions={participantAssigneeOptions}
          projectEndDate={project.targetEndDate}
          projectId={project.id}
          projectStartDate={project.startDate}
          taskFilesByTaskId={taskFilesByTaskId}
          taskUpdatesByTaskId={taskUpdatesByTaskId}
          tasks={tasks}
        />
        {canViewFinancials ? (
          <>
            <ProjectExpenseModals
              canManageExpenses={permissions.canManageTasks}
              expenses={expenses}
              isProjectCompleted={isProjectCompleted}
              projectId={project.id}
            />
            <ProjectRevenueModals
              canManageRevenue={permissions.canManageTasks}
              isProjectCompleted={isProjectCompleted}
              projectId={project.id}
              revenue={revenue}
            />
          </>
        ) : null}
      </Suspense>
    </main>
  );
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

