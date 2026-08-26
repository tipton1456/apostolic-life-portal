import { VanPlanError, vanPlanDb } from "@/lib/van-plan/db";
import { formatUsd } from "@/lib/van-plan/format";
import { getVanPlanItemById, listItemBids } from "@/lib/van-plan/items";
import { getPortalBaseUrl } from "@/lib/portal-url";
import { canBidDuringPreview } from "@/lib/van-plan/auth";
import {
  auctionBiddingClosedMessage,
  getVanPlanAuctionSchedule,
  isAuctionBiddingOpen,
} from "@/lib/van-plan/schedule";
import { appendSmsOptOut, getRecipientPhone, sendTwilioSms } from "@/lib/twilio-sms";
import type { VanPlanBidProxy, VanPlanItem, VanPlanUser } from "@/lib/van-plan/types";

type PlaceBidRpcResult = {
  placed_bid: boolean;
  high_user_id: string;
  high_amount_cents: number;
};

type BidProxyRow = {
  item_id: string;
  user_id: string;
  max_bid_cents: number;
  increment_cents: number;
  enabled: boolean;
};

function mapBidProxy(row: BidProxyRow): VanPlanBidProxy {
  return {
    itemId: row.item_id,
    userId: row.user_id,
    maxBidCents: row.max_bid_cents,
    incrementCents: row.increment_cents,
    enabled: row.enabled,
  };
}

export function nextProxyBidCents(
  highCents: number,
  incrementCents: number,
  maxBidCents: number,
) {
  if (incrementCents <= 0 || maxBidCents <= highCents) {
    return null;
  }

  const raised = Math.min(highCents + incrementCents, maxBidCents);
  return raised > highCents ? raised : null;
}

export async function getVanPlanBidProxy(itemId: string, userId: string) {
  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_bid_proxies")
    .select("item_id, user_id, max_bid_cents, increment_cents, enabled")
    .eq("item_id", itemId)
    .eq("user_id", userId)
    .maybeSingle<BidProxyRow>();

  if (error) {
    console.error("Van Plan bid proxy load failed:", error);
    return null;
  }

  return data ? mapBidProxy(data) : null;
}

export async function placeVanPlanBid({
  itemId,
  amountCents,
  bidder,
  maxBidEnabled,
  maxBidCents,
  incrementCents,
}: {
  itemId: string;
  amountCents: number;
  bidder: VanPlanUser;
  maxBidEnabled: boolean;
  maxBidCents: number | null;
  incrementCents: number | null;
}) {
  const item = await getVanPlanItemById(itemId);

  if (!isAuctionBiddingOpen()) {
    const schedule = getVanPlanAuctionSchedule();

    if (schedule.phase !== "preview" || !canBidDuringPreview(bidder)) {
      throw new VanPlanError(auctionBiddingClosedMessage());
    }
  }

  if (item.status !== "open") {
    throw new VanPlanError("Bidding is not open on this item.");
  }

  if (amountCents <= 0) {
    throw new VanPlanError("Enter a bid amount.");
  }

  const currentHigh = item.highestBid;
  const updatingOwnHigh =
    Boolean(currentHigh) &&
    currentHigh?.userId === bidder.id &&
    currentHigh?.amountCents === amountCents;

  if (currentHigh && amountCents <= currentHigh.amountCents && !updatingOwnHigh) {
    throw new VanPlanError(
      `Your bid must be higher than the current high bid of ${formatUsd(currentHigh.amountCents)}.`,
    );
  }

  if (maxBidEnabled) {
    if (!maxBidCents || maxBidCents <= 0) {
      throw new VanPlanError("Enter a max bid.");
    }

    if (!incrementCents || incrementCents <= 0) {
      throw new VanPlanError("Enter an increment greater than zero.");
    }

    if (maxBidCents < amountCents) {
      throw new VanPlanError("Your max bid must be at least your bid amount.");
    }
  }

  const result = await executePlaceBid({
    itemId,
    amountCents,
    bidderId: bidder.id,
    maxBidEnabled,
    maxBidCents,
    incrementCents,
    currentHigh,
  });

  if (result.placedBid) {
    await notifyItemBidders({
      item,
      amountCents: result.highAmountCents,
      highBidderId: result.highUserId,
    });
  }

  return result;
}

async function executePlaceBid({
  itemId,
  amountCents,
  bidderId,
  maxBidEnabled,
  maxBidCents,
  incrementCents,
  currentHigh,
}: {
  itemId: string;
  amountCents: number;
  bidderId: string;
  maxBidEnabled: boolean;
  maxBidCents: number | null;
  incrementCents: number | null;
  currentHigh: { userId: string; amountCents: number } | null;
}) {
  const db = vanPlanDb();
  const { data, error } = await db.rpc("place_van_plan_bid", {
    p_item_id: itemId,
    p_user_id: bidderId,
    p_amount_cents: amountCents,
    p_max_bid_enabled: maxBidEnabled,
    p_max_bid_cents: maxBidEnabled ? maxBidCents : null,
    p_increment_cents: maxBidEnabled ? incrementCents : null,
  });

  if (!error) {
    return parsePlaceBidResult(data);
  }

  if (!isMissingRpcError(error)) {
    console.error("Van Plan bid RPC failed:", error);
    const message = bidRpcMessage(error.message, error.details);
    throw new VanPlanError(message, message === "Unable to place that bid." ? 500 : 400);
  }

  return placeVanPlanBidDirect({
    itemId,
    amountCents,
    bidderId,
    maxBidEnabled,
    maxBidCents,
    incrementCents,
    currentHigh,
  });
}

async function placeVanPlanBidDirect({
  itemId,
  amountCents,
  bidderId,
  maxBidEnabled,
  maxBidCents,
  incrementCents,
  currentHigh,
}: {
  itemId: string;
  amountCents: number;
  bidderId: string;
  maxBidEnabled: boolean;
  maxBidCents: number | null;
  incrementCents: number | null;
  currentHigh: { userId: string; amountCents: number } | null;
}) {
  const updatingOwnHigh =
    Boolean(currentHigh) &&
    currentHigh?.userId === bidderId &&
    currentHigh?.amountCents === amountCents;
  let placedBid = false;

  if (!updatingOwnHigh) {
    const latestHigh = (await listItemBids(itemId))[0] ?? null;

    if (latestHigh && amountCents <= latestHigh.amountCents) {
      throw new VanPlanError(
        `Your bid must be higher than the current high bid of ${formatUsd(latestHigh.amountCents)}.`,
      );
    }

    await insertVanPlanBid({
      itemId,
      userId: bidderId,
      amountCents,
      isAuto: false,
    });
    placedBid = true;
  }

  await saveBidProxy({
    itemId,
    userId: bidderId,
    maxBidEnabled,
    maxBidCents,
    incrementCents,
  });

  if (placedBid) {
    await settleProxyBids(itemId);
  }

  const high = (await listItemBids(itemId))[0];

  if (!high) {
    throw new VanPlanError("Unable to place that bid.", 500);
  }

  return {
    placedBid,
    highUserId: high.userId,
    highAmountCents: high.amountCents,
  };
}

async function insertVanPlanBid({
  itemId,
  userId,
  amountCents,
  isAuto,
}: {
  itemId: string;
  userId: string;
  amountCents: number;
  isAuto: boolean;
}) {
  const db = vanPlanDb();
  const payload: Record<string, unknown> = {
    item_id: itemId,
    user_id: userId,
    amount_cents: amountCents,
  };

  if (isAuto) {
    payload.is_auto = true;
  }

  const { error } = await db.from("van_plan_bids").insert(payload);

  if (error && isAuto && /is_auto/i.test(error.message)) {
    delete payload.is_auto;
    const retry = await db.from("van_plan_bids").insert(payload);
    if (!retry.error) return;
    console.error("Van Plan auto-bid insert failed:", retry.error);
    throw new VanPlanError("Unable to place that bid.", 500);
  }

  if (error) {
    console.error("Van Plan bid insert failed:", error);
    throw new VanPlanError("Unable to place that bid.", 500);
  }
}

async function saveBidProxy({
  itemId,
  userId,
  maxBidEnabled,
  maxBidCents,
  incrementCents,
}: {
  itemId: string;
  userId: string;
  maxBidEnabled: boolean;
  maxBidCents: number | null;
  incrementCents: number | null;
}) {
  const db = vanPlanDb();

  if (maxBidEnabled) {
    const { error } = await db.from("van_plan_bid_proxies").upsert(
      {
        item_id: itemId,
        user_id: userId,
        max_bid_cents: maxBidCents,
        increment_cents: incrementCents,
        enabled: true,
      },
      { onConflict: "item_id,user_id" },
    );

    if (error) {
      console.error("Van Plan max bid save failed:", error);
      throw new VanPlanError(
        "Unable to save that max bid. Apply the van plan max bid migration and try again.",
        500,
      );
    }

    return;
  }

  const { error } = await db
    .from("van_plan_bid_proxies")
    .update({ enabled: false })
    .eq("item_id", itemId)
    .eq("user_id", userId);

  if (error && !/van_plan_bid_proxies|schema cache/i.test(error.message)) {
    console.error("Van Plan max bid disable failed:", error);
  }
}

async function settleProxyBids(itemId: string) {
  const db = vanPlanDb();

  for (let iteration = 0; iteration < 500; iteration += 1) {
    const high = (await listItemBids(itemId))[0];
    if (!high) return;

    const { data, error } = await db
      .from("van_plan_bid_proxies")
      .select("user_id, max_bid_cents, increment_cents, created_at")
      .eq("item_id", itemId)
      .eq("enabled", true)
      .returns<{
        user_id: string;
        max_bid_cents: number;
        increment_cents: number;
        created_at: string;
      }[]>();

    if (error) {
      if (/van_plan_bid_proxies|schema cache/i.test(error.message)) return;
      console.error("Van Plan max bid load failed:", error);
      throw new VanPlanError("Unable to place that bid.", 500);
    }

    const next = (data ?? [])
      .map((proxy) => ({
        userId: proxy.user_id,
        maxBidCents: proxy.max_bid_cents,
        createdAt: proxy.created_at,
        amountCents: nextProxyBidCents(
          high.amountCents,
          proxy.increment_cents,
          proxy.max_bid_cents,
        ),
      }))
      .filter(
        (proxy) =>
          proxy.userId !== high.userId && proxy.amountCents !== null,
      )
      .sort((left, right) => {
        if (right.maxBidCents !== left.maxBidCents) {
          return right.maxBidCents - left.maxBidCents;
        }

        return left.createdAt.localeCompare(right.createdAt);
      })[0];

    if (!next || next.amountCents === null) return;

    await insertVanPlanBid({
      itemId,
      userId: next.userId,
      amountCents: next.amountCents,
      isAuto: true,
    });
  }

  throw new VanPlanError("Unable to settle automatic bids.", 500);
}

function parsePlaceBidResult(data: unknown) {
  const row = (data ?? {}) as PlaceBidRpcResult;

  if (
    typeof row.placed_bid !== "boolean" ||
    typeof row.high_user_id !== "string" ||
    typeof row.high_amount_cents !== "number"
  ) {
    throw new VanPlanError("Unable to place that bid.", 500);
  }

  return {
    placedBid: row.placed_bid,
    highUserId: row.high_user_id,
    highAmountCents: row.high_amount_cents,
  };
}

function isMissingRpcError(error: { message?: string; details?: string; code?: string }) {
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "PGRST202" ||
    text.includes("schema cache") ||
    text.includes("could not find the function")
  );
}

function bidRpcMessage(message: string | undefined, details?: string) {
  const trimmed = [message, details]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .replace(/^place_van_plan_bid:\s*/i, "")
    .replace(/^ERROR:\s*/i, "")
    .trim();

  if (!trimmed || /schema cache|could not find the function/i.test(trimmed)) {
    return "Unable to place that bid.";
  }

  const firstSentence = trimmed.split(/\n/)[0]?.trim() ?? trimmed;
  return firstSentence;
}

async function notifyItemBidders({
  item,
  amountCents,
  highBidderId,
}: {
  item: VanPlanItem;
  amountCents: number;
  highBidderId: string;
}) {
  const bids = await listItemBids(item.id);
  const recipients = new Map<string, { name: string; phone: string }>();

  for (const bid of bids) {
    if (bid.userId === highBidderId || recipients.has(bid.userId)) continue;
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
