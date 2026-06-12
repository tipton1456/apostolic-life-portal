import { redirect } from "next/navigation";
import { isPortalProjectManager } from "@/lib/portal-project-roles";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PortalUser = NonNullable<Awaited<ReturnType<typeof getCurrentPortalUser>>>;

export async function isAssignedProjectManager(projectId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_managers")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Assigned project manager lookup failed:", error);
    return false;
  }

  return Boolean(data);
}

export async function canUserManageProject(projectId: string, currentUser: PortalUser) {
  if (currentUser.isAdmin) {
    return true;
  }

  return isAssignedProjectManager(projectId, currentUser.id);
}

export async function canUserViewProject(projectId: string, currentUser: PortalUser) {
  if (await canUserManageProject(projectId, currentUser)) {
    return true;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Project view permission lookup failed:", error);
    return false;
  }

  return Boolean(data);
}

export async function loadAccessibleProjectIds(currentUser: PortalUser) {
  if (currentUser.isAdmin) {
    return null;
  }

  const supabase = await createClient();
  const [{ data: managerRows, error: managerError }, { data: memberRows, error: memberError }] =
    await Promise.all([
      supabase.from("project_managers").select("project_id").eq("user_id", currentUser.id),
      supabase.from("project_members").select("project_id").eq("user_id", currentUser.id),
    ]);

  if (managerError) {
    console.error("Project manager assignment lookup failed:", managerError);
    throw new Error("Unable to load project assignments.");
  }

  if (memberError) {
    console.error("Project membership lookup failed:", memberError);
    throw new Error("Unable to load project memberships.");
  }

  const projectIds = [
    ...new Set([
      ...(managerRows ?? []).map((row) => row.project_id as string),
      ...(memberRows ?? []).map((row) => row.project_id as string),
    ]),
  ];

  return projectIds;
}

export async function userHasProjectAreaAccess(currentUser: PortalUser) {
  if (currentUser.isAdmin || isPortalProjectManager(currentUser)) {
    const projectIds = await loadAccessibleProjectIds(currentUser);

    if (projectIds === null) {
      return true;
    }

    if (projectIds.length > 0) {
      return true;
    }

    return isPortalProjectManager(currentUser);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("user_id", currentUser.id)
    .limit(1);

  if (error) {
    console.error("Project area access lookup failed:", error);
    return false;
  }

  return Boolean(data?.length);
}

export async function requireProjectAreaAccess() {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login?next=/projects");
  }

  const hasAccess = await userHasProjectAreaAccess(currentUser);

  if (!hasAccess) {
    redirect("/dashboard");
  }

  return currentUser;
}

export async function requireEligibleProjectManager() {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login?next=/projects");
  }

  if (!isPortalProjectManager(currentUser)) {
    redirect("/dashboard");
  }

  return currentUser;
}

export async function requireProjectManageAccess(projectId: string) {
  const currentUser = await requireProjectAreaAccess();
  const canManage = await canUserManageProject(projectId, currentUser);

  if (!canManage) {
    redirect("/projects");
  }

  return currentUser;
}

export async function loadProjectManagerNamesForProject(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_managers")
    .select("user_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Project manager names lookup failed:", error);
    return [];
  }

  const userIds = (data ?? []).map((row) => row.user_id as string);
  if (userIds.length === 0) return [];

  const admin = createAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("portal_users")
    .select("id,email,first_name,last_name")
    .in("id", userIds);

  if (profileError) {
    console.error("Project manager profile lookup failed:", profileError);
    return [];
  }

  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id as string, profile]),
  );

  return userIds
    .map((userId) => {
      const profile = profilesById.get(userId);
      if (!profile) return null;

      return (
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        (profile.email as string)
      );
    })
    .filter((name): name is string => Boolean(name));
}