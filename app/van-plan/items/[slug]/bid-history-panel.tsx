"use client";

import { useActionState, useEffect, useState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import {
  clearVanPlanItemBidsAction,
  deleteVanPlanBidAction,
} from "@/lib/van-plan/actions";
import { formatUsd } from "@/lib/van-plan/format";
import { idleVanPlanActionState } from "@/lib/van-plan/types";
import type { VanPlanBid, VanPlanItemStatus } from "@/lib/van-plan/types";

export default function VanPlanBidHistoryPanel({
  itemId,
  itemName,
  itemStatus,
  bids,
  openOnLoad = false,
}: {
  itemId: string;
  itemName: string;
  itemStatus: VanPlanItemStatus;
  bids: VanPlanBid[];
  openOnLoad?: boolean;
}) {
  const [open, setOpen] = useState(openOnLoad);
  const [deleteState, deleteAction] = useActionState(
    deleteVanPlanBidAction,
    idleVanPlanActionState,
  );
  const [clearState, clearAction] = useActionState(
    clearVanPlanItemBidsAction,
    idleVanPlanActionState,
  );
  const canDelete = itemStatus !== "sold";

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div>
      <button
        type="button"
        className="vp-button vp-button-secondary"
        onClick={() => setOpen(true)}
      >
        Bid history{bids.length > 0 ? ` (${bids.length})` : ""}
      </button>

      {open ? (
        <div className="vp-overlay">
          <button
            type="button"
            aria-label="Close bid history"
            className="vp-overlay-scrim"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vp-bid-history-title"
            className="vp-dialog"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="vp-subhead text-sm">bid history</p>
                <h2 id="vp-bid-history-title" className="vp-heading mt-1 text-2xl">
                  {itemName}
                </h2>
              </div>
              <button
                type="button"
                className="vp-button vp-button-ghost"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <VanPlanActionMessage state={deleteState} />
            <VanPlanActionMessage state={clearState} />

            {bids.length === 0 ? (
              <p className="vp-description mt-5">No bids on this item.</p>
            ) : (
              <>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-left">
                    <thead>
                      <tr className="vp-subhead text-sm">
                        <th className="pb-3 font-normal">bidder</th>
                        <th className="pb-3 font-normal">amount</th>
                        <th className="pb-3 font-normal">type</th>
                        <th className="pb-3 font-normal">time</th>
                        {canDelete ? (
                          <th className="pb-3 font-normal"> </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {bids.map((bid) => (
                        <tr
                          key={bid.id}
                          className="border-t border-[rgba(70,67,60,0.12)]"
                        >
                          <td className="py-3">
                            <p>{bid.bidderName}</p>
                            <p className="vp-description text-sm">{bid.bidderEmail}</p>
                          </td>
                          <td className="py-3">{formatUsd(bid.amountCents)}</td>
                          <td className="py-3">{bid.isAuto ? "auto" : "bid"}</td>
                          <td className="py-3">
                            {new Date(bid.createdAt).toLocaleString()}
                          </td>
                          {canDelete ? (
                            <td className="py-3">
                              <form
                                action={deleteAction}
                                onSubmit={(event) => {
                                  if (
                                    !window.confirm(
                                      `Delete ${bid.bidderName}'s bid of ${formatUsd(bid.amountCents)}?`,
                                    )
                                  ) {
                                    event.preventDefault();
                                  }
                                }}
                              >
                                <input type="hidden" name="bidId" value={bid.id} />
                                <input
                                  type="hidden"
                                  name="version"
                                  value={deleteState.version}
                                />
                                <VanPlanFormButton
                                  pendingLabel="Deleting..."
                                  variant="link"
                                >
                                  delete
                                </VanPlanFormButton>
                              </form>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {canDelete ? (
                  <form
                    action={clearAction}
                    className="mt-5"
                    onSubmit={(event) => {
                      if (
                        !window.confirm(
                          `Delete all ${bids.length} bid${bids.length === 1 ? "" : "s"} on “${itemName}”? This cannot be undone.`,
                        )
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="itemId" value={itemId} />
                    <input type="hidden" name="version" value={clearState.version} />
                    <VanPlanFormButton
                      pendingLabel="Deleting bids..."
                      variant="danger"
                    >
                      Delete all bids
                    </VanPlanFormButton>
                  </form>
                ) : (
                  <p className="vp-description mt-5 text-sm">
                    This item is sold. Change the status before deleting bids.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
