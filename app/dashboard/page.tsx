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

          <div className="grid gap-4 md:grid-cols-3">
            {assignments.length > 0 ? (
              assignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  href={assignment.detailHref}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-lime-400/60 hover:bg-white/[0.07]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-lime-300">
                        {assignment.dates}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold">
                        {assignment.serviceTypeName}
                      </h3>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-300">
                      {assignment.status}
                    </span>
                  </div>
                  <div className="mt-5 space-y-3 text-sm">
                    <InfoLine label="Team" value={assignment.team} />
                    <InfoLine label="Position" value={assignment.position} />
                    <InfoLine label="Times" value={assignment.times} />
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:col-span-3">
                <h3 className="text-xl font-semibold">No assignments found</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
                  We could not find upcoming Planning Center assignments for
                  this login email yet.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <Link
            href="/contact"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-lime-400/60 hover:bg-white/[0.06]"
          >
            <h2 className="text-xl font-semibold">Contact Information</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              View your contact details and submit update requests.
            </p>
          </Link>

          <Link
            href="/contact"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-lime-400/60 hover:bg-white/[0.06]"
          >
            <h2 className="text-xl font-semibold">Family Members</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              See household information connected through Elvanto.
            </p>
          </Link>

          <Link
            href="/contact/request-update"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-lime-400/60 hover:bg-white/[0.06]"
          >
            <h2 className="text-xl font-semibold">Request Changes</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Send updated phone, email, address, or family details for review.
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-neutral-200">{value}</p>
    </div>
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
