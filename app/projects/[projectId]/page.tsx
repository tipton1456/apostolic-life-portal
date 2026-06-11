import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalIcon } from "@/app/icons";
import AdminFormButton from "@/app/admin/admin-form-button";
import HighlightTask from "@/app/projects/highlight-task";
import { getCurrentSessionUser } from "@/lib/demo";
import { listProjectFiles, uploadProjectTaskFile } from "@/lib/project-files";
import {
  formatProjectFileDate,
  formatProjectFileSize,
} from "@/lib/project-files-utils";
import type { ProjectTaskFile } from "@/lib/project-files";
import { getCurrentPortalUser } from "@/lib/portal-users";
import {
  addProjectMember,
  canCurrentUserAccessProjects,
  createProjectTask,
  deleteProject,
  deleteProjectTask,
  getProjectDashboard,
  listAssignablePortalUsers,
  removeProjectMember,
  updateProject,
  updateProjectTask,
  uploadProjectImage,
  type ProjectTask,
} from "@/lib/project-management";
import {
  formatDisplayDate,
  formatProjectStatus,
  formatTaskPriority,
  formatTaskStatus,
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
  const [dashboard, portalUser, projectFiles] = await Promise.all([
    getProjectDashboard(projectId),
    getCurrentPortalUser(),
    listProjectFiles(projectId).catch(() => [] as ProjectTaskFile[]),
  ]);
  const filesByTaskId = new Map<string, ProjectTaskFile[]>();

  for (const file of projectFiles) {
    const existing = filesByTaskId.get(file.taskId) ?? [];
    existing.push(file);
    filesByTaskId.set(file.taskId, existing);
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

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <HighlightTask taskId={highlightedTaskId} />
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Project Dashboard
          </p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(42%,28rem)] lg:items-start">
            <div className="min-w-0 text-left">
              <h1 className="text-4xl font-bold tracking-tight">{project.name}</h1>
              <p className="mt-3 max-w-3xl text-neutral-400">
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
            <div className="w-full">
              {project.imageUrl ? (
                <img
                  src={project.imageUrl}
                  alt={`${project.name} project`}
                  className="aspect-video w-full rounded-2xl border border-white/10 object-cover"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] text-sm text-neutral-500">
                  No project image yet
                </div>
              )}
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
              <SelectField
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
          assigneeOptions={assigneeOptions}
          highlightedTaskId={highlightedTaskId}
          filesByTaskId={filesByTaskId}
          isProjectCompleted={isProjectCompleted}
        />

        <TaskSection
          title="Overdue Tasks"
          description="Tasks past their due date and not yet completed."
          emptyMessage="No overdue tasks."
          tasks={overdueTasks}
          projectId={project.id}
          currentUserId={portalUser.id}
          canManageTasks={permissions.canManageTasks}
          assigneeOptions={assigneeOptions}
          highlightedTaskId={highlightedTaskId}
          filesByTaskId={filesByTaskId}
          isProjectCompleted={isProjectCompleted}
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
          assigneeOptions={assigneeOptions}
          highlightedTaskId={highlightedTaskId}
          filesByTaskId={filesByTaskId}
          isProjectCompleted={isProjectCompleted}
        />
      </div>
    </main>
  );
}

const PROJECT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
];

const TASK_PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function TaskSection({
  title,
  description,
  emptyMessage,
  tasks,
  projectId,
  currentUserId,
  canManageTasks,
  assigneeOptions,
  highlightedTaskId,
  filesByTaskId,
  isProjectCompleted,
  emphasizeOverdue = false,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  tasks: ProjectTask[];
  projectId: string;
  currentUserId: string;
  canManageTasks: boolean;
  assigneeOptions: Array<{ value: string; label: string }>;
  highlightedTaskId?: string;
  filesByTaskId: Map<string, ProjectTaskFile[]>;
  isProjectCompleted: boolean;
  emphasizeOverdue?: boolean;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-neutral-400">{description}</p>
      </div>
      <div className="divide-y divide-white/10">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              projectId={projectId}
              currentUserId={currentUserId}
              canManageTasks={canManageTasks}
              assigneeOptions={assigneeOptions}
              emphasizeOverdue={emphasizeOverdue || isTaskOverdue(task)}
              highlighted={highlightedTaskId === task.id}
              taskFiles={filesByTaskId.get(task.id) ?? []}
              isProjectCompleted={isProjectCompleted}
            />
          ))
        ) : (
          <p className="px-5 py-4 text-sm text-neutral-400">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  projectId,
  currentUserId,
  canManageTasks,
  assigneeOptions,
  emphasizeOverdue,
  highlighted,
  taskFiles,
  isProjectCompleted,
}: {
  task: ProjectTask;
  projectId: string;
  currentUserId: string;
  canManageTasks: boolean;
  assigneeOptions: Array<{ value: string; label: string }>;
  emphasizeOverdue: boolean;
  highlighted: boolean;
  taskFiles: ProjectTaskFile[];
  isProjectCompleted: boolean;
}) {
  const canEdit =
    canManageTasks || (task.assignedTo === currentUserId && task.status !== "completed");

  return (
    <details
      id={`task-${task.id}`}
      className={`group rounded-xl transition ${highlighted ? "bg-lime-400/5" : ""}`}
    >
      <summary className="grid cursor-pointer list-none gap-3 px-5 py-4 transition hover:bg-white/[0.05] marker:hidden lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] lg:items-center">
        <div>
          <p className="font-semibold text-neutral-100">{task.title}</p>
          {task.description ? (
            <p className="mt-1 line-clamp-1 text-sm text-neutral-400">
              {task.description}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500 lg:hidden">
            Assigned
          </p>
          <p className="text-neutral-300">{task.assignedName ?? "Unassigned"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500 lg:hidden">
            Status
          </p>
          <p className="text-neutral-300">{formatTaskStatus(task.status)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500 lg:hidden">
            Priority
          </p>
          <p className="text-neutral-300">{formatTaskPriority(task.priority)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500 lg:hidden">
            Timeline
          </p>
          <p className="text-sm text-neutral-300">
            {formatDisplayDate(task.startDate)} - {formatDisplayDate(task.dueDate)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500 lg:hidden">
            Due
          </p>
          <p
            className={
              emphasizeOverdue
                ? "font-semibold text-red-300"
                : "text-neutral-300"
            }
          >
            {formatDisplayDate(task.dueDate)}
          </p>
        </div>
        {canEdit ? (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-lime-300 transition group-open:border-lime-300/60 group-open:bg-lime-400/10">
            <PortalIcon className="h-4 w-4" name="update" />
          </span>
        ) : (
          <span className="text-xs text-neutral-500">View only</span>
        )}
      </summary>
      {canEdit ? (
        <div className="px-5 pb-5">
          <form
            action={updateProjectTask}
            className="grid gap-4 rounded-xl border border-white/10 bg-neutral-950/40 p-5 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_auto]"
          >
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="projectId" value={projectId} />
            {canManageTasks ? (
              <>
                <Field label="Task title" name="title" defaultValue={task.title} required />
                <Field
                  label="Description"
                  name="description"
                  defaultValue={task.description}
                />
                <Field
                  label="Start date"
                  name="startDate"
                  type="date"
                  defaultValue={task.startDate ?? ""}
                />
                <Field
                  label="Due date"
                  name="dueDate"
                  type="date"
                  defaultValue={task.dueDate ?? ""}
                />
                <SelectField
                  label="Priority"
                  name="priority"
                  defaultValue={task.priority}
                  options={TASK_PRIORITY_OPTIONS}
                />
                <SelectField
                  label="Assigned to"
                  name="assignedTo"
                  defaultValue={task.assignedTo ?? ""}
                  options={assigneeOptions}
                />
              </>
            ) : (
              <>
                <input type="hidden" name="title" value={task.title} />
                <input type="hidden" name="description" value={task.description} />
                <input type="hidden" name="startDate" value={task.startDate ?? ""} />
                <input type="hidden" name="dueDate" value={task.dueDate ?? ""} />
                <input type="hidden" name="priority" value={task.priority} />
                <input type="hidden" name="assignedTo" value={task.assignedTo ?? ""} />
              </>
            )}
            <SelectField
              label="Status"
              name="status"
              defaultValue={task.status}
              options={TASK_STATUS_OPTIONS}
            />
            <AdminFormButton pendingLabel="Saving..." className="md:col-start-2 xl:col-start-8">
              Save Task
            </AdminFormButton>
          </form>
          {canManageTasks ? (
            <form action={deleteProjectTask} className="mt-3 flex justify-end">
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="projectId" value={projectId} />
              <AdminFormButton
                pendingLabel="Deleting..."
                variant="danger"
                className="rounded-lg px-3 py-2"
              >
                <PortalIcon className="h-4 w-4" name="trash" />
                Delete Task
              </AdminFormButton>
            </form>
          ) : null}
        </div>
      ) : null}
      <div className="border-t border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Task Files
          </h3>
          <span className="text-xs text-neutral-500">
            {taskFiles.length} file{taskFiles.length === 1 ? "" : "s"}
          </span>
        </div>
        {taskFiles.length > 0 ? (
          <div className="mt-3 space-y-2">
            {taskFiles.map((file) => (
              <div
                key={file.id}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-neutral-100">{file.fileName}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatProjectFileSize(file.fileSize)} ·{" "}
                    {file.uploadedByName} · {formatProjectFileDate(file.createdAt)}
                  </p>
                </div>
                <a
                  href={`/api/projects/files/${file.id}/download`}
                  className="inline-flex w-fit rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-lime-300 transition hover:border-lime-300/60 hover:bg-lime-400/10"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No files attached to this task yet.</p>
        )}
        {!isProjectCompleted ? (
          <form
            action={uploadProjectTaskFile}
            encType="multipart/form-data"
            className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-neutral-950/40 p-4 md:grid-cols-[1fr_auto]"
          >
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="taskId" value={task.id} />
            <label className="block text-sm font-medium text-neutral-300">
              Attach file
              <input
                name="taskFile"
                type="file"
                required
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
                className="mt-2 block w-full text-sm text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-lime-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-950 hover:file:bg-lime-300"
              />
            </label>
            <AdminFormButton pendingLabel="Uploading..." className="md:mt-7">
              Upload File
            </AdminFormButton>
          </form>
        ) : (
          <p className="mt-3 text-sm text-neutral-400">
            Uploads are closed for completed projects. Use Download All Files above,
            then add the Dropbox archive link in Project Settings.
          </p>
        )}
      </div>
    </details>
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
  options: Array<{ value: string; label: string }>;
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