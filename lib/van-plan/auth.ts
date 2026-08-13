import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  VAN_PLAN_BASE_PATH,
  VAN_PLAN_SESSION_COOKIE,
  VAN_PLAN_SESSION_DAYS,
} from "@/lib/van-plan/constants";
import { VanPlanError, vanPlanDb } from "@/lib/van-plan/db";
import { verifyPassword } from "@/lib/van-plan/passwords";
import {
  createSessionToken,
  hashToken,
  isValidEmail,
  normalizeEmail,
  recordLoginAttempt,
} from "@/lib/van-plan/security";
import type { VanPlanPermission, VanPlanUser } from "@/lib/van-plan/types";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  phone_digits: string;
  permission: VanPlanPermission;
  must_reset_password: boolean | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  created_at: string;
};

export function mapVanPlanUser(row: UserRow): VanPlanUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    phoneDigits: row.phone_digits,
    permission: row.permission,
    mustResetPassword: Boolean(row.must_reset_password),
    addressLine1: row.address_line1 ?? "",
    addressLine2: row.address_line2 ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    zip: row.zip ?? "",
    createdAt: row.created_at,
  };
}

export function canManageItems(user: VanPlanUser | null) {
  return user?.permission === "admin" || user?.permission === "auctioneer";
}

export function canManageUsers(user: VanPlanUser | null) {
  return user?.permission === "admin";
}

export function canViewAllBids(user: VanPlanUser | null) {
  return canManageItems(user);
}

export function canBid(user: VanPlanUser | null) {
  return Boolean(user);
}

export async function getRequestIp() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for") ?? "";
  const realIp = requestHeaders.get("x-real-ip") ?? "";

  return forwarded.split(",")[0]?.trim() || realIp.trim() || "unknown";
}

export async function countVanPlanUsers() {
  const db = vanPlanDb();
  const { count, error } = await db
    .from("van_plan_users")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new VanPlanError(
      "Unable to load auction users. Apply the Van Plan auction migration first.",
      500,
    );
  }

  return count ?? 0;
}

export async function getCurrentVanPlanUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(VAN_PLAN_SESSION_COOKIE)?.value;

  if (!token) return null;

  const db = vanPlanDb();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("van_plan_sessions")
    .select(
      "id, expires_at, van_plan_users (id, name, email, phone, phone_digits, permission, must_reset_password, address_line1, address_line2, city, state, zip, created_at)",
    )
    .eq("token_hash", tokenHash)
    .gt("expires_at", now)
    .maybeSingle();

  if (error) {
    console.error("Van Plan session lookup failed:", error);
    return null;
  }

  const user = data?.van_plan_users as UserRow | UserRow[] | null;
  const profile = Array.isArray(user) ? user[0] : user;

  if (!data || !profile) return null;

  await db
    .from("van_plan_sessions")
    .update({ last_seen_at: now })
    .eq("id", data.id);

  return mapVanPlanUser(profile);
}

export async function requireVanPlanUser(nextPath = VAN_PLAN_BASE_PATH) {
  const user = await getCurrentVanPlanUser();

  if (!user) {
    redirect(
      `${VAN_PLAN_BASE_PATH}/login?next=${encodeURIComponent(nextPath)}`,
    );
  }

  return user;
}

export async function requireItemManager(nextPath = VAN_PLAN_BASE_PATH) {
  const user = await requireVanPlanUser(nextPath);

  if (!canManageItems(user)) {
    throw new VanPlanError("You do not have permission to manage items.", 403);
  }

  return user;
}

export async function requireVanPlanAdmin(nextPath = VAN_PLAN_BASE_PATH) {
  const user = await requireVanPlanUser(nextPath);

  if (!canManageUsers(user)) {
    throw new VanPlanError("Only an admin can manage auction users.", 403);
  }

  return user;
}

export async function createVanPlanSession(userId: string) {
  const token = createSessionToken();
  const db = vanPlanDb();
  const expiresAt = new Date(
    Date.now() + VAN_PLAN_SESSION_DAYS * 24 * 60 * 60 * 1000,
  );

  const { error } = await db.from("van_plan_sessions").insert({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw new VanPlanError("Unable to start a secure session.", 500);
  }

  const cookieStore = await cookies();
  cookieStore.set(VAN_PLAN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyAllVanPlanSessions(userId: string) {
  const db = vanPlanDb();
  await db.from("van_plan_sessions").delete().eq("user_id", userId);
}

export async function destroyVanPlanSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(VAN_PLAN_SESSION_COOKIE)?.value;

  if (token) {
    const db = vanPlanDb();
    await db
      .from("van_plan_sessions")
      .delete()
      .eq("token_hash", hashToken(token));
  }

  cookieStore.set(VAN_PLAN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function authenticateVanPlanUser({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const ipAddress = await getRequestIp();

  if (!isValidEmail(normalizedEmail) || !password) {
    await recordLoginAttempt({
      email: normalizedEmail,
      ipAddress,
      success: false,
    });
    throw new VanPlanError("Email or password is not recognized.");
  }

  const { assertLoginNotLocked } = await import("@/lib/van-plan/security");
  await assertLoginNotLocked(normalizedEmail);

  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_users")
    .select(
      "id, name, email, phone, phone_digits, permission, must_reset_password, address_line1, address_line2, city, state, zip, created_at, password_hash",
    )
    .eq("email", normalizedEmail)
    .maybeSingle<UserRow & { password_hash: string | null }>();

  if (error) {
    throw new VanPlanError("Unable to sign in right now.", 500);
  }

  const passwordMatches = await verifyPassword(password, data?.password_hash);

  if (!data || !passwordMatches) {
    await recordLoginAttempt({
      email: normalizedEmail,
      ipAddress,
      success: false,
    });
    throw new VanPlanError("Email or password is not recognized.");
  }

  await recordLoginAttempt({
    email: normalizedEmail,
    ipAddress,
    success: true,
  });
  await createVanPlanSession(data.id);

  return mapVanPlanUser(data);
}
