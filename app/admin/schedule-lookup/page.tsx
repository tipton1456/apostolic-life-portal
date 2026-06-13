import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPortalUser } from "@/lib/portal-users";
import {
  getPlanningCenterPerson,
  getUpcomingAssignmentsForPersonId,
  type UpcomingAssignment,
} from "@/lib/planning-center";
import PlanningCenterPersonSearch from "./planning-center-person-search";

type PageProps = {
  searchParams: Promise<{
    personId?: string;
  }>;
};

export default async function ScheduleLookupPage({ searchParams }: PageProps) {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  const { personId } = await searchParams;
  const [person, assignments] = personId
    ? await Promise.all([
        getPlanningCenterPerson(personId),
        getUpcomingAssignmentsForPersonId(personId, 50),
      ])
    : [null, []];

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Administration
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Schedule Look Up
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Search Planning Center people and view their upcoming assignments.
          </p>
        </header>

        <PlanningCenterPersonSearch selectedPerson={person} />

        {person ? (
          <section className="mt-8">
            <div className="mb-5 flex items-center gap-4">
              {person.thumbnail ? (
                <img
                  src={person.thumbnail}
                  alt={person.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lime-400 text-lg font-bold text-neutral-950">
                  {getInitials(person.name)}
                </span>
              )}
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-neutral-500">
                  Planning Center Person
                </p>
                <h2 className="mt-1 text-2xl font-semibold">{person.name}</h2>
              </div>
            </div>

            <AssignmentTable assignments={assignments} personName={person.name} />
          </section>
        ) : (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Choose a person</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Search above to select a Planning Center person and load their
              assignments.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function AssignmentTable({
  assignments,
  personName,
}: {
  assignments: UpcomingAssignment[];
  personName: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      {assignments.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Plan Title</th>
                <th className="px-5 py-3 font-medium">Position</th>
                <th className="px-5 py-3 font-medium">Team</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {assignments.map((assignment) => (
                <tr
                  key={assignment.id}
                  className="transition hover:bg-white/[0.06]"
                >
                  <AssignmentCell assignment={assignment} emphasis>
                    {assignment.seriesArtUrl && (
                      <img
                        src={assignment.seriesArtUrl}
                        alt="Series artwork"
                        className="mr-1.5 inline-block h-4 w-4 flex-shrink-0 rounded object-cover align-middle"
                      />
                    )}
                    {assignment.dates}
                  </AssignmentCell>
                  <AssignmentCell assignment={assignment}>
                    {assignment.serviceTypeName}
                  </AssignmentCell>
                  <AssignmentCell assignment={assignment}>
                    {assignment.position}
                  </AssignmentCell>
                  <AssignmentCell assignment={assignment}>
                    {assignment.team}
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
            We could not find upcoming Planning Center assignments for{" "}
            {personName}.
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
  assignment: UpcomingAssignment;
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
      <Link href={assignment.detailHref} className="block">
        {children}
      </Link>
    </td>
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
