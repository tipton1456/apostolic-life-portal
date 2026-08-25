"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { deleteVanPlanItemAction } from "@/lib/van-plan/actions";
import { idleVanPlanActionState } from "@/lib/van-plan/types";

export default function VanPlanDeleteItemForm({
  itemId,
  itemName,
  bidCount = 0,
  variant = "danger",
  label = "Delete item",
}: {
  itemId: string;
  itemName: string;
  bidCount?: number;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  label?: string;
}) {
  const [state, formAction] = useActionState(
    deleteVanPlanItemAction,
    idleVanPlanActionState,
  );

  return (
    <form
      action={formAction}
      className="inline-flex flex-col items-start gap-2"
      onSubmit={(event) => {
        const extra =
          bidCount > 0
            ? ` This will also remove ${bidCount} bid${bidCount === 1 ? "" : "s"}.`
            : "";

        if (
          !window.confirm(
            `Delete “${itemName}”?${extra} This cannot be undone.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="version" value={state.version} />
      <VanPlanFormButton pendingLabel="Deleting..." variant={variant}>
        {label}
      </VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
