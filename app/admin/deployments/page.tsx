import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalIcon } from "@/app/icons";
import { getCurrentPortalUser } from "@/lib/portal-users";
import {
  getVercelDeploymentConfig,
  hasVercelDeploymentConfig,
  listPortalDeployments,
  type PortalDeployment,
} from "@/lib/vercel-deployments";

export default async function DeploymentLogPage() {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  const config = getVercelDeploymentConfig();

  if (!hasVercelDeploymentConfig()) {
    return <SetupRequired project={config.project} />;
  }

  let deployments: PortalDeployment[] = [];
  let loadError = "";

  try {
    deployments = await listPortalDeployments();
  } catch (error) {
    console.error("Deployment log page failed:", error);
    loadError =
      error instanceof Error ? error.message : "Unable to load deployments.";
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Administration
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Deployment Log
          </h1>
          <p className="mt-3 max-w-3xl text-neutral-400">
            Recent production deployments for the portal, including commit
            messages, authors, deployment state, and Vercel inspection links.
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-100">
                Production Updates
              </h2>
              <p className="mt-2 text-sm text-neutral-400">
                Project: {config.project}
                {config.teamId ? ` | Team: ${config.teamId}` : ""}
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-xl border border-lime-400/40 px-4 py-3 text-sm font-semibold text-lime-300 transition hover:bg-lime-400/10"
            >
              Back to Admin
            </Link>
          </div>

          {loadError ? (
            <p className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
              {loadError}
            </p>
          ) : null}

          {!loadError && deployments.length === 0 ? (
            <p className="mt-5 rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-4 text-sm text-neutral-400">
              No production deployments were returned for this Vercel project.
            </p>
          ) : null}

          {deployments.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                  <tr>
                    <th className="py-3 pr-4 font-semibold">Date</th>
                    <th className="py-3 pr-4 font-semibold">Update</th>
                    <th className="py-3 pr-4 font-semibold">Author</th>
                    <th className="py-3 pr-4 font-semibold">Branch</th>
                    <th className="py-3 pr-4 font-semibold">Commit</th>
                    <th className="py-3 pr-4 font-semibold">State</th>
                    <th className="py-3 font-semibold">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {deployments.map((deployment) => (
                    <tr key={deployment.id} className="text-neutral-200">
                      <td className="py-4 pr-4 text-neutral-300">
                        {formatDateTime(deployment.createdAt)}
                      </td>
                      <td className="max-w-md py-4 pr-4 font-semibold">
                        {deployment.commitMessage}
                      </td>
                      <td className="py-4 pr-4 text-neutral-300">
                        {deployment.author}
                      </td>
                      <td className="py-4 pr-4 text-neutral-300">
                        {deployment.branch}
                      </td>
                      <td className="py-4 pr-4 text-neutral-400">
                        {deployment.commitSha
                          ? deployment.commitSha.slice(0, 7)
                          : "Unknown"}
                      </td>
                      <td className="py-4 pr-4">
                        <span className={getStateClassName(deployment.state)}>
                          {deployment.state}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-2">
                          {deployment.url ? (
                            <a
                              href={deployment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:border-lime-400/60 hover:text-lime-300"
                            >
                              Open
                            </a>
                          ) : null}
                          {deployment.inspectorUrl ? (
                            <a
                              href={deployment.inspectorUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:border-lime-400/60 hover:text-lime-300"
                            >
                              Inspect
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function SetupRequired({ project }: { project: string }) {
  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-lime-400/30 bg-lime-400/10 text-lime-300">
          <PortalIcon name="deployments" />
        </span>
        <p className="mt-5 text-sm uppercase tracking-[0.3em] text-lime-400">
          Administration
        </p>
        <h1 className="mt-3 text-3xl font-bold">Deployment Log Setup</h1>
        <p className="mt-3 text-neutral-400">
          Add a server-only Vercel token so portal administrators can view
          deployments without logging into Vercel.
        </p>
        <div className="mt-5 rounded-xl border border-white/10 bg-neutral-950/50 p-4 text-sm text-neutral-300">
          <p className="font-semibold text-neutral-100">Required env var</p>
          <p className="mt-2 font-mono text-lime-300">VERCEL_API_TOKEN</p>
          <p className="mt-4 font-semibold text-neutral-100">Optional env vars</p>
          <p className="mt-2 font-mono text-neutral-300">
            VERCEL_PROJECT_ID={project}
          </p>
          <p className="mt-1 font-mono text-neutral-300">VERCEL_TEAM_ID</p>
        </div>
        <Link
          href="/admin"
          className="mt-5 inline-flex items-center justify-center rounded-xl border border-lime-400/40 px-4 py-3 text-sm font-semibold text-lime-300 transition hover:bg-lime-400/10"
        >
          Back to Admin
        </Link>
      </div>
    </main>
  );
}

function formatDateTime(value: string) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStateClassName(state: string) {
  const normalizedState = state.toUpperCase();

  if (normalizedState === "READY") {
    return "inline-flex rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-300";
  }

  if (["ERROR", "CANCELED"].includes(normalizedState)) {
    return "inline-flex rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-200";
  }

  return "inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-100";
}
