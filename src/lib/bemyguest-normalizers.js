export function pickText(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value.en || value["en-US"] || value.default || Object.values(value)[0] || null;
  }
  return null;
}

function toNumberOrNull(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return fallback;
  return Boolean(value);
}

function splitMultilineText(value) {
  if (!value || typeof value !== "string") return [];
  return value
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatDuration(hours, minutes) {
  const h = toNumberOrNull(hours) || 0;
  const m = toNumberOrNull(minutes) || 0;
  if (h <= 0 && m <= 0) return "";
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function normalizeLocationList(payload) {
  const locations = Array.isArray(payload?.data?.locations) ? payload.data.locations : [];
  return locations
    .map((location) => {
      const pieces = [location?.city, location?.state, location?.country].filter(Boolean);
      return {
        city: location?.city || "",
        state: location?.state || "",
        country: location?.country || "",
        label: pieces.join(", "),
      };
    })
    .filter((location) => location.label);
}

function normalizeLanguageLabels(payload, key) {
  const items = Array.isArray(payload?.data?.[key]) ? payload.data[key] : [];
  return items
    .map((entry) => pickText(entry?.name) || "")
    .filter(Boolean)
    .map((label) =>
      label
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    );
}

function normalizePhotoUrls(payload) {
  const data = payload?.data || {};
  const photosUrl = data?.photosUrl || "";
  const photos = Array.isArray(data?.photos) ? data.photos : [];
  return photos
    .map((photo) => {
      const paths = photo?.paths || {};
      const preferred =
        paths["1280x720"] ||
        paths["680x325"] ||
        paths["175x112"] ||
        paths["75x50"] ||
        paths.original ||
        "";
      if (!preferred) return "";
      if (preferred.startsWith("http://") || preferred.startsWith("https://")) return preferred;
      return photosUrl ? `${photosUrl}${preferred}` : preferred;
    })
    .filter(Boolean);
}

export function pickProductName(payload) {
  return (
    pickText(
      payload?.data?.title ||
        payload?.title ||
        payload?.name ||
        payload?.data?.name ||
        payload?.product?.name ||
        payload?.data?.product?.name,
    ) || "Unknown product name"
  );
}

export function normalizeProductTypes(payload) {
  const candidates = [
    ...(Array.isArray(payload) ? payload : []),
    ...(Array.isArray(payload?.data) ? payload.data : []),
    ...(Array.isArray(payload?.items) ? payload.items : []),
    ...(Array.isArray(payload?.productTypes) ? payload.productTypes : []),
    ...(Array.isArray(payload?.data?.productTypes) ? payload.data.productTypes : []),
    ...(Array.isArray(payload?.data?.items) ? payload.data.items : []),
  ];

  return candidates.map((item) => ({
    uuid: item?.uuid || item?.id || "Unknown UUID",
    name:
      pickText(item?.title || item?.name || item?.label) || "Unnamed variant",
  }));
}

export function normalizeProductLocations(payload) {
  const locations = payload?.data?.locations;
  if (!Array.isArray(locations)) return [];

  return locations.map((location) => ({
    city: location?.city || "Unknown city",
    cityUuid: location?.cityUuid || "",
    state: location?.state || "Unknown state",
    stateUuid: location?.stateUuid || "",
    country: location?.country || "Unknown country",
    countryUuid: location?.countryUuid || "",
  }));
}

export function normalizeProductConsumerDetails(productPayload) {
  const data = productPayload?.data || {};
  const currency = data?.currency || {};
  return {
    title: pickProductName(productPayload),
    shortDescription: pickText(data?.descriptionTranslated || data?.description) || "",
    highlights: splitMultilineText(data?.highlightsTranslated || data?.highlights),
    additionalInfo: splitMultilineText(data?.additionalInfoTranslated || data?.additionalInfo),
    inclusions: splitMultilineText(data?.priceIncludesTranslated || data?.priceIncludes),
    exclusions: splitMultilineText(data?.priceExcludesTranslated || data?.priceExcludes),
    warnings: splitMultilineText(data?.warningsTranslated || data?.warnings),
    itinerary: splitMultilineText(data?.itineraryTranslated || data?.itinerary),
    safety: splitMultilineText(data?.safetyTranslated || data?.safety),
    basePrice: toNumberOrNull(data?.basePrice),
    currencyCode: currency?.code || "",
    currencySymbol: currency?.symbol || "",
    minPax: toNumberOrNull(data?.minPax),
    maxPax: toNumberOrNull(data?.maxPax),
    averageDeliveryMinutes: toNumberOrNull(data?.averageDelivery),
    businessHoursFrom: data?.businessHoursFrom || "",
    businessHoursTo: data?.businessHoursTo || "",
    address: data?.address || "",
    coordinates:
      data?.latitude && data?.longitude ? `${data.latitude}, ${data.longitude}` : "",
    locations: normalizeLocationList(productPayload),
    guideLanguages: normalizeLanguageLabels(productPayload, "guideLanguages"),
    audioLanguages: normalizeLanguageLabels(productPayload, "audioHeadsetLanguages"),
    writtenLanguages: normalizeLanguageLabels(productPayload, "writtenLanguages"),
    translatedLanguages: normalizeLanguageLabels(productPayload, "translationLanguages"),
    hasHotelPickup: toBoolean(data?.hotelPickup, false),
    hasAirportPickup: toBoolean(data?.airportPickup, false),
    images: normalizePhotoUrls(productPayload),
  };
}

function mapOptionInputType(inputType) {
  // BMG option inputType values seen in demo APIs:
  // 4=text, 9=textarea-like, 10=time.
  const code = toNumberOrNull(inputType);
  if (code === 10) return "time";
  if (code === 9) return "textarea";
  if (code === 5 || code === 6 || code === 7) return "number";
  return "text";
}

/**
 * Turns BMG `formatRegex` into short user-facing copy when we recognize the pattern.
 */
function humanizeBmgFormatRegex(formatRegex) {
  if (!formatRegex || typeof formatRegex !== "string") return "";
  const compact = formatRegex.replace(/\s/g, "");
  if (/\\d\{2\}\/\\d\{2\}\/\\d\{4\}/.test(compact)) {
    return "Use DD/MM/YYYY with slashes (e.g. 15/03/2028).";
  }
  if (/\\d\{4\}-\\d\{2\}-\\d\{2\}/.test(compact)) {
    return "Use YYYY-MM-DD with hyphens (e.g. 2028-03-15).";
  }
  if (/\\d\{2\}-\\d\{2\}-\\d\{4\}/.test(compact)) {
    return "Use DD-MM-YYYY with hyphens (e.g. 15-03-2028).";
  }
  if (/\\d\{8\}/.test(compact)) {
    return "Use 8 digits with no separators if required (often DDMMYYYY).";
  }
  return "";
}

function buildBmgFormatHint(formatRegex) {
  return humanizeBmgFormatRegex(formatRegex);
}

function detectOptionSemanticType(name, description) {
  const text = `${name || ""} ${description || ""}`.toLowerCase().trim();
  if (!text) return null;
  // Passport / visa / travel-document expiry: free-text dates (DD/MM/YYYY with slashes), not native date input.
  const expiryContext =
    /\bpassport\b/i.test(text) ||
    /\bvisa\b/i.test(text) ||
    /\btravel\s*document\b/i.test(text);
  const expiryWord =
    text.includes("expir") ||
    text.includes("expiration") ||
    text.includes("expiry") ||
    /\bvalid\s*(until|to|thru|through)\b/i.test(text);
  if (expiryContext && expiryWord) {
    return "passport_expiry";
  }
  if (
    text.includes("date of birth") ||
    text.includes("birth date") ||
    text.includes("birthdate") ||
    /\bdob\b/i.test(text)
  ) {
    return "dob";
  }
  if (/\bgender\b/i.test(text) || /\bsex\b/i.test(text)) {
    return "gender";
  }
  return null;
}

function normalizeOptionScope(entries, scope) {
  if (!Array.isArray(entries)) return [];
  return entries.map((option) => {
    const name = pickText(option?.nameTranslated || option?.name) || "Option";
    const description = pickText(option?.descriptionTranslated || option?.description) || "";
    return {
      scope,
      uuid: option?.uuid || "",
      name,
      description,
      semanticType: detectOptionSemanticType(name, description),
      required: toBoolean(option?.required, false),
      addOn: toBoolean(option?.addOn, false),
      inputTypeCode: toNumberOrNull(option?.inputType),
      inputType: mapOptionInputType(option?.inputType),
      minNumber: toNumberOrNull(option?.minNumber),
      maxNumber: toNumberOrNull(option?.maxNumber),
      formatRegex: option?.formatRegex || "",
      bmgFormatHint: buildBmgFormatHint(option?.formatRegex || ""),
      validFrom: option?.validFrom || "",
      validTo: option?.validTo || "",
      price: toNumberOrNull(option?.price),
      values: Array.isArray(option?.values)
        ? option.values
            .map((value) => ({
              value: value?.value || value?.uuid || "",
              label: pickText(value?.label || value?.name) || value?.value || "",
            }))
            .filter((value) => value.value || value.label)
        : [],
    };
  });
}

export function normalizeProductTypeOptions(productTypePayload) {
  const data = productTypePayload?.data || {};
  const perBooking = normalizeOptionScope(data?.options?.perBooking, "per_booking");
  const perPax = normalizeOptionScope(data?.options?.perPax, "per_pax");
  return {
    hasOptions: toBoolean(data?.hasOptions, false),
    hasFileUploadOptions: toBoolean(data?.hasFileUploadOptions, false),
    hasPriceOptions: toBoolean(data?.hasPriceOptions, false),
    hasRequiredPriceOptions: toBoolean(data?.hasRequiredPriceOptions, false),
    perBooking,
    perPax,
    requiredPerBooking: perBooking.filter((option) => option.required),
    requiredPerPax: perPax.filter((option) => option.required),
    all: [...perBooking, ...perPax],
  };
}

export function normalizeProductTypeCommercialDetails(productTypePayload) {
  const data = productTypePayload?.data || {};
  const ticketTypes = Array.isArray(data?.ticketTypes)
    ? data.ticketTypes.filter((ticketType) => ticketType?.allowed)
    : [];

  const recommendedMarkup = toNumberOrNull(data?.recommendedMarkup);
  const topTicketMarkup = ticketTypes
    .map((ticketType) => toNumberOrNull(ticketType?.recommendedMarkup))
    .find((value) => value !== null);
  const displayMarkup = recommendedMarkup ?? topTicketMarkup;

  const durationLabel = formatDuration(data?.durationHours, data?.durationMinutes);

  return {
    title: pickText(data?.titleTranslated || data?.title) || "",
    description: pickText(data?.descriptionTranslated || data?.description) || "",
    durationDays: toNumberOrNull(data?.durationDays),
    durationHours: toNumberOrNull(data?.durationHours),
    durationMinutes: toNumberOrNull(data?.durationMinutes),
    durationLabel,
    firstAvailabilityDate: data?.firstAvailabilityDate || "",
    timezone: data?.timezone || "",
    instantConfirmation: toBoolean(data?.instantConfirmation, false),
    directAdmission: toBoolean(data?.directAdmission, false),
    voucherRequiresPrinting: toBoolean(data?.voucherRequiresPrinting, false),
    isNonRefundable: toBoolean(data?.isNonRefundable, false),
    cancellationPolicySummary: data?.cancellationPolicySummary || "",
    meetingLocation:
      pickText(data?.meetingLocationTranslated || data?.meetingLocation) || "",
    meetingAddress:
      pickText(data?.meetingAddressTranslated || data?.meetingAddress) || "",
    meetingTime: data?.meetingTime || "",
    minPax: toNumberOrNull(data?.minPax),
    maxPax: toNumberOrNull(data?.maxPax),
    minGroup: toNumberOrNull(data?.minGroup),
    maxGroup: toNumberOrNull(data?.maxGroup),
    daysInAdvance: toNumberOrNull(data?.daysInAdvance),
    cutOffTime: data?.cutOffTime || "",
    recommendedMarkup: displayMarkup,
    childRecommendedMarkup: toNumberOrNull(data?.childRecommendedMarkup),
    seniorRecommendedMarkup: toNumberOrNull(data?.seniorRecommendedMarkup),
    adultGateRatePrice: toNumberOrNull(data?.adultGateRatePrice),
    childGateRatePrice: toNumberOrNull(data?.childGateRatePrice),
    seniorGateRatePrice: toNumberOrNull(data?.seniorGateRatePrice),
    ticketTypes: ticketTypes.map((ticketType) => ({
      type: String(ticketType?.type || "").toLowerCase(),
      label: ticketType?.label || "",
      min: toNumberOrNull(ticketType?.min),
      max: toNumberOrNull(ticketType?.max),
      minAge: toNumberOrNull(ticketType?.minAge),
      maxAge: toNumberOrNull(ticketType?.maxAge),
      recommendedMarkup: toNumberOrNull(ticketType?.recommendedMarkup),
      gateRatePrice: toNumberOrNull(ticketType?.gateRatePrice),
    })),
  };
}

function formatTimeslotLabel(startTime, endTime) {
  if (!startTime && !endTime) return "Timeslot";
  if (startTime && endTime && startTime !== endTime) {
    return `${startTime} - ${endTime}`;
  }
  return startTime || endTime;
}

function sumAvailabilityEntries(entries) {
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((sum, entry) => sum + (Number(entry?.quantity) || 0), 0);
}

function formatCategoryLabel(category) {
  const normalized = String(category || "general")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return "General";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeCategoryAvailability(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const byCategory = new Map();
  for (const entry of entries) {
    const category = String(entry?.category || "general").toLowerCase();
    const quantity = Number(entry?.quantity) || 0;
    const existing = byCategory.get(category);
    if (existing) {
      existing.availableQuantity += quantity;
      continue;
    }
    byCategory.set(category, {
      category,
      label: formatCategoryLabel(category),
      availableQuantity: quantity,
      type: entry?.type || "",
    });
  }

  return Array.from(byCategory.values());
}

export function normalizeAvailabilityCalendar(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];

  return rows
    .map((row) => {
      const dayAvailableQuantity = sumAvailabilityEntries(row?.availability);
      const dayCategoryAvailability = normalizeCategoryAvailability(row?.availability);
      const timeslots = Array.isArray(row?.timeslots)
        ? row.timeslots.map((slot) => {
            const totalQuantity = sumAvailabilityEntries(slot?.availability);
            const slotCategoryAvailability = normalizeCategoryAvailability(slot?.availability);

            return {
              uuid: slot?.uuid || "",
              startTime: slot?.startTime || "",
              endTime: slot?.endTime || "",
              label: formatTimeslotLabel(slot?.startTime, slot?.endTime),
              categoryAvailability: slotCategoryAvailability,
              // Some products expose shared/day-level availability instead of slot-level.
              availableQuantity:
                totalQuantity > 0
                  ? totalQuantity
                  : dayAvailableQuantity > 0
                    ? dayAvailableQuantity
                    : 0,
            };
          })
        : [];

      return {
        date: row?.date || "",
        weekday: row?.weekday || "",
        availableQuantity: dayAvailableQuantity,
        categoryAvailability: dayCategoryAvailability,
        timeslots,
      };
    })
    .filter((row) => Boolean(row.date));
}

/**
 * Reads BeMyGuest product-type detail fields (minPax / maxPax and ticketTypes[].min/max).
 * @param {object|null|undefined} payload
 * @returns {{ minPax: number|null, maxPax: number|null, perCategory: Record<string, { min?: number, max?: number }> }|null}
 */
export function normalizeProductTypePaxConstraints(payload) {
  const data = payload?.data ?? payload;
  if (!data || typeof data !== "object") return null;

  const minPax = Number.isFinite(Number(data.minPax)) ? Number(data.minPax) : null;
  const maxPax = Number.isFinite(Number(data.maxPax)) ? Number(data.maxPax) : null;

  const ticketTypes = Array.isArray(data.ticketTypes) ? data.ticketTypes : [];
  const perCategory = {};
  for (const tt of ticketTypes) {
    if (!tt || tt.allowed !== true) continue;
    const type = String(tt.type || "").toLowerCase();
    if (!type) continue;
    const min = Number.isFinite(Number(tt.min)) ? Number(tt.min) : null;
    const max = Number.isFinite(Number(tt.max)) ? Number(tt.max) : null;
    if (min == null && max == null) continue;
    perCategory[type] = {
      ...(min != null ? { min } : {}),
      ...(max != null ? { max } : {}),
    };
  }

  if (minPax == null && maxPax == null && Object.keys(perCategory).length === 0) {
    return null;
  }

  return { minPax, maxPax, perCategory };
}

/**
 * @param {Array<{ category?: string, quantity?: number }>} ticketBreakdown
 * @param {{ minPax: number|null, maxPax: number|null, perCategory: Record<string, { min?: number, max?: number }> }} constraints
 * @returns {{ ok: boolean, message: string }}
 */
export function validateTicketSelectionAgainstPaxConstraints(ticketBreakdown, constraints) {
  if (!constraints) return { ok: true, message: "" };

  const breakdown = Array.isArray(ticketBreakdown) ? ticketBreakdown : [];

  const qtyFor = (cat) => {
    const key = String(cat || "").toLowerCase();
    const row = breakdown.find((e) => String(e.category || "").toLowerCase() === key);
    return row ? Math.max(0, Number(row.quantity) || 0) : 0;
  };

  for (const [cat, rule] of Object.entries(constraints.perCategory)) {
    const q = qtyFor(cat);
    if (Number.isFinite(rule.min) && q < rule.min) {
      return {
        ok: false,
        message: `This product requires at least ${rule.min} ${cat} ticket(s).`,
      };
    }
    if (Number.isFinite(rule.max) && q > rule.max) {
      return {
        ok: false,
        message: `Too many ${cat} tickets (maximum ${rule.max}).`,
      };
    }
  }

  const total = breakdown.reduce((sum, e) => sum + (Math.max(0, Number(e.quantity) || 0)), 0);
  if (Number.isFinite(constraints.minPax) && total < constraints.minPax) {
    return {
      ok: false,
      message: `This product requires at least ${constraints.minPax} guest(s) in total.`,
    };
  }
  if (Number.isFinite(constraints.maxPax) && total > constraints.maxPax) {
    return {
      ok: false,
      message: `This product allows at most ${constraints.maxPax} guest(s) in total.`,
    };
  }

  return { ok: true, message: "" };
}
