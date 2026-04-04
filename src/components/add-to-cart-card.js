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
  const sortedAvailabilityDaysRaw = useMemo(
    () => [...availabilityDays].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [availabilityDays],
  );
  const sortedAvailabilityDays = useMemo(
    () =>
      sortedAvailabilityDaysRaw
        .map((day) => ({
          ...day,
          timeslots: (Array.isArray(day.timeslots) ? day.timeslots : []).filter(
            (slot) => (Number(slot?.availableQuantity) || 0) > 0,
          ),
        }))
        .filter((day) => day.timeslots.length > 0),
    [sortedAvailabilityDaysRaw],
  );
  const hasAvailability = sortedAvailabilityDays.length > 0;
  const firstAvailableDate = hasAvailability ? sortedAvailabilityDays[0].date : "";
  const availableMonths = useMemo(() => {
    const months = [];
    const seen = new Set();
    for (const day of sortedAvailabilityDays) {
      const month = String(day.date).slice(0, 7);
      if (!seen.has(month)) {
        seen.add(month);
        months.push(month);
      }
    }
    return months;
  }, [sortedAvailabilityDays]);

  const [travelDate, setTravelDate] = useState(firstAvailableDate);
  const [selectedMonth, setSelectedMonth] = useState(
    firstAvailableDate ? firstAvailableDate.slice(0, 7) : "",
  );
  const [timeslotUuid, setTimeslotUuid] = useState(
    hasAvailability && sortedAvailabilityDays[0].timeslots.length > 0
      ? sortedAvailabilityDays[0].timeslots[0].uuid
      : "",
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const selectedAvailabilityDay = useMemo(() => {
    if (!hasAvailability) return null;
    return (
      sortedAvailabilityDays.find((day) => day.date === travelDate) ||
      sortedAvailabilityDays[0] ||
      null
    );
  }, [sortedAvailabilityDays, hasAvailability, travelDate]);

  const selectedTimeslot = useMemo(() => {
    if (!selectedAvailabilityDay) return null;
    return (
      selectedAvailabilityDay.timeslots.find((slot) => slot.uuid === timeslotUuid) ||
      selectedAvailabilityDay.timeslots[0] ||
      null
    );
  }, [selectedAvailabilityDay, timeslotUuid]);

  const monthDays = useMemo(() => {
    if (!selectedMonth) return [];
    return sortedAvailabilityDays.filter((day) => day.date.startsWith(selectedMonth));
  }, [selectedMonth, sortedAvailabilityDays]);

  const selectedMonthLabel = useMemo(() => {
    if (!selectedMonth) return "";
    const [year, month] = selectedMonth.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString("en-US", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  function onDateChange(nextDate) {
    setTravelDate(nextDate);
    setSelectedMonth(nextDate.slice(0, 7));
    if (!hasAvailability) return;
    const day = sortedAvailabilityDays.find((entry) => entry.date === nextDate);
    setTimeslotUuid(day?.timeslots?.[0]?.uuid || "");
  }

  function moveMonth(direction) {
    if (!selectedMonth) return;
    const index = availableMonths.indexOf(selectedMonth);
    if (index === -1) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= availableMonths.length) return;
    const nextMonth = availableMonths[nextIndex];
    setSelectedMonth(nextMonth);
    const firstDateInMonth = sortedAvailabilityDays.find((day) =>
      day.date.startsWith(nextMonth),
    );
    if (firstDateInMonth) {
      onDateChange(firstDateInMonth.date);
    }
  }

  function onAdd() {
    if (!hasAvailability) return;
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
      {hasAvailability && (
        <div className={styles.calendarWrap}>
          <div className={styles.calendarHead}>
            <button
              type="button"
              className={styles.monthButton}
              onClick={() => moveMonth(-1)}
              disabled={availableMonths.indexOf(selectedMonth) <= 0}
            >
              Prev
            </button>
            <p>{selectedMonthLabel}</p>
            <button
              type="button"
              className={styles.monthButton}
              onClick={() => moveMonth(1)}
              disabled={
                availableMonths.indexOf(selectedMonth) === -1 ||
                availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1
              }
            >
              Next
            </button>
          </div>
          <div className={styles.calendarDays}>
            {monthDays.map((day) => (
              <button
                key={day.date}
                type="button"
                className={`${styles.dayButton} ${
                  day.date === travelDate ? styles.dayButtonActive : ""
                }`}
                onClick={() => onDateChange(day.date)}
              >
                {day.date.slice(8, 10)} ({(day.weekday || "Day").slice(0, 3)})
              </button>
            ))}
          </div>
          <p className={styles.nearestText}>
            Nearest availability: {firstAvailableDate || "N/A"}
          </p>
        </div>
      )}

      {!hasAvailability && (
        <p className={styles.unavailableText}>
          No available dates/timeslots in the loaded availability window.
        </p>
      )}

      <div className={styles.selectorRow}>
        <label className={styles.field}>
          <span>Travel Date</span>
          {hasAvailability ? (
            <input type="text" value={travelDate} readOnly />
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
      <button
        type="button"
        className={styles.button}
        onClick={onAdd}
        disabled={!hasAvailability}
      >
        {added ? "Added to cart" : "Add to cart"}
      </button>
    </div>
  );
}
