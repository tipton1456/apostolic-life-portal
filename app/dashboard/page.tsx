import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getHousehold } from "@/lib/elvanto";
import { getUpcomingAssignments } from "@/lib/planning-center";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [household, assignments] = await Promise.all([
    getHousehold(user.email ?? undefined),
    getUpcomingAssignments(user.email ?? undefined),
  ]);
  const loggedInPerson = household?.primary;
  const displayName = loggedInPerson
    ? `${loggedInPerson.firstName} ${loggedInPerson.lastName}`
    : user.email ?? "Member";

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="mb-10 border-b border-white/10 pb-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <Image
                src="/apostolic-life-white.png"
                alt="Apostolic Life Tupelo Mississippi"
                width={1786}
                height={535}
                priority
                className="h-auto w-72 max-w-full"
              />
              <h1 className="mt-3 text-4xl font-bold tracking-tight">
                Member Portal
              </h1>
              <p className="mt-3 max-w-2xl text-neutral-400">
                A simple place for members to view contact information, family
                details, schedules, events, and future church resources.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              {loggedInPerson?.picture ? (
                <img
                  src={loggedInPerson.picture}
                  alt={displayName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-400 text-sm font-bold text-neutral-950">
                  {getInitials(displayName)}
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Signed in
                </p>
                <p className="text-sm font-semibold text-neutral-100">
                  {displayName}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-10">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
                Upcoming Schedule
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Next 3 Assignments
              </h2>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            {assignments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Plan</th>
                      <th className="px-5 py-3 font-medium">Team</th>
                      <th className="px-5 py-3 font-medium">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {assignments.map((assignment) => (
                      <tr
                        key={assignment.id}
                        className="transition hover:bg-white/[0.06]"
                      >
                        <td className="px-5 py-4 font-semibold text-lime-300">
                          <Link
                            href={`/schedule/${assignment.serviceTypeId}/${assignment.planId}/teams`}
                            className="block"
                          >
                            {assignment.dates}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-neutral-100">
                          <Link
                            href={`/schedule/${assignment.serviceTypeId}/${assignment.planId}/teams`}
                            className="block"
                          >
                            {assignment.serviceTypeName}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-neutral-300">
                          <Link
                            href={`/schedule/${assignment.serviceTypeId}/${assignment.planId}/teams`}
                            className="block"
                          >
                            {assignment.team}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-neutral-300">
                          <Link
                            href={`/schedule/${assignment.serviceTypeId}/${assignment.planId}/teams`}
                            className="block"
                          >
                            {assignment.position}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="text-xl font-semibold">No assignments found</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
                  We could not find upcoming Planning Center assignments for
                  {user.email ? ` ${user.email}` : " this login email"} yet.
                </p>
              </div>
            )}
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
