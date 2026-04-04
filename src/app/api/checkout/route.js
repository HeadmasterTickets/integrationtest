import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { getStripePriceId } from "@/lib/stripe-catalog";

const METADATA_SCHEMA_VERSION = "1.0";
const METADATA_MAX_LENGTH = 500;
const METADATA_ROUTE_KEY = "integration";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function asMeta(value) {
  const stringValue =
    value === null || value === undefined ? "" : String(value);
  return stringValue.slice(0, METADATA_MAX_LENGTH);
}

function asNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function computeDaysUntilArrival(arrivalDate) {
  if (!arrivalDate) return 0;
  const now = new Date();
  const target = new Date(arrivalDate);
  if (Number.isNaN(target.getTime())) return 0;
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

function buildCartSummary(items) {
  return items.map((item) => ({
    productUuid: item.productUuid,
    productTypeUuid: item.productTypeUuid,
    quantity: item.quantity,
    travelDate: item.travelDate,
  }));
}

function createSchemaPayload({ items, priceMap, baseUrl, orderId, body }) {
  const primary = items[0];
  const primaryKey = `${primary.productUuid}:${primary.productTypeUuid}`;
  const primaryPriceId = priceMap[primaryKey] || "";
  const cartSummary = buildCartSummary(items);
  const arrivalDate = primary.travelDate || "";
  const customer = body?.customer || {};
  const tracking = body?.tracking || {};
  const session = body?.session || {};
  const pricing = body?.pricing || {};
  const pax = body?.pax || {};

  return {
    schema_version: METADATA_SCHEMA_VERSION,
    environment: "demo",
    site: baseUrl,
    site_name: "TicketFlow",
    booking_product: primary.productName,
    order_id: orderId,
    partner_reference: orderId,
    bmg_supplier: body?.bmg_supplier || "",
    bmg_product_uuid: primary.productUuid,
    bmg_product_type_uuid: primary.productTypeUuid,
    bmg_product_name: primary.productName,
    bmg_instant_confirmation: Boolean(body?.bmg_instant_confirmation || false),
    bmg_direct_admission: Boolean(body?.bmg_direct_admission || false),
    arrival_date: arrivalDate,
    arrival_date_display: arrivalDate,
    days_until_arrival: computeDaysUntilArrival(arrivalDate),
    timeslot_uuid: body?.timeslot_uuid || "",
    timeslot_time: body?.timeslot_time || "",
    adults: asNumber(pax.adults, primary.quantity),
    children: asNumber(pax.children, 0),
    infants: asNumber(pax.infants, 0),
    seniors: asNumber(pax.seniors, 0),
    total_pax:
      asNumber(pax.adults, primary.quantity) +
      asNumber(pax.children, 0) +
      asNumber(pax.infants, 0) +
      asNumber(pax.seniors, 0),
    ticket_label: primary.productTypeName,
    customer_email: customer.email || "",
    customer_first_name: customer.first_name || "",
    customer_last_name: customer.last_name || "",
    customer_phone: customer.phone || "",
    customer_locale: customer.locale || "",
    customer_timezone: customer.timezone || "",
    order_currency: pricing.order_currency || "EUR",
    order_amount_eur: asNumber(pricing.order_amount_eur, 0),
    adult_price_eur: asNumber(pricing.adult_price_eur, 0),
    child_price_eur: asNumber(pricing.child_price_eur, 0),
    bmg_adult_cost_sgd: asNumber(pricing.bmg_adult_cost_sgd, 0),
    bmg_child_cost_sgd: asNumber(pricing.bmg_child_cost_sgd, 0),
    bmg_total_cost_sgd: asNumber(pricing.bmg_total_cost_sgd, 0),
    bmg_currency: pricing.bmg_currency || "SGD",
    eur_sgd_rate: asNumber(pricing.eur_sgd_rate, 0),
    bmg_total_cost_eur: asNumber(pricing.bmg_total_cost_eur, 0),
    gross_margin_eur: asNumber(pricing.gross_margin_eur, 0),
    gross_margin_pct: asNumber(pricing.gross_margin_pct, 0),
    stripe_fee_eur: asNumber(pricing.stripe_fee_eur, 0),
    stripe_catalog_price_id_adult: primaryPriceId,
    stripe_catalog_price_id_child: body?.stripe_catalog_price_id_child || "",
    utm_source: tracking.utm_source || "",
    utm_medium: tracking.utm_medium || "",
    utm_campaign: tracking.utm_campaign || "",
    utm_content: tracking.utm_content || "",
    utm_term: tracking.utm_term || "",
    gclid: tracking.gclid || "",
    device_type: session.device_type || "",
    landing_page: session.landing_page || "",
    referrer_url: session.referrer_url || "",
    session_duration_seconds: asNumber(session.session_duration_seconds, 0),
    cancellation_policy: body?.cancellation_policy || "",
    is_non_refundable: Boolean(body?.is_non_refundable || false),
    bmg_options_per_booking: Array.isArray(body?.bmg_options_per_booking)
      ? body.bmg_options_per_booking
      : [],
    bmg_options_per_pax: Array.isArray(body?.bmg_options_per_pax)
      ? body.bmg_options_per_pax
      : [],
    meeting_point: body?.meeting_point || "",
    support_email: body?.support_email || "",
    operator_name: body?.operator_name || "",
    cart: cartSummary,
  };
}

function splitIntoMetadataChunks(json) {
  const chunks = [];
  for (let i = 0; i < json.length; i += METADATA_MAX_LENGTH) {
    chunks.push(json.slice(i, i + METADATA_MAX_LENGTH));
  }
  return chunks;
}

function createStripeMetadata(schemaPayload) {
  const payloadJson = JSON.stringify(schemaPayload);
  const chunks = splitIntoMetadataChunks(payloadJson);

  const metadata = {
    route_key: asMeta(METADATA_ROUTE_KEY),
    schema_version: asMeta(schemaPayload.schema_version),
    environment: asMeta(schemaPayload.environment),
    order_id: asMeta(schemaPayload.order_id),
    partner_reference: asMeta(schemaPayload.partner_reference),
    bmg_product_uuid: asMeta(schemaPayload.bmg_product_uuid),
    bmg_product_type_uuid: asMeta(schemaPayload.bmg_product_type_uuid),
    arrival_date: asMeta(schemaPayload.arrival_date),
    total_pax: asMeta(schemaPayload.total_pax),
    order_currency: asMeta(schemaPayload.order_currency),
    order_amount_eur: asMeta(schemaPayload.order_amount_eur),
    stripe_catalog_price_id_adult: asMeta(schemaPayload.stripe_catalog_price_id_adult),
    payload_parts: asMeta(chunks.length),
  };

  chunks.forEach((chunk, index) => {
    metadata[`payload_${index + 1}`] = chunk;
  });

  return metadata;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      productUuid: item?.productUuid,
      productTypeUuid: item?.productTypeUuid,
      quantity: Math.max(1, Number(item?.quantity) || 1),
      productName: item?.productName || "Ticket product",
      productTypeName: item?.productTypeName || "Variant",
      travelDate: item?.travelDate || "",
    }))
    .filter((item) => item.productUuid && item.productTypeUuid);
}

export async function POST(request) {
  try {
    const stripe = getStripeClient();
    const body = await request.json();
    const items = normalizeItems(body?.items);

    if (items.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    const priceMap = {};
    const lineItems = items.map((item) => {
      const priceId = getStripePriceId(item.productUuid, item.productTypeUuid);
      if (!priceId) {
        throw new Error(
          `No Stripe Price ID linked for ${item.productUuid} / ${item.productTypeUuid}.`,
        );
      }
      priceMap[`${item.productUuid}:${item.productTypeUuid}`] = priceId;

      return {
        price: priceId,
        quantity: item.quantity,
      };
    });

    const baseUrl = getBaseUrl();
    const successPath = process.env.STRIPE_CHECKOUT_SUCCESS_PATH || "/checkout/success";
    const cancelPath = process.env.STRIPE_CHECKOUT_CANCEL_PATH || "/checkout/cancel";
    const orderId = `tf_${Date.now()}`;
    const schemaPayload = createSchemaPayload({
      items,
      priceMap,
      baseUrl,
      orderId,
      body,
    });
    const metadata = createStripeMetadata(schemaPayload);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      allow_promotion_codes: true,
      success_url: `${baseUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${cancelPath}`,
      client_reference_id: orderId,
      metadata,
      payment_intent_data: {
        metadata,
      },
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe checkout failed." },
      { status: 400 },
    );
  }
}
