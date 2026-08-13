import { redirect } from "next/navigation";
import { canManageItems, getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";
import VanPlanItemForm from "../item-form";

export default async function NewVanPlanItemPage() {
  const user = await getCurrentVanPlanUser();

  if (!user) {
    redirect(`${VAN_PLAN_BASE_PATH}/login?next=${encodeURIComponent(`${VAN_PLAN_BASE_PATH}/admin/items/new`)}`);
  }

  if (!canManageItems(user)) {
    redirect(VAN_PLAN_BASE_PATH);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="vp-subhead text-sm">auction desk</p>
      <h1 className="vp-heading mt-2 text-4xl">Add item</h1>
      <p className="vp-description mt-4 leading-7">
        Add the item name, description, starting price, status, and as many
        photos as you need. The first photo becomes the main picture used on
        the printable flyer.
      </p>
      <VanPlanItemForm />
    </main>
  );
}
