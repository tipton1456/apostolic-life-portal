import { getLeaderGroupsForEmail } from "@/lib/elvanto-groups";
import { getHousehold } from "@/lib/elvanto";
import { isCurrentUserProjectManager } from "@/lib/project-management";
import { isCurrentUserPortalAdmin } from "@/lib/portal-users";
import {
  getPlanningCenterLeaderTeamsForEmail,
  getPlanningCenterProfilePicture,
} from "@/lib/planning-center";
import { getCurrentSessionUser } from "@/lib/demo";
import SiteNavigationMenu from "./site-navigation-menu";

export default async function SiteNavigation({
  className = "",
}: {
  className?: string;
}) {
  const user = await getCurrentSessionUser();

  if (!user) return null;

  const [
    household,
    leaderGroups,
    planningCenterLeaderTeams,
    planningCenterProfilePicture,
    isPortalAdmin,
    canAccessProjects,
  ] = await Promise.all([
    getHousehold(user.email ?? undefined),
    getLeaderGroupsForEmail(user.email ?? undefined),
    getPlanningCenterLeaderTeamsForEmail(user.email ?? undefined),
    getPlanningCenterProfilePicture(user.email ?? undefined),
    user.isDemo ? false : isCurrentUserPortalAdmin(),
    user.isDemo ? false : isCurrentUserProjectManager(),
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
      ? [{ href: "/projects", label: "Project Management" }]
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
      picture={planningCenterProfilePicture ?? household?.primary.picture}
    />
  );
}
