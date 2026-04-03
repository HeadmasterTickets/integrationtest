import Link from "next/link";
import {
  getProductDetails,
  getProductTypesForProduct,
} from "@/lib/bemyguest";
import {
  normalizeProductTypes,
  pickProductName,
} from "@/lib/bemyguest-normalizers";
import { INTEGRATION_PRODUCTS } from "@/lib/integration-products";
import styles from "./page.module.css";

async function getProductCardData(product) {
  try {
    const [productPayload, productTypesPayload] = await Promise.all([
      getProductDetails(product.productUuid),
      getProductTypesForProduct(product.productUuid),
    ]);
    const variants = normalizeProductTypes(productTypesPayload);
    const expectedVariantExists = variants.some(
      (variant) => variant.uuid === product.productTypeUuid,
    );

    return {
      ...product,
      dynamicName: pickProductName(productPayload),
      variants,
      expectedVariantExists,
      errorMessage: null,
    };
  } catch (error) {
    return {
      ...product,
      dynamicName: "Unable to load product",
      variants: [],
      expectedVariantExists: false,
      errorMessage: error instanceof Error ? error.message : "Unknown API error",
    };
  }
}

export default async function Home() {
  const productCards = await Promise.all(
    INTEGRATION_PRODUCTS.map((product) => getProductCardData(product)),
  );

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.kicker}>BeMyGuest Demo Integration</p>
          <h1>Find and preview ticket products</h1>
          <p className={styles.heroText}>
            This storefront pulls live product names and variants directly from
            BeMyGuest. Update a UUID and the displayed content updates
            automatically.
          </p>
        </section>

        <section className={styles.products}>
          {productCards.map((product) => (
            <article key={product.productUuid} className={styles.card}>
              <header className={styles.cardHeader}>
                <span className={styles.productChip}>{product.id}</span>
                <h2>{product.dynamicName}</h2>
              </header>

              <div className={styles.detailGrid}>
                <p>
                  <strong>Product UUID</strong>
                  <span>{product.productUuid}</span>
                </p>
                <p>
                  <strong>Primary Product-Type UUID</strong>
                  <span>{product.productTypeUuid}</span>
                </p>
                <p>
                  <strong>Primary Variant Found</strong>
                  <span>{product.expectedVariantExists ? "Yes" : "No"}</span>
                </p>
              </div>

              <div className={styles.variants}>
                <strong>Variants (Product Types)</strong>
                {product.variants.length > 0 ? (
                  <ul className={styles.variantList}>
                    {product.variants.map((variant) => (
                      <li key={variant.uuid}>
                        <span className={styles.variantName}>{variant.name}</span>
                        <span className={styles.variantUuid}>{variant.uuid}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className={styles.noVariants}>No variants returned.</span>
                )}
              </div>

              {product.errorMessage && (
                <p className={styles.errorText}>
                  API error: {product.errorMessage}
                </p>
              )}

              <footer className={styles.cardFooter}>
                <span className={styles.variantCount}>
                  {product.variants.length} variants
                </span>
                {product.href ? (
                  <Link href={product.href} className={styles.button}>
                    View Ticket
                  </Link>
                ) : (
                  <button type="button" className={styles.button} disabled>
                    Coming Soon
                  </button>
                )}
              </footer>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
