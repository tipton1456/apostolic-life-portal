import { redirect } from "next/navigation";
import Link from "next/link";
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
    month?: string;
    view?: string;
  }>;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const POSITION_ORDER: Array<MinisterPlatformAssignment["position"]> = [
  "Minister",
  "Platform",
];

type MinisterPlatformPlanGroup = {
  assignments: MinisterPlatformAssignment[];
  date: string;
  dateLabel: string;
  id: string;
  planName: string;
  sortDate: string;
};

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

  const { month: monthParam, view: viewParam } = await searchParams;
  const view = parseView(viewParam);
  const assignments = await getMinisterPlatformSchedule();
  const selectedMonth = parseSelectedMonth(monthParam, assignments);

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
            <CalendarView
              assignments={assignments}
              selectedMonth={selectedMonth}
            />
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
  selectedMonth,
}: {
  assignments: MinisterPlatformAssignment[];
  selectedMonth: string;
}) {
  const planGroups = groupAssignmentsByPlan(assignments);
  const monthKeys = getMonthKeys(planGroups);
  const activeMonth = monthKeys.includes(selectedMonth)
    ? selectedMonth
    : monthKeys[0];
  const activeMonthIndex = monthKeys.indexOf(activeMonth);
  const previousMonth = monthKeys[activeMonthIndex - 1];
  const nextMonth = monthKeys[activeMonthIndex + 1];
  const monthDate = parseDate(`${activeMonth}-01`);
  const month = {
    days: buildCalendarDays(planGroups, monthDate),
    key: activeMonth,
    title: getCalendarTitle(monthDate),
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-semibold">{month.title}</h2>
        <div className="flex flex-wrap gap-2">
          {previousMonth ? (
            <Link
              href={`/admin/minister-platform-schedule?view=calendar&month=${previousMonth}`}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-lime-400/60 hover:text-lime-300"
            >
              Previous Month
            </Link>
          ) : (
            <span className="rounded-xl border border-white/5 px-4 py-2 text-sm font-semibold text-neutral-600">
              Previous Month
            </span>
          )}
          {nextMonth ? (
            <Link
              href={`/admin/minister-platform-schedule?view=calendar&month=${nextMonth}`}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-lime-400/60 hover:text-lime-300"
            >
              Next Month
            </Link>
          ) : (
            <span className="rounded-xl border border-white/5 px-4 py-2 text-sm font-semibold text-neutral-600">
              Next Month
            </span>
          )}
        </div>
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
              {day.planGroups.length > 0 ? (
                <span className="text-xs font-semibold text-lime-300">
                  {day.planGroups.length}
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              {day.planGroups.map((planGroup) => (
                <PlanCard key={planGroup.id} compact planGroup={planGroup} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListView({
  assignments,
}: {
  assignments: MinisterPlatformAssignment[];
}) {
  const planGroups = groupAssignmentsByPlan(assignments);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {planGroups.map((planGroup) => (
        <PlanCard key={planGroup.id} planGroup={planGroup} />
      ))}
    </div>
  );
}

function PlanCard({
  compact = false,
  planGroup,
}: {
  compact?: boolean;
  planGroup: MinisterPlatformPlanGroup;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-lg border border-white/10 bg-neutral-950/60 p-2"
          : "rounded-2xl border border-white/10 bg-white/[0.03] p-5"
      }
    >
      <div className="flex flex-col gap-1">
        <p
          className={
            compact
              ? "text-xs font-semibold text-neutral-100"
              : "text-lg font-semibold text-neutral-100"
          }
        >
          {planGroup.planName}
        </p>
        <p
          className={
            compact
              ? "text-xs text-lime-300"
              : "text-sm font-semibold text-lime-300"
          }
        >
          {formatDate(planGroup.dateLabel)}
        </p>
      </div>

      <div
        className={
          compact ? "mt-3 space-y-3" : "mt-5 grid gap-4 md:grid-cols-2"
        }
      >
        {POSITION_ORDER.map((position) => {
          const positionAssignments = sortAssignmentsForDisplay(
            planGroup.assignments.filter(
              (assignment) => assignment.position === position,
            ),
          );

          if (positionAssignments.length === 0) return null;

          return (
            <div key={position} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                {position}
              </p>
              <div className="space-y-1.5">
                {positionAssignments.map((assignment) => (
                  <PersonLine key={assignment.id} assignment={assignment} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PersonLine({
  assignment,
}: {
  assignment: MinisterPlatformAssignment;
}) {
  const declined = isDeclined(assignment.status);

  return (
    <div className="flex items-center gap-2 text-sm">
      <StatusDot status={assignment.status} />
      <span
        className={
          declined
            ? "text-red-300 line-through decoration-red-300/80"
            : "text-neutral-200"
        }
      >
        {assignment.name}
      </span>
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

function getMonthKeys(planGroups: MinisterPlatformPlanGroup[]) {
  return Array.from(
    new Set(
      planGroups.map((planGroup) => planGroup.date.slice(0, 7)),
    ),
  ).sort();
}

function buildCalendarDays(
  planGroups: MinisterPlatformPlanGroup[],
  monthDate: Date,
) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const planGroupsByDate = groupPlanGroupsByDate(planGroups);
  const todayKey = toDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = toDateKey(date);

    return {
      planGroups: planGroupsByDate.get(key) ?? [],
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === monthStart.getMonth(),
      isToday: key === todayKey,
      key,
    };
  });
}

function groupPlanGroupsByDate(planGroups: MinisterPlatformPlanGroup[]) {
  const grouped = new Map<string, MinisterPlatformPlanGroup[]>();

  for (const planGroup of planGroups) {
    grouped.set(planGroup.date, [
      ...(grouped.get(planGroup.date) ?? []),
      planGroup,
    ]);
  }

  return grouped;
}

function groupAssignmentsByPlan(assignments: MinisterPlatformAssignment[]) {
  const groups = new Map<string, MinisterPlatformPlanGroup>();

  for (const assignment of assignments) {
    const key = `${assignment.serviceTypeId}-${assignment.planId}`;
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.assignments.push(assignment);
    } else {
      groups.set(key, {
        assignments: [assignment],
        date: assignment.date,
        dateLabel: assignment.dateLabel,
        id: key,
        planName: assignment.planName,
        sortDate: assignment.sortDate,
      });
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      assignments: sortAssignmentsForDisplay(group.assignments),
    }))
    .sort((firstGroup, secondGroup) =>
      firstGroup.sortDate.localeCompare(secondGroup.sortDate),
    );
}

function sortAssignmentsForDisplay(assignments: MinisterPlatformAssignment[]) {
  return [...assignments].sort((firstAssignment, secondAssignment) => {
    const statusDifference =
      getStatusSortOrder(firstAssignment.status) -
      getStatusSortOrder(secondAssignment.status);

    if (statusDifference !== 0) return statusDifference;

    return firstAssignment.name.localeCompare(secondAssignment.name);
  });
}

function getStatusSortOrder(status: string) {
  if (isDeclined(status)) return 0;
  if (status.toLowerCase() === "confirmed") return 1;

  return 2;
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

  if (isDeclined(status)) return "bg-red-400";
  if (normalizedStatus === "confirmed") return "bg-green-400";

  return "bg-yellow-400";
}

function isDeclined(status: string) {
  return status.toLowerCase() === "declined";
}

function parseView(value?: string): MinisterPlatformView {
  return value === "list" ? "list" : "calendar";
}

function parseSelectedMonth(
  value: string | undefined,
  assignments: MinisterPlatformAssignment[],
) {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value;

  return assignments[0]?.date.slice(0, 7) ?? toDateKey(new Date()).slice(0, 7);
}
