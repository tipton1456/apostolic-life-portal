import { NextResponse } from "next/server";
import {
  applyStripeInvoiceEvent,
  constructStripeWebhookEvent,
} from "@/lib/van-plan/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();
  let event;

  try {
    event = constructStripeWebhookEvent(payload, signature);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    await applyStripeInvoiceEvent(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to apply Stripe event.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
