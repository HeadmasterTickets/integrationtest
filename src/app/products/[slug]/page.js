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
  normalizeProductTypePaxConstraints,
  normalizeProductTypes,
  pickProductName,
} from "@/lib/bemyguest-normalizers";
import { getIntegrationProductBySlug } from "@/lib/integration-products";
import styles from "./product.module.css";

function hasExpectedProductType(payload, expectedTypeUuid) {
  const candidates = normalizeProductTypes(payload);
  return candidates.some((item) => item.uuid === expectedTypeUuid);
}

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

  const { productUuid, productTypeUuid, id: productLabel } = product;

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
  const expectedTypeFound = productTypesPayload
    ? hasExpectedProductType(productTypesPayload, productTypeUuid)
    : false;

  let availabilityByTypeUuid = {};
  const paxConstraintsByTypeUuid = {};
  if (!errorMessage && productTypes.length > 0) {
    const ranges = buildAvailabilityRangesForYear();

    const typeDetailPayloads = await Promise.all(
      productTypes.map((type) => getProductTypeDetails(type.uuid).catch(() => null)),
    );
    productTypes.forEach((type, index) => {
      const constraints = normalizeProductTypePaxConstraints(typeDetailPayloads[index]);
      if (constraints) {
        paxConstraintsByTypeUuid[type.uuid] = constraints;
      }
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

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <p className={styles.kicker}>BeMyGuest Published Product</p>
          <h1>{productName || productLabel} Ticket Details</h1>
          <p className={styles.subtitle}>
            Product details and variants load from the BeMyGuest demo API. Use
            Add to cart to test checkout.
          </p>
        </header>

        <div className={styles.meta}>
          <p>
            <strong>Product UUID</strong>
            <span>{productUuid}</span>
          </p>
          <p>
            <strong>Primary Product-Type UUID</strong>
            <span>{productTypeUuid}</span>
          </p>
          {productName && (
            <p>
              <strong>Product Name</strong>
              <span>{productName}</span>
            </p>
          )}
          {productTypesPayload && (
            <p>
              <strong>Primary Product-Type Found</strong>
              <span>{expectedTypeFound ? "Yes" : "No"}</span>
            </p>
          )}
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
          <div className={styles.successBox}>
            <h2>Live API Fetch Success</h2>
            <p>
              Product details and product-types are fetched server-side from
              BeMyGuest demo API.
            </p>
          </div>
        )}

        {!errorMessage && (
          <section className={styles.typesSection}>
            <h2>Product Types</h2>
            {productTypes.length === 0 ? (
              <p className={styles.emptyText}>No product-types returned by API.</p>
            ) : (
              <div className={styles.typeGrid}>
                {productTypes.map((type) => {
                  const availability = availabilityByTypeUuid[type.uuid] || {
                    days: [],
                    error: "",
                  };
                  const previewDays = availability.days.slice(0, 6);

                  return (
                    <article key={type.uuid} className={styles.typeCard}>
                      <h3>{type.name}</h3>
                      <p>
                        <strong>Product-Type UUID</strong>
                        <span>{type.uuid}</span>
                      </p>

                      <section className={styles.availabilitySection}>
                          <h4>Availability (next 12 months)</h4>
                        {availability.error ? (
                          <p className={styles.availabilityError}>{availability.error}</p>
                        ) : previewDays.length === 0 ? (
                          <p className={styles.availabilityEmpty}>
                              No availability returned in the next 12 months.
                          </p>
                        ) : (
                          <ul className={styles.availabilityList}>
                            {previewDays.map((day) => (
                              <li key={`${type.uuid}-${day.date}`}>
                                <span className={styles.dayLabel}>
                                  {day.date} ({day.weekday || "Day"})
                                </span>
                                <span className={styles.slotLabel}>
                                  {day.timeslots.length > 0
                                    ? day.timeslots.map((slot) => slot.label).join(", ")
                                    : "No timeslots"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>

                      <AddToCartCard
                        productUuid={productUuid}
                        productName={productName || productLabel}
                        productTypeUuid={type.uuid}
                        productTypeName={type.name}
                        availabilityDays={availability.days}
                        paxConstraints={paxConstraintsByTypeUuid[type.uuid] || null}
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
