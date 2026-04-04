"use client";

import { useState } from "react";
import styles from "./task-15-runner.module.css";

export default function Task15Runner() {
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function runTask15() {
    setLoading(true);
    setErrorMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/integration/task-15-run", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Task 15 execution failed.");
      }
      setResult(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown task error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.button} onClick={runTask15} disabled={loading}>
        {loading ? "Running..." : "Run Task 15 Booking Flow"}
      </button>

      {errorMessage && <p className={styles.error}>{errorMessage}</p>}

      {result && (
        <div className={styles.result}>
          <p>
            <strong>Result</strong>
            <span>{result.expectedResult}</span>
          </p>
          <p>
            <strong>Arrival Date</strong>
            <span>{result.arrivalDate}</span>
          </p>
          <p>
            <strong>Booking UUID</strong>
            <span>{result.bookingUuid}</span>
          </p>
          <p>
            <strong>Create API HTTP Status</strong>
            <span>{result.createStatus}</span>
          </p>
          <p>
            <strong>Confirm API HTTP Status</strong>
            <span>{result.confirmStatus}</span>
          </p>
          <p>
            <strong>walletBlockedBalance Before</strong>
            <span>{result.walletBlockedBalanceBefore}</span>
          </p>
          <p>
            <strong>walletBlockedBalance After</strong>
            <span>{result.walletBlockedBalanceAfter}</span>
          </p>
          <p>
            <strong>Partner Reference</strong>
            <span>{result.partnerReference}</span>
          </p>
        </div>
      )}
    </div>
  );
}
