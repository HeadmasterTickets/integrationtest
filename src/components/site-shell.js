"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";
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

export default function SiteShell() {
  return (
    <>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          TicketFlow
        </Link>
        <CartPill />
      </header>
    </>
  );
}
