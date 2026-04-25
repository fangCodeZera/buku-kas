/**
 * utils/reportUtils.js
 * Shared computation helpers for Reports.js and ReportModal.js.
 */

/**
 * For a multi-item transaction, compute the combined contribution of ALL selected items.
 * Returns null when no filter is active, transaction has 0 or 1 items, all items match,
 * or none match (only returns non-null when there is a genuine mix).
 *
 * @param {Object}   t        - transaction
 * @param {string[]} selItems - active item filter names (array, any length)
 * @returns {{ filteredItems, otherItems, combinedSubtotal,
 *             combinedProportionalOutstanding, combinedCashValue,
 *             totalTransactionValue, totalOutstanding } | null}
 */
export function getMultiItemContribution(t, selItems) {
  if (!selItems || selItems.length === 0) return null;
  if (!Array.isArray(t.items) || t.items.length <= 1) return null;

  const filteredItems = t.items.filter((it) => selItems.includes(it.itemName));
  const otherItems    = t.items.filter((it) => !selItems.includes(it.itemName));

  if (filteredItems.length === 0 || otherItems.length === 0) return null;

  const combinedSubtotal = filteredItems.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  const totalTransactionValue = Number(t.value) || 0;
  const totalOutstanding      = Number(t.outstanding) || 0;
  const combinedProportionalOutstanding = totalTransactionValue > 0
    ? Math.round((combinedSubtotal / totalTransactionValue) * totalOutstanding)
    : 0;
  const combinedCashValue = combinedSubtotal - combinedProportionalOutstanding;

  return {
    filteredItems,
    otherItems,
    combinedSubtotal,
    combinedProportionalOutstanding,
    combinedCashValue,
    totalTransactionValue,
    totalOutstanding,
  };
}
