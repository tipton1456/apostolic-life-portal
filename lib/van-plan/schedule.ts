import {
  VAN_PLAN_AUCTION_CLOSES_AT,
  VAN_PLAN_AUCTION_OPENS_AT,
  VAN_PLAN_AUCTION_TIME_ZONE,
} from "@/lib/van-plan/constants";
import type { AuctionStatusOverride } from "@/lib/van-plan/types";

export type AuctionPhase = "preview" | "live" | "closed";
export type { AuctionStatusOverride };

export type AuctionRemaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

export type AuctionSchedule = {
  opensAt: string;
  closesAt: string;
  now: string;
  phase: AuctionPhase;
  statusOverride: AuctionStatusOverride;
};

export function getAuctionPhase(
  nowMs: number,
  opensAtMs: number,
  closesAtMs: number,
  statusOverride: AuctionStatusOverride = "scheduled",
): AuctionPhase {
  if (statusOverride === "open") return "live";
  if (statusOverride === "closed") return "closed";
  if (nowMs < opensAtMs) return "preview";
  if (nowMs < closesAtMs) return "live";
  return "closed";
}

export function getAuctionRemainingParts(
  nowMs: number,
  opensAtMs: number,
  closesAtMs: number,
  statusOverride: AuctionStatusOverride = "scheduled",
): AuctionRemaining {
  const phase = getAuctionPhase(nowMs, opensAtMs, closesAtMs, statusOverride);
  const targetMs = phase === "preview" ? opensAtMs : closesAtMs;
  const totalMs = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, totalMs };
}

export function buildVanPlanAuctionSchedule(
  statusOverride: AuctionStatusOverride = "scheduled",
  now = new Date(),
): AuctionSchedule {
  const opensAt = VAN_PLAN_AUCTION_OPENS_AT;
  const closesAt = VAN_PLAN_AUCTION_CLOSES_AT;

  return {
    opensAt,
    closesAt,
    now: now.toISOString(),
    statusOverride,
    phase: getAuctionPhase(
      now.getTime(),
      Date.parse(opensAt),
      Date.parse(closesAt),
      statusOverride,
    ),
  };
}

export function formatAuctionClock(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: VAN_PLAN_AUCTION_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatAuctionShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: VAN_PLAN_AUCTION_TIME_ZONE,
    month: "short",
    day: "numeric",
  })
    .format(new Date(iso))
    .toLowerCase();
}

export function padAuctionUnit(value: number) {
  return String(value).padStart(2, "0");
}
