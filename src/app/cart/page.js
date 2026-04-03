import CartView from "@/components/cart-view";
import styles from "./page.module.css";

export const metadata = {
  title: "Cart | TicketFlow",
  description: "Review selected tickets and proceed to Stripe checkout.",
};

export default function CartPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Your Cart</h1>
        <p>Review your selected tickets, then continue to secure checkout.</p>
        <CartView />
      </section>
    </main>
  );
}
