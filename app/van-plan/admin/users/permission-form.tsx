"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { updateVanPlanUserPermissionAction } from "@/lib/van-plan/actions";
import { VAN_PLAN_PERMISSIONS } from "@/lib/van-plan/constants";
import { idleVanPlanActionState } from "@/lib/van-plan/types";
import type { VanPlanPermission } from "@/lib/van-plan/types";

export default function VanPlanPermissionForm({
  userId,
  permission,
}: {
  userId: string;
  permission: VanPlanPermission;
}) {
  const [state, formAction] = useActionState(
    updateVanPlanUserPermissionAction,
    idleVanPlanActionState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="version" value={state.version} />
      <select name="permission" defaultValue={permission} className="vp-select">
        {VAN_PLAN_PERMISSIONS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <VanPlanFormButton pendingLabel="Saving..." variant="secondary">
        Save
      </VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
