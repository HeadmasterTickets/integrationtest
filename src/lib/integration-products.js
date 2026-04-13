export const INTEGRATION_PRODUCTS = [
  {
    id: "Product 1",
    productUuid: "a26e84c1-ebe3-5611-8507-6dc092053882",
    productTypeUuid: "beb95299-4144-56ea-8764-882f3e67b31f",
    href: "/products/product-1",
  },
  {
    id: "Product 2",
    productUuid: "b49fd2f5-8d1b-4071-94d9-3e3a2c8219f8",
    productTypeUuid: "7d066e29-5ec0-49b1-8317-1bf52c025af8",
    href: "/products/product-2",
  },
  {
    id: "Product 3",
    productUuid: "b32945ad-29db-570f-96a1-0ff058f35481",
    productTypeUuid: "c28b2938-a13b-51d0-9a40-a7649c18da84",
    href: "/products/product-3",
  },
  {
    id: "Product 4",
    productUuid: "02fed470-1b2c-4937-b7cb-3156fd5e3403",
    productTypeUuid: "23b83619-f5d6-45fd-a614-db2bcd4403f8",
    href: "/products/product-4",
  },
  {
    id: "Product 5",
    productUuid: "c06e4620-c54d-5152-afb8-b45b9f3c5383",
    productTypeUuid: "ad0368f9-3bfd-51e4-beb0-7af11e157741",
    href: "/products/product-5",
  },
  {
    id: "Task 17",
    productUuid: "8e18ab29-1297-4e3c-b8cb-cbbc6a00d0dd",
    productTypeUuid: "ca270be0-96ea-48c9-9ac5-4e5a6be6fb3c",
    href: "/products/task-17",
  },
  {
    id: "Product 6",
    productUuid: "19b83178-84e3-4d42-aa95-da42d524559c",
    productTypeUuid: "906eecf7-f62f-47e0-98c9-052b714cb221",
    href: "/products/product-6",
  },
  {
    id: "Product 7",
    productUuid: "90264dc9-703d-59d7-9dad-8812b704d005",
    productTypeUuid: "d11b9919-4da2-5a4c-bcea-c3b9f688cc62",
    href: "/products/product-7",
  },
  {
    id: "Product 8",
    productUuid: "ac6a2b69-a014-5c50-806c-2cbda706e019",
    productTypeUuid: "d03837b9-c89a-477d-8c53-e8f0e759a0fb",
    href: "/products/product-8",
  },
  {
    id: "Jurong Bird Park",
    productUuid: "ec1897a3-86fb-525c-914b-bfe39a4d5396",
    productTypeUuid: "5f775003-4111-565d-a3d2-568e7ec57506",
    href: "/products/jurong-bird-park",
  },
  {
    id: "Dinner Cruise with Transfer Services",
    productUuid: "22eef52f-70a7-4140-9160-2dd0dff4d638",
    productTypeUuid: "16359b5d-575d-46e8-947c-5941a0fef58a",
    href: "/products/dinner-cruise-with-transfer-services",
  },
  {
    id: "Scuba Diving at TARP Island - For Cert Diver With Two Boat Dives",
    productUuid: "49d32aab-f0f1-4ee7-8c50-52ab64ac29de",
    productTypeUuid: "20cbc3d0-cad6-4e27-869f-7375c8564255",
    href: "/products/scuba-diving-at-tarp-island-for-cert-diver-with-two-boat-dives",
  },
];

export function getIntegrationProductByUuid(productUuid) {
  return INTEGRATION_PRODUCTS.find((product) => product.productUuid === productUuid);
}

export function getIntegrationProductBySlug(slug) {
  if (!slug) return undefined;
  return INTEGRATION_PRODUCTS.find((product) => product.href === `/products/${slug}`);
}
