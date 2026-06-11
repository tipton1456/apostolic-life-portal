import Link from "next/link";
import { redirect } from "next/navigation";
import AdminFormButton from "@/app/admin/admin-form-button";
import ProjectFilesPreview from "@/app/projects/project-files-preview";
import { getCurrentSessionUser } from "@/lib/demo";
import { listAccessibleProjectFiles } from "@/lib/project-files";
import {
  canCurrentUserAccessProjects,
  createProject,
  isCurrentUserProjectManager,
  listProjects,
} from "@/lib/project-management";
import {
  formatDisplayDate,
  formatProjectStatus,
} from "@/lib/project-management-utils";

export default async function ProjectsPage() {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.isDemo) {
    return (
      <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Project Management
          </p>
          <h1 className="mt-3 text-3xl font-bold">Live Login Required</h1>
          <p className="mt-3 text-neutral-400">
            Project management uses Supabase data and is not available in demo
            mode. Sign in with your portal account to continue.
          </p>
        </div>
      </main>
    );
  }

  const canAccessProjects = await canCurrentUserAccessProjects();

  if (!canAccessProjects) {
    redirect("/dashboard");
  }

  const isManager = await isCurrentUserProjectManager();
  const [projects, recentFiles] = await Promise.all([
    listProjects(),
    listAccessibleProjectFiles(8).catch((error) => {
      console.error("Recent project files preview failed:", error);
      return [];
    }),
  ]);

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Project Management
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            {isManager ? "Projects" : "My Projects"}
          </h1>
          <p className="mt-3 max-w-3xl text-neutral-400">
            {isManager
              ? "Manage church projects, track tasks, deadlines, and completion progress from one dashboard."
              : "View the projects you are on, your assigned tasks, and project progress."}
          </p>
        </header>

        <div className="mt-8">
          <ProjectFilesPreview
            files={recentFiles}
            title="Recent Files"
            viewAllHref="/projects/files"
          />
        </div>

        {isManager ? (
        <details className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-2xl font-semibold marker:hidden">
            <span>New Project</span>
            <span className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-950">
              Add Project
            </span>
          </summary>
          <form
            action={createProject}
            className="mt-6 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_auto]"
          >
            <Field label="Project name" name="name" required />
            <Field label="Description" name="description" />
            <Field label="Start date" name="startDate" type="date" />
            <Field label="Target end date" name="targetEndDate" type="date" />
            <SelectField
              label="Status"
              name="status"
              defaultValue="active"
              options={[
                { value: "active", label: "Active" },
                { value: "on_hold", label: "On Hold" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
            <AdminFormButton pendingLabel="Creating..." className="md:col-start-2 xl:col-start-6">
              Create Project
            </AdminFormButton>
          </form>
        </details>
        ) : null}

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.length > 0 ? (
            projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-lime-400/60 hover:bg-white/[0.06]"
              >
                <div className="flex items-start gap-4">
                  <ProjectCardThumbnail
                    imageUrl={project.imageUrl}
                    projectName={project.name}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                          {formatProjectStatus(project.status)}
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-neutral-100">
                          {project.name}
                        </h2>
                      </div>
                      <span className="shrink-0 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-sm font-semibold text-lime-300">
                        {project.completionPercent}%
                      </span>
                    </div>
                  </div>
                </div>

                {project.description ? (
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-neutral-400">
                    {project.description}
                  </p>
                ) : null}

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-lime-400 transition-all"
                    style={{ width: `${project.completionPercent}%` }}
                  />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                  <Stat label="Outstanding" value={project.outstandingTasks} />
                  <Stat
                    label="Overdue"
                    value={project.overdueTasks}
                    highlight={project.overdueTasks > 0}
                  />
                  <Stat label="Completed" value={project.completedTasks} />
                </div>

                <p className="mt-5 text-xs text-neutral-500">
                  Timeline: {formatDisplayDate(project.startDate)} to{" "}
                  {formatDisplayDate(project.targetEndDate)}
                </p>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:col-span-2 xl:col-span-3">
              <h2 className="text-2xl font-semibold">No projects yet</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
                Create your first project to start adding tasks, deadlines, and
                tracking completion progress.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ProjectCardThumbnail({
  imageUrl,
  projectName,
}: {
  imageUrl: string | null;
  projectName: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${projectName} project`}
        className="h-20 w-20 shrink-0 rounded-xl border border-white/10 object-cover"
      />
    );
  }

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
      No image
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      <p
        className={
          highlight
            ? "mt-1 text-lg font-semibold text-red-300"
            : "mt-1 text-lg font-semibold text-neutral-100"
        }
      >
        {value}
      </p>
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