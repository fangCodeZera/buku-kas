/**
 * utils/balanceUtils.js
 * Balance computation helpers — pure functions, no side effects.
 *
 * Accounts Receivable (AR): money customers still owe us   (income + outstanding > 0)
 * Accounts Payable   (AP): money we still owe suppliers    (expense + outstanding > 0)
 *
 * Cash-basis totals: only count money actually received / paid.
 *   Cash income  = sum(value - outstanding) for income transactions
 *   Cash expense = sum(value - outstanding) for expense transactions
 * This means partially-paid / unpaid portions do NOT count until settled.
 */

/**
 * Compute global AR and AP totals from all transactions.
 * Unchanged — used for debt-tracking cards everywhere.
 *
 * @param {Array} transactions
 * @returns {{ ar: number, ap: number }}
 */
export function computeARandAP(transactions) {
  let ar = 0;
  let ap = 0;

  for (const t of transactions) {
    const out = Number(t.outstanding) || 0;
    if (out <= 0) continue;

    if (t.type === "income") {
      ar += out; // Buyer owes us
    } else {
      ap += out; // We owe supplier
    }
  }

  return { ar, ap };
}

/**
 * Cash-basis income: sum of (value − outstanding) for all income transactions.
 * Represents money we have actually received (not just invoiced).
 *
 * @param {Array} transactions
 * @returns {number}
 */
export function computeCashIncome(transactions) {
  return transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + (Number(t.value) - (Number(t.outstanding) || 0)), 0);
}

/**
 * Cash-basis expense: sum of (value − outstanding) for all expense transactions.
 * Represents money we have actually paid out.
 *
 * @param {Array} transactions
 * @returns {number}
 */
export function computeCashExpense(transactions) {
  return transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + (Number(t.value) - (Number(t.outstanding) || 0)), 0);
}

/**
 * Net cash position: cashIncome − cashExpense.
 *
 * @param {Array} transactions
 * @returns {number}
 */
export function computeNetCash(transactions) {
  return computeCashIncome(transactions) - computeCashExpense(transactions);
}