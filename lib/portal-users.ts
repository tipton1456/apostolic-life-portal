"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PortalUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  canAccessProjects: boolean;
  mustResetPassword: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

export type PortalUserAuditLog = {
  id: number;
  action: string;
  actorEmail: string;
  targetEmail: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type PortalActionState = {
  message: string;
  status: "idle" | "success" | "error";
  version: number;
};

type PortalUserProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean | null;
  can_access_projects: boolean | null;
  must_reset_password: boolean | null;
  created_at: string;
};

type PortalUserAuditLogRow = {
  id: number;
  action: string;
  actor_email: string | null;
  target_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export async function getCurrentPortalUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("portal_users")
    .select(
      "id,email,first_name,last_name,is_admin,can_access_projects,must_reset_password,created_at",
    )
    .eq("id", user.id)
    .maybeSingle<PortalUserProfile>();

  if (error) {
    console.error("Portal user lookup failed:", error);
    return null;
  }

  return {
    id: user.id,
    email: data?.email ?? user.email ?? "",
    firstName: data?.first_name ?? "",
    lastName: data?.last_name ?? "",
    isAdmin: Boolean(data?.is_admin),
    canAccessProjects: Boolean(data?.can_access_projects),
    mustResetPassword: Boolean(data?.must_reset_password),
    createdAt: data?.created_at ?? "",
  };
}

export async function isCurrentUserPortalAdmin() {
  const currentUser = await getCurrentPortalUser().catch((error) => {
    console.error("Portal admin check failed:", error);
    return null;
  });

  return Boolean(currentUser?.isAdmin);
}

export async function listPortalUsers(): Promise<PortalUser[]> {
  await requirePortalAdmin();

  const admin = createAdminClient();
  const [{ data: profileData, error: profileError }, { data: authData, error: authError }] =
    await Promise.all([
      admin
        .from("portal_users")
        .select(
          "id,email,first_name,last_name,is_admin,can_access_projects,must_reset_password,created_at",
        )
        .order("email", { ascending: true }),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

  if (profileError) {
    console.error("Portal user profiles failed:", profileError);
    throw new Error("Unable to load portal users.");
  }

  if (authError) {
    console.error("Portal auth users failed:", authError);
    throw new Error("Unable to load portal auth users.");
  }

  const authUsersById = new Map(
    authData.users.map((user) => [
      user.id,
      {
        email: user.email ?? "",
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      },
    ]),
  );

  return (profileData as PortalUserProfile[]).map((profile) => {
    const authUser = authUsersById.get(profile.id);

    return {
      id: profile.id,
      email: profile.email || authUser?.email || "",
      firstName: profile.first_name ?? "",
      lastName: profile.last_name ?? "",
      isAdmin: Boolean(profile.is_admin),
      canAccessProjects: Boolean(profile.can_access_projects),
      mustResetPassword: Boolean(profile.must_reset_password),
      createdAt: profile.created_at || authUser?.createdAt || "",
      lastSignInAt: authUser?.lastSignInAt ?? null,
    };
  });
}

export async function hasPortalUserForEmail(email?: string) {
  await requirePortalAdmin();

  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) return false;

  const admin = createAdminClient();
  const [{ data: profiles, error: profileError }, { data: authData, error: authError }] =
    await Promise.all([
      admin
        .from("portal_users")
        .select("id,email")
        .ilike("email", normalizedEmail)
        .limit(1),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

  if (profileError) {
    console.error("Portal profile email lookup failed:", profileError);
  }

  if (authError) {
    console.error("Portal auth email lookup failed:", authError);
  }

  return Boolean(
    profiles?.length ||
      authData?.users.some(
        (user) => user.email?.trim().toLowerCase() === normalizedEmail,
      ),
  );
}

export async function createPortalUser(formData: FormData) {
  const currentUser = await requirePortalAdmin();

  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  const firstName = normalizeText(formData.get("firstName"));
  const lastName = normalizeText(formData.get("lastName"));
  const isAdmin = formData.get("isAdmin") === "on";
  const canAccessProjects = formData.get("canAccessProjects") === "on";

  if (!email || password.length < 8) {
    throw new Error("Email and an 8 character password are required.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (error || !data.user) {
    console.error("Portal user creation failed:", error);
    throw new Error(error?.message ?? "Unable to create portal user.");
  }

  await upsertPortalUserProfile(data.user.id, {
    email,
    firstName,
    lastName,
    isAdmin,
    canAccessProjects,
    mustResetPassword: true,
  });

  await logPortalUserEvent({
    action: "portal_user.created",
    actor: currentUser,
    target: {
      id: data.user.id,
      email,
    },
    details: {
      created: {
        email,
        firstName,
        lastName,
        isAdmin,
        canAccessProjects,
        mustResetPassword: true,
      },
      temporaryPasswordSet: true,
    },
  });

  revalidatePath("/admin");
}

export async function createPortalUserWithState(
  _previousState: PortalActionState,
  formData: FormData,
): Promise<PortalActionState> {
  try {
    await createPortalUser(formData);

    return {
      message: "User created. The temporary password reset is required at next login.",
      status: "success",
      version: Date.now(),
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Unable to create user.",
      status: "error",
      version: Date.now(),
    };
  }
}

export async function updatePortalUser(formData: FormData) {
  const currentUser = await requirePortalAdmin();
  const id = String(formData.get("id") || "");
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  const firstName = normalizeText(formData.get("firstName"));
  const lastName = normalizeText(formData.get("lastName"));
  const isAdmin = formData.get("isAdmin") === "on";
  const canAccessProjects = formData.get("canAccessProjects") === "on";

  if (!id || !email) {
    throw new Error("User ID and email are required.");
  }

  if (currentUser.id === id && !isAdmin) {
    throw new Error("You cannot remove admin access from your own account.");
  }

  const admin = createAdminClient();
  const before = await getPortalUserSnapshot(id);
  const update: {
    email: string;
    password?: string;
    user_metadata: {
      first_name: string;
      last_name: string;
    };
  } = {
    email,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
    },
  };

  if (password) {
    if (password.length < 8) {
      throw new Error("Passwords must be at least 8 characters.");
    }

    update.password = password;
  }

  const { error } = await admin.auth.admin.updateUserById(id, update);

  if (error) {
    console.error("Portal user auth update failed:", error);
    throw new Error(error.message);
  }

  await upsertPortalUserProfile(id, {
    email,
    firstName,
    lastName,
    isAdmin,
    canAccessProjects,
    mustResetPassword: password ? true : before?.mustResetPassword,
  });

  const after = await getPortalUserSnapshot(id);

  await logPortalUserEvent({
    action: "portal_user.updated",
    actor: currentUser,
    target: {
      id,
      email,
    },
    details: {
      before,
      after,
      passwordChanged: Boolean(password),
      resetRequired: password ? true : after?.mustResetPassword,
    },
  });

  revalidatePath("/admin");
}

export async function deletePortalUser(formData: FormData) {
  const currentUser = await requirePortalAdmin();
  const id = String(formData.get("id") || "");

  if (!id) {
    throw new Error("User ID is required.");
  }

  if (currentUser.id === id) {
    throw new Error("You cannot delete your own logged-in account.");
  }

  const admin = createAdminClient();
  const before = await getPortalUserSnapshot(id);
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    console.error("Portal user delete failed:", error);
    throw new Error(error.message);
  }

  await logPortalUserEvent({
    action: "portal_user.deleted",
    actor: currentUser,
    target: {
      email: before?.email ?? "",
    },
    details: {
      deleted: before,
    },
  });

  revalidatePath("/admin");
}

export async function completePasswordReset() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const before = await getPortalUserSnapshot(user.id);
  const { error } = await admin
    .from("portal_users")
    .update({ must_reset_password: false })
    .eq("id", user.id);

  if (error) {
    console.error("Password reset completion failed:", error);
    throw new Error("Unable to complete password reset.");
  }

  await logPortalUserEvent({
    action: "portal_user.password_reset_completed",
    actor: {
      id: user.id,
      email: user.email ?? "",
    },
    target: {
      id: user.id,
      email: user.email ?? "",
    },
    details: {
      before,
      after: await getPortalUserSnapshot(user.id),
    },
  });

  revalidatePath("/admin");
}

export async function listPortalUserAuditLogs(): Promise<PortalUserAuditLog[]> {
  await requirePortalAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_user_audit_logs")
    .select("id,action,actor_email,target_email,details,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Portal audit log lookup failed:", error);
    throw new Error("Unable to load portal audit log.");
  }

  return (data as PortalUserAuditLogRow[]).map((log) => ({
    id: log.id,
    action: log.action,
    actorEmail: log.actor_email ?? "Unknown",
    targetEmail: log.target_email ?? "Unknown",
    details: log.details ?? {},
    createdAt: log.created_at,
  }));
}

async function requirePortalAdmin() {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  return currentUser;
}

async function upsertPortalUserProfile(
  id: string,
  user: {
    email: string;
    firstName: string;
    lastName: string;
    isAdmin: boolean;
    canAccessProjects: boolean;
    mustResetPassword?: boolean;
  },
) {
  const admin = createAdminClient();
  const payload: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    is_admin: boolean;
    can_access_projects: boolean;
    must_reset_password?: boolean;
  } = {
    id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    is_admin: user.isAdmin,
    can_access_projects: user.canAccessProjects,
  };

  if (user.mustResetPassword !== undefined) {
    payload.must_reset_password = user.mustResetPassword;
  }

  const { error } = await admin.from("portal_users").upsert(payload);

  if (error) {
    console.error("Portal user profile upsert failed:", error);
    throw new Error("Unable to save portal user profile.");
  }
}

async function getPortalUserSnapshot(id: string) {
  const admin = createAdminClient();
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin
      .from("portal_users")
      .select(
        "id,email,first_name,last_name,is_admin,can_access_projects,must_reset_password,created_at,updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    admin.auth.admin.getUserById(id),
  ]);

  return {
    id,
    email: profile?.email ?? authUser.user?.email ?? "",
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    isAdmin: Boolean(profile?.is_admin),
    canAccessProjects: Boolean(profile?.can_access_projects),
    mustResetPassword: Boolean(profile?.must_reset_password),
    createdAt: profile?.created_at ?? authUser.user?.created_at ?? null,
    updatedAt: profile?.updated_at ?? null,
    lastSignInAt: authUser.user?.last_sign_in_at ?? null,
  };
}

async function logPortalUserEvent({
  action,
  actor,
  target,
  details,
}: {
  action: string;
  actor: {
    id: string;
    email: string;
  };
  target: {
    id?: string;
    email: string;
  };
  details: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("portal_user_audit_logs").insert({
    action,
    actor_user_id: actor.id,
    actor_email: actor.email,
    target_user_id: target.id || null,
    target_email: target.email,
    details,
  });

  if (error) {
    console.error("Portal audit log insert failed:", error);
  }
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}
