import { redirect } from "next/navigation";
import { getLeaderGroupsForEmail } from "@/lib/elvanto-groups";
import { getHousehold } from "@/lib/elvanto";
import { createClient } from "@/lib/supabase/server";
import SiteNavigationMenu from "./site-navigation-menu";

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
  const navigationItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/contact", label: "Contact Information" },
    { href: "/assignments", label: "Planning Center Assignments" },
    { href: "/events", label: "Events" },
    { href: "/giving", label: "Giving Records" },
    { href: "/prayer-board", label: "Prayer Board" },
    ...(leaderGroups.length > 0
      ? [{ href: "/groups", label: "Group Management" }]
      : []),
  ];

  async function logout() {
    "use server";

    const supabase = await createClient();

    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <SiteNavigationMenu
      className={className}
      logoutAction={logout}
      memberName={memberName}
      navigationItems={navigationItems}
      picture={household?.primary.picture}
    />
  );
}
