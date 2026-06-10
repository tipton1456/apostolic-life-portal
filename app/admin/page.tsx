import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalIcon, type PortalIconName } from "@/app/icons";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { hasAdminClientConfig } from "@/lib/supabase/admin";

const ADMIN_ITEMS: Array<{
  description: string;
  href: string;
  icon: PortalIconName;
  label: string;
}> = [
  {
    description: "Create users, manage admin access, reset passwords, and review the audit log.",
    href: "/admin/users",
    icon: "admin",
    label: "Portal Users",
  },
  {
    description: "Search Planning Center people and view upcoming assignments for any person.",
    href: "/admin/schedule-lookup",
    icon: "search",
    label: "Schedule Look Up",
  },
  {
    description: "Preview a member dashboard by email for testing and support.",
    href: "/admin/clone-dashboard",
    icon: "dashboard",
    label: "Clone Dashboard",
  },
  {
    description: "View upcoming Minister and Platform assignments from Planning Center.",
    href: "/admin/minister-platform-schedule",
    icon: "assignments",
    label: "Minister and Platform Schedule",
  },
  {
    description: "Verify the Cognito Forms API connection and inspect available forms.",
    href: "/admin/cognito-forms",
    icon: "resources",
    label: "Cognito Forms",
  },
  {
    description: "Review recent production deployments and the commit trail behind portal updates.",
    href: "/admin/deployments",
    icon: "deployments",
    label: "Deployment Log",
  },
  {
    description: "Review SMS and email messages sent from group management and recipient delivery results.",
    href: "/admin/communications",
    icon: "communications",
    label: "Communication Log",
  },
];

export default async function AdminLandingPage() {
  if (!hasAdminClientConfig()) {
    return (
      <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Administration
          </p>
          <h1 className="mt-3 text-3xl font-bold">Setup Required</h1>
          <p className="mt-3 text-neutral-400">
            Add the server-only Supabase service role key to enable portal
            administration.
          </p>
        </div>
      </main>
    );
  }

  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Administration
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Admin Tools
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Tools and reports available only to portal administrators.
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {ADMIN_ITEMS.map((item) => (
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
      </div>
    </main>
  );
}
