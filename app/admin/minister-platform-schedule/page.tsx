import { redirect } from "next/navigation";
import { getCurrentPortalUser } from "@/lib/portal-users";
import {
  getMinisterPlatformSchedule,
  type MinisterPlatformAssignment,
} from "@/lib/planning-center";
import MinisterPlatformViewToggle, {
  type MinisterPlatformView,
} from "./view-toggle";

type PageProps = {
  searchParams: Promise<{
    view?: string;
  }>;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function MinisterPlatformSchedulePage({
  searchParams,
}: PageProps) {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  const { view: viewParam } = await searchParams;
  const view = parseView(viewParam);
  const assignments = await getMinisterPlatformSchedule();

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
                Administration
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">
                Minister and Platform Schedule
              </h1>
              <p className="mt-3 max-w-3xl text-neutral-400">
                Upcoming Planning Center service plans with Minister and
                Platform assignments.
              </p>
            </div>
            <MinisterPlatformViewToggle key={view} view={view} />
          </div>
        </header>

        <section className="mt-8">
          {assignments.length === 0 ? (
            <EmptyState />
          ) : view === "calendar" ? (
            <CalendarView assignments={assignments} />
          ) : (
            <ListView assignments={assignments} />
          )}
        </section>
      </div>
    </main>
  );
}

function CalendarView({
  assignments,
}: {
  assignments: MinisterPlatformAssignment[];
}) {
  const months = buildCalendarMonths(assignments);

  return (
    <div className="space-y-8">
      {months.map((month) => (
        <div
          key={month.key}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
        >
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-2xl font-semibold">{month.title}</h2>
          </div>
          <div className="grid grid-cols-7 border-b border-white/10 bg-neutral-950/50 text-center text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="px-2 py-3">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-7">
            {month.days.map((day) => (
              <div
                key={day.key}
                className={
                  day.inMonth
                    ? "min-h-36 border-b border-white/10 p-3 md:border-r"
                    : "hidden min-h-36 border-b border-white/10 bg-neutral-950/40 p-3 text-neutral-600 md:block md:border-r"
                }
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={
                      day.isToday
                        ? "flex h-7 w-7 items-center justify-center rounded-full bg-lime-400 text-sm font-bold text-neutral-950"
                        : "text-sm font-semibold text-neutral-300"
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
                <div className="space-y-2">
                  {day.assignments.map((assignment) => (
                    <AssignmentPill
                      key={assignment.id}
                      assignment={assignment}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListView({
  assignments,
}: {
  assignments: MinisterPlatformAssignment[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
            <tr>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Position</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {assignments.map((assignment) => (
              <tr
                key={assignment.id}
                className="transition hover:bg-white/[0.06]"
              >
                <td className="px-5 py-4 font-semibold text-neutral-100">
                  {assignment.planName}
                </td>
                <td className="px-5 py-4 text-lime-300">
                  {formatDate(assignment.dateLabel)}
                </td>
                <td className="px-5 py-4 text-neutral-300">
                  {assignment.name}
                </td>
                <td className="px-5 py-4 text-neutral-300">
                  {assignment.position}
                </td>
                <td className="px-5 py-4">
                  <StatusDot status={assignment.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssignmentPill({
  assignment,
}: {
  assignment: MinisterPlatformAssignment;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-950/60 p-2">
      <p className="text-xs font-semibold text-neutral-100">
        {assignment.planName}
      </p>
      <div className="mt-1 flex items-center gap-2 text-xs text-neutral-300">
        <StatusDot status={assignment.status} />
        <span>{assignment.position}</span>
      </div>
      <p className="mt-1 text-xs text-neutral-400">{assignment.name}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-label={`${status} status`}
        title={status}
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${getStatusColor(status)}`}
      />
      <span className="sr-only">{status}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-xl font-semibold">No assignments found</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
        No upcoming Minister or Platform assignments were found in Planning
        Center.
      </p>
    </div>
  );
}

function buildCalendarMonths(assignments: MinisterPlatformAssignment[]) {
  const monthKeys = new Set(
    assignments.map((assignment) => assignment.date.slice(0, 7)),
  );

  return Array.from(monthKeys)
    .sort()
    .map((monthKey) => {
      const monthDate = parseDate(`${monthKey}-01`);

      return {
        days: buildCalendarDays(assignments, monthDate),
        key: monthKey,
        title: getCalendarTitle(monthDate),
      };
    });
}

function buildCalendarDays(
  assignments: MinisterPlatformAssignment[],
  monthDate: Date,
) {
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

function groupAssignmentsByDate(assignments: MinisterPlatformAssignment[]) {
  const grouped = new Map<string, MinisterPlatformAssignment[]>();

  for (const assignment of assignments) {
    grouped.set(assignment.date, [
      ...(grouped.get(assignment.date) ?? []),
      assignment,
    ]);
  }

  return grouped;
}

function getCalendarTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function parseDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const date = parseDate(value);

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStatusColor(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "declined") return "bg-red-400";
  if (normalizedStatus === "confirmed") return "bg-green-400";

  return "bg-yellow-400";
}

function parseView(value?: string): MinisterPlatformView {
  return value === "list" ? "list" : "calendar";
}
