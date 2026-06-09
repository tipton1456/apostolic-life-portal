import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalIcon, type PortalIconName } from "@/app/icons";
import { getCurrentSessionUser } from "@/lib/demo";
import { listExpenseReimbursementTrackers } from "@/lib/expense-reimbursements";

type PageProps = {
  searchParams: Promise<{
    submitted?: string;
  }>;
};

const RESOURCE_ITEMS: Array<{
  description: string;
  href: string;
  icon: PortalIconName;
  label: string;
}> = [
  {
    description:
      "Submit expense and reimbursement details directly through the portal.",
    href: "/expense-reimbursement",
    icon: "expense",
    label: "Expense Reimbursement",
  },
];

export default async function ResourcesPage({ searchParams }: PageProps) {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  const { submitted } = await searchParams;
  const reimbursementTrackers = user.isDemo
    ? { error: false, items: getDemoReimbursementTrackers() }
    : await listExpenseReimbursementTrackers();

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Member Portal
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Resources
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Forms and resources available through the portal.
          </p>

          {submitted === "expense" ? (
            <p className="mt-4 rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-sm font-semibold text-lime-300">
              Expense reimbursement submitted.
            </p>
          ) : null}
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {RESOURCE_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-lime-400/60 hover:bg-white/[0.06]"
            >
              <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-lime-400/30 bg-lime-400/10 text-lime-300">
                <PortalIcon name={item.icon} />
              </span>
              <h2 className="text-2xl font-semibold text-neutral-100">
                {item.label}
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                {item.description}
              </p>
            </Link>
          ))}
        </section>

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-100">
                Reimbursement Workflow
              </h2>
              <p className="mt-2 text-sm text-neutral-400">
                Track expense and reimbursement forms submitted through the
                portal.
              </p>
            </div>
            <Link
              href="/expense-reimbursement"
              className="inline-flex items-center justify-center rounded-xl border border-lime-400/40 px-4 py-3 text-sm font-semibold text-lime-300 transition hover:bg-lime-400/10"
            >
              New Request
            </Link>
          </div>

          {reimbursementTrackers.error ? (
            <p className="mt-5 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-100">
              Reimbursement tracking is not available yet. Run the latest
              Supabase migration to enable this grid.
            </p>
          ) : null}

          {!reimbursementTrackers.error && reimbursementTrackers.items.length === 0 ? (
            <p className="mt-5 rounded-xl border border-white/10 bg-neutral-950/40 px-4 py-4 text-sm text-neutral-400">
              No reimbursement requests have been submitted through the portal
              yet.
            </p>
          ) : null}

          {reimbursementTrackers.items.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-[0.2em] text-neutral-500">
                  <tr>
                    <th className="py-3 pr-4 font-semibold">Date</th>
                    <th className="py-3 pr-4 font-semibold">Event</th>
                    <th className="py-3 pr-4 font-semibold">Type</th>
                    <th className="py-3 pr-4 font-semibold">Amount</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {reimbursementTrackers.items.map((item) => (
                    <tr key={item.id} className="text-neutral-200">
                      <td className="py-4 pr-4 text-neutral-300">
                        {formatDate(item.requestDate || item.createdAt)}
                      </td>
                      <td className="py-4 pr-4 font-semibold">
                        {item.event || "Expense Request"}
                      </td>
                      <td className="py-4 pr-4 text-neutral-300">
                        {item.reportType || "Reimbursement"}
                      </td>
                      <td className="py-4 pr-4 text-neutral-300">
                        {formatCurrency(item.amountTotal)}
                      </td>
                      <td className="py-4 pr-4">
                        <span className="inline-flex rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-semibold text-lime-300">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-4 text-neutral-400">
                        {formatDateTime(item.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function getDemoReimbursementTrackers() {
  return [
    {
      amountTotal: 48.72,
      cognitoEntryId: "demo-1",
      createdAt: "2026-06-07T16:30:00.000Z",
      event: "Youth Rally Supplies",
      id: 1,
      requestDate: "2026-06-07",
      reportType: "Reimbursement",
      status: "Submitted",
      updatedAt: "2026-06-07T16:30:00.000Z",
      workflowAction: "Submit",
    },
    {
      amountTotal: 126.19,
      cognitoEntryId: "demo-2",
      createdAt: "2026-06-01T14:15:00.000Z",
      event: "Guest Ministry Meal",
      id: 2,
      requestDate: "2026-06-01",
      reportType: "Expense Report",
      status: "Approved",
      updatedAt: "2026-06-03T19:45:00.000Z",
      workflowAction: "Approve",
    },
  ];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function formatDate(value: string) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
