"use client";

import { useEffect, useState } from "react";
import {
  getAuctionPhase,
  getAuctionRemainingParts,
  type AuctionPhase,
  type AuctionRemaining,
} from "@/lib/van-plan/schedule";

export function useAuctionClock(
  opensAt: string,
  closesAt: string,
  serverNow: string,
) {
  const [nowMs, setNowMs] = useState(() => Date.parse(serverNow));

  useEffect(() => {
    const origin = Date.parse(serverNow);
    const offset = Number.isNaN(origin) ? 0 : Date.now() - origin;
    const tick = () => setNowMs(Date.now() - offset);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [serverNow]);

  const opensAtMs = Date.parse(opensAt);
  const closesAtMs = Date.parse(closesAt);
  const phase: AuctionPhase = getAuctionPhase(nowMs, opensAtMs, closesAtMs);
  const remaining: AuctionRemaining = getAuctionRemainingParts(
    nowMs,
    opensAtMs,
    closesAtMs,
  );

  return { phase, remaining, nowMs };
}
