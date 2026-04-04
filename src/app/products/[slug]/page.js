import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCartCard from "@/components/add-to-cart-card";
import {
  getProductDetails,
  getProductTypesForProduct,
} from "@/lib/bemyguest";
import {
  normalizeProductTypes,
  pickProductName,
} from "@/lib/bemyguest-normalizers";
import { getIntegrationProductBySlug } from "@/lib/integration-products";
import styles from "./product.module.css";

function hasExpectedProductType(payload, expectedTypeUuid) {
  const candidates = normalizeProductTypes(payload);
  return candidates.some((item) => item.uuid === expectedTypeUuid);
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
                {productTypes.map((type) => (
                  <article key={type.uuid} className={styles.typeCard}>
                    <h3>{type.name}</h3>
                    <p>
                      <strong>Product-Type UUID</strong>
                      <span>{type.uuid}</span>
                    </p>
                    <AddToCartCard
                      productUuid={productUuid}
                      productName={productName || productLabel}
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
