import { notFound, redirect } from "next/navigation";
import { PortalIcon } from "@/app/icons";
import AdminFormButton from "@/app/admin/admin-form-button";
import { getCurrentSessionUser } from "@/lib/demo";
import {
  createProjectTask,
  deleteProject,
  deleteProjectTask,
  getProjectDashboard,
  isCurrentUserProjectManager,
  updateProject,
  updateProjectTask,
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
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.isDemo) {
    redirect("/projects");
  }

  const canAccessProjects = await isCurrentUserProjectManager();

  if (!canAccessProjects) {
    redirect("/dashboard");
  }

  const { projectId } = await params;
  const dashboard = await getProjectDashboard(projectId);

  if (!dashboard) {
    notFound();
  }

  const { project, tasks, stats } = dashboard;
  const outstandingTasks = tasks.filter((task) => task.status !== "completed");
  const overdueTasks = tasks.filter((task) => isTaskOverdue(task));
  const completedTasks = tasks.filter((task) => task.status === "completed");

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Project Dashboard
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-3 max-w-3xl text-neutral-400">
            {project.description || "Track tasks, deadlines, and project completion."}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-400">
            <span>Status: {formatProjectStatus(project.status)}</span>
            <span>Start: {formatDisplayDate(project.startDate)}</span>
            <span>Target End: {formatDisplayDate(project.targetEndDate)}</span>
          </div>
        </header>

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
            label="Total Tasks"
            value={String(stats.totalTasks)}
            detail="Across this project"
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
              options={[
                { value: "active", label: "Active" },
                { value: "on_hold", label: "On Hold" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
            <AdminFormButton pendingLabel="Saving..." className="md:col-start-2 xl:col-start-6">
              Save Project
            </AdminFormButton>
          </form>
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

        <details className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-2xl font-semibold marker:hidden">
            <span>Add Task</span>
            <span className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-950">
              New Task
            </span>
          </summary>
          <form
            action={createProjectTask}
            className="mt-6 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]"
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
            <AdminFormButton pendingLabel="Adding..." className="md:col-start-2 xl:col-start-7">
              Add Task
            </AdminFormButton>
          </form>
        </details>

        <TaskSection
          title="Outstanding Tasks"
          description="Open tasks that still need attention."
          emptyMessage="No outstanding tasks. Everything is complete."
          tasks={outstandingTasks}
          projectId={project.id}
        />

        <TaskSection
          title="Overdue Tasks"
          description="Tasks past their due date and not yet completed."
          emptyMessage="No overdue tasks."
          tasks={overdueTasks}
          projectId={project.id}
          emphasizeOverdue
        />

        <TaskSection
          title="Completed Tasks"
          description="Finished work for this project."
          emptyMessage="No completed tasks yet."
          tasks={completedTasks}
          projectId={project.id}
        />
      </div>
    </main>
  );
}

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
  emphasizeOverdue = false,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  tasks: ProjectTask[];
  projectId: string;
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
              emphasizeOverdue={emphasizeOverdue || isTaskOverdue(task)}
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
  emphasizeOverdue,
}: {
  task: ProjectTask;
  projectId: string;
  emphasizeOverdue: boolean;
}) {
  return (
    <details className="group">
      <summary className="grid cursor-pointer list-none gap-3 px-5 py-4 transition hover:bg-white/[0.05] marker:hidden lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] lg:items-center">
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
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-lime-300 transition group-open:border-lime-300/60 group-open:bg-lime-400/10">
          <PortalIcon className="h-4 w-4" name="update" />
        </span>
      </summary>
      <div className="px-5 pb-5">
        <form
          action={updateProjectTask}
          className="grid gap-4 rounded-xl border border-white/10 bg-neutral-950/40 p-5 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]"
        >
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="projectId" value={projectId} />
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
            label="Status"
            name="status"
            defaultValue={task.status}
            options={TASK_STATUS_OPTIONS}
          />
          <SelectField
            label="Priority"
            name="priority"
            defaultValue={task.priority}
            options={TASK_PRIORITY_OPTIONS}
          />
          <AdminFormButton pendingLabel="Saving..." className="md:col-start-2 xl:col-start-7">
            Save Task
          </AdminFormButton>
        </form>
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
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}