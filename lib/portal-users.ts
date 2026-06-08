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
  createdAt: string;
  lastSignInAt: string | null;
};

type PortalUserProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean | null;
  created_at: string;
};

export async function getCurrentPortalUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_users")
    .select("id,email,first_name,last_name,is_admin,created_at")
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
        .select("id,email,first_name,last_name,is_admin,created_at")
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
      createdAt: profile.created_at || authUser?.createdAt || "",
      lastSignInAt: authUser?.lastSignInAt ?? null,
    };
  });
}

export async function createPortalUser(formData: FormData) {
  await requirePortalAdmin();

  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  const firstName = normalizeText(formData.get("firstName"));
  const lastName = normalizeText(formData.get("lastName"));
  const isAdmin = formData.get("isAdmin") === "on";

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
  });

  revalidatePath("/admin");
}

export async function updatePortalUser(formData: FormData) {
  const currentUser = await requirePortalAdmin();
  const id = String(formData.get("id") || "");
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  const firstName = normalizeText(formData.get("firstName"));
  const lastName = normalizeText(formData.get("lastName"));
  const isAdmin = formData.get("isAdmin") === "on";

  if (!id || !email) {
    throw new Error("User ID and email are required.");
  }

  if (currentUser.id === id && !isAdmin) {
    throw new Error("You cannot remove admin access from your own account.");
  }

  const admin = createAdminClient();
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
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    console.error("Portal user delete failed:", error);
    throw new Error(error.message);
  }

  revalidatePath("/admin");
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
  },
) {
  const admin = createAdminClient();
  const { error } = await admin.from("portal_users").upsert({
    id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    is_admin: user.isAdmin,
  });

  if (error) {
    console.error("Portal user profile upsert failed:", error);
    throw new Error("Unable to save portal user profile.");
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
