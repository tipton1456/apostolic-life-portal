import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  canBidDuringPreview,
  canManageItems,
  canViewAllBids,
  getCurrentVanPlanUser,
} from "@/lib/van-plan/auth";
import { getVanPlanBidProxy } from "@/lib/van-plan/bids";
import { VAN_PLAN_BASE_PATH, VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import { getVanPlanItemBySlug, listItemBids } from "@/lib/van-plan/items";
import { formatUsd, toProperCase } from "@/lib/van-plan/format";
import { getVanPlanAuctionSchedule } from "@/lib/van-plan/settings";
import { canRetryVanPlanInvoice, listItemInvoices } from "@/lib/van-plan/stripe";
import VanPlanDeleteItemForm from "@/app/van-plan/components/delete-item-form";
import VanPlanBidHistoryPanel from "./bid-history-panel";
import VanPlanBiddingPanel from "./bidding-panel";
import VanPlanItemGallery from "./gallery";
import VanPlanInvoiceRetryForm from "./invoice-retry-form";
import VanPlanStatusForm from "./status-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const user = await getCurrentVanPlanUser();
  const item = await getVanPlanItemBySlug(slug, user);

  if (!item) {
    return { title: "Item not found" };
  }

  return {
    title: item.name,
    description: item.description,
  };
}

export default async function VanPlanItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ bids?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const openBidHistory = query.bids === "1" || query.bids === "true";
  const user = await getCurrentVanPlanUser();
  const item = await getVanPlanItemBySlug(slug, user);

  if (!item) {
    notFound();
  }

  const staff = canManageItems(user);
  const allowPreviewBidding = canBidDuringPreview(user);
  const showBidHistory = canViewAllBids(user);
  const [bids, invoices, proxy] = await Promise.all([
    showBidHistory ? listItemBids(item.id) : Promise.resolve([]),
    staff ? listItemInvoices(item.id) : Promise.resolve([]),
    user ? getVanPlanBidProxy(item.id, user.id) : Promise.resolve(null),
  ]);
  const currentHigh = item.highestBid?.amountCents ?? item.startingPriceCents;
  const schedule = await getVanPlanAuctionSchedule();
  const showingStartingPrice =
    !item.highestBid || (schedule.phase === "preview" && !allowPreviewBidding);
  const loginHref = `${VAN_PLAN_BASE_PATH}/login?next=${encodeURIComponent(
    `${VAN_PLAN_BASE_PATH}/items/${item.slug}`,
  )}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="vp-subhead text-sm">{VAN_PLAN_TITLE.toLowerCase()}</p>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <VanPlanItemGallery images={item.images} itemName={item.name} />

        <section>
          <p className="vp-accent text-sm">{item.status}</p>
          <h1 className="vp-heading-bold mt-2 text-4xl leading-tight">
            {item.name}
          </h1>
          <p className="vp-description mt-5 text-lg leading-8">
            {toProperCase(item.description)}
          </p>

          <div className="vp-card mt-8 p-6">
            <p className="vp-subhead text-sm">
              {showingStartingPrice ? "starting bid" : "current high bid"}
            </p>
            <p className="vp-heading-bold mt-2 text-4xl">{formatUsd(currentHigh)}</p>
            <p className="vp-description mt-2 text-sm">
              Starting price {formatUsd(item.startingPriceCents)}
              {item.highestBid && (schedule.phase !== "preview" || allowPreviewBidding)
                ? ` · ${item.bidCount} bid${item.bidCount === 1 ? "" : "s"}`
                : ""}
            </p>

            <VanPlanBiddingPanel
              itemId={item.id}
              itemStatus={item.status}
              currentHighCents={item.highestBid?.amountCents ?? null}
              isHighBidder={Boolean(user && item.highestBid?.userId === user.id)}
              proxy={proxy}
              signedIn={Boolean(user)}
              allowPreviewBidding={allowPreviewBidding}
              loginHref={loginHref}
              opensAt={schedule.opensAt}
              closesAt={schedule.closesAt}
              serverNow={schedule.now}
              statusOverride={schedule.statusOverride}
            />
          </div>

          <div className="mt-6">
            <Link
              href={`${VAN_PLAN_BASE_PATH}/items/${item.slug}/pdf`}
              className="vp-button vp-button-secondary"
            >
              Printable PDF
            </Link>
          </div>

          {staff ? (
            <div className="vp-card mt-6 p-6">
              <h2 className="vp-heading text-2xl">Staff controls</h2>
              <VanPlanStatusForm itemId={item.id} currentStatus={item.status} />
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <VanPlanBidHistoryPanel
                  itemId={item.id}
                  itemName={item.name}
                  itemStatus={item.status}
                  bids={bids}
                  openOnLoad={openBidHistory}
                />
                <Link
                  href={`${VAN_PLAN_BASE_PATH}/admin/items/${item.id}`}
                  className="vp-button vp-button-secondary"
                >
                  Edit item
                </Link>
                <VanPlanDeleteItemForm
                  itemId={item.id}
                  itemName={item.name}
                  bidCount={item.bidCount}
                />
              </div>
            </div>
          ) : null}

          {invoices.length > 0 ? (
            <div className="vp-card mt-6 p-6">
              <h2 className="vp-heading text-2xl">Invoice</h2>
              {invoices.map((invoice) => (
                <div key={invoice.id} className="mt-4">
                  <p className="vp-accent text-sm">{invoice.status}</p>
                  <p className="vp-description mt-1">
                    {formatUsd(invoice.amountCents)} · memo {invoice.memo}
                  </p>
                  {invoice.stripeInvoiceUrl ? (
                    <a
                      href={invoice.stripeInvoiceUrl}
                      className="vp-subhead mt-2 inline-block text-sm"
                      target="_blank"
                      rel="noreferrer"
                    >
                      open stripe invoice
                    </a>
                  ) : null}
                  {invoice.errorMessage ? (
                    <p className="mt-2 text-sm text-red-800">{invoice.errorMessage}</p>
                  ) : null}
                  {canRetryVanPlanInvoice(invoice) ? (
                    <VanPlanInvoiceRetryForm invoiceId={invoice.id} />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
