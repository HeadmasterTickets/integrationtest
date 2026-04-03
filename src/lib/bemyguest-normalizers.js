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
    name: pickText(item?.name) || "Unnamed variant",
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
