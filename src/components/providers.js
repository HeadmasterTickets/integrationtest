"use client";

import { CartProvider } from "@/components/cart-provider";

export default function Providers({ children }) {
  return <CartProvider>{children}</CartProvider>;
}
