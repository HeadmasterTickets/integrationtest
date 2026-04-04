import {
  getAvailabilityForDate,
  getPriceListCalendar,
  getProductDetails,
  getProductsList,
  getProductTypeDetails,
} from "@/lib/bemyguest";
import { INTEGRATION_PRODUCTS } from "@/lib/integration-products";

const DAY_MS = 24 * 60 * 60 * 1000;

const endpointState = {
  products: { lastRefreshedAt: null, lastAttemptAt: null, lastError: "", hasData: false },
  productDetails: { lastRefreshedAt: null, lastAttemptAt: null, lastError: "", hasData: false },
  productTypeDetails: {
    lastRefreshedAt: null,
    lastAttemptAt: null,
    lastError: "",
    hasData: false,
  },
  priceListsCalendar: {
    lastRefreshedAt: null,
    lastAttemptAt: null,
    lastError: "",
    hasData: false,
  },
  realtimeDateCheck: {
    lastRefreshedAt: null,
    lastAttemptAt: null,
    lastError: "",
    hasData: false,
  },
};

function toIso(timestamp) {
  return timestamp ? new Date(timestamp).toISOString() : "";
}

function isFresh(timestamp) {
  return Boolean(timestamp) && Date.now() - timestamp < DAY_MS;
}

function plusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function refreshKey(key, fetcher) {
  const state = endpointState[key];
  state.lastAttemptAt = Date.now();
  try {
    await fetcher();
    state.lastRefreshedAt = Date.now();
    state.lastError = "";
    state.hasData = true;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "Unknown API error.";
  }
}

export async function getTask456Snapshot() {
  const sampleProduct = INTEGRATION_PRODUCTS[0];
  const dateStart = plusDays(1);
  const dateEnd = plusDays(7);

  if (!isFresh(endpointState.products.lastRefreshedAt)) {
    await refreshKey("products", () => getProductsList({ perPage: 1 }));
  }

  if (!isFresh(endpointState.productDetails.lastRefreshedAt)) {
    await refreshKey("productDetails", () => getProductDetails(sampleProduct.productUuid));
  }

  if (!isFresh(endpointState.productTypeDetails.lastRefreshedAt)) {
    await refreshKey("productTypeDetails", () =>
      getProductTypeDetails(sampleProduct.productTypeUuid),
    );
  }

  if (!isFresh(endpointState.priceListsCalendar.lastRefreshedAt)) {
    await refreshKey("priceListsCalendar", () =>
      getPriceListCalendar(sampleProduct.productTypeUuid, dateStart, dateEnd),
    );
  }

  // Task 6 requires using real-time single-date availability endpoint.
  await refreshKey("realtimeDateCheck", () =>
    getAvailabilityForDate(sampleProduct.productTypeUuid, dateStart),
  );

  return {
    ttlHours: 24,
    endpoints: {
      products: {
        ...endpointState.products,
        isFresh: isFresh(endpointState.products.lastRefreshedAt),
        lastRefreshedAt: toIso(endpointState.products.lastRefreshedAt),
        lastAttemptAt: toIso(endpointState.products.lastAttemptAt),
      },
      productDetails: {
        ...endpointState.productDetails,
        isFresh: isFresh(endpointState.productDetails.lastRefreshedAt),
        lastRefreshedAt: toIso(endpointState.productDetails.lastRefreshedAt),
        lastAttemptAt: toIso(endpointState.productDetails.lastAttemptAt),
      },
      productTypeDetails: {
        ...endpointState.productTypeDetails,
        isFresh: isFresh(endpointState.productTypeDetails.lastRefreshedAt),
        lastRefreshedAt: toIso(endpointState.productTypeDetails.lastRefreshedAt),
        lastAttemptAt: toIso(endpointState.productTypeDetails.lastAttemptAt),
      },
      priceListsCalendar: {
        ...endpointState.priceListsCalendar,
        isFresh: isFresh(endpointState.priceListsCalendar.lastRefreshedAt),
        lastRefreshedAt: toIso(endpointState.priceListsCalendar.lastRefreshedAt),
        lastAttemptAt: toIso(endpointState.priceListsCalendar.lastAttemptAt),
      },
      realtimeDateCheck: {
        ...endpointState.realtimeDateCheck,
        isFresh: true,
        lastRefreshedAt: toIso(endpointState.realtimeDateCheck.lastRefreshedAt),
        lastAttemptAt: toIso(endpointState.realtimeDateCheck.lastAttemptAt),
      },
    },
    samples: {
      productUuid: sampleProduct.productUuid,
      productTypeUuid: sampleProduct.productTypeUuid,
      dateStart,
      dateEnd,
      realtimeDate: dateStart,
    },
  };
}
