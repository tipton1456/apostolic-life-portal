"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { setVanPlanAuctionStatusAction } from "@/lib/van-plan/actions";
import type { AuctionPhase } from "@/lib/van-plan/schedule";
import { idleVanPlanActionState } from "@/lib/van-plan/types";
import type { AuctionStatusOverride } from "@/lib/van-plan/types";

export default function VanPlanAuctionStatusForm({
  phase,
  statusOverride,
  opensAtLabel,
  closesAtLabel,
}: {
  phase: AuctionPhase;
  statusOverride: AuctionStatusOverride;
  opensAtLabel: string;
  closesAtLabel: string;
}) {
  const [state, formAction] = useActionState(
    setVanPlanAuctionStatusAction,
    idleVanPlanActionState,
  );
  const statusLabel =
    phase === "live"
      ? statusOverride === "open"
        ? "open (admin override)"
        : "live"
      : phase === "preview"
        ? "preview"
        : statusOverride === "closed"
          ? "closed (admin override)"
          : "closed";

  return (
    <div className="vp-card mt-8 p-6">
      <h2 className="vp-heading text-2xl">Auction status</h2>
      <p className="vp-description mt-3 max-w-2xl leading-7">
        Official schedule: opened {opensAtLabel} and closes {closesAtLabel}.
        Open or close bidding immediately, or return to that schedule.
      </p>
      <p className="vp-accent mt-4 text-sm">current status: {statusLabel}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <form action={formAction}>
          <input type="hidden" name="status" value="open" />
          <input type="hidden" name="version" value={state.version} />
          <VanPlanFormButton pendingLabel="Opening...">
            Open auction
          </VanPlanFormButton>
        </form>
        <form action={formAction}>
          <input type="hidden" name="status" value="closed" />
          <input type="hidden" name="version" value={state.version} />
          <VanPlanFormButton pendingLabel="Closing..." variant="danger">
            Close auction
          </VanPlanFormButton>
        </form>
        <form action={formAction}>
          <input type="hidden" name="status" value="scheduled" />
          <input type="hidden" name="version" value={state.version} />
          <VanPlanFormButton pendingLabel="Updating..." variant="secondary">
            Follow schedule
          </VanPlanFormButton>
        </form>
      </div>
      <div className="mt-4">
        <VanPlanActionMessage state={state} />
      </div>
    </div>
  );
}
