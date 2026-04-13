export function pickText(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value.en || value["en-US"] || value.default || Object.values(value)[0] || null;
  }
  return null;
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
