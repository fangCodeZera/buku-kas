/**
 * utils/paymentUtils.js
 * Shared payment progress calculation.
 * No state, no UI, no React — safe to import anywhere.
 */

/**
 * Compute the payment progress percentage for a transaction.
 *
 * @param {number} value       - total transaction value
 * @param {number} outstanding - remaining outstanding amount
 * @returns {{ percent: number } | null}  null if value is 0 (cannot compute)
 */
export function computePaymentProgress(value, outstanding) {
  const val = Number(value) || 0;
  const out = Number(outstanding) || 0;
  if (val === 0) return null;
  const percent = val > 0 ? Math.round(((val - out) / val) * 100) : 0;
  return { percent };
}
