"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/components/cart-provider";
import styles from "./add-to-cart-card.module.css";

export default function AddToCartCard({
  productUuid,
  productName,
  productTypeUuid,
  productTypeName,
  availabilityDays = [],
}) {
  const { addItem } = useCart();
  const hasAvailability = availabilityDays.length > 0;
  const firstAvailableDate = hasAvailability ? availabilityDays[0].date : "";
  const [travelDate, setTravelDate] = useState(firstAvailableDate);
  const [timeslotUuid, setTimeslotUuid] = useState(
    hasAvailability && availabilityDays[0].timeslots.length > 0
      ? availabilityDays[0].timeslots[0].uuid
      : "",
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const selectedAvailabilityDay = useMemo(() => {
    if (!hasAvailability) return null;
    return (
      availabilityDays.find((day) => day.date === travelDate) ||
      availabilityDays[0] ||
      null
    );
  }, [availabilityDays, hasAvailability, travelDate]);

  const selectedTimeslot = useMemo(() => {
    if (!selectedAvailabilityDay) return null;
    return (
      selectedAvailabilityDay.timeslots.find((slot) => slot.uuid === timeslotUuid) ||
      selectedAvailabilityDay.timeslots[0] ||
      null
    );
  }, [selectedAvailabilityDay, timeslotUuid]);

  function onDateChange(nextDate) {
    setTravelDate(nextDate);
    if (!hasAvailability) return;
    const day = availabilityDays.find((entry) => entry.date === nextDate);
    setTimeslotUuid(day?.timeslots?.[0]?.uuid || "");
  }

  function onAdd() {
    addItem({
      productUuid,
      productName,
      productTypeUuid,
      productTypeName,
      travelDate: travelDate || firstAvailableDate,
      timeslotUuid: selectedTimeslot?.uuid || "",
      timeslotTime: selectedTimeslot?.label || "",
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
          {hasAvailability ? (
            <select
              value={travelDate}
              onChange={(event) => onDateChange(event.target.value)}
            >
              {availabilityDays.map((day) => (
                <option key={day.date} value={day.date}>
                  {day.date} ({day.weekday || "Day"})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="date"
              value={travelDate}
              onChange={(event) => onDateChange(event.target.value)}
            />
          )}
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
      {selectedAvailabilityDay && selectedAvailabilityDay.timeslots.length > 0 && (
        <div className={styles.selectorRow}>
          <label className={styles.field}>
            <span>Timeslot</span>
            <select
              value={timeslotUuid}
              onChange={(event) => setTimeslotUuid(event.target.value)}
            >
              {selectedAvailabilityDay.timeslots.map((slot) => (
                <option key={slot.uuid} value={slot.uuid}>
                  {slot.label}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.field}>
            <span>Available Quantity</span>
            <input
              type="text"
              readOnly
              value={selectedTimeslot ? selectedTimeslot.availableQuantity : "N/A"}
            />
          </div>
        </div>
      )}
      <button type="button" className={styles.button} onClick={onAdd}>
        {added ? "Added to cart" : "Add to cart"}
      </button>
    </div>
  );
}
