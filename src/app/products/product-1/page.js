import Link from "next/link";
import AddToCartCard from "@/components/add-to-cart-card";
import {
  getProductDetails,
  getProductTypesForProduct,
} from "@/lib/bemyguest";
import {
  normalizeProductTypes,
  pickProductName,
} from "@/lib/bemyguest-normalizers";
import styles from "./product.module.css";

const PRODUCT_1_UUID = "a26e84c1-ebe3-5611-8507-6dc092053882";
const PRODUCT_1_TYPE_UUID = "beb95299-4144-56ea-8764-882f3e67b31f";

function hasExpectedProductType(payload) {
  const candidates = normalizeProductTypes(payload);

  return candidates.some((item) => item.uuid === PRODUCT_1_TYPE_UUID);
}

export const metadata = {
  title: "Product 1 | Integration Test",
  description: "Published Product 1 view for BeMyGuest integration testing.",
};

export default async function Product1Page() {
  let productPayload = null;
  let productTypesPayload = null;
  let errorMessage = null;

  try {
    [productPayload, productTypesPayload] = await Promise.all([
      getProductDetails(PRODUCT_1_UUID),
      getProductTypesForProduct(PRODUCT_1_UUID),
    ]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown API error.";
  }

  const productName = productPayload ? pickProductName(productPayload) : null;
  const productTypes = productTypesPayload ? normalizeProductTypes(productTypesPayload) : [];
  const expectedTypeFound = productTypesPayload
    ? hasExpectedProductType(productTypesPayload)
    : false;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <p className={styles.kicker}>Task 1 Published Product</p>
          <h1>{productName || "Product 1"} Ticket Details</h1>
          <p className={styles.subtitle}>
            This page is used as evidence for task 1 in the BeMyGuest
            integration test.
          </p>
        </header>

        <div className={styles.meta}>
          <p>
            <strong>Product UUID</strong>
            <span>{PRODUCT_1_UUID}</span>
          </p>
          <p>
            <strong>Expected Product-Type UUID</strong>
            <span>{PRODUCT_1_TYPE_UUID}</span>
          </p>
          {productName && (
            <p>
              <strong>Product Name</strong>
              <span>{productName}</span>
            </p>
          )}
          {productTypesPayload && (
            <p>
              <strong>Expected Product-Type Found</strong>
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
                {productTypes.map((type) => (
                  <article key={type.uuid} className={styles.typeCard}>
                    <h3>{type.name}</h3>
                    <p>
                      <strong>Product-Type UUID</strong>
                      <span>{type.uuid}</span>
                    </p>
                    <AddToCartCard
                      productUuid={PRODUCT_1_UUID}
                      productName={productName || "Product 1"}
                      productTypeUuid={type.uuid}
                      productTypeName={type.name}
                    />
                  </article>
                ))}
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
