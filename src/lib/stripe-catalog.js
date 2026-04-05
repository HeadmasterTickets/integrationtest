import { INTEGRATION_PRODUCTS } from "@/lib/integration-products";

// Fill these Stripe Price IDs after you create products/prices in Stripe.
// Key format: `${productUuid}:${productTypeUuid}`
export const STRIPE_PRICE_MAP = {
  "a26e84c1-ebe3-5611-8507-6dc092053882:beb95299-4144-56ea-8764-882f3e67b31f":
    "price_1TICH7Bq3JaiOlPJuOdLb4P8",
  "b49fd2f5-8d1b-4071-94d9-3e3a2c8219f8:7d066e29-5ec0-49b1-8317-1bf52c025af8":
    "price_1TIBR4Bq3JaiOlPJQPoQ1nKO",
  "b49fd2f5-8d1b-4071-94d9-3e3a2c8219f8:292f2b1a-e3dc-4673-9506-721b9333c7a0":
    "price_1TIBRKBq3JaiOlPJ2L8JRqfr",
  "b32945ad-29db-570f-96a1-0ff058f35481:c28b2938-a13b-51d0-9a40-a7649c18da84":
    "price_1TIBRsBq3JaiOlPJVTtGg4Ro",
  "02fed470-1b2c-4937-b7cb-3156fd5e3403:23b83619-f5d6-45fd-a614-db2bcd4403f8":
    "price_1TIBSKBq3JaiOlPJfYjyGd5u",
  "02fed470-1b2c-4937-b7cb-3156fd5e3403:304f8c95-7d68-4c1b-a7ae-e1b9b2570b6c":
    "price_1TIBSVBq3JaiOlPJzDnS4vsS",
  "c06e4620-c54d-5152-afb8-b45b9f3c5383:ad0368f9-3bfd-51e4-beb0-7af11e157741":
    "price_1TIBSgBq3JaiOlPJ40Cir6mu",
  "8e18ab29-1297-4e3c-b8cb-cbbc6a00d0dd:ca270be0-96ea-48c9-9ac5-4e5a6be6fb3c":
    "price_1TIsQSBq3JaiOlPJXta1mI7k",
  "19b83178-84e3-4d42-aa95-da42d524559c:906eecf7-f62f-47e0-98c9-052b714cb221":
    "price_1TIsR9Bq3JaiOlPJjw4F2Hr6",
  "90264dc9-703d-59d7-9dad-8812b704d005:d11b9919-4da2-5a4c-bcea-c3b9f688cc62":
    "price_1TIsTgBq3JaiOlPJCafHDlpU",
  "ac6a2b69-a014-5c50-806c-2cbda706e019:d03837b9-c89a-477d-8c53-e8f0e759a0fb":
    "price_1TIsTxBq3JaiOlPJANqUpLLJ",
  "ac6a2b69-a014-5c50-806c-2cbda706e019:371460cb-b9d6-5917-86f8-fff14573cabb":
    "price_1TIsUBBq3JaiOlPJyGmivc4l",
  "ac6a2b69-a014-5c50-806c-2cbda706e019:f627cfb7-45b4-4fe6-a512-40e8285fa5e4":
    "price_1TIsUNBq3JaiOlPJNYIuRk0w",
};

export function getStripePriceId(productUuid, productTypeUuid) {
  return STRIPE_PRICE_MAP[`${productUuid}:${productTypeUuid}`] || null;
}

export function getKnownProduct(productUuid) {
  return INTEGRATION_PRODUCTS.find((item) => item.productUuid === productUuid) || null;
}
