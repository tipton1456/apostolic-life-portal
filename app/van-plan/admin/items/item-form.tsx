"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import {
  createVanPlanItemAction,
  updateVanPlanItemAction,
} from "@/lib/van-plan/actions";
import { VAN_PLAN_ITEM_STATUSES } from "@/lib/van-plan/constants";
import { idleVanPlanActionState } from "@/lib/van-plan/types";
import type { VanPlanItem } from "@/lib/van-plan/types";

export default function VanPlanItemForm({ item }: { item?: VanPlanItem }) {
  const action = item ? updateVanPlanItemAction : createVanPlanItemAction;
  const [state, formAction] = useActionState(action, idleVanPlanActionState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <input type="hidden" name="version" value={state.version} />

      <label className="vp-subhead block text-sm">
        item name
        <input
          name="name"
          required
          defaultValue={item?.name}
          className="vp-input mt-2"
        />
      </label>

      <label className="vp-subhead block text-sm">
        item description
        <textarea
          name="description"
          required
          rows={6}
          defaultValue={item?.description}
          className="vp-textarea mt-2"
        />
      </label>

      <label className="vp-subhead block text-sm">
        starting price
        <input
          name="startingPrice"
          required
          inputMode="decimal"
          defaultValue={
            item ? (item.startingPriceCents / 100).toFixed(2) : "0.00"
          }
          className="vp-input mt-2"
        />
      </label>

      {!item ? (
        <label className="vp-subhead block text-sm">
          status
          <select name="status" defaultValue="draft" className="vp-select mt-2">
            {VAN_PLAN_ITEM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="vp-subhead block text-sm">
        photos
        <input
          name="images"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="vp-input mt-2"
        />
      </label>

      <VanPlanFormButton pendingLabel={item ? "Saving..." : "Adding item..."}>
        {item ? "Save item" : "Add item"}
      </VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
