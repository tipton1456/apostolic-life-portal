import { notFound, redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/demo";
import { getPlanningCenterLeaderTeamDetail } from "@/lib/planning-center";

type PageProps = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function PlanningCenterTeamDetailPage({ params }: PageProps) {
  const { teamId } = await params;
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  const team = await getPlanningCenterLeaderTeamDetail(
    teamId,
    user.email ?? undefined,
  );

  if (!team) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Group Management
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            {team.name}
          </h1>
          <p className="mt-3 text-neutral-400">
            Planning Center Team · {team.members.length} members
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-xl font-semibold">Team Members</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Planning Center team membership is listed here for leader reference.
            Contact details are only shown when Planning Center Services exposes
            them through the team roster.
          </p>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Leader</th>
                  <th className="px-5 py-3 font-medium">Birthdate</th>
                  <th className="px-5 py-3 font-medium">Mobile</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {team.members.map((member) => (
                  <tr key={member.id} className="transition hover:bg-white/[0.06]">
                    <td className="px-5 py-4 font-semibold text-neutral-100">
                      <div className="flex items-center gap-3">
                        {member.picture ? (
                          <img
                            src={member.picture}
                            alt={member.name}
                            className="h-8 w-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-400 text-xs font-bold text-neutral-950">
                            {getInitials(member.name)}
                          </span>
                        )}
                        <span>{member.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {member.isLeader ? (
                        <span
                          aria-label="Leader"
                          title="Leader"
                          className="block h-2.5 w-2.5 rounded-full bg-green-400"
                        />
                      ) : (
                        <span className="text-neutral-600">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      {member.birthdate}
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      {member.mobile}
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      {member.email}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
