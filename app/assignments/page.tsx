import Link from "next/link";
import { redirect } from "next/navigation";
import { getUpcomingAssignments } from "@/lib/planning-center";
import { createClient } from "@/lib/supabase/server";
import AssignmentCountSelect from "./assignment-count-select";

type PageProps = {
  searchParams: Promise<{
    count?: string;
  }>;
};

const VALID_COUNTS = [3, 5, 10];

export default async function AssignmentsPage({ searchParams }: PageProps) {
  const { count: countParam } = await searchParams;
  const count = parseAssignmentCount(countParam);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const assignments = await getUpcomingAssignments(user.email ?? undefined, count);

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
                Planning Center
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">
                Assignments
              </h1>
              <p className="mt-3 max-w-2xl text-neutral-400">
                Upcoming service assignments connected to your Planning Center
                profile.
              </p>
            </div>

            <AssignmentCountSelect count={count} />
          </div>
        </header>

        <section className="mt-8">
          <AssignmentTable assignments={assignments} userEmail={user.email} />
        </section>
      </div>
    </main>
  );
}

function AssignmentTable({
  assignments,
  userEmail,
}: {
  assignments: Awaited<ReturnType<typeof getUpcomingAssignments>>;
  userEmail?: string;
}) {
  return (
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
                  <AssignmentCell assignment={assignment} emphasis>
                    {assignment.dates}
                  </AssignmentCell>
                  <AssignmentCell assignment={assignment}>
                    {assignment.serviceTypeName}
                  </AssignmentCell>
                  <AssignmentCell assignment={assignment}>
                    {assignment.team}
                  </AssignmentCell>
                  <AssignmentCell assignment={assignment}>
                    {assignment.position}
                  </AssignmentCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6">
          <h2 className="text-xl font-semibold">No assignments found</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
            We could not find upcoming Planning Center assignments for
            {userEmail ? ` ${userEmail}` : " this login email"} yet.
          </p>
        </div>
      )}
    </div>
  );
}

function AssignmentCell({
  assignment,
  children,
  emphasis = false,
}: {
  assignment: Awaited<ReturnType<typeof getUpcomingAssignments>>[number];
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <td
      className={
        emphasis
          ? "px-5 py-4 font-semibold text-lime-300"
          : "px-5 py-4 text-neutral-300"
      }
    >
      <Link
        href={assignment.detailHref}
        className="block"
      >
        {children}
      </Link>
    </td>
  );
}

function parseAssignmentCount(value?: string) {
  const parsedCount = Number(value);

  return VALID_COUNTS.includes(parsedCount) ? parsedCount : 3;
}
