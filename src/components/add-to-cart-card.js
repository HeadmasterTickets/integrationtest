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
  const { addItem, isAvailable } = useCart();
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
        .filter(
          (day) =>
            day.timeslots.length > 0 || (Number(day.availableQuantity) || 0) > 0,
        ),
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
  const [categorySelections, setCategorySelections] = useState({});
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

  const activeCategoryAvailability = useMemo(() => {
    const fromTimeslot = selectedTimeslot?.categoryAvailability || [];
    const fromDay = selectedAvailabilityDay?.categoryAvailability || [];
    const categories = fromTimeslot.length > 0 ? fromTimeslot : fromDay;
    if (categories.length > 0) return categories;

    const fallbackAvailableQuantity = Number(
      selectedTimeslot?.availableQuantity ?? selectedAvailabilityDay?.availableQuantity ?? 0,
    );
    if (fallbackAvailableQuantity <= 0) return [];

    return [
      {
        category: "general",
        label: "General",
        availableQuantity: fallbackAvailableQuantity,
      },
    ];
  }, [selectedAvailabilityDay, selectedTimeslot]);

  const categoryQuantities = useMemo(() => {
    if (activeCategoryAvailability.length === 0) return {};

    const next = {};
    let selectedTotal = 0;
    for (const category of activeCategoryAvailability) {
      const code = category.category;
      const limit = Number(category.availableQuantity) || 0;
      const requested = Number(categorySelections[code]) || 0;
      const clamped = Math.max(0, Math.min(limit, requested));
      next[code] = clamped;
      selectedTotal += clamped;
    }

    if (selectedTotal === 0) {
      const first = activeCategoryAvailability[0];
      const firstLimit = Number(first.availableQuantity) || 0;
      next[first.category] = Math.max(0, Math.min(1, firstLimit));
    }

    return next;
  }, [activeCategoryAvailability, categorySelections]);

  const totalSelectedQuantity = useMemo(
    () =>
      activeCategoryAvailability.reduce((sum, category) => {
        const code = category.category;
        return sum + (Number(categoryQuantities[code]) || 0);
      }, 0),
    [activeCategoryAvailability, categoryQuantities],
  );

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
    if (!hasAvailability || !isAvailable) return;
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
    if (!hasAvailability || totalSelectedQuantity <= 0) return;
    const ticketBreakdown = activeCategoryAvailability
      .map((category) => {
        const quantity = Number(categoryQuantities[category.category]) || 0;
        return {
          category: category.category,
          label: category.label,
          quantity,
        };
      })
      .filter((entry) => entry.quantity > 0);

    addItem({
      productUuid,
      productName,
      productTypeUuid,
      productTypeName,
      travelDate: travelDate || firstAvailableDate,
      timeslotUuid: selectedTimeslot?.uuid || "",
      timeslotTime: selectedTimeslot?.label || "",
      quantity: totalSelectedQuantity,
      ticketBreakdown,
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
      {!isAvailable && (
        <p className={styles.unavailableText}>
          Cart is not ready yet. Please refresh this page.
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
        <div className={styles.field}>
          <span>Total Quantity</span>
          <input type="number" min="0" value={totalSelectedQuantity} readOnly />
        </div>
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
      {selectedAvailabilityDay && selectedAvailabilityDay.timeslots.length === 0 && (
        <div className={styles.selectorRow}>
          <div className={styles.field}>
            <span>Availability Type</span>
            <input type="text" readOnly value="Date-based (no timeslots)" />
          </div>
          <div className={styles.field}>
            <span>Available Quantity</span>
            <input
              type="text"
              readOnly
              value={Number(selectedAvailabilityDay.availableQuantity) || "N/A"}
            />
          </div>
        </div>
      )}
      {activeCategoryAvailability.length > 0 && (
        <section className={styles.ticketMix}>
          <p className={styles.ticketMixTitle}>Ticket Types</p>
          <div className={styles.ticketMixGrid}>
            {activeCategoryAvailability.map((category) => (
              <label key={category.category} className={styles.ticketMixRow}>
                <span>
                  {category.label} (max {category.availableQuantity})
                </span>
                <input
                  type="number"
                  min="0"
                  max={String(category.availableQuantity)}
                  value={categoryQuantities[category.category] ?? 0}
                  onChange={(event) => {
                    const nextValue = Math.max(
                      0,
                      Math.min(
                        Number(category.availableQuantity) || 0,
                        Number(event.target.value) || 0,
                      ),
                    );
                    setCategorySelections((prev) => ({
                      ...prev,
                      [category.category]: nextValue,
                    }));
                  }}
                />
              </label>
            ))}
          </div>
        </section>
      )}
      <button
        type="button"
        className={styles.button}
        onClick={onAdd}
        disabled={!hasAvailability || !isAvailable || totalSelectedQuantity <= 0}
      >
        {added ? "Added to cart" : "Add to cart"}
      </button>
    </div>
  );
}
