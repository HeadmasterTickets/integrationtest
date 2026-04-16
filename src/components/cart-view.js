"use client";

import { useState } from "react";
import { useCart } from "@/components/cart-provider";
import styles from "./cart-view.module.css";

export default function CartView() {
  const { items, updateQuantity, removeItem, clearCart } = useCart();
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function startCheckout() {
    setErrorMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Checkout session failed.");
      }

      if (payload?.url) {
        window.location.href = payload.url;
        return;
      }

      throw new Error("Stripe checkout URL missing.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown checkout error.");
      setIsLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {items.map((item, index) => (
          <li key={`${item.productUuid}:${item.productTypeUuid}:${index}`}>
            <div className={styles.itemTop}>
              <h3>{item.productName}</h3>
              <button type="button" onClick={() => removeItem(index)}>
                Remove
              </button>
            </div>
            <p>{item.productTypeName}</p>
            <p className={styles.mono}>{item.productTypeUuid}</p>
            {item.timeslotTime && <p className={styles.mono}>Timeslot: {item.timeslotTime}</p>}
            {Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0 && (
              <div className={styles.optionsWrap}>
                <p className={styles.optionsTitle}>Booking details</p>
                <ul className={styles.optionsList}>
                  {item.selectedOptions.map((option) => (
                    <li
                      key={`${item.productUuid}:${option.uuid}:${
                        Number.isFinite(Number(option.guestIndex))
                          ? Number(option.guestIndex)
                          : "single"
                      }`}
                    >
                      <span>
                        {option.name}
                        {Number.isFinite(Number(option.guestIndex))
                          ? ` (${option.guestLabel || `Guest ${Number(option.guestIndex) + 1}`})`
                          : ""}
                      </span>
                      <span>{option.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(item.ticketBreakdown) && item.ticketBreakdown.length > 0 && (
              <ul className={styles.breakdown}>
                {item.ticketBreakdown.map((entry) => (
                  <li key={`${item.productUuid}:${item.productTypeUuid}:${entry.category}`}>
                    {entry.label || entry.category}: {entry.quantity}
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.controls}>
              <label>
                Qty
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  disabled={Array.isArray(item.ticketBreakdown) && item.ticketBreakdown.length > 0}
                  onChange={(event) =>
                    updateQuantity(index, Number(event.target.value) || 1)
                  }
                />
              </label>
              <label>
                Date
                <input type="text" value={item.travelDate || "Not selected"} readOnly />
              </label>
            </div>
            {Array.isArray(item.ticketBreakdown) && item.ticketBreakdown.length > 0 && (
              <p className={styles.hint}>
                Edit ticket mix from the product page (remove and re-add this item).
              </p>
            )}
          </li>
        ))}
      </ul>

      {errorMessage && <p className={styles.error}>{errorMessage}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.clear} onClick={clearCart}>
          Clear cart
        </button>
        <button type="button" className={styles.checkout} onClick={startCheckout}>
          {isLoading ? "Preparing checkout..." : "Checkout with Stripe"}
        </button>
      </div>
    </div>
  );
}
