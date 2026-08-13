import { VAN_PLAN_PAYMENT_MEMO, VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import { VanPlanError, vanPlanDb } from "@/lib/van-plan/db";
import { getVanPlanItemById, listItemBids } from "@/lib/van-plan/items";
import type { VanPlanInvoice, VanPlanInvoiceStatus } from "@/lib/van-plan/types";

type InvoiceRow = {
  id: string;
  item_id: string;
  user_id: string;
  amount_cents: number;
  memo: string;
  status: VanPlanInvoiceStatus;
  stripe_customer_id: string | null;
  stripe_invoice_id: string | null;
  stripe_invoice_url: string | null;
  error_message: string | null;
  created_at: string;
};

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function hasStripeConfig() {
  return Boolean(stripeSecretKey());
}

function mapInvoice(row: InvoiceRow): VanPlanInvoice {
  return {
    id: row.id,
    itemId: row.item_id,
    userId: row.user_id,
    amountCents: row.amount_cents,
    memo: row.memo,
    status: row.status,
    stripeCustomerId: row.stripe_customer_id,
    stripeInvoiceId: row.stripe_invoice_id,
    stripeInvoiceUrl: row.stripe_invoice_url,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export async function listItemInvoices(itemId: string) {
  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_invoices")
    .select(
      "id, item_id, user_id, amount_cents, memo, status, stripe_customer_id, stripe_invoice_id, stripe_invoice_url, error_message, created_at",
    )
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .returns<InvoiceRow[]>();

  if (error) {
    throw new VanPlanError("Unable to load invoices.", 500);
  }

  return (data ?? []).map(mapInvoice);
}

export async function markItemSoldAndInvoice(itemId: string) {
  const item = await getVanPlanItemById(itemId);
  const bids = await listItemBids(itemId);
  const winningBid = bids[0];

  if (!winningBid) {
    throw new VanPlanError("An item needs at least one bid before it can be sold.");
  }

  const db = vanPlanDb();
  const existingSent = (await listItemInvoices(itemId)).find(
    (invoice) => invoice.status === "sent" && invoice.amountCents === winningBid.amountCents,
  );

  const { error: soldError } = await db
    .from("van_plan_items")
    .update({
      status: "sold",
      sold_to_user_id: winningBid.userId,
      sold_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (soldError) {
    throw new VanPlanError("Unable to mark that item as sold.", 500);
  }

  if (existingSent) {
    return existingSent;
  }

  const { data: invoiceRow, error: invoiceInsertError } = await db
    .from("van_plan_invoices")
    .insert({
      item_id: itemId,
      user_id: winningBid.userId,
      amount_cents: winningBid.amountCents,
      memo: VAN_PLAN_PAYMENT_MEMO,
      status: "pending",
    })
    .select(
      "id, item_id, user_id, amount_cents, memo, status, stripe_customer_id, stripe_invoice_id, stripe_invoice_url, error_message, created_at",
    )
    .single<InvoiceRow>();

  if (invoiceInsertError || !invoiceRow) {
    throw new VanPlanError("Item was marked sold, but the invoice record failed.", 500);
  }

  return sendStripeInvoice({
    invoice: mapInvoice(invoiceRow),
    itemName: item.name,
    winnerName: winningBid.bidderName,
    winnerEmail: winningBid.bidderEmail,
    winnerPhone: winningBid.bidderPhone,
  });
}

export async function retryStripeInvoice(invoiceId: string) {
  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_invoices")
    .select(
      "id, item_id, user_id, amount_cents, memo, status, stripe_customer_id, stripe_invoice_id, stripe_invoice_url, error_message, created_at",
    )
    .eq("id", invoiceId)
    .maybeSingle<InvoiceRow>();

  if (error || !data) {
    throw new VanPlanError("Invoice not found.", 404);
  }

  if (data.status === "sent" && data.stripe_invoice_id) {
    return mapInvoice(data);
  }

  const item = await getVanPlanItemById(data.item_id);
  const bids = await listItemBids(data.item_id);
  const winner = bids.find((bid) => bid.userId === data.user_id) ?? bids[0];

  if (!winner) {
    throw new VanPlanError("Unable to find the winning bidder for this invoice.");
  }

  return sendStripeInvoice({
    invoice: mapInvoice(data),
    itemName: item.name,
    winnerName: winner.bidderName,
    winnerEmail: winner.bidderEmail,
    winnerPhone: winner.bidderPhone,
  });
}

async function sendStripeInvoice({
  invoice,
  itemName,
  winnerName,
  winnerEmail,
  winnerPhone,
}: {
  invoice: VanPlanInvoice;
  itemName: string;
  winnerName: string;
  winnerEmail: string;
  winnerPhone: string;
}) {
  const db = vanPlanDb();

  if (!hasStripeConfig()) {
    const failed = {
      ...invoice,
      status: "failed" as const,
      errorMessage: "STRIPE_SECRET_KEY is not configured.",
    };

    await db
      .from("van_plan_invoices")
      .update({
        status: "failed",
        error_message: failed.errorMessage,
      })
      .eq("id", invoice.id);

    return failed;
  }

  try {
    const customerId =
      invoice.stripeCustomerId ??
      (await findOrCreateStripeCustomer({
        email: winnerEmail,
        name: winnerName,
        phone: winnerPhone,
      }));

    const createdInvoice = await stripeRequest<{
      id: string;
      hosted_invoice_url?: string | null;
    }>("/invoices", {
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: "14",
      auto_advance: "false",
      description: VAN_PLAN_PAYMENT_MEMO,
      footer: VAN_PLAN_PAYMENT_MEMO,
      statement_descriptor: "GREAT VAN PLAN",
      "custom_fields[0][name]": "Memo",
      "custom_fields[0][value]": VAN_PLAN_PAYMENT_MEMO,
      "metadata[memo]": VAN_PLAN_PAYMENT_MEMO,
      "metadata[item_id]": invoice.itemId,
      "metadata[auction]": VAN_PLAN_TITLE,
    });

    await stripeRequest("/invoiceitems", {
      customer: customerId,
      invoice: createdInvoice.id,
      amount: String(invoice.amountCents),
      currency: "usd",
      description: `${itemName} — ${VAN_PLAN_TITLE} Silent Auction`,
    });

    const sentInvoice = await stripeRequest<{
      id: string;
      hosted_invoice_url?: string | null;
    }>(`/invoices/${createdInvoice.id}/send`, {});

    const updated = {
      ...invoice,
      status: "sent" as const,
      stripeCustomerId: customerId,
      stripeInvoiceId: sentInvoice.id ?? createdInvoice.id,
      stripeInvoiceUrl:
        sentInvoice.hosted_invoice_url ?? createdInvoice.hosted_invoice_url ?? null,
      errorMessage: null,
    };

    await db
      .from("van_plan_invoices")
      .update({
        status: "sent",
        stripe_customer_id: updated.stripeCustomerId,
        stripe_invoice_id: updated.stripeInvoiceId,
        stripe_invoice_url: updated.stripeInvoiceUrl,
        error_message: null,
      })
      .eq("id", invoice.id);

    return updated;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe invoice failed.";

    await db
      .from("van_plan_invoices")
      .update({
        status: "failed",
        error_message: message,
      })
      .eq("id", invoice.id);

    return {
      ...invoice,
      status: "failed" as const,
      errorMessage: message,
    };
  }
}

async function findOrCreateStripeCustomer({
  email,
  name,
  phone,
}: {
  email: string;
  name: string;
  phone: string;
}) {
  const search = await stripeRequest<{
    data?: Array<{ id: string }>;
  }>(`/customers?email=${encodeURIComponent(email)}&limit=1`, null, "GET");

  if (search.data?.[0]?.id) {
    return search.data[0].id;
  }

  const customer = await stripeRequest<{ id: string }>("/customers", {
    email,
    name,
    phone,
    description: VAN_PLAN_PAYMENT_MEMO,
    "metadata[memo]": VAN_PLAN_PAYMENT_MEMO,
  });

  return customer.id;
}

async function stripeRequest<T>(
  path: string,
  body: Record<string, string> | null,
  method = "POST",
): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body) : undefined,
    cache: "no-store",
  });

  const payload = (await response.json()) as T & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || `Stripe request failed (${response.status}).`);
  }

  return payload;
}
