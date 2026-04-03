import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";

export async function POST(request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing stripe signature or webhook secret." },
      { status: 400 },
    );
  }

  try {
    const rawBody = await request.text();
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    // Placeholder for future fulfillment logic.
    if (event.type === "checkout.session.completed") {
      // Example: write booking/order rows in database.
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook signature failed." },
      { status: 400 },
    );
  }
}
