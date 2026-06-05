import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlanDetail } from "@/lib/planning-center";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    serviceTypeId: string;
    planId: string;
  }>;
};

export default async function SchedulePlanPage({ params }: PageProps) {
  const { serviceTypeId, planId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const detail = await getPlanDetail(serviceTypeId, planId, user.email);

  if (!detail) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          className="text-sm text-lime-400 hover:text-lime-300"
        >
          ← Back to Dashboard
        </Link>

        <header className="mt-8 border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Service Plan
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            {detail.plan.title}
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            {detail.plan.dates}
            {detail.plan.seriesTitle ? ` · ${detail.plan.seriesTitle}` : ""}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={detail.plan.teamsHref}
              className="rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300"
            >
              View All Teams
            </Link>
            <Link
              href={detail.plan.orderHref}
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-100 transition hover:border-lime-400/60"
            >
              View Full Order
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">My Assignment</h2>
            {detail.assignment ? (
              <div className="mt-5 space-y-4">
                <Info label="Team" value={detail.assignment.team} />
                <Info label="Position" value={detail.assignment.position} />
                <Info label="Status" value={detail.assignment.status} />
                <Info label="Times" value={detail.assignment.times} />
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-neutral-400">
                You can view this plan, but no matching assignment was found in
                your next three scheduled items.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-neutral-500">
                  My Team
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {detail.myTeamName ?? "Team Assignments"}
                </h2>
              </div>
              <p className="text-sm text-neutral-400">
                {detail.teamMembers.length} scheduled
              </p>
            </div>

            <TeamMemberGrid members={detail.teamMembers} />
          </div>
        </section>
      </div>
    </main>
  );
}

function TeamMemberGrid({
  members,
}: {
  members: Array<{
    id: string;
    name: string;
    position: string;
    status: string;
  }>;
}) {
  if (members.length === 0) {
    return (
      <p className="mt-5 text-sm leading-6 text-neutral-400">
        No team assignments are visible for this plan.
      </p>
    );
  }

  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="rounded-xl border border-white/10 bg-neutral-950/40 p-4"
        >
          <p className="font-semibold text-neutral-100">{member.name}</p>
          <p className="mt-1 text-sm text-lime-300">{member.position}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-neutral-500">
            {member.status}
          </p>
        </div>
      ))}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-neutral-200">{value}</p>
    </div>
  );
}
