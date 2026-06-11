import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/demo";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { getProjectDashboard } from "@/lib/project-management";
import { listProjectFiles } from "@/lib/project-files";
import ProjectFilesTable from "@/app/projects/project-files-table";

export default async function ProjectFilesMenuPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login?next=/projects");
  }

  if (user.isDemo) {
    redirect("/projects");
  }

  const portalUser = await getCurrentPortalUser();

  if (!portalUser) {
    redirect("/login?next=/projects");
  }

  const { projectId } = await params;
  const [dashboard, files] = await Promise.all([
    getProjectDashboard(projectId),
    listProjectFiles(projectId),
  ]);

  if (!dashboard) {
    notFound();
  }

  const { project, permissions } = dashboard;
  const isManager = permissions.isManager;
  const isProjectCompleted = project.status === "completed";

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Project Files
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-3 max-w-3xl text-neutral-400">
            All files attached to tasks in this project.
          </p>
          {isProjectCompleted ? (
            <div className="mt-5 flex flex-wrap gap-4">
              {files.length > 0 ? (
                <a
                  href={`/api/projects/${project.id}/files/download-all`}
                  className="inline-flex rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300"
                >
                  Download All Files (.zip)
                </a>
              ) : null}
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
          ) : null}
        </header>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Files</h2>
              <p className="mt-2 text-sm text-neutral-400">
                {files.length} file{files.length === 1 ? "" : "s"} in this project
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
              <Link
                href={`/projects/${project.id}`}
                className="text-lime-400 transition hover:text-lime-300"
              >
                Project Dashboard
              </Link>
              <Link
                href="/projects/files"
                className="text-lime-400 transition hover:text-lime-300"
              >
                All Project Files
              </Link>
            </div>
          </div>
          <ProjectFilesTable
            files={files}
            currentUserId={portalUser.id}
            isManager={isManager}
            showProjectColumn={false}
          />
        </section>
      </div>
    </main>
  );
}