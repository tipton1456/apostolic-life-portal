import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/demo";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { listAccessibleProjectFiles } from "@/lib/project-files";
import ProjectFilesTable from "@/app/projects/project-files-table";

export default async function ProjectFilesPage() {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login?next=/projects/files");
  }

  if (user.isDemo) {
    redirect("/projects");
  }

  const portalUser = await getCurrentPortalUser();

  if (!portalUser) {
    redirect("/login?next=/projects/files");
  }

  const isManager = portalUser.isAdmin || portalUser.canAccessProjects;

  if (!isManager) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("project_members")
      .select("id")
      .eq("user_id", portalUser.id)
      .limit(1);

    if (!data?.length) {
      redirect("/dashboard");
    }
  }

  const files = await listAccessibleProjectFiles();

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Project Management
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Project Files</h1>
          <p className="mt-3 max-w-3xl text-neutral-400">
            All files attached to tasks across the projects you can access. Active
            project files are stored on the portal server. Completed projects can
            also link to an archived Dropbox folder.
          </p>
        </header>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Your Files</h2>
              <p className="mt-2 text-sm text-neutral-400">
                {files.length} file{files.length === 1 ? "" : "s"} available
              </p>
            </div>
            <Link
              href="/projects"
              className="text-sm font-semibold text-lime-400 transition hover:text-lime-300"
            >
              Back to Projects
            </Link>
          </div>
          <ProjectFilesTable
            files={files}
            currentUserId={portalUser.id}
            isManager={isManager}
          />
        </section>
      </div>
    </main>
  );
}