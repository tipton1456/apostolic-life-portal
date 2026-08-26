"use client";

import { useActionState, useState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { placeVanPlanBidAction } from "@/lib/van-plan/actions";
import { VAN_PLAN_DEFAULT_BID_INCREMENT_CENTS } from "@/lib/van-plan/constants";
import { formatUsd } from "@/lib/van-plan/format";
import { idleVanPlanActionState } from "@/lib/van-plan/types";
import type { VanPlanBidProxy } from "@/lib/van-plan/types";

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function VanPlanBidForm({
  itemId,
  currentHighCents,
  isHighBidder,
  proxy,
}: {
  itemId: string;
  currentHighCents: number | null;
  isHighBidder: boolean;
  proxy: VanPlanBidProxy | null;
}) {
  const [state, formAction] = useActionState(
    placeVanPlanBidAction,
    idleVanPlanActionState,
  );
  const [maxBidEnabled, setMaxBidEnabled] = useState(Boolean(proxy?.enabled));
  const maxReached =
    proxy !== null &&
    proxy.enabled &&
    currentHighCents !== null &&
    !isHighBidder &&
    proxy.maxBidCents <= currentHighCents;

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="version" value={state.version} />

      {isHighBidder ? (
        <p className="vp-accent text-sm">you are the current high bidder</p>
      ) : null}

      {proxy?.enabled && !maxReached ? (
        <p className="vp-description text-sm leading-6">
          Your max bid is {formatUsd(proxy.maxBidCents)} in{" "}
          {formatUsd(proxy.incrementCents)} increments. If someone outbids you,
          we will raise your bid by that increment until you reach your max.
        </p>
      ) : null}

      {maxReached && proxy ? (
        <p className="vp-description text-sm leading-6">
          Your max bid of {formatUsd(proxy.maxBidCents)} has been reached. Place
          a new bid to keep going — you can set a new max and increment.
        </p>
      ) : null}

      <label className="vp-subhead block text-sm">
        your bid
        <input
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required
          inputMode="decimal"
          defaultValue={
            isHighBidder && currentHighCents !== null
              ? centsToInput(currentHighCents)
              : undefined
          }
          placeholder="0.00"
          className="vp-input mt-2"
        />
      </label>
      <p className="vp-description text-sm leading-6">
        Enter the amount you want to bid.
        {currentHighCents !== null
          ? ` If you are not already ahead, it must be higher than the current high bid of ${formatUsd(currentHighCents)}.`
          : " There is no required minimum."}
      </p>

      <label className="vp-check">
        <input
          name="maxBidEnabled"
          type="checkbox"
          value="true"
          checked={maxBidEnabled}
          onChange={(event) => setMaxBidEnabled(event.target.checked)}
        />
        <span>
          <span className="vp-subhead block text-sm">use a max bid</span>
          <span className="vp-description mt-1 block text-sm leading-6">
            Optional. If someone bids higher, we raise your bid by your increment
            until we reach this max. Leave unchecked to bid by hand each time.
          </span>
        </span>
      </label>

      {maxBidEnabled ? (
        <div className="space-y-4">
          <label className="vp-subhead block text-sm">
            max bid
            <input
              name="maxBid"
              type="number"
              min="0.01"
              step="0.01"
              required
              inputMode="decimal"
              defaultValue={
                proxy ? centsToInput(proxy.maxBidCents) : undefined
              }
              placeholder="20.00"
              className="vp-input mt-2"
            />
          </label>
          <label className="vp-subhead block text-sm">
            increment
            <input
              name="increment"
              type="number"
              min="0.01"
              step="0.01"
              required
              inputMode="decimal"
              defaultValue={
                proxy
                  ? centsToInput(proxy.incrementCents)
                  : centsToInput(VAN_PLAN_DEFAULT_BID_INCREMENT_CENTS)
              }
              className="vp-input mt-2"
            />
          </label>
          <p className="vp-description text-sm leading-6">
            Example: bid $5.00, max $20.00, increment $1.00. If someone bids
            $6.00, your bid becomes $7.00, and so on, up to $20.00.
          </p>
        </div>
      ) : null}

      <VanPlanFormButton pendingLabel="Placing bid...">Place bid</VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
