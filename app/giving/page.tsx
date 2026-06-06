import { redirect } from "next/navigation";
import {
  getGivingSummary,
  parseGivingRange,
  type GivingRange,
} from "@/lib/giving";
import { createClient } from "@/lib/supabase/server";
import PortalLogo from "../portal-logo";

type PageProps = {
  searchParams: Promise<{
    range?: string;
  }>;
};

const RANGE_OPTIONS: Array<{ label: string; value: GivingRange }> = [
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "This Quarter", value: "this-quarter" },
  { label: "Last Quarter", value: "last-quarter" },
  { label: "This Year to Date", value: "year-to-date" },
  { label: "Last Year", value: "last-year" },
];

export default async function GivingPage({ searchParams }: PageProps) {
  const { range: rangeParam } = await searchParams;
  const range = parseGivingRange(rangeParam);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const summary = await getGivingSummary(user.email ?? undefined, range);

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-white/10 pb-6">
          <PortalLogo />
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Giving
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Giving Records
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Recent giving connected to your portal login.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <a
                key={option.value}
                href={`/giving?range=${option.value}`}
                className={
                  option.value === summary.range
                    ? "rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-950"
                    : "rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-lime-400/60 hover:text-lime-300"
                }
              >
                {option.label}
              </a>
            ))}
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-2 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{summary.label}</h2>
              <p className="mt-2 text-sm text-neutral-400">
                {summary.start} through {summary.end}
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm uppercase tracking-[0.18em] text-neutral-500">
                Total
              </p>
              <p className="mt-1 text-2xl font-bold text-lime-300">
                {summary.totalLabel}
              </p>
            </div>
          </div>

          {summary.records.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                  <tr>
                    <th className="py-3 font-medium">Date</th>
                    <th className="py-3 font-medium">Fund</th>
                    <th className="py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {summary.records.map((record) => (
                    <tr key={record.id}>
                      <td className="py-4 text-neutral-200">
                        {record.dateLabel}
                      </td>
                      <td className="py-4 text-neutral-300">{record.fund}</td>
                      <td className="py-4 text-right font-semibold text-neutral-100">
                        {record.amountLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-white/10 bg-neutral-950/40 p-5">
              <h3 className="text-xl font-semibold">No giving found</h3>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                No giving records were found for this date range and login
                email.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
