import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeaderGroupsForEmail } from "@/lib/elvanto-groups";
import { getCurrentSessionUser } from "@/lib/demo";
import { getPlanningCenterLeaderTeamsForEmail } from "@/lib/planning-center";

export default async function GroupManagementPage() {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  const [leaderGroups, planningCenterLeaderTeams] = await Promise.all([
    getLeaderGroupsForEmail(user.email ?? undefined),
    getPlanningCenterLeaderTeamsForEmail(user.email ?? undefined),
  ]);

  if (leaderGroups.length === 0 && planningCenterLeaderTeams.length === 0) {
    redirect("/dashboard");
  }

  const managedGroups = [
    ...leaderGroups.map((group) => ({
      href: `/groups/${group.id}`,
      id: group.id,
      leaders: "You",
      name: group.name,
      type: "Elvanto Group",
    })),
    ...planningCenterLeaderTeams.map((team) => ({
      href: team.href,
      id: team.id,
      leaders: team.leaders,
      name: team.name,
      type: team.type,
    })),
  ].sort((firstGroup, secondGroup) =>
    firstGroup.name.localeCompare(secondGroup.name),
  );

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Groups
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Group Management
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Elvanto groups and Planning Center teams where you are listed as a
            leader.
          </p>
        </header>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="divide-y divide-white/10">
            {managedGroups.map((group) => (
              <Link
                key={`${group.type}-${group.id}`}
                href={group.href}
                className="block px-5 py-4 transition hover:bg-white/[0.06]"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-neutral-100">{group.name}</p>
                    <p className="mt-1 text-sm text-lime-300">{group.type}</p>
                  </div>
                  <p className="text-sm text-neutral-400">
                    Leaders: {group.leaders}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
