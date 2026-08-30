import { cache } from "react";
import {
  VAN_PLAN_AUCTION_SETTINGS_SLUG,
  VAN_PLAN_AUCTION_STATUSES,
} from "@/lib/van-plan/constants";
import { VanPlanError, vanPlanDb } from "@/lib/van-plan/db";
import {
  buildVanPlanAuctionSchedule,
  formatAuctionClock,
  type AuctionSchedule,
} from "@/lib/van-plan/schedule";
import type { AuctionStatusOverride } from "@/lib/van-plan/types";

type SettingsRow = {
  id: number;
  status: AuctionStatusOverride;
};

function isMissingSettingsTable(error: { message?: string; code?: string } | null) {
  if (!error) return false;

  const message = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    /van_plan_auction_settings|schema cache/i.test(message)
  );
}

function isAuctionStatus(value: unknown): value is AuctionStatusOverride {
  return VAN_PLAN_AUCTION_STATUSES.includes(String(value) as AuctionStatusOverride);
}

export function parseAuctionStatusOverride(value: unknown): AuctionStatusOverride {
  const status = String(value ?? "").trim().toLowerCase();

  if (!VAN_PLAN_AUCTION_STATUSES.includes(status as AuctionStatusOverride)) {
    throw new VanPlanError("Choose open, close, or follow the official schedule.");
  }

  return status as AuctionStatusOverride;
}

async function getFallbackAuctionStatusOverride(): Promise<AuctionStatusOverride> {
  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_items")
    .select("description")
    .eq("slug", VAN_PLAN_AUCTION_SETTINGS_SLUG)
    .maybeSingle<{ description: string }>();

  if (error || !data) return "scheduled";

  const status = data.description.trim();
  return isAuctionStatus(status) ? status : "scheduled";
}

async function setFallbackAuctionStatusOverride({
  status,
  updatedBy,
}: {
  status: AuctionStatusOverride;
  updatedBy: string;
}) {
  const db = vanPlanDb();
  const { data: existing, error: loadError } = await db
    .from("van_plan_items")
    .select("id")
    .eq("slug", VAN_PLAN_AUCTION_SETTINGS_SLUG)
    .maybeSingle<{ id: string }>();

  if (loadError) {
    throw new VanPlanError("Unable to update the auction status.", 500);
  }

  if (existing) {
    const { error } = await db
      .from("van_plan_items")
      .update({
        description: status,
        status: "draft",
      })
      .eq("id", existing.id);

    if (error) {
      throw new VanPlanError("Unable to update the auction status.", 500);
    }

    return;
  }

  const { error } = await db.from("van_plan_items").insert({
    slug: VAN_PLAN_AUCTION_SETTINGS_SLUG,
    name: "Auction status",
    description: status,
    starting_price_cents: 0,
    status: "draft",
    created_by: updatedBy,
  });

  if (error) {
    throw new VanPlanError("Unable to update the auction status.", 500);
  }
}

export const getVanPlanAuctionStatusOverride = cache(async function getVanPlanAuctionStatusOverride(): Promise<AuctionStatusOverride> {
  try {
    const db = vanPlanDb();
    const { data, error } = await db
      .from("van_plan_auction_settings")
      .select("id, status")
      .eq("id", 1)
      .maybeSingle<SettingsRow>();

    if (isMissingSettingsTable(error)) {
      return getFallbackAuctionStatusOverride();
    }

    if (error) {
      console.error("Unable to load auction settings:", error.message);
      return getFallbackAuctionStatusOverride();
    }

    return data?.status ?? (await getFallbackAuctionStatusOverride());
  } catch (error) {
    console.error("Unable to load auction settings:", error);
    return "scheduled";
  }
});

export async function setVanPlanAuctionStatusOverride({
  status,
  updatedBy,
}: {
  status: AuctionStatusOverride;
  updatedBy: string;
}) {
  const db = vanPlanDb();
  const { error } = await db.from("van_plan_auction_settings").upsert(
    {
      id: 1,
      status,
      updated_by: updatedBy,
    },
    { onConflict: "id" },
  );

  if (isMissingSettingsTable(error)) {
    await setFallbackAuctionStatusOverride({ status, updatedBy });
    return;
  }

  if (error) {
    throw new VanPlanError("Unable to update the auction status.", 500);
  }
}

export async function getVanPlanAuctionSchedule(
  now = new Date(),
): Promise<AuctionSchedule> {
  const statusOverride = await getVanPlanAuctionStatusOverride();
  return buildVanPlanAuctionSchedule(statusOverride, now);
}

export async function isAuctionBiddingOpen(now = new Date()) {
  return (await getVanPlanAuctionSchedule(now)).phase === "live";
}

export async function auctionBiddingClosedMessage(now = new Date()) {
  const schedule = await getVanPlanAuctionSchedule(now);

  if (schedule.statusOverride === "closed") {
    return "Bidding is closed.";
  }

  if (schedule.phase === "preview") {
    return `Official bidding opens ${formatAuctionClock(schedule.opensAt)}. You can register, set up your account, and browse items now.`;
  }

  return `Bidding closed at ${formatAuctionClock(schedule.closesAt)}.`;
}
