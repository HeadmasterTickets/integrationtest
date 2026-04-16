"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/cart-provider";
import { validateTicketSelectionAgainstPaxConstraints } from "@/lib/bemyguest-normalizers";
import styles from "./add-to-cart-card.module.css";

const DEFAULT_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

function isEmptyOptionValue(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function toLabel(option) {
  return option?.name || "Required field";
}

function formatDateLabel(dateValue, weekday) {
  if (!dateValue) return "Select date";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  const label = date.toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return weekday ? `${label} (${weekday})` : label;
}

function toScopeLabel(scope) {
  if (scope === "per_pax") return "Per guest";
  return "Per booking";
}

function toOptionHint(option) {
  const bits = [];
  if (option?.description) bits.push(option.description);
  if (option?.bmgFormatHint) bits.push(option.bmgFormatHint);
  if (option?.semanticType === "dob") bits.push("Select date of birth (YYYY-MM-DD)");
  if (option?.semanticType === "passport_expiry") {
    const hasBmgGuidance =
      Boolean(option?.description?.trim()) ||
      Boolean(option?.bmgFormatHint) ||
      Boolean(option?.formatRegex);
    if (!hasBmgGuidance) {
      bits.push("Enter the expiry date as requested by BeMyGuest (often DD/MM/YYYY with slashes).");
    }
  }
  if (option?.inputType === "time") bits.push("Format: HH:MM");
  if (option?.inputType === "number") {
    if (Number.isFinite(option?.minNumber)) bits.push(`Min ${option.minNumber}`);
    if (Number.isFinite(option?.maxNumber)) bits.push(`Max ${option.maxNumber}`);
  }
  if (Array.isArray(option?.values) && option.values.length > 0) {
    bits.push(`Choices: ${option.values.map((entry) => entry.label || entry.value).join(", ")}`);
  }
  return bits.join(" · ");
}

export default function AddToCartCard({
  productUuid,
  productName,
  productTypeUuid,
  productTypeName,
  availabilityDays = [],
  paxConstraints = null,
  optionDefinitions = {
    perBooking: [],
    perPax: [],
    all: [],
    requiredPerBooking: [],
    requiredPerPax: [],
  },
  pricingContext = null,
  variantContext = null,
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
  const [paxError, setPaxError] = useState("");
  const [optionValues, setOptionValues] = useState({});
  const [perPaxOptionValues, setPerPaxOptionValues] = useState({});
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showDatePopup, setShowDatePopup] = useState(false);
  const [showTimeslotPopup, setShowTimeslotPopup] = useState(false);
  const [optionError, setOptionError] = useState("");

  const perBookingOptions = useMemo(
    () => (Array.isArray(optionDefinitions?.perBooking) ? optionDefinitions.perBooking : []),
    [optionDefinitions],
  );
  const perPaxOptions = useMemo(
    () => (Array.isArray(optionDefinitions?.perPax) ? optionDefinitions.perPax : []),
    [optionDefinitions],
  );
  const requiredPerBookingOptions = useMemo(
    () =>
      Array.isArray(optionDefinitions?.requiredPerBooking)
        ? optionDefinitions.requiredPerBooking
        : perBookingOptions.filter((option) => option.required),
    [optionDefinitions, perBookingOptions],
  );
  const requiredPerPaxOptions = useMemo(
    () =>
      Array.isArray(optionDefinitions?.requiredPerPax)
        ? optionDefinitions.requiredPerPax
        : perPaxOptions.filter((option) => option.required),
    [optionDefinitions, perPaxOptions],
  );
  const requiredOptions = useMemo(
    () => [...requiredPerBookingOptions, ...requiredPerPaxOptions],
    [requiredPerBookingOptions, requiredPerPaxOptions],
  );

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

  const selectedDateLabel = useMemo(
    () =>
      selectedAvailabilityDay
        ? formatDateLabel(selectedAvailabilityDay.date, selectedAvailabilityDay.weekday)
        : formatDateLabel(travelDate, ""),
    [selectedAvailabilityDay, travelDate],
  );

  const selectedTimeslotLabel = selectedTimeslot?.label || "Select timeslot";

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

    const selectionFor = (code) => {
      const key = String(code || "").toLowerCase();
      if (categorySelections[key] !== undefined) return categorySelections[key];
      if (categorySelections[code] !== undefined) return categorySelections[code];
      return undefined;
    };

    const categoryMin = (code) => {
      const key = String(code || "").toLowerCase();
      const v = paxConstraints?.perCategory?.[key]?.min;
      return Number.isFinite(Number(v)) ? Number(v) : 0;
    };

    const categoryMaxCap = (code, stockLimit) => {
      const key = String(code || "").toLowerCase();
      const cap = paxConstraints?.perCategory?.[key]?.max;
      const stock = Number(stockLimit) || 0;
      if (Number.isFinite(Number(cap))) {
        return Math.min(stock, Number(cap));
      }
      return stock;
    };

    const next = {};
    for (const category of activeCategoryAvailability) {
      const code = category.category;
      const stock = Number(category.availableQuantity) || 0;
      const maxCap = categoryMaxCap(code, stock);
      const minCap = categoryMin(code);
      const raw = selectionFor(code);
      if (raw !== undefined && raw !== "") {
        const requested = Number(raw);
        if (!Number.isNaN(requested)) {
          next[code] = Math.max(minCap, Math.min(maxCap, requested));
          continue;
        }
      }
      next[code] = 0;
    }

    let selectedTotal = activeCategoryAvailability.reduce(
      (sum, c) => sum + (Number(next[c.category]) || 0),
      0,
    );

    if (selectedTotal === 0) {
      for (const category of activeCategoryAvailability) {
        const code = category.category;
        const stock = Number(category.availableQuantity) || 0;
        const maxCap = categoryMaxCap(code, stock);
        const minCap = categoryMin(code);
        if (minCap > 0) {
          next[code] = Math.min(maxCap, minCap);
        }
      }
      selectedTotal = activeCategoryAvailability.reduce(
        (sum, c) => sum + (Number(next[c.category]) || 0),
        0,
      );
    }

    if (selectedTotal === 0) {
      const first = activeCategoryAvailability[0];
      const code = first.category;
      const stock = Number(first.availableQuantity) || 0;
      const maxCap = categoryMaxCap(code, stock);
      const minCap = categoryMin(code);
      if (minCap === 0) {
        next[code] = Math.max(0, Math.min(1, maxCap));
      }
    }

    return next;
  }, [activeCategoryAvailability, categorySelections, paxConstraints]);

  const totalSelectedQuantity = useMemo(
    () =>
      activeCategoryAvailability.reduce((sum, category) => {
        const code = category.category;
        return sum + (Number(categoryQuantities[code]) || 0);
      }, 0),
    [activeCategoryAvailability, categoryQuantities],
  );

  const perPaxValuesByOption = useMemo(() => {
    const expectedSize = Math.max(0, totalSelectedQuantity);
    const next = {};
    for (const option of perPaxOptions) {
      const existing = Array.isArray(perPaxOptionValues[option.uuid])
        ? perPaxOptionValues[option.uuid]
        : [];
      next[option.uuid] = Array.from({ length: expectedSize }, (_, index) => existing[index] ?? "");
    }
    return next;
  }, [perPaxOptionValues, perPaxOptions, totalSelectedQuantity]);

  const paxConstraintsHint = useMemo(() => {
    const bits = [];
    if (Number.isFinite(paxConstraints?.minPax) && paxConstraints.minPax > 0) {
      bits.push(`min ${paxConstraints.minPax} guest(s) total`);
    } else if (Number.isFinite(variantContext?.minPax) && variantContext.minPax > 0) {
      bits.push(`min ${variantContext.minPax} guest(s) total`);
    }
    if (Number.isFinite(paxConstraints?.maxPax) && paxConstraints.maxPax > 0) {
      bits.push(`max ${paxConstraints.maxPax} guest(s) total`);
    }
    if (Number.isFinite(variantContext?.minGroup) && variantContext.minGroup > 0) {
      bits.push(`min ${variantContext.minGroup} group(s)`);
    }
    const adultMin = paxConstraints?.perCategory?.adult?.min;
    if (Number.isFinite(adultMin) && adultMin > 0) {
      bits.push(`min ${adultMin} adult(s)`);
    }
    return bits.join(" · ");
  }, [paxConstraints, variantContext]);

  const selectionPassesPaxRules = useMemo(() => {
    if (!paxConstraints || activeCategoryAvailability.length === 0) return true;
    const ticketBreakdown = activeCategoryAvailability.map((category) => ({
      category: category.category,
      label: category.label,
      quantity: Number(categoryQuantities[category.category]) || 0,
    }));
    return validateTicketSelectionAgainstPaxConstraints(ticketBreakdown, paxConstraints).ok;
  }, [activeCategoryAvailability, categoryQuantities, paxConstraints]);

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

  function applyTravelDate(nextDate, closePopup = true) {
    setTravelDate(nextDate);
    setSelectedMonth(nextDate.slice(0, 7));
    if (!hasAvailability || !isAvailable) return;
    const day = sortedAvailabilityDays.find((entry) => entry.date === nextDate);
    setTimeslotUuid(day?.timeslots?.[0]?.uuid || "");
    if (closePopup) {
      setShowDatePopup(false);
      setShowTimeslotPopup(false);
    }
  }

  function onDateChange(nextDate) {
    applyTravelDate(nextDate, true);
  }

  function onOptionValueChange(optionUuid, nextValue) {
    setOptionError("");
    setOptionValues((prev) => ({
      ...prev,
      [optionUuid]: nextValue,
    }));
  }

  function onPerPaxOptionValueChange(optionUuid, guestIndex, nextValue) {
    setOptionError("");
    setPerPaxOptionValues((prev) => {
      const currentValues = Array.isArray(prev[optionUuid]) ? prev[optionUuid] : [];
      const nextValues = [...currentValues];
      nextValues[guestIndex] = nextValue;
      return {
        ...prev,
        [optionUuid]: nextValues,
      };
    });
  }

  function buildSelectedOptions() {
    const perBookingSelected = perBookingOptions
      .map((option) => ({
        uuid: option.uuid,
        scope: option.scope,
        name: option.name,
        required: Boolean(option.required),
        inputType: option.inputType,
        value: optionValues[option.uuid] ?? "",
      }))
      .filter((entry) => !isEmptyOptionValue(entry.value));
    const perPaxSelected = perPaxOptions.flatMap((option) => {
      const values = Array.isArray(perPaxValuesByOption[option.uuid])
        ? perPaxValuesByOption[option.uuid]
        : [];
      return values
        .map((value, guestIndex) => ({
          uuid: option.uuid,
          scope: option.scope,
          name: option.name,
          required: Boolean(option.required),
          inputType: option.inputType,
          value: value ?? "",
          guestIndex,
          guestLabel: `Guest ${guestIndex + 1}`,
        }))
        .filter((entry) => !isEmptyOptionValue(entry.value));
    });
    return [...perBookingSelected, ...perPaxSelected];
  }

  const getMissingRequiredFieldLabels = useCallback(() => {
    const missing = [];
    for (const option of requiredPerBookingOptions) {
      if (isEmptyOptionValue(optionValues[option.uuid])) {
        missing.push(toLabel(option));
      }
    }
    if (totalSelectedQuantity > 0) {
      for (const option of requiredPerPaxOptions) {
        const values = Array.isArray(perPaxValuesByOption[option.uuid])
          ? perPaxValuesByOption[option.uuid]
          : [];
        for (let guestIndex = 0; guestIndex < totalSelectedQuantity; guestIndex += 1) {
          if (isEmptyOptionValue(values[guestIndex])) {
            missing.push(`${toLabel(option)} (Guest ${guestIndex + 1})`);
          }
        }
      }
    }
    return missing;
  }, [
    optionValues,
    perPaxValuesByOption,
    requiredPerBookingOptions,
    requiredPerPaxOptions,
    totalSelectedQuantity,
  ]);

  const requiredDetailsComplete = useMemo(
    () => requiredOptions.length === 0 || getMissingRequiredFieldLabels().length === 0,
    [getMissingRequiredFieldLabels, requiredOptions.length],
  );

  function validateRequiredOptions() {
    if (requiredOptions.length === 0) return { ok: true, message: "" };
    const missing = getMissingRequiredFieldLabels();
    if (missing.length === 0) return { ok: true, message: "" };
    const names = missing.join(", ");
    return {
      ok: false,
      message: `Please fill required fields: ${names}`,
    };
  }

  function renderOptionInput(option, overrides = {}) {
    const value = overrides.value ?? optionValues[option.uuid] ?? "";
    const selectOptions =
      Array.isArray(option.values) && option.values.length > 0
        ? option.values
        : option.semanticType === "gender"
          ? DEFAULT_GENDER_OPTIONS
          : [];
    const commonProps = {
      value,
      required: Boolean(option.required),
      onChange:
        overrides.onChange || ((event) => onOptionValueChange(option.uuid, event.target.value)),
      placeholder: option.description || "",
    };
    if (selectOptions.length > 0) {
      return (
        <select {...commonProps}>
          <option value="">Select</option>
          {selectOptions.map((entry) => (
            <option key={`${option.uuid}:${entry.value || entry.label}`} value={entry.value}>
              {entry.label || entry.value}
            </option>
          ))}
        </select>
      );
    }
    if (option.inputType === "textarea") {
      return <textarea {...commonProps} rows={3} />;
    }
    if (option.semanticType === "passport_expiry") {
      const passportPlaceholder =
        option.description?.trim() ||
        (option.bmgFormatHint?.includes("YYYY-MM-DD")
          ? "YYYY-MM-DD"
          : option.bmgFormatHint?.includes("DD/MM/YYYY")
            ? "DD/MM/YYYY"
            : option.bmgFormatHint?.includes("DD-MM-YYYY")
              ? "DD-MM-YYYY"
              : "") ||
        "DD/MM/YYYY";
      return (
        <input
          {...commonProps}
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder={passportPlaceholder}
        />
      );
    }
    const inputType =
      option.semanticType === "dob"
        ? "date"
        : option.inputType === "time"
          ? "time"
          : option.inputType === "number"
            ? "number"
            : "text";
    const applyFormatRegex =
      option.inputType === "text" &&
      option.formatRegex &&
      option.semanticType !== "passport_expiry";
    return (
      <input
        {...commonProps}
        type={inputType}
        min={option.inputType === "number" && Number.isFinite(option.minNumber) ? option.minNumber : undefined}
        max={option.inputType === "number" && Number.isFinite(option.maxNumber) ? option.maxNumber : undefined}
        step={option.inputType === "number" ? "1" : undefined}
        pattern={applyFormatRegex ? option.formatRegex : undefined}
      />
    );
  }

  useEffect(() => {
    if (!showDatePopup && !showTimeslotPopup && !showOptionsModal) return undefined;
    const onEscape = (event) => {
      if (event.key !== "Escape") return;
      setShowDatePopup(false);
      setShowTimeslotPopup(false);
      setShowOptionsModal(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [showDatePopup, showTimeslotPopup, showOptionsModal]);

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
      // Keep calendar open while browsing months; only closing when a day is tapped.
      applyTravelDate(firstDateInMonth.date, false);
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

    if (paxConstraints) {
      const { ok, message } = validateTicketSelectionAgainstPaxConstraints(
        ticketBreakdown,
        paxConstraints,
      );
      if (!ok) {
        setPaxError(message);
        return;
      }
    }
    setPaxError("");

    const requiredValidation = validateRequiredOptions();
    if (!requiredValidation.ok) {
      setShowOptionsModal(true);
      setOptionError(requiredValidation.message);
      return;
    }

    const selectedOptions = buildSelectedOptions();

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
      selectedOptions,
      pricingContext,
      variantContext,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <div className={styles.wrap}>
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
          <button
            type="button"
            className={styles.popupTrigger}
            onClick={() => setShowDatePopup(true)}
            disabled={!hasAvailability}
          >
            {selectedDateLabel}
          </button>
        </label>
        <div className={styles.field}>
          <span>Total Quantity</span>
          <input type="number" min="0" value={totalSelectedQuantity} readOnly />
        </div>
      </div>
      <div className={styles.selectorRow}>
        <label className={styles.field}>
          <span>Timeslot</span>
          <button
            type="button"
            className={styles.popupTrigger}
            onClick={() => setShowTimeslotPopup(true)}
            disabled={!selectedAvailabilityDay || selectedAvailabilityDay.timeslots.length === 0}
          >
            {selectedAvailabilityDay?.timeslots?.length > 0
              ? selectedTimeslotLabel
              : "Date-based availability"}
          </button>
        </label>
        <div className={styles.field}>
          <span>Available Quantity</span>
          <input
            type="text"
            readOnly
            value={
              selectedAvailabilityDay?.timeslots?.length > 0
                ? selectedTimeslot?.availableQuantity ?? "N/A"
                : Number(selectedAvailabilityDay?.availableQuantity) || "N/A"
            }
          />
        </div>
      </div>
      {hasAvailability ? (
        <p className={styles.nearestText}>Nearest availability: {firstAvailableDate || "N/A"}</p>
      ) : null}
      {requiredOptions.length > 0 && (
        <button
          type="button"
          className={`${styles.manageOptionsButton} ${
            requiredDetailsComplete ? styles.manageOptionsButtonComplete : ""
          }`}
          onClick={() => {
            setOptionError("");
            setShowOptionsModal(true);
          }}
          aria-label={
            requiredDetailsComplete
              ? "Additional booking details complete. Open to edit."
              : `Add required booking details, ${requiredOptions.length} field group(s)`
          }
        >
          {requiredDetailsComplete ? (
            <>
              <span className={styles.completionCheck} aria-hidden="true">
                ✓
              </span>
              <span>Additional details complete</span>
            </>
          ) : (
            <span>Add required details ({requiredOptions.length})</span>
          )}
        </button>
      )}
      {activeCategoryAvailability.length > 0 && (
        <section className={styles.ticketMix}>
          <p className={styles.ticketMixTitle}>Ticket Types</p>
          {paxConstraintsHint ? (
            <p className={styles.constraintsHint}>
              BeMyGuest booking limits: {paxConstraintsHint}.
            </p>
          ) : null}
          <div className={styles.ticketMixGrid}>
            {activeCategoryAvailability.map((category) => (
              <label key={category.category} className={styles.ticketMixRow}>
                <span>
                  {category.label} (max {category.availableQuantity})
                </span>
                <input
                  type="number"
                  min={String(
                    (() => {
                      const key = String(category.category || "").toLowerCase();
                      const v = paxConstraints?.perCategory?.[key]?.min;
                      return Number.isFinite(Number(v)) ? Number(v) : 0;
                    })(),
                  )}
                  max={String(
                    (() => {
                      const key = String(category.category || "").toLowerCase();
                      const cap = paxConstraints?.perCategory?.[key]?.max;
                      const stock = Number(category.availableQuantity) || 0;
                      if (Number.isFinite(Number(cap))) {
                        return Math.min(stock, Number(cap));
                      }
                      return stock;
                    })(),
                  )}
                  value={categoryQuantities[category.category] ?? 0}
                  onChange={(event) => {
                    setPaxError("");
                    const key = String(category.category || "").toLowerCase();
                    const stock = Number(category.availableQuantity) || 0;
                    const apiMax = paxConstraints?.perCategory?.[key]?.max;
                    const maxCap = Number.isFinite(Number(apiMax))
                      ? Math.min(stock, Number(apiMax))
                      : stock;
                    const apiMin = paxConstraints?.perCategory?.[key]?.min;
                    const minCap = Number.isFinite(Number(apiMin)) ? Number(apiMin) : 0;
                    const nextValue = Math.max(
                      minCap,
                      Math.min(maxCap, Number(event.target.value) || 0),
                    );
                    setCategorySelections((prev) => ({
                      ...prev,
                      [key]: nextValue,
                    }));
                  }}
                />
              </label>
            ))}
          </div>
        </section>
      )}
      {paxError ? <p className={styles.unavailableText}>{paxError}</p> : null}
      {optionError ? <p className={styles.unavailableText}>{optionError}</p> : null}
      <button
        type="button"
        className={styles.button}
        onClick={onAdd}
        disabled={
          !hasAvailability ||
          !isAvailable ||
          totalSelectedQuantity <= 0 ||
          !selectionPassesPaxRules
        }
      >
        {added ? "Added to cart" : "Add to cart"}
      </button>

      {showDatePopup && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowDatePopup(false);
          }}
        >
          <div className={styles.popupCard}>
            <div className={styles.modalHeader}>
              <h3>Select travel date</h3>
              <button
                type="button"
                onClick={() => setShowDatePopup(false)}
                className={styles.modalClose}
              >
                Close
              </button>
            </div>
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
                  <span>{day.date.slice(8, 10)}</span>
                  <small>{(day.weekday || "Day").slice(0, 3)}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showTimeslotPopup && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowTimeslotPopup(false);
          }}
        >
          <div className={styles.popupCard}>
            <div className={styles.modalHeader}>
              <h3>Select timeslot</h3>
              <button
                type="button"
                onClick={() => setShowTimeslotPopup(false)}
                className={styles.modalClose}
              >
                Close
              </button>
            </div>
            {!selectedAvailabilityDay || selectedAvailabilityDay.timeslots.length === 0 ? (
              <p className={styles.modalHint}>No timeslots are required for this selected date.</p>
            ) : (
              <div className={styles.timeslotList}>
                {selectedAvailabilityDay.timeslots.map((slot) => (
                  <button
                    key={slot.uuid}
                    type="button"
                    className={`${styles.timeslotButton} ${
                      slot.uuid === selectedTimeslot?.uuid ? styles.timeslotButtonActive : ""
                    }`}
                    onClick={() => {
                      setTimeslotUuid(slot.uuid);
                      setShowTimeslotPopup(false);
                    }}
                  >
                    <span>{slot.label}</span>
                    <small>{slot.availableQuantity} left</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showOptionsModal && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowOptionsModal(false);
          }}
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleRow}>
                <h3>Required booking details</h3>
                {requiredDetailsComplete ? (
                  <span className={styles.completionBadge}>
                    <span className={styles.completionBadgeIcon} aria-hidden="true">
                      ✓
                    </span>
                    Complete
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setShowOptionsModal(false)}
                className={styles.modalClose}
              >
                Close
              </button>
            </div>
            <p className={styles.modalHint}>
              These fields come directly from BeMyGuest product options and must be completed accurately.
            </p>
            {perBookingOptions.length > 0 ? (
              <section className={styles.optionSection}>
                <h4>Per booking details</h4>
                <div className={styles.modalGrid}>
                  {perBookingOptions.map((option) => (
                    <label key={option.uuid} className={styles.modalField}>
                      <span>
                        {toLabel(option)} {option.required ? "*" : ""}
                      </span>
                      {renderOptionInput(option)}
                      {toOptionHint(option) ? (
                        <small className={styles.optionHint}>{toOptionHint(option)}</small>
                      ) : null}
                    </label>
                  ))}
                </div>
              </section>
            ) : null}
            {perPaxOptions.length > 0 ? (
              <section className={styles.optionSection}>
                <h4>Per guest details</h4>
                <div className={styles.modalGrid}>
                  {perPaxOptions.map((option) => (
                    <div key={option.uuid} className={styles.perGuestBlock}>
                      <p className={styles.perGuestTitle}>
                        {toLabel(option)} {option.required ? "*" : ""}
                      </p>
                      <div className={styles.perGuestRows}>
                        {Array.from({ length: Math.max(0, totalSelectedQuantity) }, (_, guestIndex) => (
                          <label
                            key={`${option.uuid}:guest:${guestIndex}`}
                            className={styles.perGuestRow}
                          >
                            <span className={styles.perGuestLabel}>Guest {guestIndex + 1}</span>
                            {renderOptionInput(option, {
                              value: perPaxValuesByOption?.[option.uuid]?.[guestIndex] ?? "",
                              onChange: (event) =>
                                onPerPaxOptionValueChange(
                                  option.uuid,
                                  guestIndex,
                                  event.target.value,
                                ),
                            })}
                          </label>
                        ))}
                      </div>
                      <small className={styles.optionHint}>
                        {toScopeLabel(option.scope)} field
                        {toOptionHint(option) ? ` · ${toOptionHint(option)}` : ""}
                      </small>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalSave}
                onClick={() => {
                  const result = validateRequiredOptions();
                  if (!result.ok) {
                    setOptionError(result.message);
                    return;
                  }
                  setOptionError("");
                  setShowOptionsModal(false);
                }}
              >
                Save details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
