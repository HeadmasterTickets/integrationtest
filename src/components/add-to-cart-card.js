"use client";

import { useState } from "react";
import { useCart } from "@/components/cart-provider";
import styles from "./add-to-cart-card.module.css";

export default function AddToCartCard({
  productUuid,
  productName,
  productTypeUuid,
  productTypeName,
}) {
  const { addItem } = useCart();
  const [travelDate, setTravelDate] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  function onAdd() {
    addItem({
      productUuid,
      productName,
      productTypeUuid,
      productTypeName,
      travelDate,
      quantity: Number(quantity),
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.selectorRow}>
        <label className={styles.field}>
          <span>Travel Date</span>
          <input
            type="date"
            value={travelDate}
            onChange={(event) => setTravelDate(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Quantity</span>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
      </div>
      <button type="button" className={styles.button} onClick={onAdd}>
        {added ? "Added to cart" : "Add to cart"}
      </button>
    </div>
  );
}
