"use client";

import { padAuctionUnit } from "@/lib/van-plan/schedule";
import type { AuctionStatusOverride } from "@/lib/van-plan/types";
import { useAuctionClock } from "./use-auction-clock";

export default function VanPlanCountdown({
  opensAt,
  closesAt,
  serverNow,
  statusOverride = "scheduled",
}: {
  opensAt: string;
  closesAt: string;
  serverNow: string;
  statusOverride?: AuctionStatusOverride;
}) {
  const { phase, remaining } = useAuctionClock(
    opensAt,
    closesAt,
    serverNow,
    statusOverride,
  );
  const showUnits = phase !== "closed" && remaining.totalMs > 0;
  const label =
    phase === "preview"
      ? "auction live in"
      : phase === "live" && remaining.totalMs > 0
        ? "auction closes in"
        : phase === "live"
          ? "auction open"
          : "auction closed";

  return (
    <p
      className="vp-countdown"
      aria-label={
        showUnits
          ? `${label} ${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes, ${remaining.seconds} seconds`
          : phase === "live"
            ? "Auction open"
            : "Auction closed"
      }
    >
      <span className="vp-countdown-label">{label}</span>
      {showUnits ? (
        <span className="vp-countdown-units" suppressHydrationWarning>
          <span>
            <strong>{remaining.days}</strong>d
          </span>
          <span>
            <strong>{padAuctionUnit(remaining.hours)}</strong>h
          </span>
          <span>
            <strong>{padAuctionUnit(remaining.minutes)}</strong>m
          </span>
          <span>
            <strong>{padAuctionUnit(remaining.seconds)}</strong>s
          </span>
        </span>
      ) : null}
    </p>
  );
}
