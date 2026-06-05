import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlanOrderDetail } from "@/lib/planning-center";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    serviceTypeId: string;
    planId: string;
  }>;
};

export default async function ScheduleOrderPage({ params }: PageProps) {
  const { serviceTypeId, planId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const detail = await getPlanOrderDetail(serviceTypeId, planId);

  if (!detail) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/schedule/${serviceTypeId}/${planId}`}
          className="text-sm text-lime-400 hover:text-lime-300"
        >
          ← Back to Service Plan
        </Link>

        <header className="mt-8 border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Full Order
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            {detail.plan.title}
          </h1>
          <p className="mt-3 text-neutral-400">
            {detail.plan.dates} · {detail.plan.totalLength}
          </p>
        </header>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {detail.items.length > 0 ? (
            <div className="divide-y divide-white/10">
              {detail.items.map((item, index) => (
                <article key={item.id} className="grid gap-4 p-5 md:grid-cols-[4rem_1fr_8rem]">
                  <div className="text-sm font-semibold text-lime-300">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold">{item.title}</h2>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-300">
                        {item.type}
                      </span>
                    </div>
                    {item.description ? (
                      <p className="mt-2 text-sm leading-6 text-neutral-400">
                        {item.description}
                      </p>
                    ) : null}
                    {item.servicePosition ? (
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-neutral-500">
                        {item.servicePosition}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm text-neutral-300 md:text-right">
                    {item.length}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-6">
              <h2 className="text-2xl font-semibold">No order visible</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                Planning Center did not return visible order items for this
                plan.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
