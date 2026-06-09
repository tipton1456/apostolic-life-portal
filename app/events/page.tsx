import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getEventsSubscriptionUrl,
  getUpcomingEvents,
  type ChurchEvent,
} from "@/lib/events";
import { getCurrentSessionUser } from "@/lib/demo";
import EventsViewToggle, { type EventsView } from "./events-view-toggle";

type PageProps = {
  searchParams: Promise<{
    month?: string;
    view?: string;
  }>;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function EventsPage({ searchParams }: PageProps) {
  const { month: monthParam, view: viewParam } = await searchParams;
  const view = parseEventsView(viewParam);
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  const events = await getUpcomingEvents();
  const selectedMonth = parseSelectedMonth(monthParam, events);
  const subscriptionUrl = getEventsSubscriptionUrl();

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
                Apostolic Life
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">Events</h1>
              <p className="mt-3 max-w-2xl text-neutral-400">
                Upcoming church events from the Apostolic Life public calendar.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <EventsViewToggle key={view} view={view} />
              <a
                href={subscriptionUrl}
                className="inline-flex items-center justify-center rounded-xl border border-lime-400/40 px-4 py-2 text-sm font-semibold text-lime-300 transition hover:border-lime-300 hover:text-lime-200"
              >
                Subscribe to this calendar
              </a>
            </div>
          </div>
        </header>

        <section className="mt-8">
          {view === "calendar" ? (
            <EventsCalendar events={events} selectedMonth={selectedMonth} />
          ) : (
            <EventsList events={events} />
          )}
        </section>
      </div>
    </main>
  );
}

function EventsList({ events }: { events: ChurchEvent[] }) {
  if (events.length === 0) {
    return <EmptyEvents />;
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <EventDetails key={event.id} event={event} />
      ))}
    </div>
  );
}

function EventDetails({ event }: { event: ChurchEvent }) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <summary className="grid cursor-pointer list-none gap-3 px-5 py-4 transition hover:bg-white/[0.05] md:grid-cols-[1fr_12rem_10rem] [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="font-semibold text-neutral-100">{event.title}</h2>
          <p className="mt-1 text-sm text-neutral-400">{event.location}</p>
        </div>
        <p className="text-sm font-semibold text-lime-300 md:text-right">
          {event.dateLabel}
        </p>
        <p className="text-sm text-neutral-300 md:text-right">
          {event.timeLabel}
        </p>
      </summary>

      <div className="grid gap-5 border-t border-white/10 p-5 md:grid-cols-[14rem_1fr]">
        <EventImage event={event} />
        <div>
          <p className="whitespace-pre-line text-sm leading-6 text-neutral-300">
            {event.description || "No additional details listed."}
          </p>
          {event.sourceUrl ? (
            <a
              href={event.sourceUrl}
              className="mt-4 inline-flex text-sm font-semibold text-lime-400 hover:text-lime-300"
            >
              View on Apostolic Life
            </a>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function EventsCalendar({
  events,
  selectedMonth,
}: {
  events: ChurchEvent[];
  selectedMonth: string;
}) {
  if (events.length === 0) {
    return <EmptyEvents />;
  }

  const monthKeys = getMonthKeys(events);
  const activeMonth = monthKeys.includes(selectedMonth)
    ? selectedMonth
    : monthKeys[0];
  const activeMonthIndex = monthKeys.indexOf(activeMonth);
  const previousMonth = monthKeys[activeMonthIndex - 1];
  const nextMonth = monthKeys[activeMonthIndex + 1];
  const monthDate = parseDate(`${activeMonth}-01`);
  const days = buildCalendarDays(events, monthDate);

  return (
    <div className="overflow-visible rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold">{getCalendarTitle(monthDate)}</h2>
        <div className="flex flex-wrap gap-2">
          <CalendarMonthLink
            disabled={!previousMonth}
            label="Previous Month"
            month={previousMonth}
          />
          <CalendarMonthLink
            disabled={!nextMonth}
            label="Next Month"
            month={nextMonth}
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
              {day.events.length > 0 ? (
                <span className="text-xs font-semibold text-lime-300">
                  {day.events.length}
                </span>
              ) : null}
            </div>
            <div className="space-y-1.5">
              {day.events.map((event) => (
                <CalendarEventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarEventCard({ event }: { event: ChurchEvent }) {
  return (
    <div
      tabIndex={0}
      className="group relative rounded-md border border-white/10 bg-neutral-950/60 p-2 outline-none transition hover:border-lime-400/50 focus:border-lime-400/50"
    >
      <p className="text-[11px] font-semibold leading-tight text-neutral-100">
        {event.title}
      </p>
      <p className="mt-1 text-[11px] leading-tight text-lime-300">
        {event.timeLabel}
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-tight text-neutral-400">
        {event.location}
      </p>
      {event.imageUrl ? (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-neutral-950 p-2 opacity-0 shadow-2xl shadow-black/50 transition group-hover:opacity-100 group-focus:opacity-100">
          <img
            src={event.imageUrl}
            alt={event.title}
            className="aspect-video w-full rounded-lg object-cover"
          />
          <p className="mt-2 line-clamp-1 text-xs font-semibold text-neutral-100">
            {event.title}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CalendarMonthLink({
  disabled,
  label,
  month,
}: {
  disabled: boolean;
  label: string;
  month?: string;
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
      href={`/events?view=calendar&month=${month}`}
      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-lime-400/60 hover:text-lime-300"
    >
      {label}
    </Link>
  );
}

function EventImage({ event }: { event: ChurchEvent }) {
  return event.imageUrl ? (
    <img
      src={event.imageUrl}
      alt={event.title}
      className="aspect-video w-full rounded-xl object-cover"
    />
  ) : (
    <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-white/[0.08] text-sm text-neutral-400">
      No image
    </div>
  );
}

function EmptyEvents() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-2xl font-semibold">No events found</h2>
      <p className="mt-3 text-sm leading-6 text-neutral-400">
        The public events calendar did not return upcoming events.
      </p>
    </div>
  );
}

function parseEventsView(value?: string): EventsView {
  return value === "calendar" ? "calendar" : "list";
}

function getMonthKeys(events: ChurchEvent[]) {
  return Array.from(
    new Set(events.map((event) => getEventDateKey(event).slice(0, 7))),
  ).sort();
}

function buildCalendarDays(events: ChurchEvent[], monthDate: Date) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const eventsByDate = groupEventsByDate(events);
  const todayKey = toDateKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = toDateKey(date);

    return {
      dayNumber: date.getDate(),
      events: eventsByDate.get(key) ?? [],
      inMonth: date.getMonth() === monthStart.getMonth(),
      isToday: key === todayKey,
      key,
    };
  });
}

function groupEventsByDate(events: ChurchEvent[]) {
  const grouped = new Map<string, ChurchEvent[]>();

  for (const event of events) {
    const dateKey = getEventDateKey(event);

    grouped.set(dateKey, [...(grouped.get(dateKey) ?? []), event]);
  }

  return grouped;
}

function parseSelectedMonth(value: string | undefined, events: ChurchEvent[]) {
  if (value && /^\d{4}-\d{2}$/.test(value)) return value;

  return events[0]
    ? getEventDateKey(events[0]).slice(0, 7)
    : toDateKey(new Date()).slice(0, 7);
}

function getEventDateKey(event: ChurchEvent) {
  return event.startsAt.slice(0, 10);
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
