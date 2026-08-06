export const INTEGRATION_PRODUCTS = [
  {
    slug: "bmg-test-product-1",
    name: "BMG Test — Product 1",
    productUuid: "a26e84c1-ebe3-5611-8507-6dc092053882",
    productTypeUuid: "beb95299-4144-56ea-8764-882f3e67b31f",
  },
  {
    slug: "bmg-test-product-2",
    name: "BMG Test — Product 2",
    productUuid: "b49fd2f5-8d1b-4071-94d9-3e3a2c8219f8",
    productTypeUuid: "7d066e29-5ec0-49b1-8317-1bf52c025af8",
  },
  {
    slug: "bmg-test-product-4",
    name: "BMG Test — Product 4 (dynamic timeslots)",
    productUuid: "02fed470-1b2c-4937-b7cb-3156fd5e3403",
    productTypeUuid: "23b83619-f5d6-45fd-a614-db2bcd4403f8",
  },
  {
    slug: "bmg-test-product-5",
    name: "BMG Test — Product 5 (JPY)",
    productUuid: "c06e4620-c54d-5152-afb8-b45b9f3c5383",
    productTypeUuid: "ad0368f9-3bfd-51e4-beb0-7af11e157741",
  },
  {
    slug: "bmg-test-q28",
    name: "BMG Test — Q28 Availability",
    productUuid: "e3f4ace3-0bba-43ea-ac0a-669834dd65f4",
    productTypeUuid: "5d500a4e-9f0f-496f-ba9a-98ce6b2bab65",
  },
];

export function getIntegrationProductByUuid(productUuid) {
  return INTEGRATION_PRODUCTS.find((product) => product.productUuid === productUuid);
}

export function getIntegrationProductBySlug(slug) {
  if (!slug) return undefined;
  return INTEGRATION_PRODUCTS.find((product) => product.slug === slug);
}
