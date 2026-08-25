"use client";

import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { deleteVanPlanItemImageAction } from "@/lib/van-plan/actions";

export default function VanPlanDeleteImageForm({
  itemId,
  imageId,
}: {
  itemId: string;
  imageId: string;
}) {
  return (
    <form
      action={deleteVanPlanItemImageAction}
      onSubmit={(event) => {
        if (!window.confirm("Remove this photo from the item?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="imageId" value={imageId} />
      <VanPlanFormButton pendingLabel="Removing..." variant="ghost">
        Remove photo
      </VanPlanFormButton>
    </form>
  );
}
