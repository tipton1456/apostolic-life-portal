import { redirect } from "next/navigation";
import {
  getAttendanceDashboard,
  parseAttendanceRange,
  type SundayAttendanceRow,
} from "@/lib/elvanto-attendance";
import { getCurrentPortalUser } from "@/lib/portal-users";
import AttendanceRangeFilter from "./attendance-range-filter";

type PageProps = {
  searchParams: Promise<{
    end?: string;
    range?: string;
    start?: string;
  }>;
};

export default async function AttendanceDashboardPage({
  searchParams,
}: PageProps) {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const range = parseAttendanceRange({
    end: params.end,
    preset: params.range,
    start: params.start,
  });
  const dashboard = await getAttendanceDashboard(range);

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Administration
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Attendance Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Sunday AM, Sunday PM, and unique Sunday attendance from Elvanto.
          </p>

          <AttendanceRangeFilter
            key={`${dashboard.range.preset}-${dashboard.range.start}-${dashboard.range.end}`}
            currentPreset={dashboard.range.preset}
            end={dashboard.range.end}
            start={dashboard.range.start}
          />
        </header>

        {dashboard.warning ? (
          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
            {dashboard.warning}
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <KpiCard label="Sunday AM Average" value={dashboard.amAverage} />
          <KpiCard label="Sunday PM Average" value={dashboard.pmAverage} />
          <KpiCard
            label="Unique People Average"
            value={dashboard.uniqueAverage}
          />
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-2 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Attendance Trend</h2>
              <p className="mt-2 text-sm text-neutral-400">
                {dashboard.range.label}: {dashboard.range.start} through{" "}
                {dashboard.range.end}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
              <Legend color="bg-lime-300" label="Sunday AM" />
              <Legend color="bg-sky-300" label="Sunday PM" />
              <Legend color="bg-fuchsia-300" label="Unique" />
            </div>
          </div>

          <AttendanceChart rows={[...dashboard.rows].reverse()} />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-2xl font-semibold">Sunday Totals</h2>
          </div>

          {dashboard.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 text-right font-medium">
                      Sunday AM Attendance
                    </th>
                    <th className="px-5 py-3 text-right font-medium">
                      Sunday PM Attendance
                    </th>
                    <th className="px-5 py-3 text-right font-medium">
                      Unique Sunday Attendance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {dashboard.rows.map((row) => (
                    <tr key={row.date} className="transition hover:bg-white/[0.06]">
                      <td className="px-5 py-4 font-semibold text-lime-300">
                        {row.dateLabel}
                      </td>
                      <td className="px-5 py-4 text-right text-neutral-200">
                        {row.am}
                      </td>
                      <td className="px-5 py-4 text-right text-neutral-200">
                        {row.pm}
                      </td>
                      <td className="px-5 py-4 text-right text-neutral-100">
                        {row.unique}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              <h3 className="text-xl font-semibold">No Sundays found</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
                No Sunday AM or Sunday PM services were found in this date
                range.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      <p className="mt-3 text-4xl font-bold text-neutral-100">{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function AttendanceChart({ rows }: { rows: SundayAttendanceRow[] }) {
  const width = 900;
  const height = 320;
  const padding = 42;
  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [row.am, row.pm, row.unique]),
  );
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const points = rows.map((row, index) => ({
    ...row,
    x: padding + (rows.length <= 1 ? chartWidth / 2 : (index / (rows.length - 1)) * chartWidth),
  }));

  if (rows.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-white/10 bg-neutral-950/40 p-5 text-sm text-neutral-400">
        No attendance data is available for this range.
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <svg
        role="img"
        aria-label="Attendance trend line chart"
        viewBox={`0 0 ${width} ${height}`}
        className="min-h-[260px] w-full min-w-[720px]"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding + chartHeight * tick;
          const value = Math.round(maxValue * (1 - tick));

          return (
            <g key={tick}>
              <line
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
              />
              <text
                x={padding - 10}
                y={y + 4}
                fill="rgb(163,163,163)"
                fontSize="12"
                textAnchor="end"
              >
                {value}
              </text>
            </g>
          );
        })}

        <ChartLine
          color="rgb(190,242,100)"
          maxValue={maxValue}
          padding={padding}
          points={points}
          valueKey="am"
          chartHeight={chartHeight}
        />
        <ChartLine
          color="rgb(125,211,252)"
          maxValue={maxValue}
          padding={padding}
          points={points}
          valueKey="pm"
          chartHeight={chartHeight}
        />
        <ChartLine
          color="rgb(240,171,252)"
          maxValue={maxValue}
          padding={padding}
          points={points}
          valueKey="unique"
          chartHeight={chartHeight}
        />

        {points.map((point) => (
          <text
            key={point.date}
            x={point.x}
            y={height - 12}
            fill="rgb(163,163,163)"
            fontSize="11"
            textAnchor="middle"
          >
            {point.date.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function ChartLine({
  chartHeight,
  color,
  maxValue,
  padding,
  points,
  valueKey,
}: {
  chartHeight: number;
  color: string;
  maxValue: number;
  padding: number;
  points: Array<SundayAttendanceRow & { x: number }>;
  valueKey: "am" | "pm" | "unique";
}) {
  const path = points
    .map((point, index) => {
      const y = padding + chartHeight - (point[valueKey] / maxValue) * chartHeight;

      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <g>
      <path d={path} fill="none" stroke={color} strokeWidth="3" />
      {points.map((point) => {
        const y = padding + chartHeight - (point[valueKey] / maxValue) * chartHeight;

        return (
          <circle
            key={`${valueKey}-${point.date}`}
            cx={point.x}
            cy={y}
            r="4"
            fill={color}
          />
        );
      })}
    </g>
  );
}
