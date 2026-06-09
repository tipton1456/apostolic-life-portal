import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalIcon } from "@/app/icons";
import { getCurrentSessionUser } from "@/lib/demo";
import { getMemberGroupsForEmail } from "@/lib/elvanto-groups";
import { getPlanningCenterTeamsForEmail } from "@/lib/planning-center";

export default async function MyGroupsPage() {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  const [elvantoGroups, planningCenterTeams] = await Promise.all([
    getMemberGroupsForEmail(user.email ?? undefined),
    getPlanningCenterTeamsForEmail(user.email ?? undefined),
  ]);
  const groups = [...elvantoGroups, ...planningCenterTeams].sort(
    (firstGroup, secondGroup) =>
      firstGroup.name.localeCompare(secondGroup.name) ||
      firstGroup.type.localeCompare(secondGroup.type),
  );

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Groups
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">My Groups</h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Elvanto groups and Planning Center teams connected to your profile.
          </p>
        </header>

        <section className="mt-8">
          {groups.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Type of Group</th>
                      <th className="px-5 py-3 font-medium">Group Leader</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {groups.map((group) => (
                      <tr key={`${group.type}-${group.id}`} className="transition hover:bg-white/[0.06]">
                        <td className="px-5 py-4 font-semibold text-neutral-100">
                          {group.name}
                        </td>
                        <td className="px-5 py-4 text-lime-300">
                          {group.type}
                        </td>
                        <td className="px-5 py-4 text-neutral-300">
                          {group.leaders}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lime-400/10 text-lime-300">
                <PortalIcon name="groups" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">No groups found</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
                We could not find Elvanto groups or Planning Center teams tied
                to your login email yet.
              </p>
            </div>
          )}
        </section>

        <div className="mt-8">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-lime-400 hover:text-lime-300"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
