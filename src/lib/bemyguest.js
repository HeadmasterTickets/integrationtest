const DEFAULT_BASE_URL = "https://api.demo.bemyguest.com.sg";
const REQUEST_TIMEOUT_MS = 30000;
const RETRY_DELAYS_MS = [300, 900];

function getConfig() {
  const baseUrl = process.env.BMG_API_BASE || DEFAULT_BASE_URL;
  const apiKey = process.env.BMG_API_KEY;

  if (!apiKey) {
    throw new Error("Missing BMG_API_KEY. Add it to your .env.local file.");
  }

  return { baseUrl, apiKey };
}

async function bmgFetch(pathname) {
  const { baseUrl, apiKey } = getConfig();
  const url = `${baseUrl}${pathname}`;

  let lastNetworkError = null;
  let response = null;
  const attempts = RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Authorization": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      lastNetworkError = null;
      break;
    } catch (error) {
      lastNetworkError = error;
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => {
          setTimeout(resolve, RETRY_DELAYS_MS[attempt]);
        });
      }
    }
  }

  if (!response) {
    const rootCause =
      lastNetworkError instanceof Error
        ? lastNetworkError.message
        : "Unknown network error";
    throw new Error(
      `Unable to reach BeMyGuest API at ${baseUrl}. ${rootCause}`,
    );
  }

  const body = await response.text();
  let payload = {};
  if (body) {
    try {
      payload = JSON.parse(body);
    } catch {
      payload = { raw: body };
    }
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `BeMyGuest request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export async function getProductDetails(productUuid) {
  return bmgFetch(`/v2/products/${productUuid}`);
}

export async function getProductTypesForProduct(productUuid) {
  return bmgFetch(`/v2/products/${productUuid}/product-types`);
}

export async function getConfigData() {
  return bmgFetch("/v2/config");
}

export async function getProductsList({ perPage = 1 } = {}) {
  const query = new URLSearchParams({
    per_page: String(perPage),
    page: "1",
  });
  return bmgFetch(`/v2/products?${query.toString()}`);
}

export async function getProductTypeDetails(productTypeUuid) {
  return bmgFetch(`/v2/product-types/${productTypeUuid}`);
}

export async function getPriceListCalendar(productTypeUuid, dateStart, dateEnd) {
  const query = new URLSearchParams({
    date_start: dateStart,
    date_end: dateEnd,
  });
  return bmgFetch(`/v2/product-types/${productTypeUuid}/price-lists?${query.toString()}`);
}

export async function getAvailabilityForDate(productTypeUuid, date) {
  return bmgFetch(`/v2/product-types/${productTypeUuid}/price-lists/${date}`);
}
