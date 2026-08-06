import {
  getAvailabilityForDate,
  getPriceListCalendar,
} from "@/lib/bemyguest";
import {
  normalizeAvailabilityCalendar,
  normalizePriceListRateSnapshots,
} from "@/lib/bemyguest-normalizers";
import { INTEGRATION_TEST_PRODUCTS } from "@/lib/integration-test-products";
import styles from "./integration-test.module.css";

// Read-only reporting endpoint: always hit BeMyGuest live, never cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "BeMyGuest Integration Test | Price-List Report",
  description:
    "Raw /price-lists range + single-date responses for BMG integration test questions Q7, Q9, Q12, Q14, Q28.",
};

const CALENDAR_RANGE_DAYS = 60;

function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function errorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Run a synchronous transform without letting a bad shape crash the page. */
function safe(fn) {
  try {
    return { value: fn(), error: null };
  } catch (error) {
    return { value: null, error: errorMessage(error, "Normalizer failed.") };
  }
}

/**
 * Pick the first calendar row that actually carries pricing/availability data.
 * Falls back to the first row that has a date at all.
 */
function findFirstDateWithData(calendarPayload) {
  const rows = Array.isArray(calendarPayload?.data) ? calendarPayload.data : [];
  for (const row of rows) {
    if (!row?.date) continue;
    const hasPrices = Array.isArray(row.prices) && row.prices.length > 0;
    const hasTimeslots = Array.isArray(row.timeslots) && row.timeslots.length > 0;
    const hasAvailability =
      Array.isArray(row.availability) && row.availability.length > 0;
    if (hasPrices || hasTimeslots || hasAvailability) return row.date;
  }
  for (const row of rows) {
    if (row?.date) return row.date;
  }
  return null;
}

async function loadProductReport(product) {
  const dateStart = todayIso();
  const dateEnd = addDays(dateStart, CALENDAR_RANGE_DAYS);

  const report = {
    ...product,
    dateStart,
    dateEnd,
    calendar: null,
    calendarError: null,
    firstDateWithData: null,
    singleDate: null,
    singleDateError: null,
    normalizedCalendar: null,
    normalizedRateSnapshots: null,
    normalizedSingleDate: null,
  };

  // 1) price-lists range (calendar view)
  try {
    report.calendar = await getPriceListCalendar(
      product.productTypeUuid,
      dateStart,
      dateEnd,
    );
  } catch (error) {
    report.calendarError = errorMessage(
      error,
      "Price-list range request failed.",
    );
  }

  // 2) price-lists/{date} single-date detail for the first date with data
  if (report.calendar) {
    report.firstDateWithData = findFirstDateWithData(report.calendar);
    if (report.firstDateWithData) {
      try {
        report.singleDate = await getAvailabilityForDate(
          product.productTypeUuid,
          report.firstDateWithData,
        );
      } catch (error) {
        report.singleDateError = errorMessage(
          error,
          "Single-date price-list request failed.",
        );
      }
    }
  }

  // 3) normalized views (best-effort; raw is always shown regardless)
  if (report.calendar) {
    report.normalizedCalendar = safe(() =>
      normalizeAvailabilityCalendar(report.calendar),
    );
    report.normalizedRateSnapshots = safe(() =>
      normalizePriceListRateSnapshots(report.calendar),
    );
  }
  if (report.singleDate) {
    report.normalizedSingleDate = safe(() =>
      normalizePriceListRateSnapshots(report.singleDate),
    );
  }

  return report;
}

function JsonBlock({ value }) {
  return (
    <pre className={styles.json}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function CallSection({ title, endpoint, error, rawLabel, raw, normalized }) {
  return (
    <div className={styles.call}>
      <div className={styles.callHead}>
        <h3>{title}</h3>
        <code className={styles.endpoint}>{endpoint}</code>
      </div>

      {error ? (
        <p className={styles.error}>
          <strong>Request failed / status:</strong> {error}
        </p>
      ) : null}

      {raw !== undefined && raw !== null ? (
        <details className={styles.details} open>
          <summary>{rawLabel} (raw, unnormalized)</summary>
          <JsonBlock value={raw} />
        </details>
      ) : null}

      {normalized ? (
        <details className={styles.details}>
          <summary>Normalized view</summary>
          {normalized.error ? (
            <p className={styles.error}>Normalizer error: {normalized.error}</p>
          ) : (
            <JsonBlock value={normalized.value} />
          )}
        </details>
      ) : null}
    </div>
  );
}

function ProductReport({ report }) {
  const rangeEndpoint = `GET /v2/product-types/${report.productTypeUuid}/price-lists?date_start=${report.dateStart}&date_end=${report.dateEnd}`;
  const singleEndpoint = report.firstDateWithData
    ? `GET /v2/product-types/${report.productTypeUuid}/price-lists/${report.firstDateWithData}`
    : `GET /v2/product-types/${report.productTypeUuid}/price-lists/{date}`;

  return (
    <article className={styles.product}>
      <header className={styles.productHead}>
        <h2>{report.label}</h2>
        <p className={styles.note}>{report.note}</p>
        <dl className={styles.meta}>
          <div>
            <dt>Product UUID</dt>
            <dd>{report.productUuid}</dd>
          </div>
          <div>
            <dt>Product-Type UUID</dt>
            <dd>{report.productTypeUuid}</dd>
          </div>
          <div>
            <dt>Range</dt>
            <dd>
              {report.dateStart} → {report.dateEnd}
            </dd>
          </div>
          <div>
            <dt>First date with data</dt>
            <dd>{report.firstDateWithData || "none found"}</dd>
          </div>
        </dl>
      </header>

      {report.fatalError ? (
        <p className={styles.error}>
          <strong>Report failed:</strong> {report.fatalError}
        </p>
      ) : null}

      <CallSection
        title="1. Price-list range (calendar)"
        endpoint={rangeEndpoint}
        error={report.calendarError}
        rawLabel="Calendar response"
        raw={report.calendar}
        normalized={report.normalizedRateSnapshots}
      />

      {report.normalizedCalendar ? (
        <details className={styles.details}>
          <summary>Availability calendar (normalized)</summary>
          {report.normalizedCalendar.error ? (
            <p className={styles.error}>
              Normalizer error: {report.normalizedCalendar.error}
            </p>
          ) : (
            <JsonBlock value={report.normalizedCalendar.value} />
          )}
        </details>
      ) : null}

      <CallSection
        title="2. Single-date detail"
        endpoint={singleEndpoint}
        error={
          report.singleDateError ||
          (!report.firstDateWithData && report.calendar
            ? "No date with data found in range; single-date call skipped."
            : null)
        }
        rawLabel="Single-date response"
        raw={report.singleDate}
        normalized={report.normalizedSingleDate}
      />
    </article>
  );
}

export default async function IntegrationTestPage() {
  const reports = await Promise.all(
    INTEGRATION_TEST_PRODUCTS.map((product) =>
      loadProductReport(product).catch((error) => ({
        ...product,
        fatalError: errorMessage(error, "Unexpected error building report."),
        dateStart: todayIso(),
        dateEnd: addDays(todayIso(), CALENDAR_RANGE_DAYS),
      })),
    ),
  );

  return (
    <main className={styles.page}>
      <header className={styles.pageHead}>
        <p className={styles.kicker}>BeMyGuest Integration Test</p>
        <h1>Price-list report (read-only)</h1>
        <p className={styles.lead}>
          Raw <code>/price-lists</code> range and single-date responses for the
          BMG test products behind questions Q7, Q9, Q12, Q14, and Q28. No
          bookings, cart, or Stripe involved. Read exact field names
          (<code>nettPrice</code>, <code>minimumSellingPrice</code>,{" "}
          <code>retailPrice</code>, <code>recommendedPrice</code>, timeslot
          identifiers, currency) directly from the raw JSON.
        </p>
      </header>

      <div className={styles.list}>
        {reports.map((report) => (
          <ProductReport key={report.productUuid} report={report} />
        ))}
      </div>
    </main>
  );
}
