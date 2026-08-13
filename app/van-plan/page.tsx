import Link from "next/link";
import { countVanPlanUsers, getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { VAN_PLAN_BASE_PATH, VAN_PLAN_SUBTITLE, VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import { listVanPlanItems, primaryItemImage } from "@/lib/van-plan/items";
import { formatUsd, toProperCase } from "@/lib/van-plan/format";

export default async function VanPlanCatalogPage() {
  const user = await getCurrentVanPlanUser();
  const [userCount, items] = await Promise.all([
    countVanPlanUsers().catch(() => -1),
    listVanPlanItems(user).catch(() => []),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="vp-subhead text-sm">{VAN_PLAN_SUBTITLE}</p>
      <h1 className="vp-heading mt-2 text-4xl md:text-5xl">{VAN_PLAN_TITLE}</h1>
      <p className="vp-description mt-4 max-w-2xl text-lg leading-7">
        Browse the silent auction items and place your bid. Each listing has its
        own page, current high bid, and a printable flyer with a QR code.
      </p>

      {userCount < 0 ? (
        <div className="vp-card mt-8 p-6">
          <p className="vp-heading-bold text-xl">Apply the auction migration</p>
          <p className="vp-description mt-3">
            Run <code>supabase/migrations/202608120001_create_van_plan_auction.sql</code>{" "}
            in Supabase, then reload this page.
          </p>
        </div>
      ) : null}

      {userCount === 0 ? (
        <div className="vp-card mt-8 p-6">
          <p className="vp-heading-bold text-xl">First-time setup</p>
          <p className="vp-description mt-3">
            Create the first auction admin so you can add users and items.
          </p>
          <Link href={`${VAN_PLAN_BASE_PATH}/setup`} className="vp-button mt-5">
            Create admin
          </Link>
        </div>
      ) : null}

      {userCount > 0 && items.length === 0 ? (
        <div className="vp-card mt-10 p-8">
          <p className="vp-heading-bold text-xl">No items yet</p>
          <p className="vp-description mt-3">
            Auction items will appear here once an admin or auctioneer adds them.
          </p>
        </div>
      ) : items.length > 0 ? (
        <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const image = primaryItemImage(item);
            const current = item.highestBid?.amountCents ?? item.startingPriceCents;

            return (
              <Link
                key={item.id}
                href={`${VAN_PLAN_BASE_PATH}/items/${item.slug}`}
                className="vp-card overflow-hidden transition hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] bg-white/40">
                  {image ? (
                    // Dynamic auction images are served by the module route.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.url}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <p className="vp-accent text-sm">no photo yet</p>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="vp-accent text-xs">{item.status}</p>
                  <h2 className="vp-heading-bold mt-2 text-xl leading-7">
                    {item.name}
                  </h2>
                  <p className="vp-description mt-3 line-clamp-3 text-sm leading-6">
                    {toProperCase(item.description)}
                  </p>
                  <p className="vp-subhead mt-4 text-sm">
                    current high bid {formatUsd(current)}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
