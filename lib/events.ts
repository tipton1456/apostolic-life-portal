import { isDemoMode } from "./demo";

export type ChurchEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt?: string;
  dateLabel: string;
  timeLabel: string;
  imageUrl?: string;
  sourceUrl?: string;
};

const EVENTS_FEED_URL =
  process.env.TITHELY_EVENTS_ICS_URL ??
  "https://apostoliclifeupci.com/events.ics";

export async function getUpcomingEvents(limit?: number): Promise<ChurchEvent[]> {
  if (await isDemoMode()) {
    return typeof limit === "number"
      ? sampleEvents.slice(0, limit)
      : sampleEvents;
  }

  try {
    const response = await fetch(EVENTS_FEED_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Events feed error ${response.status}: ${await response.text()}`);
      return [];
    }

    const events = parseCalendar(await response.text());
    const now = new Date();
    const upcomingEvents = events
      .filter((event) => new Date(event.endsAt ?? event.startsAt) >= now)
      .sort(
        (firstEvent, secondEvent) =>
          new Date(firstEvent.startsAt).getTime() -
          new Date(secondEvent.startsAt).getTime(),
      );

    return typeof limit === "number"
      ? upcomingEvents.slice(0, limit)
      : upcomingEvents;
  } catch (error) {
    console.error("Events feed lookup failed:", error);
    return [];
  }
}

const sampleEvents: ChurchEvent[] = [
  sampleEvent("demo-event-1", "Family Worship Night", "An evening of worship, prayer, and fellowship for every generation.", "Apostolic Life Sanctuary", 4, "6:30 PM - 8:00 PM", "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=900&q=80"),
  sampleEvent("demo-event-2", "Serve Team Breakfast", "A relaxed breakfast for ministry volunteers with updates for the coming month.", "Fellowship Hall", 9, "9:00 AM - 10:30 AM", "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=900&q=80"),
  sampleEvent("demo-event-3", "Youth Rally", "Students from the area will gather for worship, preaching, and after-service food.", "Apostolic Life Youth Center", 15, "7:00 PM - 9:30 PM", "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80"),
  sampleEvent("demo-event-4", "Community Outreach", "Teams will meet at the church and go into the community with invitation cards and prayer.", "Main Lobby", 22, "10:00 AM - 12:00 PM", "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=900&q=80"),
];

function sampleEvent(
  id: string,
  title: string,
  description: string,
  location: string,
  daysFromNow: number,
  timeLabel: string,
  imageUrl: string,
): ChurchEvent {
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + daysFromNow);
  startsAt.setHours(18, 30, 0, 0);

  return {
    id,
    dateLabel: formatEventDate(startsAt),
    description,
    imageUrl,
    location,
    sourceUrl: "https://apostoliclifeupci.com/events",
    startsAt: startsAt.toISOString(),
    timeLabel,
    title,
  };
}

function parseCalendar(calendar: string) {
  const lines = unfoldCalendarLines(calendar);
  const events: ChurchEvent[] = [];
  let currentEvent: Record<string, string> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (currentEvent) {
        const event = mapCalendarEvent(currentEvent);

        if (event) events.push(event);
      }

      currentEvent = null;
      continue;
    }

    if (!currentEvent) continue;

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) continue;

    const rawKey = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    const key = rawKey.split(";")[0];

    if (key === "ATTACH") {
      currentEvent.ATTACH = value;
      continue;
    }

    currentEvent[key] = value;
  }

  return events;
}

function mapCalendarEvent(event: Record<string, string>): ChurchEvent | null {
  const startsAt = parseIcsDate(event.DTSTART);

  if (!startsAt || !event.SUMMARY) return null;

  const endsAt = parseIcsDate(event.DTEND);

  return {
    id: event.UID ?? `${event.SUMMARY}-${event.DTSTART}`,
    title: unescapeCalendarText(event.SUMMARY),
    description: unescapeCalendarText(event.DESCRIPTION ?? ""),
    location: unescapeCalendarText(event.LOCATION ?? "Location not listed"),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt?.toISOString(),
    dateLabel: formatEventDate(startsAt),
    timeLabel: formatEventTime(startsAt, endsAt),
    imageUrl: event.ATTACH,
    sourceUrl: event.URL,
  };
}

function unfoldCalendarLines(calendar: string) {
  return calendar
    .replaceAll("\r\n", "\n")
    .split("\n")
    .reduce<string[]>((lines, line) => {
      if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      } else if (line.trim()) {
        lines.push(line.trimEnd());
      }

      return lines;
    }, []);
}

function parseIcsDate(value?: string) {
  if (!value) return null;

  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));

    return new Date(Date.UTC(year, month - 1, day, 6));
  }

  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/,
  );

  if (!match) return null;

  const [, year, month, day, hour, minute, second, utcMarker] = match;
  const dateParts = [
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ] as const;

  return utcMarker
    ? new Date(Date.UTC(...dateParts))
    : new Date(...dateParts);
}

function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(date);
}

function formatEventTime(startDate: Date, endDate?: Date | null) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });

  if (!endDate) return formatter.format(startDate);

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function unescapeCalendarText(value: string) {
  return value
    .replaceAll("\\n", "\n")
    .replaceAll("\\,", ",")
    .replaceAll("\\;", ";")
    .replaceAll("\\\\", "\\")
    .trim();
}
