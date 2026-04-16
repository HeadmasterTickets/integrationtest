export const INTEGRATION_PRODUCTS = [
  {
    listingId: 12278,
    id: "Jurong Bird Park",
    productUuid: "ec1897a3-86fb-525c-914b-bfe39a4d5396",
    productTypeUuid: "5f775003-4111-565d-a3d2-568e7ec57506",
    href: "/products/jurong-bird-park",
  },
  {
    listingId: 27321,
    id: "Dinner Cruise with Transfer Services",
    productUuid: "22eef52f-70a7-4140-9160-2dd0dff4d638",
    productTypeUuid: "16359b5d-575d-46e8-947c-5941a0fef58a",
    href: "/products/dinner-cruise-with-transfer-services",
  },
  {
    listingId: 27334,
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
