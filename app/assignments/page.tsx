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
import AssignmentDisplayToggle, {
  type AssignmentDisplay,
} from "./assignment-display-toggle";
import AssignmentViewToggle from "./assignment-view-toggle";

type PageProps = {
  searchParams: Promise<{
    count?: string;
    display?: string;
    month?: string;
    view?: string;
  }>;
};

const VALID_COUNTS = [3, 5, 10];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type AssignmentView = "mine" | "family";

export default async function AssignmentsPage({ searchParams }: PageProps) {
  const {
    count: countParam,
    display: displayParam,
    month: monthParam,
    view: viewParam,
  } = await searchParams;
  const count = parseAssignmentCount(countParam);
  const display = parseAssignmentDisplay(displayParam);
  const view = parseAssignmentView(viewParam);
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  const assignments = await getUpcomingAssignments(user.email ?? undefined, count);
  const household =
    view === "family" || display === "calendar"
      ? await getHousehold(user.email ?? undefined)
      : null;
  const primaryName = household?.primary
    ? [household.primary.firstName, household.primary.lastName]
        .filter(Boolean)
        .join(" ")
    : user.isDemo
      ? "Demo User"
      : user.email || "Me";
  const familyAssignments =
    view === "family" && household
      ? await getFamilyAssignmentSections(
          household.family,
          user.email ?? undefined,
          count,
        )
      : [];
  const calendarAssignments =
    view === "family"
      ? flattenFamilyCalendarAssignments(familyAssignments)
      : assignments.map((assignment) =>
          mapCalendarAssignment(assignment, primaryName),
        );
  const selectedMonth = parseSelectedMonth(monthParam, calendarAssignments);

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
              <AssignmentViewToggle
                key={view}
                view={view}
                display={display}
                count={count}
              />
              <AssignmentDisplayToggle
                key={display}
                view={view}
                display={display}
                count={count}
              />
              <AssignmentCountSelect
                count={count}
                display={display}
                view={view}
              />
            </div>
          </div>
        </header>

        <section className="mt-8">
          {display === "calendar" ? (
            <AssignmentCalendar
              assignments={calendarAssignments}
              count={count}
              selectedMonth={selectedMonth}
              view={view}
              userEmail={user.email}
            />
          ) : view === "family" ? (
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

type CalendarAssignment = {
  date: string;
  dateLabel: string;
  detailHref: string;
  id: string;
  name: string;
  planName: string;
  position: string;
  seriesArtUrl?: string;
  status: string;
};

function AssignmentCalendar({
  assignments,
  count,
  selectedMonth,
  userEmail,
  view,
}: {
  assignments: CalendarAssignment[];
  count: number;
  selectedMonth: string;
  userEmail?: string;
  view: AssignmentView;
}) {
  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-xl font-semibold">No assignments found</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
          We could not find upcoming Planning Center assignments for
          {userEmail ? ` ${userEmail}` : " this view"} yet.
        </p>
      </div>
    );
  }

  const monthKeys = getMonthKeys(assignments);
  const activeMonth = monthKeys.includes(selectedMonth)
    ? selectedMonth
    : monthKeys[0];
  const activeMonthIndex = monthKeys.indexOf(activeMonth);
  const previousMonth = monthKeys[activeMonthIndex - 1];
  const nextMonth = monthKeys[activeMonthIndex + 1];
  const monthDate = parseDate(`${activeMonth}-01`);
  const days = buildCalendarDays(assignments, monthDate);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold">{getCalendarTitle(monthDate)}</h2>
        <div className="flex flex-wrap gap-2">
          <CalendarMonthLink
            count={count}
            disabled={!previousMonth}
            label="Previous Month"
            month={previousMonth}
            view={view}
          />
          <CalendarMonthLink
            count={count}
            disabled={!nextMonth}
            label="Next Month"
            month={nextMonth}
            view={view}
          />
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-white/10 bg-neutral-950/50 text-center text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-2">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-7">
        {days.map((day) => (
          <div
            key={day.key}
            className={
              day.inMonth
                ? "min-h-28 border-b border-white/10 p-2 md:border-r"
                : "hidden min-h-28 border-b border-white/10 bg-neutral-950/40 p-2 text-neutral-600 md:block md:border-r"
            }
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className={
                  day.isToday
                    ? "flex h-6 w-6 items-center justify-center rounded-full bg-lime-400 text-xs font-bold text-neutral-950"
                    : "text-xs font-semibold text-neutral-300"
                }
              >
                {day.dayNumber}
              </span>
              {day.assignments.length > 0 ? (
                <span className="text-xs font-semibold text-lime-300">
                  {day.assignments.length}
                </span>
              ) : null}
            </div>
            <div className="space-y-1.5">
              {day.assignments.map((assignment) => (
                <CalendarAssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarMonthLink({
  count,
  disabled,
  label,
  month,
  view,
}: {
  count: number;
  disabled: boolean;
  label: string;
  month?: string;
  view: AssignmentView;
}) {
  if (disabled || !month) {
    return (
      <span className="rounded-lg border border-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-600">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={`/assignments?view=${view}&display=calendar&count=${count}&month=${month}`}
      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-lime-400/60 hover:text-lime-300"
    >
      {label}
    </Link>
  );
}

function CalendarAssignmentCard({
  assignment,
}: {
  assignment: CalendarAssignment;
}) {
  return (
    <Link
      href={assignment.detailHref}
      className="block rounded-md border border-white/10 bg-neutral-950/60 p-2 transition hover:border-lime-400/50"
    >
      {assignment.seriesArtUrl && (
        <img
          src={assignment.seriesArtUrl}
          alt="Series artwork"
          className="mb-1 h-8 w-8 rounded object-cover"
        />
      )}
      <p className="text-[11px] font-semibold leading-tight text-neutral-100">
        {assignment.planName}
      </p>
      <p className="mt-1 text-[11px] leading-tight text-neutral-400">
        {assignment.name}
      </p>
      <div className="mt-1 flex items-center gap-1.5 text-xs leading-tight text-neutral-300">
        <StatusDot status={assignment.status} />
        <span>{assignment.position}</span>
      </div>
    </Link>
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

function parseAssignmentDisplay(value?: string): AssignmentDisplay {
  return value === "calendar" ? "calendar" : "list";
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

function flattenFamilyCalendarAssignments(
  familyAssignments: FamilyAssignmentSection[],
) {
  return familyAssignments.flatMap((section) =>
    section.assignments.map((assignment) =>
      mapCalendarAssignment(assignment, section.name),
    ),
  );
}

function mapCalendarAssignment(
  assignment: UpcomingAssignment,
  name: string,
): CalendarAssignment {
  return {
    date: getAssignmentDateKey(assignment),
    dateLabel: assignment.dates,
    detailHref: assignment.detailHref,
    id: `${assignment.id}-${name}`,
    name,
    planName: assignment.serviceTypeName,
    position: assignment.position,
    seriesArtUrl: assignment.seriesArtUrl,
    status: assignment.status,
  };
}

function getAssignmentDateKey(assignment: UpcomingAssignment) {
  if (assignment.sortDate) {
    return assignment.sortDate.slice(0, 10);
  }

  const parsedDate = parseDate(assignment.dates);

  if (!Number.isNaN(parsedDate.getTime())) {
    return toDateKey(parsedDate);
  }

  return toDateKey(new Date());
}

function getMonthKeys(assignments: CalendarAssignment[]) {
  return Array.from(
    new Set(assignments.map((assignment) => assignment.date.slice(0, 7))),
  ).sort();
}

function buildCalendarDays(assignments: CalendarAssignment[], monthDate: Date) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const assignmentsByDate = groupAssignmentsByDate(assignments);
  const todayKey = toDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = toDateKey(date);

    return {
      assignments: assignmentsByDate.get(key) ?? [],
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === monthStart.getMonth(),
      isToday: key === todayKey,
      key,
    };
  });
}

function groupAssignmentsByDate(assignments: CalendarAssignment[]) {
  const grouped = new Map<string, CalendarAssignment[]>();

  for (const assignment of assignments) {
    grouped.set(assignment.date, [
      ...(grouped.get(assignment.date) ?? []),
      assignment,
    ]);
  }

  return grouped;
}

function parseSelectedMonth(
  value: string | undefined,
  assignments: CalendarAssignment[],
) {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value;

  return assignments[0]?.date.slice(0, 7) ?? toDateKey(new Date()).slice(0, 7);
}

function parseDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCalendarTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      aria-label={`${status} status`}
      title={status}
      className={`h-2 w-2 shrink-0 rounded-full ${getStatusColor(status)}`}
    />
  );
}

function getStatusColor(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "declined") return "bg-red-400";
  if (normalizedStatus === "confirmed") return "bg-green-400";

  return "bg-yellow-400";
}
