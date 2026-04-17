import { INTEGRATION_PRODUCTS } from "@/lib/integration-products";

// Fill these Stripe Price IDs after you create products/prices in Stripe.
// Key format: `${productUuid}:${productTypeUuid}`
export const STRIPE_PRICE_MAP = {
  "52d1b30f-9314-432a-9ec8-406b525a4f5c:28d87a08-6101-40f4-907e-856ca0d01b1d":
    "price_1TN9ZnBq3JaiOlPJ1ayNtodA",
  "dd15d4fc-4ca2-4ff9-a663-0c45a7de47a9:59f32f47-8828-4a02-8d09-820aef43f5a5":
    "price_1TN9ZoBq3JaiOlPJNtyyuyRQ",
  "4f688295-af91-49f3-be97-23f8d38c10b3:14985a27-b9da-4931-8db5-0b48bd5311c0":
    "price_1TN9ZoBq3JaiOlPJNF24RLK0",
  "03919a2b-eb6f-4462-8744-ccbf50cd3c86:f636339b-b960-47e1-93b6-9da016f95db0":
    "price_1TN9ZpBq3JaiOlPJ5rza4BXI",
};

export function getStripePriceId(productUuid, productTypeUuid) {
  return STRIPE_PRICE_MAP[`${productUuid}:${productTypeUuid}`] || null;
}

export function getKnownProduct(productUuid) {
  return INTEGRATION_PRODUCTS.find((item) => item.productUuid === productUuid) || null;
}
