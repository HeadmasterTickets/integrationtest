import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCartCard from "@/components/add-to-cart-card";
import {
  getPriceListCalendar,
  getProductDetails,
  getProductTypeDetails,
  getProductTypesForProduct,
} from "@/lib/bemyguest";
import {
  normalizeAvailabilityCalendar,
  normalizeProductConsumerDetails,
  normalizeProductTypeCommercialDetails,
  normalizeProductTypeOptions,
  normalizeProductTypePaxConstraints,
  normalizeProductTypes,
  pickProductName,
} from "@/lib/bemyguest-normalizers";
import { getIntegrationProductBySlug } from "@/lib/integration-products";
import styles from "./product.module.css";

const DISPLAY_CURRENCY = "SDG";

function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildAvailabilityRangesForYear() {
  // BeMyGuest validates date_start against its timezone and can reject "today".
  // Start from tomorrow to avoid cross-timezone off-by-one validation errors.
  const today = addDays(new Date().toISOString().slice(0, 10), 1);
  // API calendar range is capped at 6 months; split into two safe windows.
  return [
    {
      dateStart: today,
      dateEnd: addDays(today, 179),
    },
    {
      dateStart: addDays(today, 180),
      dateEnd: addDays(today, 365),
    },
  ];
}

function mergeAvailabilityDays(dayRows) {
  const byDate = new Map();
  for (const day of dayRows) {
    if (!day?.date) continue;
    if (!byDate.has(day.date)) {
      byDate.set(day.date, day);
      continue;
    }
    const existing = byDate.get(day.date);
    const timeslotMap = new Map();
    for (const slot of [...(existing.timeslots || []), ...(day.timeslots || [])]) {
      if (!slot?.uuid) continue;
      timeslotMap.set(slot.uuid, slot);
    }
    byDate.set(day.date, {
      ...existing,
      timeslots: Array.from(timeslotMap.values()),
    });
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function formatCurrency(value, currencyCode = DISPLAY_CURRENCY) {
  if (!Number.isFinite(Number(value))) return "";
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: currencyCode || DISPLAY_CURRENCY,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function getRecommendedTicketPrice(basePrice, commercial) {
  const recommendedRate = Number(commercial?.rates?.recommendedPrice);
  if (Number.isFinite(recommendedRate) && recommendedRate > 0) {
    return recommendedRate;
  }
  const ticketTypePrices = Array.isArray(commercial?.ticketTypes)
    ? commercial.ticketTypes
        .map((ticketType) => {
          const gateRate = Number(ticketType?.gateRatePrice);
          const markup = Number(ticketType?.recommendedMarkup);
          if (!Number.isFinite(gateRate) || !Number.isFinite(markup)) return null;
          return gateRate + markup;
        })
        .filter((value) => Number.isFinite(value))
    : [];
  // Prefer lowest positive resale per ticket type (child/free tiers can be 0+0 and would skew "from" price).
  const positiveTicketPrices = ticketTypePrices.filter((value) => value > 0);
  if (positiveTicketPrices.length > 0) {
    return Math.min(...positiveTicketPrices);
  }
  const markup = Number(commercial?.recommendedMarkup);
  if (Number.isFinite(basePrice) && Number.isFinite(markup)) {
    const sum = Number(basePrice) + markup;
    if (sum > 0) return sum;
  }
  if (Number.isFinite(basePrice) && Number(basePrice) > 0) {
    return Number(basePrice);
  }
  return null;
}

function buildMinimumRequirementLabel(paxConstraints, commercial) {
  const bits = [];
  if (Number.isFinite(paxConstraints?.minPax) && paxConstraints.minPax > 0) {
    bits.push(`Minimum ${paxConstraints.minPax} guest(s) per booking`);
  } else if (Number.isFinite(commercial?.minPax) && commercial.minPax > 0) {
    bits.push(`Minimum ${commercial.minPax} guest(s) per booking`);
  }
  if (Number.isFinite(commercial?.minGroup) && commercial.minGroup > 0) {
    bits.push(`Minimum ${commercial.minGroup} group(s)`);
  }
  if (paxConstraints?.perCategory) {
    const categoryBits = Object.entries(paxConstraints.perCategory)
      .filter(([, rule]) => Number.isFinite(rule?.min) && rule.min > 0)
      .map(([category, rule]) => {
        const label = String(category).replace(/\b\w/g, (char) => char.toUpperCase());
        return `${rule.min}+ ${label}`;
      });
    if (categoryBits.length > 0) {
      bits.push(`Per ticket type: ${categoryBits.join(", ")}`);
    }
  }
  return bits;
}

function buildFactRows(productInfo) {
  const rows = [];
  if (productInfo.businessHoursFrom || productInfo.businessHoursTo) {
    rows.push({
      label: "Opening Hours",
      value: [productInfo.businessHoursFrom, productInfo.businessHoursTo]
        .filter(Boolean)
        .join(" - "),
    });
  }
  if (Number.isFinite(productInfo.minPax) || Number.isFinite(productInfo.maxPax)) {
    rows.push({
      label: "Group Size",
      value: `${productInfo.minPax ?? "-"} to ${productInfo.maxPax ?? "-"} guest(s)`,
    });
  }
  if (productInfo.address) {
    rows.push({
      label: "Address",
      value: productInfo.address,
    });
  }
  if (productInfo.locations.length > 0) {
    rows.push({
      label: "Destinations",
      value: productInfo.locations.map((location) => location.label).join(" | "),
    });
  }
  if (productInfo.guideLanguages.length > 0) {
    rows.push({
      label: "Guide Languages",
      value: productInfo.guideLanguages.join(", "),
    });
  }
  return rows;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const product = getIntegrationProductBySlug(slug);
  if (!product) {
    return { title: "Product | Integration Test" };
  }
  return {
    title: `${product.id} | Integration Test`,
    description: `Published ${product.id} view for BeMyGuest integration testing.`,
  };
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const product = getIntegrationProductBySlug(slug);
  if (!product) {
    notFound();
  }

  const { productUuid, id: productLabel } = product;

  let productPayload = null;
  let productTypesPayload = null;
  let errorMessage = null;

  try {
    [productPayload, productTypesPayload] = await Promise.all([
      getProductDetails(productUuid),
      getProductTypesForProduct(productUuid),
    ]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown API error.";
  }

  const productName = productPayload ? pickProductName(productPayload) : null;
  const productTypes = productTypesPayload ? normalizeProductTypes(productTypesPayload) : [];
  let availabilityByTypeUuid = {};
  const paxConstraintsByTypeUuid = {};
  const commercialByTypeUuid = {};
  const optionsByTypeUuid = {};
  if (!errorMessage && productTypes.length > 0) {
    const ranges = buildAvailabilityRangesForYear();

    const typeDetailEntries = await Promise.all(
      productTypes.map(async (type) => [
        type.uuid,
        await getProductTypeDetails(type.uuid).catch(() => null),
      ]),
    );
    const typeDetailPayloadByTypeUuid = Object.fromEntries(typeDetailEntries);

    productTypes.forEach((type) => {
      const detailPayload = typeDetailPayloadByTypeUuid[type.uuid];
      const constraints = normalizeProductTypePaxConstraints(detailPayload);
      if (constraints) {
        paxConstraintsByTypeUuid[type.uuid] = constraints;
      }
      commercialByTypeUuid[type.uuid] = normalizeProductTypeCommercialDetails(detailPayload);
      optionsByTypeUuid[type.uuid] = normalizeProductTypeOptions(detailPayload);
    });

    const availabilityEntries = await Promise.all(
      productTypes.map(async (type) => {
        try {
          const rangePayloads = await Promise.all(
            ranges.map(async (range) => {
              try {
                return await getPriceListCalendar(type.uuid, range.dateStart, range.dateEnd);
              } catch {
                // Keep partial availability if one range fails.
                return null;
              }
            }),
          );
          const mergedDays = mergeAvailabilityDays(
            rangePayloads
              .filter(Boolean)
              .flatMap((payload) => normalizeAvailabilityCalendar(payload)),
          );
          return [
            type.uuid,
            {
              days: mergedDays,
              error: "",
              dateStart: ranges[0].dateStart,
              dateEnd: ranges[ranges.length - 1].dateEnd,
            },
          ];
        } catch (error) {
          return [
            type.uuid,
            {
              days: [],
              error: error instanceof Error ? error.message : "Availability request failed.",
              dateStart: ranges[0].dateStart,
              dateEnd: ranges[ranges.length - 1].dateEnd,
            },
          ];
        }
      }),
    );
    availabilityByTypeUuid = Object.fromEntries(availabilityEntries);
  }

  const productInfo = normalizeProductConsumerDetails(productPayload);
  const factRows = buildFactRows(productInfo);
  const heroImages = Array.isArray(productInfo.images) ? productInfo.images : [];
  const heroImage = heroImages[0] || "";
  const retailBadges = [productInfo.hasHotelPickup ? "Hotel Pickup Available" : ""].filter(Boolean);
  const startingRecommendedPrice = productTypes
    .map((type) =>
      getRecommendedTicketPrice(productInfo.basePrice, commercialByTypeUuid[type.uuid] || {}),
    )
    .filter((value) => Number.isFinite(value) && value > 0);
  const displayStartingPrice =
    startingRecommendedPrice.length > 0
      ? Math.min(...startingRecommendedPrice)
      : getRecommendedTicketPrice(productInfo.basePrice, {});

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <p className={styles.kicker}>Book Online</p>
          <h1>{productName || productLabel}</h1>
          <p className={styles.subtitle}>
            Book your preferred date and ticket type with live availability and instant booking
            requirements.
          </p>
          {retailBadges.length > 0 && (
            <div className={styles.badgeRow}>
              {retailBadges.map((badge) => (
                <span key={badge} className={styles.badge}>
                  {badge}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className={styles.heroGrid}>
          <article className={styles.pricePanel}>
            <p className={styles.priceLabel}>Starting from</p>
            <p className={styles.priceValue}>
              {formatCurrency(displayStartingPrice, DISPLAY_CURRENCY) || "Price on request"}
            </p>
            <p className={styles.priceHint}>All prices shown in SDG.</p>
          </article>
          <article className={styles.summaryPanel}>
            {heroImage ? (
              <div className={styles.heroGallery}>
                <img
                  src={heroImage}
                  alt={productName || productLabel}
                  className={styles.heroImage}
                />
                {heroImages.length > 1 ? (
                  <div className={styles.heroThumbGrid}>
                    {heroImages.map((imageUrl, imageIndex) => (
                      <img
                        key={`${imageUrl}-${imageIndex}`}
                        src={imageUrl}
                        alt={`${productName || productLabel} visual ${imageIndex + 1}`}
                        className={styles.heroThumb}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className={styles.summaryText}>
              <p>{productInfo.shortDescription || "Description unavailable."}</p>
            </div>
          </article>
        </div>

        {errorMessage ? (
          <div className={styles.errorBox}>
            <h2>API Connection Error</h2>
            <p>{errorMessage}</p>
            <p>
              Verify `BMG_API_BASE` and internet/DNS access to the BeMyGuest
              host, then restart `npm run dev` after env changes.
            </p>
          </div>
        ) : (
          <>
            <section className={styles.factsSection}>
              {factRows.map((fact) => (
                <article key={fact.label} className={styles.factCard}>
                  <h3>{fact.label}</h3>
                  <p>{fact.value}</p>
                </article>
              ))}
            </section>

            <section className={styles.detailSection}>
              {productInfo.highlights.length > 0 && (
                <article className={styles.detailCard}>
                  <h3>Highlights</h3>
                  <ul>
                    {productInfo.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              )}
              {productInfo.inclusions.length > 0 && (
                <article className={styles.detailCard}>
                  <h3>Included</h3>
                  <ul>
                    {productInfo.inclusions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              )}
              {productInfo.exclusions.length > 0 && (
                <article className={styles.detailCard}>
                  <h3>Not Included</h3>
                  <ul>
                    {productInfo.exclusions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              )}
              {productInfo.additionalInfo.length > 0 && (
                <article className={styles.detailCard}>
                  <h3>Additional Info</h3>
                  <ul>
                    {productInfo.additionalInfo.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              )}
              {productInfo.warnings.length > 0 && (
                <article className={styles.detailCard}>
                  <h3>Important Notes</h3>
                  <ul>
                    {productInfo.warnings.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              )}
              {productInfo.itinerary.length > 0 && (
                <article className={styles.detailCard}>
                  <h3>Itinerary</h3>
                  <ul>
                    {productInfo.itinerary.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              )}
            </section>
          </>
        )}

        {!errorMessage && (
          <section className={styles.typesSection}>
            <h2>Ticket Options</h2>
            {productTypes.length === 0 ? (
              <p className={styles.emptyText}>No product-types returned by API.</p>
            ) : (
              <div className={styles.typeGrid}>
                {productTypes.map((type) => {
                  const availability = availabilityByTypeUuid[type.uuid] || {
                    days: [],
                    error: "",
                  };
                  const commercial = commercialByTypeUuid[type.uuid] || {};
                  const optionDefinitions = optionsByTypeUuid[type.uuid] || {
                    all: [],
                    requiredPerBooking: [],
                    requiredPerPax: [],
                  };
                  const ticketPrice = getRecommendedTicketPrice(productInfo.basePrice, commercial);
                  const rateRows = [
                    {
                      key: "recommended",
                      label: "Recommended",
                      value: commercial?.rates?.recommendedPrice,
                    },
                    {
                      key: "parity",
                      label: "MSP (Parity)",
                      value: commercial?.rates?.parityPrice,
                    },
                    {
                      key: "retail",
                      label: "Retail (Gate)",
                      value: commercial?.rates?.retailPrice,
                    },
                    {
                      key: "nett",
                      label: "Nett (B2B)",
                      value: commercial?.rates?.nettPrice,
                    },
                  ];
                  const minimumRequirements = buildMinimumRequirementLabel(
                    paxConstraintsByTypeUuid[type.uuid] || null,
                    commercial,
                  );

                  return (
                    <article key={type.uuid} className={styles.typeCard}>
                      <div className={styles.typeHeader}>
                        <div>
                          <h3>{type.name}</h3>
                        </div>
                        <div className={styles.typePricing}>
                          {Number.isFinite(ticketPrice) && ticketPrice > 0 && (
                            <p className={styles.recommendedPrice}>
                              Recommended price: {formatCurrency(ticketPrice, DISPLAY_CURRENCY)}
                            </p>
                          )}
                          {(!Number.isFinite(ticketPrice) || ticketPrice <= 0) && (
                            <p>Price on request</p>
                          )}
                          <ul className={styles.rateBreakdown}>
                            {rateRows.map((rate) => {
                              const numberValue = Number(rate.value);
                              const displayValue =
                                Number.isFinite(numberValue) && numberValue >= 0
                                  ? formatCurrency(numberValue, DISPLAY_CURRENCY)
                                  : "Not provided";
                              return (
                                <li key={rate.key}>
                                  <span>{rate.label}</span>
                                  <strong>{displayValue}</strong>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>

                      <div className={styles.variantMeta}>
                        {commercial.durationLabel ? (
                          <span>Duration: {commercial.durationLabel}</span>
                        ) : null}
                        {commercial.cancellationPolicySummary ? (
                          <span>Flexible cancellation</span>
                        ) : null}
                        {commercial.instantConfirmation ? (
                          <span>Instant confirmation</span>
                        ) : null}
                        {commercial.directAdmission ? <span>Direct admission</span> : null}
                        {commercial.firstAvailabilityDate ? (
                          <span>Available from {commercial.firstAvailabilityDate}</span>
                        ) : null}
                        {minimumRequirements.length > 0 ? (
                          <span>{minimumRequirements[0]}</span>
                        ) : null}
                      </div>

                      {commercial.description ? (
                        <p className={styles.typeDescription}>{commercial.description}</p>
                      ) : null}

                      {availability.error ? (
                        <p className={styles.availabilityError}>{availability.error}</p>
                      ) : null}

                      {commercial.meetingLocation || commercial.meetingAddress ? (
                        <section className={styles.meetingSection}>
                          <h4>Meeting & Pickup</h4>
                          {commercial.meetingLocation ? (
                            <p>{commercial.meetingLocation}</p>
                          ) : null}
                          {commercial.meetingAddress ? (
                            <p className={styles.meetingAddress}>{commercial.meetingAddress}</p>
                          ) : null}
                        </section>
                      ) : null}

                      {optionDefinitions.requiredPerBooking.length > 0 ||
                      optionDefinitions.requiredPerPax.length > 0 ? (
                        <section className={styles.meetingSection}>
                          <h4>Required before adding to cart</h4>
                          <ul className={styles.requiredOptionList}>
                            {optionDefinitions.requiredPerBooking.map((option) => (
                              <li key={option.uuid}>{option.name}</li>
                            ))}
                            {optionDefinitions.requiredPerPax.map((option) => (
                              <li key={option.uuid}>
                                {option.name} (required per guest)
                              </li>
                            ))}
                          </ul>
                        </section>
                      ) : null}

                      <AddToCartCard
                        productUuid={productUuid}
                        productName={productName || productLabel}
                        productTypeUuid={type.uuid}
                        productTypeName={type.name}
                        availabilityDays={availability.days}
                        paxConstraints={paxConstraintsByTypeUuid[type.uuid] || null}
                        optionDefinitions={optionDefinitions}
                        pricingContext={{
                          basePrice: productInfo.basePrice,
                          currencyCode: DISPLAY_CURRENCY,
                          currencySymbol: DISPLAY_CURRENCY,
                          recommendedMarkup: commercial.recommendedMarkup,
                          childRecommendedMarkup: commercial.childRecommendedMarkup,
                          seniorRecommendedMarkup: commercial.seniorRecommendedMarkup,
                          ticketTypes: commercial.ticketTypes,
                        }}
                        variantContext={commercial}
                      />
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <footer className={styles.footer}>
          <Link href="/" className={styles.link}>
            Back to Product List
          </Link>
        </footer>
      </section>
    </main>
  );
}
