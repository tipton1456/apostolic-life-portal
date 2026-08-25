import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { VAN_PLAN_BASE_PATH, VAN_PLAN_PAYMENT_MEMO, VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import { VanPlanError, vanPlanDb } from "@/lib/van-plan/db";
import { getVanPlanItemById, listItemBids } from "@/lib/van-plan/items";
import type { VanPlanInvoice, VanPlanInvoiceStatus } from "@/lib/van-plan/types";

const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;
const INVOICE_SELECT =
  "id, item_id, user_id, amount_cents, memo, status, stripe_customer_id, stripe_invoice_id, stripe_invoice_url, error_message, created_at";

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

type WinnerProfile = {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
};

let stripeClient: Stripe | null = null;

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}

export function hasStripeConfig() {
  return Boolean(stripeSecretKey());
}

export function hasStripeWebhookConfig() {
  return Boolean(stripeWebhookSecret());
}

function getStripe() {
  const key = stripeSecretKey();

  if (!key) {
    throw new VanPlanError("STRIPE_SECRET_KEY is not configured.", 500);
  }

  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
      maxNetworkRetries: 2,
    });
  }

  return stripeClient;
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

function stripeErrorMessage(error: unknown) {
  if (error instanceof Stripe.errors.StripeError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Stripe invoice failed.";
}

export function canRetryVanPlanInvoice(invoice: VanPlanInvoice) {
  return invoice.status === "pending" || invoice.status === "failed";
}

export async function listItemInvoices(itemId: string) {
  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_invoices")
    .select(INVOICE_SELECT)
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
    (invoice) =>
      (invoice.status === "sent" || invoice.status === "paid") &&
      invoice.amountCents === winningBid.amountCents,
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
    .select(INVOICE_SELECT)
    .single<InvoiceRow>();

  if (invoiceInsertError || !invoiceRow) {
    throw new VanPlanError("Item was marked sold, but the invoice record failed.", 500);
  }

  return sendStripeInvoice({
    invoice: mapInvoice(invoiceRow),
    itemName: item.name,
  });
}

export async function retryStripeInvoice(invoiceId: string) {
  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_invoices")
    .select(INVOICE_SELECT)
    .eq("id", invoiceId)
    .maybeSingle<InvoiceRow>();

  if (error || !data) {
    throw new VanPlanError("Invoice not found.", 404);
  }

  if (data.status === "paid" || data.status === "voided" || data.status === "uncollectible") {
    return mapInvoice(data);
  }

  if (data.status === "sent" && data.stripe_invoice_id) {
    return mapInvoice(data);
  }

  const item = await getVanPlanItemById(data.item_id);

  return sendStripeInvoice({
    invoice: mapInvoice(data),
    itemName: item.name,
  });
}

async function sendStripeInvoice({
  invoice,
  itemName,
}: {
  invoice: VanPlanInvoice;
  itemName: string;
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
    const winner = await getWinnerProfile(invoice.userId);
    const stripe = getStripe();
    const customerId =
      invoice.stripeCustomerId ??
      (await findOrCreateStripeCustomer(winner));
    const stripeInvoice = invoice.stripeInvoiceId
      ? await stripe.invoices.retrieve(invoice.stripeInvoiceId)
      : await createStripeInvoice({
          invoice,
          itemName,
          customerId,
        });

    if (stripeInvoice.status === "paid") {
      return persistInvoiceRow({
        invoice,
        status: "paid",
        stripeCustomerId: customerId,
        stripeInvoiceId: stripeInvoice.id,
        stripeInvoiceUrl:
        stripeInvoice.hosted_invoice_url ?? invoice.stripeInvoiceUrl ?? null,
        errorMessage: null,
      });
    }

    if (stripeInvoice.status === "void") {
      return persistInvoiceRow({
        invoice,
        status: "voided",
        stripeCustomerId: customerId,
        stripeInvoiceId: stripeInvoice.id,
        stripeInvoiceUrl:
        stripeInvoice.hosted_invoice_url ?? invoice.stripeInvoiceUrl ?? null,
        errorMessage: null,
      });
    }

    if (stripeInvoice.status === "uncollectible") {
      return persistInvoiceRow({
        invoice,
        status: "uncollectible",
        stripeCustomerId: customerId,
        stripeInvoiceId: stripeInvoice.id,
        stripeInvoiceUrl:
        stripeInvoice.hosted_invoice_url ?? invoice.stripeInvoiceUrl ?? null,
        errorMessage: null,
      });
    }

    await persistInvoiceRow({
      invoice,
      status: invoice.status === "failed" ? "pending" : invoice.status,
      stripeCustomerId: customerId,
      stripeInvoiceId: stripeInvoice.id,
      stripeInvoiceUrl:
        stripeInvoice.hosted_invoice_url ?? invoice.stripeInvoiceUrl ?? null,
      errorMessage: null,
    });

    const sentInvoice =
      stripeInvoice.status === "draft"
        ? await stripe.invoices.sendInvoice(stripeInvoice.id, undefined, {
            idempotencyKey: `van-plan-inv-send-${invoice.id}`,
          })
        : stripeInvoice.status === "open"
          ? await stripe.invoices.sendInvoice(stripeInvoice.id)
          : stripeInvoice;

    return persistInvoiceRow({
      invoice,
      status: "sent",
      stripeCustomerId: customerId,
      stripeInvoiceId: sentInvoice.id,
      stripeInvoiceUrl:
        sentInvoice.hosted_invoice_url ?? stripeInvoice.hosted_invoice_url ?? null,
      errorMessage: null,
    });
  } catch (error) {
    const message = stripeErrorMessage(error);

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

async function createStripeInvoice({
  invoice,
  itemName,
  customerId,
}: {
  invoice: VanPlanInvoice;
  itemName: string;
  customerId: string;
}) {
  const stripe = getStripe();
  const created = await stripe.invoices.create(
    {
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: 14,
      auto_advance: false,
      currency: "usd",
      description: VAN_PLAN_PAYMENT_MEMO,
      footer: VAN_PLAN_PAYMENT_MEMO,
      statement_descriptor: "GREAT VAN PLAN",
      custom_fields: [
        {
          name: "Memo",
          value: VAN_PLAN_PAYMENT_MEMO,
        },
      ],
      metadata: {
        memo: VAN_PLAN_PAYMENT_MEMO,
        item_id: invoice.itemId,
        van_plan_invoice_id: invoice.id,
        auction: VAN_PLAN_TITLE,
      },
    },
    { idempotencyKey: `van-plan-inv-create-${invoice.id}` },
  );

  const lineCount = created.lines?.data?.length ?? 0;

  if (lineCount > 0) {
    return created;
  }

  return stripe.invoices.addLines(
    created.id,
    {
      lines: [
        {
          amount: invoice.amountCents,
          description: `${itemName} — ${VAN_PLAN_TITLE} Silent Auction`,
        },
      ],
    },
    { idempotencyKey: `van-plan-inv-lines-${invoice.id}` },
  );
}

async function persistInvoiceRow({
  invoice,
  status,
  stripeCustomerId,
  stripeInvoiceId,
  stripeInvoiceUrl,
  errorMessage,
}: {
  invoice: VanPlanInvoice;
  status: VanPlanInvoiceStatus;
  stripeCustomerId: string | null;
  stripeInvoiceId: string | null;
  stripeInvoiceUrl: string | null;
  errorMessage: string | null;
}) {
  const db = vanPlanDb();
  const { error } = await db
    .from("van_plan_invoices")
    .update({
      status,
      stripe_customer_id: stripeCustomerId,
      stripe_invoice_id: stripeInvoiceId,
      stripe_invoice_url: stripeInvoiceUrl,
      error_message: errorMessage,
    })
    .eq("id", invoice.id);

  if (error) {
    throw new VanPlanError("Unable to save the Stripe invoice.", 500);
  }

  return {
    ...invoice,
    status,
    stripeCustomerId,
    stripeInvoiceId,
    stripeInvoiceUrl,
    errorMessage,
  };
}

async function getWinnerProfile(userId: string): Promise<WinnerProfile> {
  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_users")
    .select("name, email, phone, address_line1, address_line2, city, state, zip")
    .eq("id", userId)
    .maybeSingle<{
      name: string;
      email: string;
      phone: string;
      address_line1: string | null;
      address_line2: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    }>();

  if (error || !data) {
    throw new VanPlanError("Unable to find the winning bidder for this invoice.");
  }

  return {
    name: data.name,
    email: data.email,
    phone: data.phone,
    addressLine1: data.address_line1 ?? "",
    addressLine2: data.address_line2 ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    zip: data.zip ?? "",
  };
}

async function findOrCreateStripeCustomer(winner: WinnerProfile) {
  const stripe = getStripe();
  const existing = await stripe.customers.list({
    email: winner.email,
    limit: 1,
  });

  const address = winner.addressLine1
    ? {
        line1: winner.addressLine1,
        line2: winner.addressLine2 || undefined,
        city: winner.city || undefined,
        state: winner.state || undefined,
        postal_code: winner.zip || undefined,
        country: "US",
      }
    : undefined;

  if (existing.data[0]?.id) {
    const customer = await stripe.customers.update(existing.data[0].id, {
      name: winner.name,
      phone: winner.phone,
      address,
      metadata: {
        memo: VAN_PLAN_PAYMENT_MEMO,
        auction: VAN_PLAN_TITLE,
      },
    });

    return customer.id;
  }

  const customer = await stripe.customers.create({
    email: winner.email,
    name: winner.name,
    phone: winner.phone,
    address,
    description: VAN_PLAN_PAYMENT_MEMO,
    metadata: {
      memo: VAN_PLAN_PAYMENT_MEMO,
      auction: VAN_PLAN_TITLE,
    },
  });

  return customer.id;
}

export function constructStripeWebhookEvent(payload: string, signature: string) {
  const secret = stripeWebhookSecret();

  if (!secret) {
    throw new VanPlanError("STRIPE_WEBHOOK_SECRET is not configured.", 500);
  }

  return getStripe().webhooks.constructEvent(payload, signature, secret);
}

export async function applyStripeInvoiceEvent(event: Stripe.Event) {
  if (
    event.type !== "invoice.paid" &&
    event.type !== "invoice.payment_failed" &&
    event.type !== "invoice.voided" &&
    event.type !== "invoice.marked_uncollectible" &&
    event.type !== "invoice.sent"
  ) {
    return;
  }

  const stripeInvoice = event.data.object as Stripe.Invoice;
  const localId = stripeInvoice.metadata?.van_plan_invoice_id ?? "";
  const db = vanPlanDb();
  let query = db.from("van_plan_invoices").select(INVOICE_SELECT);

  if (localId) {
    query = query.eq("id", localId);
  } else if (stripeInvoice.id) {
    query = query.eq("stripe_invoice_id", stripeInvoice.id);
  } else {
    return;
  }

  const { data, error } = await query.maybeSingle<InvoiceRow>();

  if (error || !data) {
    return;
  }

  const nextStatus: VanPlanInvoiceStatus =
    event.type === "invoice.paid"
      ? "paid"
      : event.type === "invoice.voided"
        ? "voided"
        : event.type === "invoice.marked_uncollectible"
          ? "uncollectible"
          : data.status === "pending" || data.status === "failed"
            ? "sent"
            : data.status;

  const errorMessage =
    event.type === "invoice.payment_failed"
      ? "The bidder’s payment attempt failed. The invoice is still open."
      : null;

  const { error: updateError } = await db
    .from("van_plan_invoices")
    .update({
      status: nextStatus,
      stripe_invoice_id: stripeInvoice.id,
      stripe_invoice_url: stripeInvoice.hosted_invoice_url ?? data.stripe_invoice_url,
      error_message: errorMessage,
    })
    .eq("id", data.id);

  if (updateError) {
    throw new VanPlanError("Unable to update that invoice from Stripe.", 500);
  }

  const item = await getVanPlanItemById(data.item_id).catch(() => null);

  revalidatePath(`${VAN_PLAN_BASE_PATH}/admin`);
  revalidatePath(`${VAN_PLAN_BASE_PATH}/admin/items/${data.item_id}`);

  if (item) {
    revalidatePath(`${VAN_PLAN_BASE_PATH}/items/${item.slug}`);
  }
}
