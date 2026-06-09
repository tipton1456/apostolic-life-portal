import Link from "next/link";
import { redirect } from "next/navigation";
import { getHousehold } from "@/lib/elvanto";
import {
  getUpcomingAssignments,
  getUpcomingAssignmentsForEmail,
  type UpcomingAssignment,
} from "@/lib/planning-center";
import { getCurrentSessionUser } from "@/lib/demo";
import AssignmentCountSelect from "./assignment-count-select";
import AssignmentViewToggle from "./assignment-view-toggle";

type PageProps = {
  searchParams: Promise<{
    count?: string;
    view?: string;
  }>;
};

const VALID_COUNTS = [3, 5, 10];
type AssignmentView = "mine" | "family";

export default async function AssignmentsPage({ searchParams }: PageProps) {
  const { count: countParam, view: viewParam } = await searchParams;
  const count = parseAssignmentCount(countParam);
  const view = parseAssignmentView(viewParam);
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  const assignments = await getUpcomingAssignments(user.email ?? undefined, count);
  const household =
    view === "family" ? await getHousehold(user.email ?? undefined) : null;
  const familyAssignments =
    view === "family" && household
      ? await getFamilyAssignmentSections(
          household.family,
          user.email ?? undefined,
          count,
        )
      : [];

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
                profile and household.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <AssignmentViewToggle key={view} view={view} count={count} />
              <AssignmentCountSelect count={count} view={view} />
            </div>
          </div>
        </header>

        <section className="mt-8">
          {view === "family" ? (
            <FamilyAssignmentsList
              familyAssignments={familyAssignments}
              hasHousehold={Boolean(household)}
              userEmail={user.email}
            />
          ) : (
            <AssignmentTable assignments={assignments} userEmail={user.email} />
          )}
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
            We could not find upcoming Planning Center assignments for
            {userEmail ? ` ${userEmail}` : " this login email"} yet.
          </p>
        </div>
      )}
    </div>
  );
}

type FamilyAssignmentSection = {
  assignments: UpcomingAssignment[];
  id: string;
  name: string;
  relationship?: string;
};

function FamilyAssignmentsList({
  familyAssignments,
  hasHousehold,
  userEmail,
}: {
  familyAssignments: FamilyAssignmentSection[];
  hasHousehold: boolean;
  userEmail?: string;
}) {
  if (!hasHousehold) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-xl font-semibold">No household found</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
          We could not find household members for
          {userEmail ? ` ${userEmail}` : " this login email"}.
        </p>
      </div>
    );
  }

  if (familyAssignments.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-xl font-semibold">No family members found</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
          No additional household members are currently connected to this
          profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {familyAssignments.map((section) => (
        <details
          key={section.id}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.05]">
            <div>
              <h2 className="text-lg font-semibold">{section.name}</h2>
              <p className="mt-1 text-sm text-neutral-400">
                {section.relationship || "Family Member"}
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
              {section.assignments.length > 0
                ? `${section.assignments.length} scheduled`
                : "No Assignments"}
            </span>
          </summary>

          {section.assignments.length > 0 ? (
            <div className="overflow-x-auto border-t border-white/10">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Plan</th>
                    <th className="px-5 py-3 font-medium">Position</th>
                    <th className="px-5 py-3 font-medium">Team</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {section.assignments.map((assignment) => (
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
            <div className="border-t border-white/10 p-5">
              <p className="text-sm text-neutral-400">No Assignments</p>
            </div>
          )}
        </details>
      ))}
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

function parseAssignmentView(value?: string): AssignmentView {
  return value === "family" ? "family" : "mine";
}

async function getFamilyAssignmentSections(
  family: NonNullable<Awaited<ReturnType<typeof getHousehold>>>["family"],
  userEmail: string | undefined,
  limit: number,
): Promise<FamilyAssignmentSection[]> {
  return Promise.all(
    family.map(async (person) => {
      const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
      const email = normalizeEmail(person.email);
      const isSharedEmail = Boolean(
        email && userEmail && email === userEmail.toLowerCase(),
      );
      const assignments =
        email && !isSharedEmail
          ? await getUpcomingAssignmentsForEmail(email, limit)
          : [];

      return {
        assignments,
        id: person.id,
        name: name || "Family Member",
        relationship: person.relationship,
      };
    }),
  );
}

function normalizeEmail(email?: string) {
  const normalized = email?.trim().toLowerCase();

  if (!normalized || normalized === "not listed") return "";

  return normalized;
}
