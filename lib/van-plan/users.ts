import {
  assertVanPlanAddress,
  type VanPlanAddress,
} from "@/lib/van-plan/address";
import { mapVanPlanUser } from "@/lib/van-plan/auth";
import { VanPlanError, vanPlanDb } from "@/lib/van-plan/db";
import {
  assertPasswordComplexity,
  assertPasswordsMatch,
  hashPassword,
} from "@/lib/van-plan/passwords";
import {
  comparablePhone,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
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

const USER_SELECT =
  "id, name, email, phone, phone_digits, permission, must_reset_password, address_line1, address_line2, city, state, zip, created_at";

export async function listVanPlanUsers(): Promise<VanPlanUser[]> {
  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_users")
    .select(USER_SELECT)
    .order("name", { ascending: true })
    .returns<UserRow[]>();

  if (error) {
    throw new VanPlanError("Unable to load auction users.", 500);
  }

  return (data ?? []).map(mapVanPlanUser);
}

export async function createVanPlanUser({
  name,
  email,
  phone,
  permission,
  password,
  confirmPassword,
  address,
  mustResetPassword = false,
}: {
  name: string;
  email: string;
  phone: string;
  permission: VanPlanPermission;
  password: string;
  confirmPassword: string;
  address: VanPlanAddress;
  mustResetPassword?: boolean;
}) {
  const trimmedName = name.trim();
  const normalizedEmail = normalizeEmail(email);
  const trimmedPhone = phone.trim();
  const phoneDigits = comparablePhone(trimmedPhone);

  if (trimmedName.length < 2) {
    throw new VanPlanError("Enter the bidder's full name.");
  }

  if (!isValidEmail(normalizedEmail)) {
    throw new VanPlanError("Enter a valid email address.");
  }

  if (!isValidPhone(trimmedPhone)) {
    throw new VanPlanError("Enter a valid 10-digit phone number.");
  }

  assertPasswordsMatch(password, confirmPassword);
  assertPasswordComplexity(password);
  assertVanPlanAddress(address);

  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_users")
    .insert({
      name: trimmedName,
      email: normalizedEmail,
      phone: trimmedPhone,
      phone_digits: phoneDigits,
      permission,
      password_hash: await hashPassword(password),
      must_reset_password: mustResetPassword,
      address_line1: address.addressLine1,
      address_line2: address.addressLine2,
      city: address.city,
      state: address.state,
      zip: address.zip,
    })
    .select(USER_SELECT)
    .single<UserRow>();

  if (error) {
    if (error.code === "23505") {
      throw new VanPlanError(
        "A user with that email or phone number already exists.",
      );
    }

    console.error("Van Plan user create failed:", error);
    throw new VanPlanError("Unable to create that user.", 500);
  }

  return mapVanPlanUser(data);
}

export async function updateVanPlanUserPermission({
  userId,
  permission,
  actorId,
}: {
  userId: string;
  permission: VanPlanPermission;
  actorId: string;
}) {
  if (userId === actorId && permission !== "admin") {
    throw new VanPlanError("You cannot remove your own admin permission.");
  }

  const db = vanPlanDb();
  const { error } = await db
    .from("van_plan_users")
    .update({ permission })
    .eq("id", userId);

  if (error) {
    throw new VanPlanError("Unable to update that user's permission.", 500);
  }
}

export async function updateVanPlanUserProfile({
  userId,
  name,
  phone,
  address,
}: {
  userId: string;
  name: string;
  phone: string;
  address: VanPlanAddress;
}) {
  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const phoneDigits = comparablePhone(trimmedPhone);

  if (trimmedName.length < 2) {
    throw new VanPlanError("Enter your full name.");
  }

  if (!isValidPhone(trimmedPhone)) {
    throw new VanPlanError("Enter a valid 10-digit phone number.");
  }

  assertVanPlanAddress(address);

  const db = vanPlanDb();
  const { error } = await db
    .from("van_plan_users")
    .update({
      name: trimmedName,
      phone: trimmedPhone,
      phone_digits: phoneDigits,
      address_line1: address.addressLine1,
      address_line2: address.addressLine2,
      city: address.city,
      state: address.state,
      zip: address.zip,
    })
    .eq("id", userId);

  if (error) {
    if (error.code === "23505") {
      throw new VanPlanError("That phone number is already used by another account.");
    }

    throw new VanPlanError("Unable to update that account.", 500);
  }
}
