import { unstable_noStore as noStore } from "next/cache";
import { getLeaderGroupsForEmail } from "@/lib/elvanto-groups";
import { getHousehold, getMenuProfilePicture } from "@/lib/elvanto";
import { canCurrentUserAccessProjects } from "@/lib/project-management";
import { isCurrentUserPortalAdmin } from "@/lib/portal-users";
import { getPlanningCenterLeaderTeamsForEmail } from "@/lib/planning-center";
import { getCurrentSessionUser } from "@/lib/demo";
import SiteNavigationMenu from "./site-navigation-menu";

export default async function SiteNavigation({
  className = "",
}: {
  className?: string;
}) {
  noStore();

  const user = await getCurrentSessionUser();

  if (!user) return null;

  const [
    household,
    leaderGroups,
    planningCenterLeaderTeams,
    menuProfilePicture,
    isPortalAdmin,
    canAccessProjects,
  ] = await Promise.all([
    getHousehold(user.email ?? undefined),
    getLeaderGroupsForEmail(user.email ?? undefined),
    getPlanningCenterLeaderTeamsForEmail(user.email ?? undefined),
    getMenuProfilePicture(user.email ?? undefined, user.isDemo),
    user.isDemo ? false : isCurrentUserPortalAdmin(),
    user.isDemo ? false : canCurrentUserAccessProjects(),
  ]);
  const memberName = household?.primary
    ? `${household.primary.firstName} ${household.primary.lastName}`
    : user.email ?? "Member";
  const navigationItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/contact", label: "Contact Information" },
    { href: "/assignments", label: "Planning Center Assignments" },
    { href: "/events", label: "Events" },
    { href: "/give-now", label: "Give Now" },
    { href: "/giving", label: "Giving Records" },
    { href: "/resources", label: "Resources" },
    { href: "/my-groups", label: "My Groups" },
    { href: "/prayer-board", label: "Prayer Board" },
    ...(canAccessProjects
      ? [
          { href: "/projects", label: "Projects" },
          { href: "/projects/files", label: "Project Files" },
        ]
      : []),
    ...(isPortalAdmin ? [{ href: "/admin", label: "Administration" }] : []),
    ...(leaderGroups.length > 0 || planningCenterLeaderTeams.length > 0
      ? [{ href: "/groups", label: "Group Management" }]
      : []),
  ];

  return (
    <SiteNavigationMenu
      className={className}
      memberName={memberName}
      navigationItems={navigationItems}
      picture={menuProfilePicture.picture ?? household?.primary.picture}
      pictureCacheKey={menuProfilePicture.cacheKey ?? undefined}
    />
  );
}