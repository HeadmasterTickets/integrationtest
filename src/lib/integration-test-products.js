// BeMyGuest's own integration-test product UUIDs.
// These are intentionally separate from src/lib/integration-products.js (our storefront catalog).
// Used only by the read-only /integration-test reporting route.
export const INTEGRATION_TEST_PRODUCTS = [
  {
    label: "Product 1",
    productUuid: "a26e84c1-ebe3-5611-8507-6dc092053882",
    productTypeUuid: "beb95299-4144-56ea-8764-882f3e67b31f",
    note: "Q7 - adult/child/senior rates, Wed vs Sat",
  },
  {
    label: "Product 2",
    productUuid: "b49fd2f5-8d1b-4071-94d9-3e3a2c8219f8",
    productTypeUuid: "7d066e29-5ec0-49b1-8317-1bf52c025af8",
    note: "Q9 - min selling price, firstAvailableDate beyond 90 days",
  },
  {
    label: "Product 4",
    productUuid: "02fed470-1b2c-4937-b7cb-3156fd5e3403",
    productTypeUuid: "23b83619-f5d6-45fd-a614-db2bcd4403f8",
    note: "Q12 - dynamic timeslot pricing (09:00/13:00/17:00)",
  },
  {
    label: "Product 5",
    productUuid: "c06e4620-c54d-5152-afb8-b45b9f3c5383",
    productTypeUuid: "ad0368f9-3bfd-51e4-beb0-7af11e157741",
    note: "Q14 - day-varying pricing, JPY",
  },
  {
    label: "Q28 product",
    productUuid: "e3f4ace3-0bba-43ea-ac0a-669834dd65f4",
    productTypeUuid: "5d500a4e-9f0f-496f-ba9a-98ce6b2bab65",
    note: "Q28 - availability types and quantities",
  },
];
