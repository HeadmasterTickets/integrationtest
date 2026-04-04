import Link from "next/link";
import Task15Runner from "@/components/task-15-runner";
import {
  getAvailabilityForDate,
  getPriceListCalendar,
  getProductDetails,
  getProductTypeDetails,
  getProductTypesForProduct,
} from "@/lib/bemyguest";
import { getConfigSnapshot } from "@/lib/bmg-config-cache";
import { getTask456Snapshot } from "@/lib/bmg-endpoint-cache";
import {
  normalizeProductLocations,
  normalizeProductTypes,
  pickProductName,
} from "@/lib/bemyguest-normalizers";
import { INTEGRATION_PRODUCTS } from "@/lib/integration-products";
import styles from "./page.module.css";

const TASK_1_PRODUCT = INTEGRATION_PRODUCTS[0];
const TASK_2_PRODUCT = INTEGRATION_PRODUCTS[1];
const TASK_10_PRODUCT = INTEGRATION_PRODUCTS[2];
const TASK_11_PRODUCT = INTEGRATION_PRODUCTS[3];
const TASK_13_PRODUCT = INTEGRATION_PRODUCTS[4];
const TASK_3_PRODUCT_UUID = "6e3eeea2-a866-42f8-b84c-bb7549b765f9";
const DEFAULT_SITE_URL = "https://integrationtest-three.vercel.app";

function getNextWeekday(targetWeekday) {
  const date = new Date();
  const today = date.getDay();
  let daysAhead = (targetWeekday - today + 7) % 7;
  if (daysAhead === 0) daysAhead = 7;
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

function toAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : "";
}

function findRate(payload, type, category) {
  const prices = Array.isArray(payload?.data?.prices) ? payload.data.prices : [];
  for (const price of prices) {
    const rates = Array.isArray(price?.rates) ? price.rates : [];
    const match = rates.find((rate) => rate?.type === type && rate?.category === category);
    if (match) return match;
  }
  return null;
}

function getRateAmount(payload, type, category) {
  return toAmount(findRate(payload, type, category)?.amount);
}

function getRateConvertedJpy(payload, type, category) {
  const rate = findRate(payload, type, category);
  const converted = rate?.meta?.convertedFrom;
  if (!converted || converted.currency !== "JPY") return "";
  return toAmount(converted.amount);
}

function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getMissingDates(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const sorted = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const dates = new Set(sorted.map((row) => row.date));
  const missing = [];
  let cursor = sorted[0].date;
  const end = sorted[sorted.length - 1].date;

  while (cursor <= end) {
    if (!dates.has(cursor)) missing.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return missing;
}

function getAdultRateByTimeslot(dayPayload, timeslotStart, rateType) {
  const timeslots = Array.isArray(dayPayload?.timeslots) ? dayPayload.timeslots : [];
  const prices = Array.isArray(dayPayload?.prices) ? dayPayload.prices : [];
  const timeslot = timeslots.find((slot) => slot?.startTime === timeslotStart);
  if (!timeslot?.priceId) return "";
  const priceRow = prices.find((row) => row?.id === timeslot.priceId);
  if (!priceRow) return "";
  const rates = Array.isArray(priceRow.rates) ? priceRow.rates : [];
  const rate = rates.find(
    (entry) => entry?.type === rateType && entry?.category === "adult",
  );
  return toAmount(rate?.amount);
}

function isBeyondDays(dateString, days) {
  if (!dateString) return false;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const diffMs = date.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return diffMs > days * 24 * 60 * 60 * 1000;
}

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

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SITE_URL;
  const publishUrl = `${siteUrl}${TASK_1_PRODUCT.href}`;
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
  const task456Snapshot = await getTask456Snapshot();

  const task4Ready =
    task456Snapshot.endpoints.products.isFresh &&
    task456Snapshot.endpoints.productDetails.isFresh &&
    task456Snapshot.endpoints.productTypeDetails.isFresh &&
    !task456Snapshot.endpoints.products.lastError &&
    !task456Snapshot.endpoints.productDetails.lastError &&
    !task456Snapshot.endpoints.productTypeDetails.lastError;

  const task5Ready =
    task456Snapshot.endpoints.priceListsCalendar.isFresh &&
    !task456Snapshot.endpoints.priceListsCalendar.lastError;

  const task6Ready =
    task456Snapshot.endpoints.realtimeDateCheck.hasData &&
    !task456Snapshot.endpoints.realtimeDateCheck.lastError;

  const nextWednesday = getNextWeekday(3);
  const nextSaturday = getNextWeekday(6);
  const year = new Date().getFullYear();
  const octDates = [`${year}-10-03`, `${year}-10-04`, `${year}-10-05`];

  let task789Error = "";
  let wednesdayRates = { adult: "", child: "", senior: "" };
  let saturdayRates = { adult: "", child: "", senior: "" };
  let product2FirstAvailabilityDate = "";
  let product2FirstAvailabilityBeyond90 = false;
  const task9MinSellingByDate = {};

  try {
    const [wednesdayPayload, saturdayPayload, product2TypeDetails, ...octPayloads] =
      await Promise.all([
        getAvailabilityForDate(TASK_1_PRODUCT.productTypeUuid, nextWednesday),
        getAvailabilityForDate(TASK_1_PRODUCT.productTypeUuid, nextSaturday),
        getProductTypeDetails(TASK_2_PRODUCT.productTypeUuid),
        ...octDates.map((date) =>
          getAvailabilityForDate(TASK_2_PRODUCT.productTypeUuid, date),
        ),
      ]);

    wednesdayRates = {
      adult: toAmount(findRate(wednesdayPayload, "nettPrice", "adult")?.amount),
      child: toAmount(findRate(wednesdayPayload, "nettPrice", "child")?.amount),
      senior: toAmount(findRate(wednesdayPayload, "nettPrice", "senior")?.amount),
    };

    saturdayRates = {
      adult: toAmount(findRate(saturdayPayload, "nettPrice", "adult")?.amount),
      child: toAmount(findRate(saturdayPayload, "nettPrice", "child")?.amount),
      senior: toAmount(findRate(saturdayPayload, "nettPrice", "senior")?.amount),
    };

    product2FirstAvailabilityDate =
      product2TypeDetails?.data?.firstAvailabilityDate ||
      product2TypeDetails?.data?.firstAvailableDate ||
      "";
    product2FirstAvailabilityBeyond90 = isBeyondDays(product2FirstAvailabilityDate, 90);

    octDates.forEach((date, index) => {
      const minimum = findRate(octPayloads[index], "minimumSellingPrice", "adult")?.amount;
      task9MinSellingByDate[date] = toAmount(minimum);
    });
  } catch (error) {
    task789Error = error instanceof Error ? error.message : "Unknown API error.";
  }

  const task7Ready =
    !task789Error &&
    Boolean(wednesdayRates.adult && wednesdayRates.child && wednesdayRates.senior) &&
    Boolean(saturdayRates.adult && saturdayRates.child && saturdayRates.senior);
  const task8Ready = !task789Error && product2FirstAvailabilityBeyond90;
  const task9Ready =
    !task789Error &&
    Boolean(task9MinSellingByDate[octDates[0]]) &&
    Boolean(task9MinSellingByDate[octDates[1]]) &&
    Boolean(task9MinSellingByDate[octDates[2]]);

  const task101112DateStart = new Date().toISOString().slice(0, 10);
  const task101112DateEnd = addDays(task101112DateStart, 30);
  let task101112Error = "";
  let task10Rows = [];
  let task11Rows = [];
  let task11TargetDay = null;
  let task12Rates = {
    "09:00": {},
    "13:00": {},
    "17:00": {},
  };

  try {
    const [task10Calendar, task11Calendar] = await Promise.all([
      getPriceListCalendar(
        TASK_10_PRODUCT.productTypeUuid,
        task101112DateStart,
        task101112DateEnd,
      ),
      getPriceListCalendar(
        TASK_11_PRODUCT.productTypeUuid,
        task101112DateStart,
        task101112DateEnd,
      ),
    ]);

    task10Rows = Array.isArray(task10Calendar?.data) ? task10Calendar.data : [];
    task11Rows = Array.isArray(task11Calendar?.data) ? task11Calendar.data : [];

    task11TargetDay = task11Rows.find((row) => {
      const starts = new Set((row?.timeslots || []).map((slot) => slot?.startTime));
      return starts.has("09:00") && starts.has("13:00") && starts.has("17:00");
    });

    if (task11TargetDay) {
      const times = ["09:00", "13:00", "17:00"];
      for (const time of times) {
        task12Rates[time] = {
          nettPrice: getAdultRateByTimeslot(task11TargetDay, time, "nettPrice"),
          minimumSellingPrice: getAdultRateByTimeslot(
            task11TargetDay,
            time,
            "minimumSellingPrice",
          ),
          retailPrice: getAdultRateByTimeslot(task11TargetDay, time, "retailPrice"),
          recommendedPrice: getAdultRateByTimeslot(
            task11TargetDay,
            time,
            "recommendedPrice",
          ),
        };
      }
    }
  } catch (error) {
    task101112Error = error instanceof Error ? error.message : "Unknown API error.";
  }

  const task10TimeslotPatterns = new Set(
    task10Rows.map((row) =>
      (row?.timeslots || []).map((slot) => slot?.startTime).filter(Boolean).join(","),
    ),
  );
  const task10MissingDates = getMissingDates(task10Rows);
  const task10Ready = !task101112Error && task10Rows.length > 0;

  const task11NettRates = task11TargetDay
    ? ["09:00", "13:00", "17:00"].map((time) =>
        getAdultRateByTimeslot(task11TargetDay, time, "nettPrice"),
      )
    : [];
  const task11DynamicPricing =
    new Set(task11NettRates.filter(Boolean)).size > 1 && task11NettRates.length === 3;
  const task11Ready = !task101112Error && Boolean(task11TargetDay) && task11DynamicPricing;

  const task12Ready =
    !task101112Error &&
    ["09:00", "13:00", "17:00"].every((time) =>
      ["nettPrice", "minimumSellingPrice", "retailPrice", "recommendedPrice"].every(
        (rateType) => Boolean(task12Rates[time]?.[rateType]),
      ),
    );

  let task131415Error = "";
  let task13PublishUrl = "";
  let task13DatePrimary = "";
  let task13DateSecondary = "";
  let task13DynamicPricingDetected = false;
  const task14Rates = {
    nettPrice: { sgd: "", jpy: "" },
    minimumSellingPrice: { sgd: "", jpy: "" },
    retailPrice: { sgd: "", jpy: "" },
    recommendedPrice: { sgd: "", jpy: "" },
  };

  try {
    task13PublishUrl = siteUrl + TASK_13_PRODUCT.href;
    const today = new Date().toISOString().slice(0, 10);
    task13DatePrimary = addDays(today, 5);
    task13DateSecondary = addDays(today, 6);

    const [task13PrimaryPayload, task13SecondaryPayload] = await Promise.all([
      getAvailabilityForDate(TASK_13_PRODUCT.productTypeUuid, task13DatePrimary),
      getAvailabilityForDate(TASK_13_PRODUCT.productTypeUuid, task13DateSecondary),
    ]);

    const primaryNett = getRateAmount(task13PrimaryPayload, "nettPrice", "adult");
    const secondaryNett = getRateAmount(task13SecondaryPayload, "nettPrice", "adult");
    task13DynamicPricingDetected =
      Boolean(primaryNett && secondaryNett) && primaryNett !== secondaryNett;

    for (const rateType of Object.keys(task14Rates)) {
      task14Rates[rateType] = {
        sgd: getRateAmount(task13PrimaryPayload, rateType, "adult"),
        jpy: getRateConvertedJpy(task13PrimaryPayload, rateType, "adult"),
      };
    }
  } catch (error) {
    task131415Error = error instanceof Error ? error.message : "Unknown API error.";
  }

  const task13Ready = !task131415Error && Boolean(task13PublishUrl);
  const task14Ready =
    !task131415Error &&
    Object.values(task14Rates).every((entry) => Boolean(entry.sgd) && Boolean(entry.jpy));

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <p className={styles.kicker}>Integration Test Runner</p>
          <h1>Tasks</h1>
          <p>Tasks 1-6 are integrated with live API checks and cache tracking.</p>
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

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 4 - Daily refresh for products/product-type endpoints</h2>
            <span className={task4Ready ? styles.badgeOk : styles.badgeFail}>
              {task4Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          <div className={styles.grid}>
            <p>
              <strong>/v2/products</strong>
              <span>
                {task456Snapshot.endpoints.products.lastRefreshedAt || "No refresh yet"}
              </span>
            </p>
            <p>
              <strong>/v2/products/{'{uuid}'}</strong>
              <span>
                {task456Snapshot.endpoints.productDetails.lastRefreshedAt ||
                  "No refresh yet"}
              </span>
            </p>
            <p>
              <strong>/v2/product-types/{'{uuid}'}</strong>
              <span>
                {task456Snapshot.endpoints.productTypeDetails.lastRefreshedAt ||
                  "No refresh yet"}
              </span>
            </p>
            <p>
              <strong>Cache TTL</strong>
              <span>{task456Snapshot.ttlHours} hours</span>
            </p>
          </div>

          {!task4Ready && (
            <div className={styles.errorBox}>
              <h3>Refresh issue detected</h3>
              <p>{task456Snapshot.endpoints.products.lastError}</p>
              <p>{task456Snapshot.endpoints.productDetails.lastError}</p>
              <p>{task456Snapshot.endpoints.productTypeDetails.lastError}</p>
            </div>
          )}
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 5 - Daily refresh for /price-lists calendar endpoint</h2>
            <span className={task5Ready ? styles.badgeOk : styles.badgeFail}>
              {task5Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          <div className={styles.grid}>
            <p>
              <strong>Endpoint</strong>
              <span>/v2/product-types/{'{uuid}'}/price-lists</span>
            </p>
            <p>
              <strong>Sample product-type UUID</strong>
              <span>{task456Snapshot.samples.productTypeUuid}</span>
            </p>
            <p>
              <strong>Cache range</strong>
              <span>
                {task456Snapshot.samples.dateStart} to {task456Snapshot.samples.dateEnd}
              </span>
            </p>
            <p>
              <strong>Last successful refresh</strong>
              <span>
                {task456Snapshot.endpoints.priceListsCalendar.lastRefreshedAt ||
                  "No refresh yet"}
              </span>
            </p>
          </div>

          {!task5Ready && (
            <div className={styles.errorBox}>
              <h3>Refresh issue detected</h3>
              <p>{task456Snapshot.endpoints.priceListsCalendar.lastError}</p>
            </div>
          )}
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 6 - Use real-time /price-lists/{'{date}'} before booking</h2>
            <span className={task6Ready ? styles.badgeOk : styles.badgeFail}>
              {task6Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          <div className={styles.grid}>
            <p>
              <strong>Realtime endpoint</strong>
              <span>/v2/product-types/{'{uuid}'}/price-lists/{'{date}'}</span>
            </p>
            <p>
              <strong>Checked date</strong>
              <span>{task456Snapshot.samples.realtimeDate}</span>
            </p>
            <p>
              <strong>Last live check attempt</strong>
              <span>
                {task456Snapshot.endpoints.realtimeDateCheck.lastAttemptAt ||
                  "No check yet"}
              </span>
            </p>
            <p>
              <strong>Last live check success</strong>
              <span>
                {task456Snapshot.endpoints.realtimeDateCheck.lastRefreshedAt ||
                  "No successful check yet"}
              </span>
            </p>
          </div>

          {task6Ready ? (
            <div className={styles.successBox}>
              <h3>Realtime availability endpoint verified</h3>
              <p>
                This endpoint is called for up-to-date availability checks prior
                to booking submission.
              </p>
            </div>
          ) : (
            <div className={styles.errorBox}>
              <h3>Realtime check failed</h3>
              <p>{task456Snapshot.endpoints.realtimeDateCheck.lastError}</p>
            </div>
          )}
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 7 - Product 1 Wednesday/Saturday net rates (SGD)</h2>
            <span className={task7Ready ? styles.badgeOk : styles.badgeFail}>
              {task7Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          {task789Error ? (
            <div className={styles.errorBox}>
              <h3>API Error</h3>
              <p>{task789Error}</p>
            </div>
          ) : (
            <div className={styles.grid}>
              <p>
                <strong>Next Wednesday ({nextWednesday}) Adult / Child / Senior</strong>
                <span>
                  {wednesdayRates.adult || "N/A"} / {wednesdayRates.child || "N/A"} /{" "}
                  {wednesdayRates.senior || "N/A"} SGD
                </span>
              </p>
              <p>
                <strong>Next Saturday ({nextSaturday}) Adult / Child / Senior</strong>
                <span>
                  {saturdayRates.adult || "N/A"} / {saturdayRates.child || "N/A"} /{" "}
                  {saturdayRates.senior || "N/A"} SGD
                </span>
              </p>
            </div>
          )}
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 8 - Publish Product 2 and 90+ day first availability</h2>
            <span className={task8Ready ? styles.badgeOk : styles.badgeFail}>
              {task8Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          <div className={styles.grid}>
            <p>
              <strong>Product 2 publish URL</strong>
                <span>{siteUrl + TASK_2_PRODUCT.href}</span>
            </p>
            <p>
              <strong>First availability date (Product-Type)</strong>
              <span>{product2FirstAvailabilityDate || "N/A"}</span>
            </p>
            <p>
              <strong>Beyond 90 days</strong>
              <span>{product2FirstAvailabilityBeyond90 ? "Yes" : "No"}</span>
            </p>
          </div>
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 9 - Product 2 minimum selling price (Adult, SGD)</h2>
            <span className={task9Ready ? styles.badgeOk : styles.badgeFail}>
              {task9Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          <div className={styles.grid}>
            {octDates.map((date) => (
              <p key={date}>
                <strong>{date}</strong>
                <span>{task9MinSellingByDate[date] || "N/A"} SGD</span>
              </p>
            ))}
          </div>
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 10 - Publish Product 3 (timeslots + blackout handling)</h2>
            <span className={task10Ready ? styles.badgeOk : styles.badgeFail}>
              {task10Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          {task101112Error ? (
            <div className={styles.errorBox}>
              <h3>API Error</h3>
              <p>{task101112Error}</p>
            </div>
          ) : (
            <>
              <div className={styles.grid}>
                <p>
                  <strong>Product 3 publish URL</strong>
                <span>{siteUrl + TASK_10_PRODUCT.href}</span>
                </p>
                <p>
                  <strong>Calendar rows returned (next 30 days)</strong>
                  <span>{task10Rows.length}</span>
                </p>
                <p>
                  <strong>Unique timeslot patterns across days</strong>
                  <span>{task10TimeslotPatterns.size}</span>
                </p>
                <p>
                  <strong>Detected blackout dates in window</strong>
                  <span>{task10MissingDates.length}</span>
                </p>
              </div>
              <div className={styles.actions}>
                <p>
                  <strong>Sample timeslot patterns:</strong>
                  <span>
                    {[...task10TimeslotPatterns].slice(0, 3).join(" | ") || "N/A"}
                  </span>
                </p>
              </div>
            </>
          )}
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 11 - Publish Product 4 (dynamic timeslot pricing)</h2>
            <span className={task11Ready ? styles.badgeOk : styles.badgeFail}>
              {task11Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          <div className={styles.grid}>
            <p>
              <strong>Product 4 publish URL</strong>
                <span>{siteUrl + TASK_11_PRODUCT.href}</span>
            </p>
            <p>
              <strong>Reference date for rates</strong>
              <span>{task11TargetDay?.date || "N/A"}</span>
            </p>
            <p>
              <strong>09:00 / 13:00 / 17:00 nett (SGD)</strong>
              <span>
                {task11NettRates[0] || "N/A"} / {task11NettRates[1] || "N/A"} /{" "}
                {task11NettRates[2] || "N/A"}
              </span>
            </p>
            <p>
              <strong>Dynamic timeslot pricing detected</strong>
              <span>{task11DynamicPricing ? "Yes" : "No"}</span>
            </p>
          </div>
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 12 - Product 4 adult rates by timeslot (SGD)</h2>
            <span className={task12Ready ? styles.badgeOk : styles.badgeFail}>
              {task12Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          <div className={styles.rateGrid}>
            {["09:00", "13:00", "17:00"].map((time) => (
              <article key={time} className={styles.rateCard}>
                <h3>{time}</h3>
                <p>
                  <strong>Nett Price</strong>
                  <span>{task12Rates[time].nettPrice || "N/A"} SGD</span>
                </p>
                <p>
                  <strong>Minimum Selling Price</strong>
                  <span>{task12Rates[time].minimumSellingPrice || "N/A"} SGD</span>
                </p>
                <p>
                  <strong>Retail Price</strong>
                  <span>{task12Rates[time].retailPrice || "N/A"} SGD</span>
                </p>
                <p>
                  <strong>Recommended Price</strong>
                  <span>{task12Rates[time].recommendedPrice || "N/A"} SGD</span>
                </p>
              </article>
            ))}
          </div>
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 13 - Publish Product 5 (day-based + JPY-compatible pricing)</h2>
            <span className={task13Ready ? styles.badgeOk : styles.badgeFail}>
              {task13Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          {task131415Error ? (
            <div className={styles.errorBox}>
              <h3>API Error</h3>
              <p>{task131415Error}</p>
            </div>
          ) : (
            <div className={styles.grid}>
              <p>
                <strong>Product 5 publish URL</strong>
                <span>{task13PublishUrl}</span>
              </p>
              <p>
                <strong>Date sample for pricing check</strong>
                <span>{task13DatePrimary}</span>
              </p>
              <p>
                <strong>Comparison date</strong>
                <span>{task13DateSecondary}</span>
              </p>
              <p>
                <strong>Different pricing across days detected</strong>
                <span>{task13DynamicPricingDetected ? "Yes" : "No"}</span>
              </p>
            </div>
          )}
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 14 - Product 5 adult rates (SGD + JPY)</h2>
            <span className={task14Ready ? styles.badgeOk : styles.badgeFail}>
              {task14Ready ? "Ready" : "Needs attention"}
            </span>
          </div>

          <p className={styles.taskSubtleText}>
            Date used for this check: <strong>{task13DatePrimary || "N/A"}</strong>
          </p>

          <div className={styles.rateGrid}>
            {Object.entries(task14Rates).map(([rateType, values]) => (
              <article key={rateType} className={styles.rateCard}>
                <h3>{rateType}</h3>
                <p>
                  <strong>SGD</strong>
                  <span>{values.sgd || "N/A"}</span>
                </p>
                <p>
                  <strong>JPY</strong>
                  <span>{values.jpy || "N/A"}</span>
                </p>
              </article>
            ))}
          </div>
        </article>

        <article className={styles.taskCard}>
          <div className={styles.taskTop}>
            <h2>Task 15 - Create and confirm Product 1 booking (1 adult, 1 child)</h2>
            <span className={styles.badgeOk}>Manual run</span>
          </div>

          <p className={styles.taskSubtleText}>
            This task creates a real booking and confirms it, then captures walletBlockedBalance
            before/after plus HTTP statuses.
          </p>

          <Task15Runner />
        </article>
      </section>
    </main>
  );
}
