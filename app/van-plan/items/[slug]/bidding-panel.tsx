"use client";

import Link from "next/link";
import { useAuctionClock } from "@/app/van-plan/components/use-auction-clock";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";
import { formatAuctionClock } from "@/lib/van-plan/schedule";
import type { VanPlanItemStatus } from "@/lib/van-plan/types";
import VanPlanBidForm from "./bid-form";

export default function VanPlanBiddingPanel({
  itemId,
  itemStatus,
  minimumCents,
  signedIn,
  loginHref,
  opensAt,
  closesAt,
  serverNow,
}: {
  itemId: string;
  itemStatus: VanPlanItemStatus;
  minimumCents: number;
  signedIn: boolean;
  loginHref: string;
  opensAt: string;
  closesAt: string;
  serverNow: string;
}) {
  const { phase } = useAuctionClock(opensAt, closesAt, serverNow);

  if (itemStatus !== "open") {
    return (
      <p className="vp-accent mt-5 text-sm">
        bidding is {itemStatus === "sold" ? "closed, this item is sold" : `currently ${itemStatus}`}
      </p>
    );
  }

  if (phase === "preview") {
    return (
      <div className="mt-5 space-y-3">
        <p className="vp-accent text-sm">
          official bidding opens {formatAuctionClock(opensAt).toLowerCase()}
        </p>
        <p className="vp-description text-sm leading-6">
          You can register, set up your account, and look through the items now.
          Bids cannot be placed until the auction is live.
        </p>
        {signedIn ? null : (
          <p>
            <Link href={`${VAN_PLAN_BASE_PATH}/register`} className="vp-button">
              Create an account
            </Link>
          </p>
        )}
      </div>
    );
  }

  if (phase === "closed") {
    return (
      <p className="vp-accent mt-5 text-sm">
        bidding closed at {formatAuctionClock(closesAt).toLowerCase()}
      </p>
    );
  }

  if (!signedIn) {
    return (
      <p className="mt-5">
        <Link href={loginHref} className="vp-button">
          Sign in to bid
        </Link>
      </p>
    );
  }

  return <VanPlanBidForm itemId={itemId} minimumCents={minimumCents} />;
}
