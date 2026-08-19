import {
  VAN_PLAN_AUCTION_CLOSES_AT,
  VAN_PLAN_AUCTION_OPENS_AT,
  VAN_PLAN_AUCTION_TIME_ZONE,
} from "@/lib/van-plan/constants";

export type AuctionPhase = "preview" | "live" | "closed";

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
};

export function getAuctionPhase(
  nowMs: number,
  opensAtMs: number,
  closesAtMs: number,
): AuctionPhase {
  if (nowMs < opensAtMs) return "preview";
  if (nowMs < closesAtMs) return "live";
  return "closed";
}

export function getAuctionRemainingParts(
  nowMs: number,
  opensAtMs: number,
  closesAtMs: number,
): AuctionRemaining {
  const phase = getAuctionPhase(nowMs, opensAtMs, closesAtMs);
  const targetMs = phase === "preview" ? opensAtMs : closesAtMs;
  const totalMs = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, totalMs };
}

export function getVanPlanAuctionSchedule(now = new Date()): AuctionSchedule {
  const opensAt = VAN_PLAN_AUCTION_OPENS_AT;
  const closesAt = VAN_PLAN_AUCTION_CLOSES_AT;

  return {
    opensAt,
    closesAt,
    now: now.toISOString(),
    phase: getAuctionPhase(now.getTime(), Date.parse(opensAt), Date.parse(closesAt)),
  };
}

export function isAuctionBiddingOpen(now = new Date()) {
  return getVanPlanAuctionSchedule(now).phase === "live";
}

export function auctionBiddingClosedMessage(now = new Date()) {
  const schedule = getVanPlanAuctionSchedule(now);

  if (schedule.phase === "preview") {
    return `Official bidding opens ${formatAuctionClock(schedule.opensAt)}. You can register, set up your account, and browse items now.`;
  }

  return `Bidding closed at ${formatAuctionClock(schedule.closesAt)}.`;
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

export function padAuctionUnit(value: number) {
  return String(value).padStart(2, "0");
}
