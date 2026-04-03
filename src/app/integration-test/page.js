import Link from "next/link";
import { getProductDetails, getProductTypesForProduct } from "@/lib/bemyguest";
import { getConfigSnapshot } from "@/lib/bmg-config-cache";
import {
  normalizeProductLocations,
  normalizeProductTypes,
  pickProductName,
} from "@/lib/bemyguest-normalizers";
import { INTEGRATION_PRODUCTS } from "@/lib/integration-products";
import styles from "./page.module.css";

const TASK_1_PRODUCT = INTEGRATION_PRODUCTS[0];
const TASK_3_PRODUCT_UUID = "6e3eeea2-a866-42f8-b84c-bb7549b765f9";

export const metadata = {
  title: "Integration Tasks | TicketFlow",
  description: "BeMyGuest integration test tasks runner.",
};

export default async function IntegrationTestPage() {
  let productName = "Unknown product";
  let foundVariant = false;
  let errorMessage = "";

  try {
    const [productPayload, productTypesPayload] = await Promise.all([
      getProductDetails(TASK_1_PRODUCT.productUuid),
      getProductTypesForProduct(TASK_1_PRODUCT.productUuid),
    ]);

    productName = pickProductName(productPayload);
    const productTypes = normalizeProductTypes(productTypesPayload);
    foundVariant = productTypes.some(
      (productType) => productType.uuid === TASK_1_PRODUCT.productTypeUuid,
    );
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown API error.";
  }

  const publishUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${TASK_1_PRODUCT.href}`;
  const configSnapshot = await getConfigSnapshot();
  const task2Error = configSnapshot.lastError;
  const task2Ready = configSnapshot.hasData && configSnapshot.isFresh && !task2Error;

  let task3Locations = [];
  let task3Error = "";

  try {
    const task3Payload = await getProductDetails(TASK_3_PRODUCT_UUID);
    task3Locations = normalizeProductLocations(task3Payload);
  } catch (error) {
    task3Error = error instanceof Error ? error.message : "Unknown API error.";
  }

  const task3Ready = task3Locations.length > 0 && !task3Error;

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <p className={styles.kicker}>Integration Test Runner</p>
          <h1>Tasks</h1>
          <p>Task 1 and Task 2 are integrated with live API validation.</p>
        </header>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 1 - Publish Product 1</h2>
            <span className={errorMessage ? styles.badgeFail : styles.badgeOk}>
              {errorMessage ? "Needs attention" : "Ready"}
            </span>
          </div>

          <div className={styles.grid}>
            <p>
              <strong>Product UUID</strong>
              <span>{TASK_1_PRODUCT.productUuid}</span>
            </p>
            <p>
              <strong>Required Product-Type UUID</strong>
              <span>{TASK_1_PRODUCT.productTypeUuid}</span>
            </p>
            <p>
              <strong>Live Product Name</strong>
              <span>{productName}</span>
            </p>
            <p>
              <strong>Required Variant Found</strong>
              <span>{foundVariant ? "Yes" : "No"}</span>
            </p>
          </div>

          {errorMessage ? (
            <div className={styles.errorBox}>
              <h3>API Error</h3>
              <p>{errorMessage}</p>
            </div>
          ) : (
            <div className={styles.successBox}>
              <h3>Validation checks passed</h3>
              <p>Product and required product-type were fetched successfully.</p>
            </div>
          )}

          <div className={styles.actions}>
            <Link href={TASK_1_PRODUCT.href} className={styles.button}>
              Open Published Product Page
            </Link>
            <p>
              <strong>UAT URL to share:</strong> <span>{publishUrl}</span>
            </p>
          </div>
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 2 - Refresh /v2/config at least daily</h2>
            <span className={task2Ready ? styles.badgeOk : styles.badgeFail}>
              {task2Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          <div className={styles.grid}>
            <p>
              <strong>Endpoint</strong>
              <span>/v2/config</span>
            </p>
            <p>
              <strong>Cache TTL</strong>
              <span>{configSnapshot.ttlHours} hours</span>
            </p>
            <p>
              <strong>Last refresh attempt</strong>
              <span>{configSnapshot.lastAttemptAt || "No attempts yet"}</span>
            </p>
            <p>
              <strong>Last successful refresh</strong>
              <span>{configSnapshot.lastRefreshedAt || "No successful refresh yet"}</span>
            </p>
          </div>

          {task2Error ? (
            <div className={styles.errorBox}>
              <h3>Refresh failed</h3>
              <p>{task2Error}</p>
            </div>
          ) : (
            <div className={styles.successBox}>
              <h3>Daily cache refresh logic active</h3>
              <p>
                Cache auto-refreshes when stale ({">"}24h). You can also force a
                refresh using the integration endpoint.
              </p>
            </div>
          )}

          <div className={styles.actions}>
            <p>
              <strong>Force refresh URL:</strong>{" "}
              <span>/api/integration/config-refresh?force=1</span>
            </p>
            <p>
              <strong>Cron target URL:</strong>{" "}
              <span>/api/integration/config-refresh?force=1</span>
            </p>
          </div>
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 3 - Location details for product</h2>
            <span className={task3Ready ? styles.badgeOk : styles.badgeFail}>
              {task3Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          <div className={styles.grid}>
            <p>
              <strong>Product UUID</strong>
              <span>{TASK_3_PRODUCT_UUID}</span>
            </p>
            <p>
              <strong>Total locations found</strong>
              <span>{task3Locations.length}</span>
            </p>
          </div>

          {task3Error ? (
            <div className={styles.errorBox}>
              <h3>API Error</h3>
              <p>{task3Error}</p>
            </div>
          ) : (
            <div className={styles.successBox}>
              <h3>Location extraction successful</h3>
              <p>
                Use these values directly to fill Task 3 city/state/country rows
                in the integration test form.
              </p>
            </div>
          )}

          {task3Locations.length > 0 && (
            <div className={styles.locationList}>
              {task3Locations.slice(0, 4).map((location, index) => (
                <article key={`${location.cityUuid}-${index}`} className={styles.locationCard}>
                  <h3>Location {index + 1}</h3>
                  <p>
                    <strong>City</strong>
                    <span>{location.city}</span>
                  </p>
                  <p>
                    <strong>City UUID</strong>
                    <span>{location.cityUuid}</span>
                  </p>
                  <p>
                    <strong>State</strong>
                    <span>{location.state}</span>
                  </p>
                  <p>
                    <strong>State UUID</strong>
                    <span>{location.stateUuid}</span>
                  </p>
                  <p>
                    <strong>Country</strong>
                    <span>{location.country}</span>
                  </p>
                  <p>
                    <strong>Country UUID</strong>
                    <span>{location.countryUuid}</span>
                  </p>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
