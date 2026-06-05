import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFullTeamsDetail } from "@/lib/planning-center";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    serviceTypeId: string;
    planId: string;
  }>;
};

export default async function ScheduleTeamsPage({ params }: PageProps) {
  const { serviceTypeId, planId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const detail = await getFullTeamsDetail(serviceTypeId, planId);

  if (!detail) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/schedule/${serviceTypeId}/${planId}`}
          className="text-sm text-lime-400 hover:text-lime-300"
        >
          ← Back to Service Plan
        </Link>

        <header className="mt-8 border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            All Teams
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            {detail.plan.title}
          </h1>
          <p className="mt-3 text-neutral-400">{detail.plan.dates}</p>
        </header>

        <section className="mt-8 space-y-6">
          {detail.teams.length > 0 ? (
            detail.teams.map((team) => (
              <div
                key={team.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <h2 className="text-2xl font-semibold">{team.name}</h2>
                  <p className="text-sm text-neutral-400">
                    {team.members.length} scheduled
                  </p>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {team.members.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-xl border border-white/10 bg-neutral-950/40 p-4"
                    >
                      <p className="font-semibold text-neutral-100">
                        {member.name}
                      </p>
                      <p className="mt-1 text-sm text-lime-300">
                        {member.position}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-neutral-500">
                        {member.status}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-semibold">No teams visible</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                Planning Center did not return visible team assignments for
                this plan.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
