import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PortalIcon } from "@/app/icons";
import AdminFormButton from "@/app/admin/admin-form-button";
import HighlightTask from "@/app/projects/highlight-task";
import ProjectTaskModals from "@/app/projects/project-task-modals";
import TaskAssigneeField from "@/app/projects/task-assignee-field";
import TaskListTable from "@/app/projects/task-list-table";
import { getCurrentSessionUser } from "@/lib/demo";
import { listProjectFiles } from "@/lib/project-files";
import type { ProjectTaskFile } from "@/lib/project-files";
import { getCurrentPortalUser } from "@/lib/portal-users";
import {
  addProjectMember,
  canCurrentUserAccessProjects,
  createProjectTask,
  deleteProject,
  getProjectDashboard,
  listAssignablePortalUsers,
  removeProjectMember,
  updateProject,
  uploadProjectImage,
  type ProjectTask,
} from "@/lib/project-management";
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "@/lib/project-task-options";
import {
  listProjectTaskUpdates,
  type ProjectTaskUpdate,
} from "@/lib/project-task-updates";
import {
  formatDisplayDate,
  formatProjectStatus,
  isTaskOverdue,
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
  const assignableUsers = dashboard?.permissions.canManageMembers
    ? await listAssignablePortalUsers()
    : [];

  if (!dashboard || !portalUser) {
    notFound();
  }

  const { project, members, tasks, stats, permissions } = dashboard;
  const isProjectCompleted = project.status === "completed";
  const outstandingTasks = tasks.filter((task) => task.status !== "completed");
  const overdueTasks = tasks.filter((task) => isTaskOverdue(task));
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const memberIds = new Set(members.map((member) => member.userId));
  const availableUsers = assignableUsers.filter((candidate) => !memberIds.has(candidate.id));
  const assigneeOptions = [
    { value: "", label: "Unassigned" },
    ...members.map((member) => ({
      value: member.userId,
      label: member.fullName,
    })),
  ];
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
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
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
            <div className="min-w-0 flex-1 text-left">
              <h1 className="text-4xl font-bold tracking-tight">{project.name}</h1>
              <p className="mt-3 text-neutral-400">
                {project.description ||
                  "Track tasks, deadlines, and project completion."}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-neutral-400">
                <span>Status: {formatProjectStatus(project.status)}</span>
                <span>Start: {formatDisplayDate(project.startDate)}</span>
                <span>Target End: {formatDisplayDate(project.targetEndDate)}</span>
                <span>
                  Role:{" "}
                  {permissions.isManager
                    ? "Project Manager"
                    : "Project Participant"}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
                <Link
                  href={`/projects/${project.id}/files`}
                  className="text-lime-400 transition hover:text-lime-300"
                >
                  Project Files ({projectFiles.length})
                </Link>
                <Link
                  href="/projects/files"
                  className="text-lime-400 transition hover:text-lime-300"
                >
                  All Project Files
                </Link>
              </div>
            </div>
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
          <MetricCard
            label="Completion"
            value={`${stats.completionPercent}%`}
            detail={`${stats.completedTasks} of ${stats.totalTasks} tasks done`}
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

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
                Progress
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Project Completion</h2>
            </div>
            <p className="text-3xl font-bold text-lime-300">
              {stats.completionPercent}%
            </p>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-lime-400 transition-all"
              style={{ width: `${stats.completionPercent}%` }}
            />
          </div>
        </section>

        {permissions.canManageMembers ? (
          <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-2xl font-semibold">Project Participants</h2>
              <p className="mt-2 text-sm text-neutral-400">
                Add portal users to this project so tasks can be assigned to them.
              </p>
            </div>
            <div className="divide-y divide-white/10">
              {members.length > 0 ? (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-neutral-100">{member.fullName}</p>
                      <p className="text-sm text-neutral-400">{member.email}</p>
                    </div>
                    <form action={removeProjectMember}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="userId" value={member.userId} />
                      <AdminFormButton
                        pendingLabel="Removing..."
                        variant="danger"
                        className="rounded-lg px-3 py-2"
                      >
                        Remove
                      </AdminFormButton>
                    </form>
                  </div>
                ))
              ) : (
                <p className="px-5 py-4 text-sm text-neutral-400">
                  No participants have been added yet.
                </p>
              )}
            </div>
            {availableUsers.length > 0 ? (
              <form
                action={addProjectMember}
                className="grid gap-4 border-t border-white/10 px-5 py-5 md:grid-cols-[1fr_auto]"
              >
                <input type="hidden" name="projectId" value={project.id} />
                <SelectField
                  label="Add participant"
                  name="userId"
                  options={availableUsers.map((candidate) => ({
                    value: candidate.id,
                    label: `${candidate.fullName} (${candidate.email})`,
                  }))}
                />
                <AdminFormButton pendingLabel="Adding..." className="md:mt-7">
                  Add Participant
                </AdminFormButton>
              </form>
            ) : (
              <p className="border-t border-white/10 px-5 py-4 text-sm text-neutral-400">
                All portal users are already on this project.
              </p>
            )}
          </section>
        ) : (
          <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-2xl font-semibold">Project Participants</h2>
            </div>
            <div className="divide-y divide-white/10">
              {members.map((member) => (
                <div key={member.id} className="px-5 py-4">
                  <p className="font-semibold text-neutral-100">{member.fullName}</p>
                  <p className="text-sm text-neutral-400">{member.email}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {permissions.canManageProject ? (
          <details className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-2xl font-semibold marker:hidden">
              <span>Project Settings</span>
              <span className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-lime-300">
                Edit Project
              </span>
            </summary>
            <form
              action={updateProject}
              className="mt-6 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_auto]"
            >
              <input type="hidden" name="id" value={project.id} />
              <Field label="Project name" name="name" defaultValue={project.name} required />
              <Field
                label="Description"
                name="description"
                defaultValue={project.description}
              />
              <Field
                label="Start date"
                name="startDate"
                type="date"
                defaultValue={project.startDate ?? ""}
              />
              <Field
                label="Target end date"
                name="targetEndDate"
                type="date"
                defaultValue={project.targetEndDate ?? ""}
              />
              <SelectField
                label="Status"
                name="status"
                defaultValue={project.status}
                options={PROJECT_STATUS_OPTIONS}
              />
              <AdminFormButton pendingLabel="Saving..." className="md:col-start-2 xl:col-start-6">
                Save Project
              </AdminFormButton>
            </form>
            {project.status === "completed" ? (
              <form
                action={updateProject}
                className="mt-6 grid gap-4 rounded-xl border border-white/10 bg-neutral-950/40 p-5 md:grid-cols-[1fr_auto]"
              >
                <input type="hidden" name="id" value={project.id} />
                <input type="hidden" name="name" value={project.name} />
                <input type="hidden" name="description" value={project.description} />
                <input type="hidden" name="status" value={project.status} />
                <input
                  type="hidden"
                  name="startDate"
                  value={project.startDate ?? ""}
                />
                <input
                  type="hidden"
                  name="targetEndDate"
                  value={project.targetEndDate ?? ""}
                />
                <Field
                  label="Archived project files URL"
                  name="archivedFilesUrl"
                  defaultValue={project.archivedFilesUrl ?? ""}
                />
                <span className="text-xs leading-5 text-neutral-500 md:col-span-2">
                  Paste the Dropbox shared-folder link after you upload the project
                  files. This link is only shown once the project is completed.
                </span>
                <AdminFormButton pendingLabel="Saving..." className="md:mt-7">
                  Save Archive Link
                </AdminFormButton>
              </form>
            ) : null}
            <form
              action={uploadProjectImage}
              encType="multipart/form-data"
              className="mt-6 grid gap-4 rounded-xl border border-white/10 bg-neutral-950/40 p-5 md:grid-cols-[1fr_auto]"
            >
              <input type="hidden" name="projectId" value={project.id} />
              <label className="block text-sm font-medium text-neutral-300">
                Project image
                <input
                  name="projectImage"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-2 block w-full text-sm text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-lime-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-950 hover:file:bg-lime-300"
                />
                <span className="mt-2 block text-xs leading-5 text-neutral-500">
                  Upload a 16:9 image (JPG, PNG, or WebP under 5MB). It appears
                  beside the project details at the top of this dashboard.
                </span>
              </label>
              <AdminFormButton pendingLabel="Uploading..." className="md:mt-7">
                Save Image
              </AdminFormButton>
            </form>
            {project.imageUrl ? (
              <form action={uploadProjectImage} className="mt-3 flex justify-end">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="removeImage" value="on" />
                <AdminFormButton
                  pendingLabel="Removing..."
                  variant="danger"
                  className="rounded-lg px-3 py-2"
                >
                  Remove Image
                </AdminFormButton>
              </form>
            ) : null}
            <form action={deleteProject} className="mt-4 flex justify-end">
              <input type="hidden" name="id" value={project.id} />
              <AdminFormButton
                pendingLabel="Deleting..."
                variant="danger"
                className="rounded-lg px-3 py-2"
              >
                <PortalIcon className="h-4 w-4" name="trash" />
                Delete Project
              </AdminFormButton>
            </form>
          </details>
        ) : null}

        {permissions.canManageTasks ? (
          <details className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-2xl font-semibold marker:hidden">
              <span>Add Task</span>
              <span className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-950">
                New Task
              </span>
            </summary>
            <form
              action={createProjectTask}
              className="mt-6 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_auto]"
            >
              <input type="hidden" name="projectId" value={project.id} />
              <Field label="Task title" name="title" required />
              <Field label="Description" name="description" />
              <Field label="Start date" name="startDate" type="date" />
              <Field label="Due date" name="dueDate" type="date" />
              <SelectField
                label="Status"
                name="status"
                defaultValue="todo"
                options={TASK_STATUS_OPTIONS}
              />
              <SelectField
                label="Priority"
                name="priority"
                defaultValue="medium"
                options={TASK_PRIORITY_OPTIONS}
              />
              <TaskAssigneeField
                label="Assigned to"
                name="assignedTo"
                defaultValue=""
                options={assigneeOptions}
              />
              <AdminFormButton pendingLabel="Adding..." className="md:col-start-2 xl:col-start-8">
                Add Task
              </AdminFormButton>
            </form>
          </details>
        ) : null}

        <TaskSection
          title="Outstanding Tasks"
          description="Open tasks that still need attention."
          emptyMessage="No outstanding tasks. Everything is complete."
          tasks={outstandingTasks}
          projectId={project.id}
          currentUserId={portalUser.id}
          canManageTasks={permissions.canManageTasks}
          highlightedTaskId={highlightedTaskId}
          taskUpdatesByTaskId={taskUpdatesByTaskId}
        />

        <TaskSection
          title="Overdue Tasks"
          description="Tasks past their due date and not yet completed."
          emptyMessage="No overdue tasks."
          tasks={overdueTasks}
          projectId={project.id}
          currentUserId={portalUser.id}
          canManageTasks={permissions.canManageTasks}
          highlightedTaskId={highlightedTaskId}
          taskUpdatesByTaskId={taskUpdatesByTaskId}
          emphasizeOverdue
        />

        <TaskSection
          title="Completed Tasks"
          description="Finished work for this project."
          emptyMessage="No completed tasks yet."
          tasks={completedTasks}
          projectId={project.id}
          currentUserId={portalUser.id}
          canManageTasks={permissions.canManageTasks}
          highlightedTaskId={highlightedTaskId}
          taskUpdatesByTaskId={taskUpdatesByTaskId}
        />
      </div>

      <Suspense fallback={null}>
        <ProjectTaskModals
          assigneeOptions={assigneeOptions}
          canManageTasks={permissions.canManageTasks}
          currentUserId={portalUser.id}
          isProjectCompleted={isProjectCompleted}
          projectId={project.id}
          taskFilesByTaskId={taskFilesByTaskId}
          taskUpdatesByTaskId={taskUpdatesByTaskId}
          tasks={tasks}
        />
      </Suspense>
    </main>
  );
}

const PROJECT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function TaskSection({
  title,
  description,
  emptyMessage,
  tasks,
  projectId,
  currentUserId,
  canManageTasks,
  highlightedTaskId,
  taskUpdatesByTaskId,
  emphasizeOverdue = false,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  tasks: ProjectTask[];
  projectId: string;
  currentUserId: string;
  canManageTasks: boolean;
  highlightedTaskId?: string;
  taskUpdatesByTaskId: Record<string, ProjectTaskUpdate[]>;
  emphasizeOverdue?: boolean;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-2xl font-semibold text-lime-200">{title}</h2>
        <p className="mt-2 text-sm text-neutral-400">{description}</p>
      </div>
      {tasks.length > 0 ? (
        <TaskListTable
          canManageTasks={canManageTasks}
          currentUserId={currentUserId}
          emphasizeOverdue={emphasizeOverdue}
          highlightedTaskId={highlightedTaskId}
          projectId={projectId}
          taskUpdatesByTaskId={taskUpdatesByTaskId}
          tasks={tasks}
        />
      ) : (
        <p className="px-5 py-4 text-sm text-neutral-400">{emptyMessage}</p>
      )}
    </section>
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

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-300">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-300">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      >
        {options.map((option) => (
          <option key={option.value || "unassigned"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}