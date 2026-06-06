import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeaderGroupsForEmail } from "@/lib/elvanto-groups";
import { createClient } from "@/lib/supabase/server";
import PortalLogo from "../portal-logo";

export default async function GroupManagementPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const leaderGroups = await getLeaderGroupsForEmail(user.email ?? undefined);

  if (leaderGroups.length === 0) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-white/10 pb-6">
          <PortalLogo />
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Groups
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Group Management
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Groups where Elvanto lists you as a leader.
          </p>
        </header>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="divide-y divide-white/10">
            {leaderGroups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="block px-5 py-4 transition hover:bg-white/[0.06]"
              >
                <p className="font-semibold text-neutral-100">{group.name}</p>
                <p className="mt-1 text-sm text-lime-300">{group.position}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
