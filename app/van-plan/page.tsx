import Link from "next/link";
import { countVanPlanUsers, getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { VAN_PLAN_BASE_PATH, VAN_PLAN_SUBTITLE, VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import VanPlanItemCard from "@/app/van-plan/components/item-card";
import { listVanPlanItems } from "@/lib/van-plan/items";
import {
  formatAuctionClock,
  formatAuctionShortDate,
} from "@/lib/van-plan/schedule";
import { getVanPlanAuctionSchedule } from "@/lib/van-plan/settings";

export default async function VanPlanCatalogPage() {
  const user = await getCurrentVanPlanUser().catch(() => null);
  const [schedule, userCount, items] = await Promise.all([
    getVanPlanAuctionSchedule(),
    countVanPlanUsers().catch(() => -1),
    listVanPlanItems(user).catch(() => []),
  ]);
  const intro =
    schedule.phase === "preview"
      ? `Browse the silent auction items and set up your account. Official bidding opens ${formatAuctionClock(schedule.opensAt)} and closes ${formatAuctionClock(schedule.closesAt)}. You can look around without signing in.`
      : schedule.phase === "live"
        ? `Browse the silent auction items and place your bid. Bidding closes ${formatAuctionClock(schedule.closesAt)}. Each listing has its own page, current high bid, and a printable flyer with a QR code.`
        : schedule.statusOverride === "closed"
          ? "Bidding is closed. You can still browse the items and print flyers."
          : `Bidding closed ${formatAuctionClock(schedule.closesAt)}. You can still browse the items and print flyers.`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="vp-subhead text-xs sm:text-sm">{VAN_PLAN_SUBTITLE}</p>
      <h1 className="vp-heading mt-2 text-3xl sm:text-4xl md:text-5xl">{VAN_PLAN_TITLE}</h1>
      <p className="vp-description mt-3 hidden max-w-2xl text-lg leading-7 sm:mt-4 sm:block">
        {intro}
      </p>

      {!user && schedule.phase !== "closed" ? (
        <p className="mt-6">
          <Link href={`${VAN_PLAN_BASE_PATH}/register`} className="vp-button">
            {schedule.phase === "preview" ? "Create an account" : "Create an account to bid"}
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
        <section className="mt-6 grid grid-cols-2 items-stretch gap-3 sm:mt-10 sm:gap-6 md:grid-cols-3">
          {items.map((item) => (
            <VanPlanItemCard
              key={item.id}
              item={item}
              statusLabel={
                schedule.phase === "preview" && item.status === "open"
                  ? `opens ${formatAuctionShortDate(schedule.opensAt)}`
                  : schedule.phase === "closed" && item.status === "open"
                    ? "closed"
                    : item.status
              }
            />
          ))}
        </section>
      )}
    </main>
  );
}
