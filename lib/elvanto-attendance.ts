type ElvantoServiceType = {
  id?: string;
  name?: string;
};

type ElvantoService = {
  id?: string;
  name?: string;
  date?: string;
  service_type?: ElvantoServiceType;
  [key: string]: unknown;
};

type ElvantoResponse = {
  error?: {
    code?: number;
    message?: string;
  };
  services?: {
    service?: ElvantoService | ElvantoService[];
    total?: number;
  };
  status?: string;
};

export type AttendanceRangePreset =
  | "previous-sunday"
  | "month-to-date"
  | "year-to-date"
  | "this-year"
  | "last-year"
  | "custom";

export type AttendanceRange = {
  end: string;
  label: string;
  preset: AttendanceRangePreset;
  start: string;
};

export type SundayAttendanceRow = {
  am: number;
  date: string;
  dateLabel: string;
  pm: number;
  unique: number;
};

export type AttendanceDashboard = {
  amAverage: number;
  pmAverage: number;
  range: AttendanceRange;
  rows: SundayAttendanceRow[];
  uniqueAverage: number;
  warning?: string;
};

const AM_SERVICE_NAME = process.env.ELVANTO_SUNDAY_AM_SERVICE_NAME ?? "Sunday AM";
const PM_SERVICE_NAME = process.env.ELVANTO_SUNDAY_PM_SERVICE_NAME ?? "Sunday PM";
const ATTENDANCE_FIELDS = [
  "service_times",
  "notes",
  "plans",
  "volunteers",
  "picture",
];

export function parseAttendanceRange({
  end,
  preset,
  start,
}: {
  end?: string;
  preset?: string;
  start?: string;
}): AttendanceRange {
  const today = new Date();
  const safePreset = parsePreset(preset);

  if (safePreset === "custom") {
    const customStart = normalizeDateInput(start);
    const customEnd = normalizeDateInput(end);

    if (customStart && customEnd) {
      return {
        end: customEnd < customStart ? customStart : customEnd,
        label: "Custom Range",
        preset: "custom",
        start: customStart,
      };
    }
  }

  if (safePreset === "month-to-date") {
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
      end: formatDateInput(today),
      label: "Month to Date",
      preset: "month-to-date",
      start: formatDateInput(startDate),
    };
  }

  if (safePreset === "year-to-date") {
    return {
      end: formatDateInput(today),
      label: "Year to Date",
      preset: "year-to-date",
      start: `${today.getFullYear()}-01-01`,
    };
  }

  if (safePreset === "this-year") {
    return {
      end: `${today.getFullYear()}-12-31`,
      label: "This Year",
      preset: "this-year",
      start: `${today.getFullYear()}-01-01`,
    };
  }

  if (safePreset === "last-year") {
    const year = today.getFullYear() - 1;

    return {
      end: `${year}-12-31`,
      label: "Last Year",
      preset: "last-year",
      start: `${year}-01-01`,
    };
  }

  const previousSunday = getPreviousSunday(today);

  return {
    end: formatDateInput(previousSunday),
    label: "Previous Sunday",
    preset: "previous-sunday",
    start: formatDateInput(previousSunday),
  };
}

export async function getAttendanceDashboard(
  range: AttendanceRange,
): Promise<AttendanceDashboard> {
  if (!process.env.ELVANTO_API_KEY) {
    return buildDashboard(range, [], "Elvanto is not configured.");
  }

  const services = await getServices(range.start, range.end);
  const rows = summarizeSundays(services, range.start, range.end);
  const hasExtractedAttendance = rows.some(
    (row) => row.am > 0 || row.pm > 0 || row.unique > 0,
  );

  return buildDashboard(
    range,
    rows,
    hasExtractedAttendance
      ? undefined
      : "Elvanto returned services, but no attendance counts were present in the API response.",
  );
}

async function getServices(start: string, end: string) {
  const authorization = getElvantoAuthorization();
  const apiEnd = addDays(end, 1);
  const services: ElvantoService[] = [];
  let page = 1;
  let total = 0;

  do {
    const body: Record<string, string> = {
      all: "yes",
      end: apiEnd,
      page: String(page),
      page_size: "100",
      start,
    };

    ATTENDANCE_FIELDS.forEach((field, index) => {
      body[`fields[${index}]`] = field;
    });

    const result = await postElvanto("services/getAll.json", authorization, body);

    if (result.status !== "ok") {
      if (result.error?.code === 404) return services;
      throw new Error(result.error?.message ?? "Elvanto services request failed.");
    }

    const pageServices = normalizeArray(result.services?.service);
    services.push(...pageServices);
    total = Number(result.services?.total ?? services.length);
    page += 1;
  } while (services.length < total);

  return services;
}

function summarizeSundays(
  services: ElvantoService[],
  start: string,
  end: string,
): SundayAttendanceRow[] {
  const rowsByDate = new Map<
    string,
    {
      am: number;
      date: string;
      pm: number;
      people: Set<string>;
    }
  >();

  for (const sunday of getSundays(start, end)) {
    rowsByDate.set(sunday, {
      am: 0,
      date: sunday,
      people: new Set(),
      pm: 0,
    });
  }

  for (const service of services) {
    const serviceDate = getDateOnly(service.date);
    if (!serviceDate || !rowsByDate.has(serviceDate)) continue;

    const row = rowsByDate.get(serviceDate)!;
    const serviceName = `${service.name ?? ""} ${service.service_type?.name ?? ""}`;
    const attendance = extractAttendance(service);
    const people = extractAttendeeIds(service);

    for (const personId of people) {
      row.people.add(personId);
    }

    if (isServiceMatch(serviceName, AM_SERVICE_NAME)) {
      row.am += attendance || people.length;
      continue;
    }

    if (isServiceMatch(serviceName, PM_SERVICE_NAME)) {
      row.pm += attendance || people.length;
    }
  }

  return [...rowsByDate.values()]
    .map((row) => ({
      am: row.am,
      date: row.date,
      dateLabel: formatDisplayDate(row.date),
      pm: row.pm,
      unique: row.people.size || uniqueFallback(row.am, row.pm),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function extractAttendance(value: unknown): number {
  let best = 0;

  walk(value, (key, current) => {
    if (
      typeof current === "number" &&
      /attendance|attended|total|count|guests|people/i.test(key)
    ) {
      best = Math.max(best, current);
    }

    if (
      typeof current === "string" &&
      /^\d+$/.test(current) &&
      /attendance|attended|total|count|guests|people/i.test(key)
    ) {
      best = Math.max(best, Number(current));
    }
  });

  return best;
}

function extractAttendeeIds(value: unknown): string[] {
  const people = new Set<string>();

  walk(value, (key, current) => {
    if (
      typeof current === "string" &&
      current.length > 6 &&
      /person_?id|people_?id|attendee_?id/i.test(key)
    ) {
      people.add(current);
    }
  });

  return [...people];
}

function walk(
  value: unknown,
  visit: (key: string, value: unknown) => void,
  key = "",
) {
  if (!value || typeof value !== "object") {
    visit(key, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${key}.${index}`));
    return;
  }

  for (const [childKey, childValue] of Object.entries(value)) {
    const nextKey = key ? `${key}.${childKey}` : childKey;
    visit(nextKey, childValue);
    walk(childValue, visit, nextKey);
  }
}

function buildDashboard(
  range: AttendanceRange,
  rows: SundayAttendanceRow[],
  warning?: string,
): AttendanceDashboard {
  return {
    amAverage: average(rows.map((row) => row.am)),
    pmAverage: average(rows.map((row) => row.pm)),
    range,
    rows,
    uniqueAverage: average(rows.map((row) => row.unique)),
    warning,
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function uniqueFallback(am: number, pm: number) {
  return Math.max(am, pm);
}

function isServiceMatch(value: string, expected: string) {
  return value.toLowerCase().includes(expected.toLowerCase());
}

function getSundays(start: string, end: string) {
  const sundays: string[] = [];
  const current = parseDateInput(start);
  const final = parseDateInput(end);

  while (current.getDay() !== 0) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= final) {
    sundays.push(formatDateInput(current));
    current.setDate(current.getDate() + 7);
  }

  return sundays;
}

function getPreviousSunday(date: Date) {
  const previousSunday = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const daysSinceSunday = previousSunday.getDay() || 7;
  previousSunday.setDate(previousSunday.getDate() - daysSinceSunday);

  return previousSunday;
}

function parsePreset(value?: string): AttendanceRangePreset {
  if (
    value === "month-to-date" ||
    value === "year-to-date" ||
    value === "this-year" ||
    value === "last-year" ||
    value === "custom"
  ) {
    return value;
  }

  return "previous-sunday";
}

function normalizeDateInput(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";

  return value;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = parseDateInput(value);
  date.setDate(date.getDate() + days);

  return formatDateInput(date);
}

function getDateOnly(value?: string) {
  if (!value) return "";

  return value.slice(0, 10);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function getElvantoAuthorization() {
  return `Basic ${Buffer.from(`${process.env.ELVANTO_API_KEY}:x`).toString(
    "base64",
  )}`;
}

async function postElvanto(
  path: string,
  authorization: string,
  body: Record<string, string>,
): Promise<ElvantoResponse> {
  const response = await fetch(`https://api.elvanto.com/v1/${path}`, {
    body: new URLSearchParams(body),
    cache: "no-store",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  return response.json();
}

function normalizeArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];

  return Array.isArray(value) ? value : [value];
}
