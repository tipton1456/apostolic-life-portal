import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  canManageItems,
  canViewAllBids,
  getCurrentVanPlanUser,
} from "@/lib/van-plan/auth";
import { minimumNextBidCents } from "@/lib/van-plan/bids";
import { VAN_PLAN_BASE_PATH, VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import { getVanPlanItemBySlug, listItemBids } from "@/lib/van-plan/items";
import { formatUsd, toProperCase } from "@/lib/van-plan/format";
import { listItemInvoices } from "@/lib/van-plan/stripe";
import VanPlanBidForm from "./bid-form";
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentVanPlanUser();
  const item = await getVanPlanItemBySlug(slug, user);

  if (!item) {
    notFound();
  }

  const staff = canManageItems(user);
  const showBidHistory = canViewAllBids(user);
  const bids = showBidHistory ? await listItemBids(item.id) : [];
  const invoices = staff ? await listItemInvoices(item.id) : [];
  const currentHigh = item.highestBid?.amountCents ?? item.startingPriceCents;
  const nextBid = minimumNextBidCents(item);
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
            <p className="vp-subhead text-sm">current high bid</p>
            <p className="vp-heading-bold mt-2 text-4xl">{formatUsd(currentHigh)}</p>
            <p className="vp-description mt-2 text-sm">
              Starting price {formatUsd(item.startingPriceCents)}
              {item.highestBid ? ` · ${item.bidCount} bid${item.bidCount === 1 ? "" : "s"}` : ""}
            </p>

            {item.status === "open" && user ? (
              <VanPlanBidForm itemId={item.id} minimumCents={nextBid} />
            ) : null}

            {item.status === "open" && !user ? (
              <p className="mt-5">
                <Link href={loginHref} className="vp-button">
                  Sign in to bid
                </Link>
              </p>
            ) : null}

            {item.status !== "open" ? (
              <p className="vp-accent mt-5 text-sm">
                bidding is {item.status === "sold" ? "closed, this item is sold" : `currently ${item.status}`}
              </p>
            ) : null}
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
              <div className="mt-5">
                <Link
                  href={`${VAN_PLAN_BASE_PATH}/admin/items/${item.id}`}
                  className="vp-button vp-button-secondary"
                >
                  Edit item
                </Link>
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
                  {invoice.status !== "sent" ? (
                    <VanPlanInvoiceRetryForm invoiceId={invoice.id} />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {showBidHistory ? (
        <section className="vp-card mt-10 p-6">
          <h2 className="vp-heading text-3xl">Bid history</h2>
          {bids.length === 0 ? (
            <p className="vp-description mt-4">No bids yet.</p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left">
                <thead>
                  <tr className="vp-subhead text-sm">
                    <th className="pb-3 font-normal">bidder</th>
                    <th className="pb-3 font-normal">email</th>
                    <th className="pb-3 font-normal">phone</th>
                    <th className="pb-3 font-normal">amount</th>
                    <th className="pb-3 font-normal">time</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid) => (
                    <tr key={bid.id} className="border-t border-[rgba(70,67,60,0.12)]">
                      <td className="py-3">{bid.bidderName}</td>
                      <td className="py-3">{bid.bidderEmail}</td>
                      <td className="py-3">{bid.bidderPhone}</td>
                      <td className="py-3">{formatUsd(bid.amountCents)}</td>
                      <td className="py-3">
                        {new Date(bid.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
