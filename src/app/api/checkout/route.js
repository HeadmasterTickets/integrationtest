import { NextResponse } from "next/server";
import { getProductTypeDetails } from "@/lib/bemyguest";
import {
  normalizeProductTypePaxConstraints,
  validateTicketSelectionAgainstPaxConstraints,
} from "@/lib/bemyguest-normalizers";
import { getStripeClient } from "@/lib/stripe";
import { getStripePriceId } from "@/lib/stripe-catalog";

const METADATA_SCHEMA_VERSION = "1.0";
/** Stripe metadata: max 50 keys per object; each value max 500 chars. */
const METADATA_MAX_LENGTH = 500;
const METADATA_MAX_KEYS = 50;
const METADATA_RESERVED_KEYS = 15;
const METADATA_ROUTE_KEY = "integration";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://integrationtest-three.vercel.app";
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

/**
 * One row per checkout line item (multiple products / variants per order).
 * Stripe line_items drive payment; this mirrors IDs for fulfillment webhooks.
 */
function buildCartLines(items, priceMap) {
  return items.map((item) => {
    const key = `${item.productUuid}:${item.productTypeUuid}`;
    return {
      productUuid: item.productUuid,
      productTypeUuid: item.productTypeUuid,
      productName: item.productName,
      productTypeName: item.productTypeName,
      quantity: item.quantity,
      travelDate: item.travelDate || "",
      timeslotUuid: item.timeslotUuid || "",
      timeslotTime: item.timeslotTime || "",
      ticketBreakdown: item.ticketBreakdown || [],
      selected_options: item.selectedOptions || [],
      stripe_catalog_price_id: priceMap[key] || "",
    };
  });
}

function flattenSelectedOptions(items) {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const options = Array.isArray(item?.selectedOptions) ? item.selectedOptions : [];
    return options.map((entry) => ({
      ...entry,
      productUuid: item.productUuid || "",
      productTypeUuid: item.productTypeUuid || "",
      travelDate: item.travelDate || "",
      timeslotUuid: item.timeslotUuid || "",
      timeslotTime: item.timeslotTime || "",
    }));
  });
}

function groupOptionsByScope(items) {
  const all = flattenSelectedOptions(items);
  const perBooking = [];
  const perPax = [];
  for (const entry of all) {
    const normalized = {
      uuid: entry.uuid || "",
      scope: entry.scope || "per_booking",
      name: entry.name || "",
      value: entry.value ?? "",
      required: Boolean(entry.required),
      inputType: entry.inputType || "text",
      semanticType: entry.semanticType || "",
      guestIndex: Number.isFinite(Number(entry.guestIndex)) ? Number(entry.guestIndex) : null,
      guestLabel: entry.guestLabel || "",
      productUuid: entry.productUuid || "",
      productTypeUuid: entry.productTypeUuid || "",
      travelDate: entry.travelDate || "",
      timeslotUuid: entry.timeslotUuid || "",
      timeslotTime: entry.timeslotTime || "",
    };
    if (!normalized.uuid || String(normalized.value).trim() === "") continue;
    if (normalized.scope === "per_pax") {
      perPax.push(normalized);
    } else {
      perBooking.push(normalized);
    }
  }
  return { perBooking, perPax };
}

function normalizeOptionNameKey(name) {
  return String(name || "").toLowerCase();
}

function findOptionValueByPatterns(entries, patterns) {
  for (const pattern of patterns) {
    const hit = (entries || []).find((entry) =>
      pattern.test(normalizeOptionNameKey(entry?.name)),
    );
    const value = String(hit?.value ?? "").trim();
    if (value) return value;
  }
  return "";
}

/**
 * Map BMG per-booking / per-pax option labels to customer_first_name / customer_last_name
 * when the checkout form did not collect Stripe customer name fields.
 */
function deriveCustomerNamesFromBmgOptions(perBooking, perPax) {
  const leadPax = (perPax || []).filter((entry) => Number(entry?.guestIndex) === 0);
  const booking = perBooking || [];
  const allLead = [...leadPax, ...booking];

  let firstName = findOptionValueByPatterns(allLead, [
    /first\s*name/,
    /given\s*name/,
    /^first$/i,
  ]);
  let lastName = findOptionValueByPatterns(allLead, [
    /last\s*name/,
    /surname/,
    /family\s*name/,
    /^last$/i,
  ]);

  if (!firstName && !lastName) {
    const full = findOptionValueByPatterns(allLead, [
      /full\s*name/,
      /^name$/i,
      /passenger\s*name/,
      /traveller\s*name/,
      /traveler\s*name/,
      /guest\s*name/,
      /lead\s*(passenger|guest)?\s*name/,
      /primary\s*contact/,
      /contact\s*name/,
    ]);
    if (full) {
      const parts = full.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
      } else {
        firstName = full;
      }
    }
  }

  return { firstName: firstName || "", lastName: lastName || "" };
}

function buildBmgTravelersGrouped(perPax) {
  const map = new Map();
  for (const entry of perPax || []) {
    const guestIndex = Number.isFinite(Number(entry?.guestIndex))
      ? Number(entry.guestIndex)
      : 0;
    if (!map.has(guestIndex)) {
      map.set(guestIndex, {
        guest_index: guestIndex,
        guest_label: entry?.guestLabel || `Guest ${guestIndex + 1}`,
        options: [],
      });
    }
    map.get(guestIndex).options.push({
      uuid: entry?.uuid || "",
      name: entry?.name || "",
      value: String(entry?.value ?? "").trim(),
      required: Boolean(entry?.required),
      inputType: entry?.inputType || "text",
      semanticType: entry?.semanticType || "",
    });
  }
  return Array.from(map.values()).sort((a, b) => a.guest_index - b.guest_index);
}

/**
 * Map common booking-option labels to top-level hotel / transfer fields for systems
 * that only read those keys. All raw rows remain in bmg_options_per_*.
 */
function extractLodgingAndTransferFromOptions(perBooking) {
  const list = perBooking || [];

  let preferred_pickup_time = findOptionValueByPatterns(list, [
    /preferred\s*(pickup|pick-up|collection|time)/i,
    /pickup\s*time/i,
    /collection\s*time/i,
    /meeting\s*time/i,
    /^pickup$/i,
    /^pick-up$/i,
  ]);
  if (!preferred_pickup_time) {
    preferred_pickup_time = findOptionValueByPatterns(list, [
      /pickup|pick-up|preferred/i,
    ]);
  }

  let hotel_name = findOptionValueByPatterns(list, [
    /hotel\s*name/i,
    /name\s*of\s*(the\s*)?hotel/i,
    /accommodation\s*name/i,
    /property\s*name/i,
    /resort\s*name/i,
    /where\s*are\s*you\s*staying/i,
    /^hotel$/i,
  ]);
  if (!hotel_name) {
    const hotelish = list.find(
      (entry) =>
        /hotel|accommodation|property|resort/i.test(String(entry?.name || "")) &&
        String(entry?.value ?? "").trim(),
    );
    hotel_name = hotelish ? String(hotelish.value).trim() : "";
  }

  let hotel_address = findOptionValueByPatterns(list, [
    /hotel\s*address/i,
    /pick-?up\s*(location|address)/i,
    /drop-?off\s*(location|address)?/i,
    /accommodation\s*address/i,
    /stay\s*address/i,
    /full\s*address/i,
  ]);
  if (!hotel_address) {
    const addrish = list.find((entry) => {
      const name = String(entry?.name || "");
      const value = String(entry?.value ?? "").trim();
      if (!value) return false;
      return (
        /address|location/i.test(name) &&
        !/^hotel$/i.test(name) &&
        !/hotel\s*name|accommodation\s*name|property\s*name/i.test(name)
      );
    });
    hotel_address = addrish ? String(addrish.value).trim() : "";
  }

  return { preferred_pickup_time, hotel_name, hotel_address };
}

function deriveLeadTravelerDisplayName(firstName, lastName, perBooking, perPax) {
  const combined = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  const lead = (perPax || []).filter((entry) => Number(entry?.guestIndex) === 0);
  const fullFromLead = lead.find((entry) =>
    /full\s*name|passenger|traveller|traveler|^name$/i.test(String(entry?.name || "")),
  );
  const fromLead = String(fullFromLead?.value ?? "").trim();
  if (fromLead) return fromLead;
  return findOptionValueByPatterns(perBooking || [], [
    /full\s*name/,
    /^name$/i,
    /contact\s*name/,
  ]);
}

function getTicketCountByCategory(ticketBreakdown, category) {
  if (!Array.isArray(ticketBreakdown)) return 0;
  return ticketBreakdown.reduce((sum, entry) => {
    if (String(entry?.category || "").toLowerCase() !== category) return sum;
    return sum + (Math.max(0, Number(entry?.quantity) || 0));
  }, 0);
}

function getTicketCountByCategoryAcrossItems(items, category) {
  if (!Array.isArray(items)) return 0;
  return items.reduce(
    (sum, item) => sum + getTicketCountByCategory(item?.ticketBreakdown, category),
    0,
  );
}

function getTotalQuantityAcrossItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (Math.max(0, Number(item?.quantity) || 0)), 0);
}

function getPrimaryTimeslot(items) {
  if (!Array.isArray(items)) {
    return { uuid: "", time: "" };
  }
  const withTimeslot = items.find((item) => item?.timeslotUuid || item?.timeslotTime);
  if (!withTimeslot) {
    return { uuid: "", time: "" };
  }
  return {
    uuid: withTimeslot.timeslotUuid || "",
    time: withTimeslot.timeslotTime || "",
  };
}

function createSchemaPayload({ items, priceMap, baseUrl, orderId, body }) {
  const primary = items[0];
  const primaryKey = `${primary.productUuid}:${primary.productTypeUuid}`;
  const primaryPriceId = priceMap[primaryKey] || "";
  const cartLines = buildCartLines(items, priceMap);
  const arrivalDate = primary.travelDate || "";
  const primaryTimeslot = getPrimaryTimeslot(items);
  const groupedOptions = groupOptionsByScope(items);
  const perBookingForPayload = Array.isArray(body?.bmg_options_per_booking)
    ? body.bmg_options_per_booking
    : groupedOptions.perBooking;
  const perPaxForPayload = Array.isArray(body?.bmg_options_per_pax)
    ? body.bmg_options_per_pax
    : groupedOptions.perPax;
  const derivedFromBmg = deriveCustomerNamesFromBmgOptions(
    perBookingForPayload,
    perPaxForPayload,
  );
  const bmg_travelers = buildBmgTravelersGrouped(perPaxForPayload);
  const bmg_lead_traveler_display_name = deriveLeadTravelerDisplayName(
    derivedFromBmg.firstName,
    derivedFromBmg.lastName,
    perBookingForPayload,
    perPaxForPayload,
  );
  const transferDetails = extractLodgingAndTransferFromOptions(perBookingForPayload);
  const bmg_all_product_options = [...perBookingForPayload, ...perPaxForPayload];
  const customer = body?.customer || {};
  const tracking = body?.tracking || {};
  const session = body?.session || {};
  const pricing = body?.pricing || {};
  const pax = body?.pax || {};
  const environment = body?.environment || "demo";

  const adultsFromTickets = getTicketCountByCategoryAcrossItems(items, "adult");
  const childrenFromTickets = getTicketCountByCategoryAcrossItems(items, "child");
  const infantsFromTickets = getTicketCountByCategoryAcrossItems(items, "infant");
  const seniorsFromTickets = getTicketCountByCategoryAcrossItems(items, "senior");
  const totalQuantityAcrossItems = getTotalQuantityAcrossItems(items);
  const hasExplicitCategoryCounts =
    adultsFromTickets + childrenFromTickets + infantsFromTickets + seniorsFromTickets > 0;

  const adults = asNumber(
    pax.adults,
    hasExplicitCategoryCounts ? adultsFromTickets : totalQuantityAcrossItems || primary.quantity,
  );
  const children = asNumber(pax.children, childrenFromTickets);
  const infants = asNumber(pax.infants, infantsFromTickets);
  const seniors = asNumber(pax.seniors, seniorsFromTickets);
  const totalPax = adults + children + infants + seniors;

  // Field order matches integration contract / Stripe payload JSON schema.
  return {
    schema_version: METADATA_SCHEMA_VERSION,
    environment,
    site: body?.site || baseUrl || "",
    site_name: body?.site_name || "TicketFlow",
    booking_product: body?.booking_product || primary.productName || "",
    order_id: orderId,
    partner_reference: orderId,
    bmg_supplier: body?.bmg_supplier || "",
    bmg_product_uuid: primary.productUuid,
    bmg_product_type_uuid: primary.productTypeUuid,
    bmg_product_name: primary.productName || "",
    bmg_instant_confirmation: Boolean(body?.bmg_instant_confirmation || false),
    bmg_direct_admission: Boolean(body?.bmg_direct_admission || false),
    arrival_date: arrivalDate,
    arrival_date_display: arrivalDate,
    days_until_arrival: computeDaysUntilArrival(arrivalDate),
    timeslot_uuid: body?.timeslot_uuid || primaryTimeslot.uuid,
    timeslot_time: body?.timeslot_time || primaryTimeslot.time,
    preferred_pickup_time: body?.preferred_pickup_time || transferDetails.preferred_pickup_time,
    hotel_name: body?.hotel_name || transferDetails.hotel_name,
    hotel_address: body?.hotel_address || transferDetails.hotel_address,
    adults,
    children,
    infants,
    seniors,
    total_pax: totalPax,
    ticket_label: primary.productTypeName || "",
    customer_email: customer.email || "",
    customer_first_name: customer.first_name || derivedFromBmg.firstName || "",
    customer_last_name: customer.last_name || derivedFromBmg.lastName || "",
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
    bmg_options_per_booking: perBookingForPayload,
    bmg_options_per_pax: perPaxForPayload,
    /** Single list of every product option row (per-booking then per-pax) for fulfillment. */
    bmg_all_product_options,
    bmg_lead_traveler_display_name,
    bmg_travelers,
    meeting_point: body?.meeting_point || "",
    support_email: body?.support_email || "",
    operator_name: body?.operator_name || "",
    cart: cartLines,
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
  if (METADATA_RESERVED_KEYS + chunks.length > METADATA_MAX_KEYS) {
    throw new Error(
      `Booking metadata too large for Stripe (${chunks.length} chunks; max ${METADATA_MAX_KEYS - METADATA_RESERVED_KEYS}). Shorten cart or optional fields.`,
    );
  }

  const metadata = {
    route_key: asMeta(METADATA_ROUTE_KEY),
    schema_version: asMeta(schemaPayload.schema_version),
    environment: asMeta(schemaPayload.environment),
    order_id: asMeta(schemaPayload.order_id),
    partner_reference: asMeta(schemaPayload.partner_reference),
    bmg_product_uuid: asMeta(schemaPayload.bmg_product_uuid),
    bmg_product_type_uuid: asMeta(schemaPayload.bmg_product_type_uuid),
    arrival_date: asMeta(schemaPayload.arrival_date),
    timeslot_uuid: asMeta(schemaPayload.timeslot_uuid),
    timeslot_time: asMeta(schemaPayload.timeslot_time),
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
    .map((item) => {
      const ticketBreakdown = Array.isArray(item?.ticketBreakdown)
        ? item.ticketBreakdown
            .map((entry) => ({
              category: String(entry?.category || "").toLowerCase(),
              label: entry?.label || "",
              quantity: Math.max(0, Number(entry?.quantity) || 0),
            }))
            .filter((entry) => entry.category && entry.quantity > 0)
        : [];
      const breakdownTotal = ticketBreakdown.reduce((sum, entry) => sum + entry.quantity, 0);

      const selectedOptions = Array.isArray(item?.selectedOptions)
        ? item.selectedOptions
            .map((entry) => ({
              uuid: entry?.uuid || "",
              scope: entry?.scope || "per_booking",
              name: entry?.name || "",
              required: Boolean(entry?.required),
              inputType: entry?.inputType || "text",
              semanticType: entry?.semanticType || "",
              value: entry?.value ?? "",
              guestIndex:
                Number.isFinite(Number(entry?.guestIndex)) ? Number(entry.guestIndex) : null,
              guestLabel: entry?.guestLabel || "",
            }))
            .filter((entry) => entry.uuid && String(entry.value).trim() !== "")
        : [];

      // Backwards compatibility for cart rows created before API-driven options.
      if (selectedOptions.length === 0) {
        if (item?.preferredPickupTime) {
          selectedOptions.push({
            uuid: "legacy-preferred-pickup-time",
            scope: "per_booking",
            name: "Preferred pickup time",
            required: false,
            inputType: "text",
            value: item.preferredPickupTime,
          });
        }
        if (item?.hotelName) {
          selectedOptions.push({
            uuid: "legacy-hotel-name",
            scope: "per_booking",
            name: "Hotel name",
            required: false,
            inputType: "text",
            value: item.hotelName,
          });
        }
        if (item?.hotelAddress) {
          selectedOptions.push({
            uuid: "legacy-hotel-address",
            scope: "per_booking",
            name: "Hotel address",
            required: false,
            inputType: "text",
            value: item.hotelAddress,
          });
        }
      }

      return {
        ticketBreakdown,
        selectedOptions,
        productUuid: item?.productUuid,
        productTypeUuid: item?.productTypeUuid,
        quantity:
          breakdownTotal > 0 ? breakdownTotal : Math.max(1, Number(item?.quantity) || 1),
        productName: item?.productName || "Ticket product",
        productTypeName: item?.productTypeName || "Variant",
        travelDate: item?.travelDate || "",
        timeslotUuid: item?.timeslotUuid || "",
        timeslotTime: item?.timeslotTime || "",
      };
    })
    .filter((item) => item.productUuid && item.productTypeUuid);
}

async function assertCartItemsMeetPaxConstraints(items) {
  const typeUuids = [...new Set(items.map((item) => item.productTypeUuid).filter(Boolean))];
  const detailPayloads = await Promise.all(
    typeUuids.map((uuid) => getProductTypeDetails(uuid).catch(() => null)),
  );
  const constraintByTypeUuid = {};
  typeUuids.forEach((uuid, index) => {
    const constraints = normalizeProductTypePaxConstraints(detailPayloads[index]);
    if (constraints) {
      constraintByTypeUuid[uuid] = constraints;
    }
  });

  for (const item of items) {
    const constraints = constraintByTypeUuid[item.productTypeUuid];
    if (!constraints) continue;
    const { ok, message } = validateTicketSelectionAgainstPaxConstraints(
      item.ticketBreakdown,
      constraints,
    );
    if (!ok) {
      throw new Error(message);
    }
  }
}

export async function POST(request) {
  try {
    const stripe = getStripeClient();
    const body = await request.json();
    const items = normalizeItems(body?.items);

    if (items.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    await assertCartItemsMeetPaxConstraints(items);

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
