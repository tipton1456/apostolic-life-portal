"use client";

import { padAuctionUnit } from "@/lib/van-plan/schedule";
import { useAuctionClock } from "./use-auction-clock";

export default function VanPlanCountdown({
  opensAt,
  closesAt,
  serverNow,
}: {
  opensAt: string;
  closesAt: string;
  serverNow: string;
}) {
  const { phase, remaining } = useAuctionClock(opensAt, closesAt, serverNow);
  const label =
    phase === "preview"
      ? "auction live in"
      : phase === "live"
        ? "auction closes in"
        : "auction closed";

  return (
    <p
      className="vp-countdown"
      aria-label={
        phase === "closed"
          ? "Auction closed"
          : `${label} ${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes, ${remaining.seconds} seconds`
      }
    >
      <span className="vp-countdown-label">{label}</span>
      {phase === "closed" ? null : (
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
      )}
    </p>
  );
}
