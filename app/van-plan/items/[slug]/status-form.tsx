"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { updateVanPlanItemStatusAction } from "@/lib/van-plan/actions";
import { VAN_PLAN_ITEM_STATUSES } from "@/lib/van-plan/constants";
import { idleVanPlanActionState } from "@/lib/van-plan/types";
import type { VanPlanItemStatus } from "@/lib/van-plan/types";

export default function VanPlanStatusForm({
  itemId,
  currentStatus,
}: {
  itemId: string;
  currentStatus: VanPlanItemStatus;
}) {
  const [state, formAction] = useActionState(
    updateVanPlanItemStatusAction,
    idleVanPlanActionState,
  );

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="version" value={state.version} />
      <label className="vp-subhead block text-sm">
        status
        <select
          name="status"
          defaultValue={currentStatus}
          className="vp-select mt-2"
        >
          {VAN_PLAN_ITEM_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <VanPlanFormButton pendingLabel="Updating...">Update status</VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
