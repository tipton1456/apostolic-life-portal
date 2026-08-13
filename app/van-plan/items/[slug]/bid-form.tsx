"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { placeVanPlanBidAction } from "@/lib/van-plan/actions";
import { formatUsd } from "@/lib/van-plan/format";
import { idleVanPlanActionState } from "@/lib/van-plan/types";

export default function VanPlanBidForm({
  itemId,
  minimumCents,
}: {
  itemId: string;
  minimumCents: number;
}) {
  const [state, formAction] = useActionState(
    placeVanPlanBidAction,
    idleVanPlanActionState,
  );
  const minimum = (minimumCents / 100).toFixed(2);

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="version" value={state.version} />
      <label className="vp-subhead block text-sm">
        your bid
        <input
          name="amount"
          type="number"
          min={minimum}
          step="1"
          required
          defaultValue={minimum}
          className="vp-input mt-2"
        />
      </label>
      <p className="vp-accent text-sm">minimum bid {formatUsd(minimumCents)}</p>
      <VanPlanFormButton pendingLabel="Placing bid...">Place bid</VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
