export const PORTAL_PROJECT_ROLES = [
  "project_manager",
  "project_participant",
] as const;

export type PortalProjectRole = (typeof PORTAL_PROJECT_ROLES)[number];

export function parsePortalProjectRole(
  value: FormDataEntryValue | null | undefined,
): PortalProjectRole | null {
  const raw = String(value || "").trim();

  if (raw === "project_manager" || raw === "project_participant") {
    return raw;
  }

  return null;
}

export function isPortalProjectManager(profile: {
  isAdmin?: boolean;
  projectRole?: PortalProjectRole | null;
  canAccessProjects?: boolean;
}) {
  return Boolean(
    profile.isAdmin ||
      profile.projectRole === "project_manager" ||
      profile.canAccessProjects,
  );
}

export function formatPortalProjectRole(
  role: PortalProjectRole | null | undefined,
): string {
  if (role === "project_manager") return "Project Manager";
  if (role === "project_participant") return "Project Participant";
  return "None";
}