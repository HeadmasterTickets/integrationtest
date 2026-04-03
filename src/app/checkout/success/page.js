import Link from "next/link";
import styles from "../status.module.css";

export const metadata = {
  title: "Checkout Success",
  description: "Stripe checkout completed successfully.",
};

export default function CheckoutSuccessPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Payment received</h1>
        <p>Your Stripe checkout completed. Next step is linking this to booking fulfillment.</p>
        <Link href="/" className={styles.link}>
          Return to products
        </Link>
      </section>
    </main>
  );
}
