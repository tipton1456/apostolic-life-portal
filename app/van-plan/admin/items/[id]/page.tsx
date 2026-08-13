import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canManageItems, getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { setPrimaryItemImageAction } from "@/lib/van-plan/actions";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";
import { getVanPlanItemById } from "@/lib/van-plan/items";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import VanPlanItemForm from "../item-form";

export default async function EditVanPlanItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentVanPlanUser();
  const { id } = await params;

  if (!user) {
    redirect(
      `${VAN_PLAN_BASE_PATH}/login?next=${encodeURIComponent(`${VAN_PLAN_BASE_PATH}/admin/items/${id}`)}`,
    );
  }

  if (!canManageItems(user)) {
    redirect(VAN_PLAN_BASE_PATH);
  }

  let item;

  try {
    item = await getVanPlanItemById(id);
  } catch {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="vp-subhead text-sm">auction desk</p>
      <h1 className="vp-heading mt-2 text-4xl">Edit item</h1>
      <p className="mt-4">
        <Link href={`${VAN_PLAN_BASE_PATH}/items/${item.slug}`} className="vp-subhead text-sm">
          view public item page
        </Link>
      </p>
      <VanPlanItemForm item={item} />

      {item.images.length > 0 ? (
        <section className="mt-10">
          <h2 className="vp-heading text-2xl">Photos</h2>
          <div className="mt-5 grid grid-cols-2 gap-4">
            {item.images.map((image) => (
              <div key={image.id} className="vp-card overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="aspect-square w-full object-cover" />
                <div className="p-3">
                  {image.isPrimary ? (
                    <p className="vp-accent text-sm">main picture</p>
                  ) : (
                    <form action={setPrimaryItemImageAction}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="imageId" value={image.id} />
                      <VanPlanFormButton pendingLabel="Saving..." variant="ghost">
                        Use as main picture
                      </VanPlanFormButton>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
