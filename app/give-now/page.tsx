import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TITHELY_GIVING_FORM_URL =
  "https://give.tithe.ly/?formId=2ab6e731-3ac0-11ee-90fc-1260ab546d11";

function getGivingFormUrl() {
  return (
    process.env.TITHELY_GIVING_FORM_URL ??
    process.env.NEXT_PUBLIC_TITHELY_GIVING_FORM_URL ??
    DEFAULT_TITHELY_GIVING_FORM_URL
  );
}

export default async function GiveNowPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const givingFormUrl = getGivingFormUrl();

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Giving
          </p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Give Now</h1>
              <p className="mt-3 max-w-2xl text-neutral-400">
                Give securely through Apostolic Life&apos;s Tithe.ly giving
                form.
              </p>
            </div>
            <Link
              href="/giving"
              className="inline-flex w-fit items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-lime-400/60 hover:text-lime-300"
            >
              Giving Records
            </Link>
          </div>
        </header>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white">
          <iframe
            src={givingFormUrl}
            title="Apostolic Life Tithe.ly giving form"
            className="h-[860px] w-full"
            loading="eager"
          />
        </section>
      </div>
    </main>
  );
}
