import Link from "next/link";
import styles from "../status.module.css";

export const metadata = {
  title: "Checkout Cancelled",
  description: "Stripe checkout was cancelled.",
};

export default function CheckoutCancelPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Checkout cancelled</h1>
        <p>No payment was made. You can review your cart and try again.</p>
        <Link href="/cart" className={styles.link}>
          Back to cart
        </Link>
      </section>
    </main>
  );
}
