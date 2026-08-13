import Link from "next/link";
import { redirect } from "next/navigation";
import { canManageItems, getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";
import { listVanPlanItems, primaryItemImage } from "@/lib/van-plan/items";
import { formatUsd } from "@/lib/van-plan/format";
import { hasStripeConfig } from "@/lib/van-plan/stripe";

export default async function VanPlanAdminPage() {
  const user = await getCurrentVanPlanUser();

  if (!user) {
    redirect(`${VAN_PLAN_BASE_PATH}/login?next=${encodeURIComponent(`${VAN_PLAN_BASE_PATH}/admin`)}`);
  }

  if (!canManageItems(user)) {
    redirect(VAN_PLAN_BASE_PATH);
  }

  const items = await listVanPlanItems(user);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="vp-subhead text-sm">auction desk</p>
      <h1 className="vp-heading mt-2 text-4xl">Manage items</h1>
      <p className="vp-description mt-4 max-w-2xl leading-7">
        Add items, update their status, and print QR flyers. Marking an item
        sold sends a Stripe invoice to the highest bidder with a memo of
        &quot;The Great Van Plan&quot;.
      </p>

      {!hasStripeConfig() ? (
        <p className="vp-card mt-6 p-4 text-sm">
          Stripe is not configured yet. Add <code>STRIPE_SECRET_KEY</code> so
          sold items can send invoices.
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`${VAN_PLAN_BASE_PATH}/admin/items/new`} className="vp-button">
          Add item
        </Link>
        {user.permission === "admin" ? (
          <Link
            href={`${VAN_PLAN_BASE_PATH}/admin/users`}
            className="vp-button vp-button-secondary"
          >
            Add users
          </Link>
        ) : null}
      </div>

      <section className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left">
          <thead>
            <tr className="vp-subhead text-sm">
              <th className="pb-3 font-normal">item</th>
              <th className="pb-3 font-normal">status</th>
              <th className="pb-3 font-normal">starting</th>
              <th className="pb-3 font-normal">high bid</th>
              <th className="pb-3 font-normal">bids</th>
              <th className="pb-3 font-normal">actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const image = primaryItemImage(item);

              return (
                <tr key={item.id} className="border-t border-[rgba(70,67,60,0.12)]">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image.url}
                          alt=""
                          className="h-14 w-14 rounded-lg object-cover"
                        />
                      ) : null}
                      <div>
                        <p className="vp-heading-bold text-sm">{item.name}</p>
                        <p className="vp-accent text-xs">{item.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">{item.status}</td>
                  <td className="py-4">{formatUsd(item.startingPriceCents)}</td>
                  <td className="py-4">
                    {formatUsd(item.highestBid?.amountCents ?? item.startingPriceCents)}
                  </td>
                  <td className="py-4">{item.bidCount}</td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`${VAN_PLAN_BASE_PATH}/items/${item.slug}`}
                        className="vp-subhead text-sm"
                      >
                        open
                      </Link>
                      <Link
                        href={`${VAN_PLAN_BASE_PATH}/admin/items/${item.id}`}
                        className="vp-subhead text-sm"
                      >
                        edit
                      </Link>
                      <Link
                        href={`${VAN_PLAN_BASE_PATH}/items/${item.slug}/pdf`}
                        className="vp-subhead text-sm"
                      >
                        pdf
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
