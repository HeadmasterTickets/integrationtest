import { INTEGRATION_PRODUCTS } from "@/lib/integration-products";

// Fill these Stripe Price IDs after you create products/prices in Stripe.
// Key format: `${productUuid}:${productTypeUuid}`
export const STRIPE_PRICE_MAP = {
  "ec1897a3-86fb-525c-914b-bfe39a4d5396:5f775003-4111-565d-a3d2-568e7ec57506":
    "price_1TLim0Bq3JaiOlPJlcgQF0vR",
  "22eef52f-70a7-4140-9160-2dd0dff4d638:16359b5d-575d-46e8-947c-5941a0fef58a":
    "price_1TLioWBq3JaiOlPJd9d5VryX",
  // Same Stripe price for both dinner cruise product-types under one product.
  "22eef52f-70a7-4140-9160-2dd0dff4d638:a9be7df9-5d16-4df5-bf78-7d2275d5aa9a":
    "price_1TLioWBq3JaiOlPJd9d5VryX",
  "49d32aab-f0f1-4ee7-8c50-52ab64ac29de:20cbc3d0-cad6-4e27-869f-7375c8564255":
    "price_1TLiq6Bq3JaiOlPJhs7Y0vZt",
};

export function getStripePriceId(productUuid, productTypeUuid) {
  return STRIPE_PRICE_MAP[`${productUuid}:${productTypeUuid}`] || null;
}

export function getKnownProduct(productUuid) {
  return INTEGRATION_PRODUCTS.find((item) => item.productUuid === productUuid) || null;
}
