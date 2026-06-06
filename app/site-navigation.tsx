import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeaderGroupsForEmail } from "@/lib/elvanto-groups";
import { getHousehold } from "@/lib/elvanto";
import { createClient } from "@/lib/supabase/server";

export default async function SiteNavigation({
  className = "",
}: {
  className?: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [household, leaderGroups] = await Promise.all([
    getHousehold(user.email ?? undefined),
    getLeaderGroupsForEmail(user.email ?? undefined),
  ]);
  const memberName = household?.primary
    ? `${household.primary.firstName} ${household.primary.lastName}`
    : user.email ?? "Member";

  async function logout() {
    "use server";

    const supabase = await createClient();

    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <details className={`group relative z-50 ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-neutral-950/95 px-3 py-2 text-sm font-semibold text-neutral-100 shadow-lg shadow-black/30 transition hover:border-lime-400/60 sm:px-4 sm:py-3 [&::-webkit-details-marker]:hidden">
        {household?.primary.picture ? (
          <img
            src={household.primary.picture}
            alt={memberName}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-400 text-xs font-bold text-neutral-950">
            {getInitials(memberName)}
          </span>
        )}
        Menu
        <span className="text-lime-300 transition group-open:rotate-180">v</span>
      </summary>

      <nav className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-neutral-950/95 p-2 shadow-xl shadow-black/40">
        <Link
          href="/dashboard"
          className="block rounded-lg px-3 py-3 text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
        >
          Dashboard
        </Link>
        <Link
          href="/contact"
          className="block rounded-lg px-3 py-3 text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
        >
          Contact Information
        </Link>
        <Link
          href="/assignments"
          className="block rounded-lg px-3 py-3 text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
        >
          Planning Center Assignments
        </Link>
        <Link
          href="/events"
          className="block rounded-lg px-3 py-3 text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
        >
          Events
        </Link>
        <Link
          href="/giving"
          className="block rounded-lg px-3 py-3 text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
        >
          Giving Records
        </Link>
        <Link
          href="/prayer-board"
          className="block rounded-lg px-3 py-3 text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
        >
          Prayer Board
        </Link>
        {leaderGroups.length > 0 ? (
          <Link
            href="/groups"
            className="block rounded-lg px-3 py-3 text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
          >
            Group Management
          </Link>
        ) : null}
        <form action={logout} className="border-t border-white/10 pt-2">
          <button
            type="submit"
            className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
          >
            Logout
          </button>
        </form>
      </nav>
    </details>
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
