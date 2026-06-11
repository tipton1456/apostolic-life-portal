import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/demo";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { hasDropboxConfig } from "@/lib/dropbox";
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
          {!hasDropboxConfig() ? (
            <p className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">
              Dropbox is not configured yet. Add the Dropbox environment variables
              to enable uploads and downloads.
            </p>
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