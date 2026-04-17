export const INTEGRATION_PRODUCTS = [
  {
    listingId: 1,
    id: "Hong Kong Disneyland 1-Day Ticket",
    productUuid: "52d1b30f-9314-432a-9ec8-406b525a4f5c",
    productTypeUuid: "28d87a08-6101-40f4-907e-856ca0d01b1d",
    href: "/products/hong-kong-disneyland-1-day-ticket",
  },
  {
    listingId: 2,
    id: "Marina Bay Sands SkyPark Observation Deck - Admission (Entry until 4:00 PM)",
    productUuid: "dd15d4fc-4ca2-4ff9-a663-0c45a7de47a9",
    productTypeUuid: "59f32f47-8828-4a02-8d09-820aef43f5a5",
    href: "/products/marina-bay-sands-skypark-observation-deck-admission-entry-until-4-00-pm",
  },
  {
    listingId: 3,
    id: "Hokkaido Rail Pass - Five Days",
    productUuid: "4f688295-af91-49f3-be97-23f8d38c10b3",
    productTypeUuid: "14985a27-b9da-4931-8db5-0b48bd5311c0",
    href: "/products/hokkaido-rail-pass-five-days",
  },
  {
    listingId: 4,
    id: "Macau Open Top Bus Tour - Macau Open Top Bus - Night Tour (7:00 PM Departure)",
    productUuid: "03919a2b-eb6f-4462-8744-ccbf50cd3c86",
    productTypeUuid: "f636339b-b960-47e1-93b6-9da016f95db0",
    href: "/products/macau-open-top-bus-tour-macau-open-top-bus-night-tour-7-00-pm-departure",
  },
];

export function getIntegrationProductByUuid(productUuid) {
  return INTEGRATION_PRODUCTS.find((product) => product.productUuid === productUuid);
}

export function getIntegrationProductBySlug(slug) {
  if (!slug) return undefined;
  return INTEGRATION_PRODUCTS.find((product) => product.href === `/products/${slug}`);
}
