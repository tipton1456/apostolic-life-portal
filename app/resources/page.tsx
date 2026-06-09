import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/demo";

const RESOURCE_ITEMS = [
  {
    description:
      "Submit expense and reimbursement details directly through the portal.",
    href: "/expense-reimbursement",
    label: "Expense Reimbursement",
  },
];

export default async function ResourcesPage() {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

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
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {RESOURCE_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-lime-400/60 hover:bg-white/[0.06]"
            >
              <h2 className="text-2xl font-semibold text-neutral-100">
                {item.label}
              </h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                {item.description}
              </p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
