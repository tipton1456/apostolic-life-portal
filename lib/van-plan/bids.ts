import { VAN_PLAN_MIN_BID_INCREMENT_CENTS } from "@/lib/van-plan/constants";
import { VanPlanError, vanPlanDb } from "@/lib/van-plan/db";
import { formatUsd } from "@/lib/van-plan/format";
import { getVanPlanItemById, listItemBids } from "@/lib/van-plan/items";
import { getPortalBaseUrl } from "@/lib/portal-url";
import { auctionBiddingClosedMessage, isAuctionBiddingOpen } from "@/lib/van-plan/schedule";
import { appendSmsOptOut, getRecipientPhone, sendTwilioSms } from "@/lib/twilio-sms";
import type { VanPlanItem, VanPlanUser } from "@/lib/van-plan/types";

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

  if (!isAuctionBiddingOpen()) {
    throw new VanPlanError(auctionBiddingClosedMessage());
  }

  if (item.status !== "open") {
    throw new VanPlanError("Bidding is not open on this item.");
  }

  const minimum = minimumNextBidCents(item);

  if (amountCents < minimum) {
    throw new VanPlanError(
      `Your bid must be at least ${(minimum / 100).toFixed(2)}.`,
    );
  }

  const previousBids = await listItemBids(itemId);
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

  await notifyPreviousBidders({
    item,
    amountCents,
    currentBidderId: bidder.id,
    previousBids,
  });
}

async function notifyPreviousBidders({
  item,
  amountCents,
  currentBidderId,
  previousBids,
}: {
  item: VanPlanItem;
  amountCents: number;
  currentBidderId: string;
  previousBids: Awaited<ReturnType<typeof listItemBids>>;
}) {
  const recipients = new Map<string, { name: string; phone: string }>();

  for (const bid of previousBids) {
    if (bid.userId === currentBidderId || recipients.has(bid.userId)) continue;
    recipients.set(bid.userId, { name: bid.bidderName, phone: bid.bidderPhone });
  }

  if (recipients.size === 0) return;

  const itemUrl = `${getPortalBaseUrl()}/van-plan/items/${item.slug}`;
  const body = appendSmsOptOut(
    `The Great Van Plan: there's a new high bid of ${formatUsd(amountCents)} on ${item.name}.\n\nBid now: ${itemUrl}`,
  );

  await Promise.all(
    Array.from(recipients.values()).map(async (recipient) => {
      const phone = getRecipientPhone(recipient.phone);

      if (!phone) return;

      const sent = await sendTwilioSms({
        to: phone.number,
        body,
      });

      if (!sent.ok) {
        console.error("Van Plan bid notice failed:", {
          name: recipient.name,
          message: sent.failureMessage,
        });
      }
    }),
  );
}
