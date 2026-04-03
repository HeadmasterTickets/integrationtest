"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CART_STORAGE_KEY = "integration_cart_v1";

const CartContext = createContext(null);

function getItemKey(item) {
  return `${item.productUuid}:${item.productTypeUuid}:${item.travelDate || ""}`;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    function addItem(payload) {
      setItems((prev) => {
        const key = getItemKey(payload);
        const idx = prev.findIndex((item) => getItemKey(item) === key);
        if (idx === -1) {
          return [...prev, payload];
        }
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + payload.quantity,
        };
        return next;
      });
    }

    function updateQuantity(index, quantity) {
      setItems((prev) => {
        const next = [...prev];
        if (!next[index]) return prev;
        next[index] = { ...next[index], quantity: Math.max(1, quantity) };
        return next;
      });
    }

    function removeItem(index) {
      setItems((prev) => prev.filter((_, idx) => idx !== index));
    }

    function clearCart() {
      setItems([]);
    }

    return {
      items,
      totalQuantity,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider.");
  }
  return context;
}
