import Link from "next/link";
import { countVanPlanUsers, getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { VAN_PLAN_BASE_PATH, VAN_PLAN_SUBTITLE, VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import { listVanPlanItems, primaryItemImage } from "@/lib/van-plan/items";
import { formatUsd, toProperCase } from "@/lib/van-plan/format";

export default async function VanPlanCatalogPage() {
  const user = await getCurrentVanPlanUser().catch(() => null);
  const [userCount, items] = await Promise.all([
    countVanPlanUsers().catch(() => -1),
    listVanPlanItems(user).catch(() => []),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="vp-subhead text-xs sm:text-sm">{VAN_PLAN_SUBTITLE}</p>
      <h1 className="vp-heading mt-2 text-3xl sm:text-4xl md:text-5xl">{VAN_PLAN_TITLE}</h1>
      <p className="vp-description mt-3 hidden max-w-2xl text-lg leading-7 sm:mt-4 sm:block">
        Browse the silent auction items and place your bid. Each listing has its
        own page, current high bid, and a printable flyer with a QR code.
        You can look around without signing in.
      </p>

      {!user ? (
        <p className="mt-6">
          <Link href={`${VAN_PLAN_BASE_PATH}/register`} className="vp-button">
            Create an account to bid
          </Link>
        </p>
      ) : null}

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

      {items.length === 0 ? (
        <div className="vp-card mt-10 p-8">
          <p className="vp-heading-bold text-xl">No items yet</p>
          <p className="vp-description mt-3">
            Auction items will appear here once an admin or auctioneer adds them.
          </p>
        </div>
      ) : (
        <section className="mt-6 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-6 md:grid-cols-3">
          {items.map((item) => {
            const image = primaryItemImage(item);
            const current = item.highestBid?.amountCents ?? item.startingPriceCents;

            return (
              <Link
                key={item.id}
                href={`${VAN_PLAN_BASE_PATH}/items/${item.slug}`}
                className="vp-card overflow-hidden transition hover:-translate-y-0.5"
              >
                <div className="aspect-square bg-white/40 sm:aspect-[4/3]">
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
                      <p className="vp-accent text-[11px] sm:text-sm">no photo yet</p>
                    </div>
                  )}
                </div>
                <div className="p-2.5 sm:p-5">
                  <p className="vp-accent text-[10px] sm:text-xs">{item.status}</p>
                  <h2 className="vp-heading-bold mt-1 line-clamp-2 text-[13px] leading-4 sm:mt-2 sm:text-xl sm:leading-7">
                    {item.name}
                  </h2>
                  <p className="vp-description mt-3 hidden line-clamp-3 text-sm leading-6 sm:block">
                    {toProperCase(item.description)}
                  </p>
                  <p className="vp-subhead mt-2 text-[11px] leading-4 sm:mt-4 sm:text-sm">
                    {formatUsd(current)}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
