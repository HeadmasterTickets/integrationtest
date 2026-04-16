"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CART_STORAGE_KEY = "integration_cart_v1";

const CartContext = createContext(null);
const FALLBACK_CART_CONTEXT = {
  items: [],
  totalQuantity: 0,
  isAvailable: false,
  addItem: () => {},
  updateQuantity: () => {},
  removeItem: () => {},
  clearCart: () => {},
};

function getItemKey(item) {
  const selectedOptions = Array.isArray(item.selectedOptions)
    ? [...item.selectedOptions]
        .map((entry) => {
          const guest =
            entry.guestIndex === null || entry.guestIndex === undefined
              ? ""
              : String(entry.guestIndex);
          return `${entry.uuid}:${guest}:${entry.value}`;
        })
        .sort()
        .join("|")
    : "";
  return [
    item.productUuid,
    item.productTypeUuid,
    item.travelDate || "",
    item.timeslotUuid || "",
    selectedOptions,
  ].join(":");
}

function normalizeTicketBreakdown(entries) {
  if (!Array.isArray(entries)) return [];
  const byCategory = new Map();
  for (const entry of entries) {
    const category = String(entry?.category || "general").toLowerCase();
    const quantity = Math.max(0, Number(entry?.quantity) || 0);
    if (quantity <= 0) continue;
    const existing = byCategory.get(category);
    if (existing) {
      existing.quantity += quantity;
      continue;
    }
    byCategory.set(category, {
      category,
      label: entry?.label || category,
      quantity,
    });
  }
  return Array.from(byCategory.values());
}

function normalizeSelectedOptions(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => ({
      uuid: entry?.uuid || "",
      scope: entry?.scope || "",
      name: entry?.name || "",
      required: Boolean(entry?.required),
      inputType: entry?.inputType || "text",
      semanticType: entry?.semanticType || "",
      value: entry?.value ?? "",
      guestIndex: Number.isFinite(Number(entry?.guestIndex)) ? Number(entry.guestIndex) : null,
      guestLabel: entry?.guestLabel || "",
    }))
    .filter((entry) => entry.uuid && String(entry.value).trim() !== "");
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
          return [
            ...prev,
            {
              ...payload,
              selectedOptions: normalizeSelectedOptions(payload.selectedOptions),
            },
          ];
        }
        const next = [...prev];
        const mergedBreakdown = normalizeTicketBreakdown([
          ...(next[idx].ticketBreakdown || []),
          ...(payload.ticketBreakdown || []),
        ]);
        const mergedOptions = normalizeSelectedOptions([
          ...(next[idx].selectedOptions || []),
          ...(payload.selectedOptions || []),
        ]);
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + payload.quantity,
          ticketBreakdown: mergedBreakdown,
          selectedOptions: mergedOptions,
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
      isAvailable: true,
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
  return context || FALLBACK_CART_CONTEXT;
}
