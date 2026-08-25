"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { duplicateVanPlanItemAction } from "@/lib/van-plan/actions";
import { idleVanPlanActionState } from "@/lib/van-plan/types";

export default function VanPlanDuplicateItemForm({
  itemId,
  itemName,
}: {
  itemId: string;
  itemName: string;
}) {
  const [state, formAction] = useActionState(
    duplicateVanPlanItemAction,
    idleVanPlanActionState,
  );

  return (
    <form
      action={formAction}
      className="inline-flex flex-col items-start gap-2"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Duplicate “${itemName}”? A new listing will be created with the same description, photos, and starting price.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="version" value={state.version} />
      <VanPlanFormButton pendingLabel="Duplicating..." variant="link">
        duplicate
      </VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
