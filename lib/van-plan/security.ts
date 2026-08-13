import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import {
  VAN_PLAN_LOGIN_WINDOW_MINUTES,
  VAN_PLAN_MAX_FAILED_LOGINS,
  VAN_PLAN_PERMISSIONS,
} from "@/lib/van-plan/constants";
import { VanPlanError, vanPlanDb } from "@/lib/van-plan/db";
import type { VanPlanPermission } from "@/lib/van-plan/types";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function comparablePhone(value: string) {
  const digits = normalizePhoneDigits(value);

  if (digits.length >= 11 && digits.startsWith("1")) {
    return digits.slice(-10);
  }

  return digits.slice(-10);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function isValidPhone(value: string) {
  return comparablePhone(value).length === 10;
}

export function parsePermission(value: FormDataEntryValue | null): VanPlanPermission {
  const permission = String(value ?? "").trim();

  if (!VAN_PLAN_PERMISSIONS.includes(permission as VanPlanPermission)) {
    throw new VanPlanError("Choose a valid permission: admin, auctioneer, or user.");
  }

  return permission as VanPlanPermission;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function toProperCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export async function getRequestIp() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for") ?? "";
  const realIp = requestHeaders.get("x-real-ip") ?? "";

  return forwarded.split(",")[0]?.trim() || realIp.trim() || "unknown";
}

export function sanitizeNextPathSafe(value: string) {
  const trimmed = value.trim();

  if (!trimmed.startsWith("/van-plan") || trimmed.startsWith("//")) {
    return "/van-plan";
  }

  return trimmed;
}

export async function assertLoginNotLocked(email: string) {
  const db = vanPlanDb();
  const since = new Date(
    Date.now() - VAN_PLAN_LOGIN_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  const { count, error } = await db
    .from("van_plan_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("success", false)
    .gte("created_at", since);

  if (error) {
    console.error("Van Plan login lockout check failed:", error);
    return;
  }

  if ((count ?? 0) >= VAN_PLAN_MAX_FAILED_LOGINS) {
    throw new VanPlanError(
      "Too many sign-in attempts. Please wait a few minutes and try again.",
      429,
    );
  }
}

export async function recordLoginAttempt({
  email,
  ipAddress,
  success,
}: {
  email: string;
  ipAddress: string;
  success: boolean;
}) {
  const db = vanPlanDb();
  const { error } = await db.from("van_plan_login_attempts").insert({
    email,
    ip_address: ipAddress,
    success,
  });

  if (error) {
    console.error("Van Plan login attempt log failed:", error);
  }
}

export function dollarsToCents(value: string) {
  const trimmed = value.trim().replace(/[$,]/g, "");

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new VanPlanError("Enter a valid dollar amount.");
  }

  const [dollars, cents = ""] = trimmed.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}

export function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function slugifyItemName(name: string) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "item";

  return `${base}-${randomBytes(3).toString("hex")}`;
}
