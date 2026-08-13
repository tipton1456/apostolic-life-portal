import { VAN_PLAN_MIN_BID_INCREMENT_CENTS } from "@/lib/van-plan/constants";
import { VanPlanError, vanPlanDb } from "@/lib/van-plan/db";
import { getVanPlanItemById } from "@/lib/van-plan/items";
import type { VanPlanUser } from "@/lib/van-plan/types";

export function minimumNextBidCents(item: {
  startingPriceCents: number;
  highestBid: { amountCents: number } | null;
}) {
  if (!item.highestBid) {
    return item.startingPriceCents;
  }

  return item.highestBid.amountCents + VAN_PLAN_MIN_BID_INCREMENT_CENTS;
}

export async function placeVanPlanBid({
  itemId,
  amountCents,
  bidder,
}: {
  itemId: string;
  amountCents: number;
  bidder: VanPlanUser;
}) {
  const item = await getVanPlanItemById(itemId);

  if (item.status !== "open") {
    throw new VanPlanError("Bidding is not open on this item.");
  }

  const minimum = minimumNextBidCents(item);

  if (amountCents < minimum) {
    throw new VanPlanError(
      `Your bid must be at least ${(minimum / 100).toFixed(2)}.`,
    );
  }

  const db = vanPlanDb();
  const { error } = await db.from("van_plan_bids").insert({
    item_id: itemId,
    user_id: bidder.id,
    amount_cents: amountCents,
  });

  if (error) {
    console.error("Van Plan bid insert failed:", error);
    throw new VanPlanError("Unable to place that bid.", 500);
  }
}
