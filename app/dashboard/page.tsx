import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getHousehold } from "@/lib/elvanto";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const household = await getHousehold(user.email ?? undefined);
  const loggedInPerson = household?.primary;
  const displayName = loggedInPerson
    ? `${loggedInPerson.firstName} ${loggedInPerson.lastName}`
    : user.email ?? "Member";

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="mb-10 border-b border-white/10 pb-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <Image
                src="/apostolic-life-white.png"
                alt="Apostolic Life Tupelo Mississippi"
                width={1786}
                height={535}
                priority
                className="h-auto w-72 max-w-full"
              />
              <h1 className="mt-3 text-4xl font-bold tracking-tight">
                Member Portal
              </h1>
              <p className="mt-3 max-w-2xl text-neutral-400">
                A simple place for members to view contact information, family
                details, schedules, events, and future church resources.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              {loggedInPerson?.picture ? (
                <img
                  src={loggedInPerson.picture}
                  alt={displayName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-400 text-sm font-bold text-neutral-950">
                  {getInitials(displayName)}
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Signed in
                </p>
                <p className="text-sm font-semibold text-neutral-100">
                  {displayName}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          <Link
            href="/contact"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-lime-400/60 hover:bg-white/[0.06]"
          >
            <h2 className="text-xl font-semibold">Contact Information</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              View your contact details and submit update requests.
            </p>
          </Link>

          <Link
            href="/contact"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-lime-400/60 hover:bg-white/[0.06]"
          >
            <h2 className="text-xl font-semibold">Family Members</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              See household information connected through Elvanto.
            </p>
          </Link>

          <Link
            href="/contact/request-update"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-lime-400/60 hover:bg-white/[0.06]"
          >
            <h2 className="text-xl font-semibold">Request Changes</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Send updated phone, email, address, or family details for review.
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
