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
];

export function getIntegrationProductByUuid(productUuid) {
  return INTEGRATION_PRODUCTS.find((product) => product.productUuid === productUuid);
}

export function getIntegrationProductBySlug(slug) {
  if (!slug) return undefined;
  return INTEGRATION_PRODUCTS.find((product) => product.href === `/products/${slug}`);
}
