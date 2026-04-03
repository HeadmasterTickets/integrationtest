"use client";

import Link from "next/link";
import { CartProvider, useCart } from "@/components/cart-provider";
import styles from "./site-shell.module.css";

function CartPill() {
  const { totalQuantity } = useCart();

  return (
    <Link href="/cart" className={styles.cartPill}>
      Cart
      <span suppressHydrationWarning>{totalQuantity}</span>
    </Link>
  );
}

export default function SiteShell({ children }) {
  return (
    <CartProvider>
      <header className={styles.header}>
        <div className={styles.left}>
          <Link href="/" className={styles.logo}>
            TicketFlow
          </Link>
          <nav className={styles.nav}>
            <Link href="/integration-test">Integration Tasks</Link>
          </nav>
        </div>
        <CartPill />
      </header>
      {children}
    </CartProvider>
  );
}
