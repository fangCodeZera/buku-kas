/**
 * utils/statusUtils.js
 * Single source of truth for all payment status strings.
 *
 * WHY THIS EXISTS:
 *   Status strings are written in 3 places (applyPayment, TransactionForm,
 *   storage migrateData) and read in 2 places (Badge.js, balanceUtils.js).
 *   A mismatch causes silent badge failures and wrong AR/AP totals.
 *   Centralising here means a string change only needs to happen once.
 *
 * USAGE:
 *   import { STATUS, deriveStatus, isUnpaid } from "../utils/statusUtils";
 *   status = deriveStatus(tx.type, newOutstanding > 0);
 */

/** All valid status string constants. Reference these — never write raw strings. */
export const STATUS = {
  LUNAS:           "Lunas",
  PARTIAL_INCOME:  "Belum Lunas (Piutang)",   // income tx, still owed by client
  PARTIAL_EXPENSE: "Belum Lunas (Utang)",      // expense tx, we still owe supplier
};

/**
 * Derive the correct stored status for a transaction.
 *
 * @param {"income"|"expense"} type       - transaction type
 * @param {boolean}            isPartial  - true when outstanding > 0
 * @returns {string}  one of STATUS.*
 */
export function deriveStatus(type, isPartial) {
  if (!isPartial) return STATUS.LUNAS;
  return type === "income" ? STATUS.PARTIAL_INCOME : STATUS.PARTIAL_EXPENSE;
}

/**
 * Return true if a status string represents an unpaid/partial transaction.
 * Used for AR/AP filtering and badge display.
 *
 * @param {string} status
 * @returns {boolean}
 */
export function isUnpaid(status) {
  return status === STATUS.PARTIAL_INCOME || status === STATUS.PARTIAL_EXPENSE;
}

/**
 * Legacy status strings from v1/v2 data that must be migrated.
 * Maps old string → new string.
 * Used exclusively by storage.js migrateData().
 */
export const LEGACY_STATUS_MAP = {
  "Sebagian Dibayar (Piutang)": STATUS.PARTIAL_INCOME,
  "Sebagian Dibayar (Utang)":   STATUS.PARTIAL_EXPENSE,
  "Belum Dibayar":              null, // needs tx.type to resolve — handled in migrateData
};