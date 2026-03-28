/**
 * utils/stockUtils.js
 * Stock computation logic — pure function, no side effects.
 * Takes a transactions array and returns a stock map keyed by normalized item name.
 */

import { normItem, normalizeTitleCase } from "./idGenerators";

/**
 * Compute the current stock for every item from the full transaction history.
 *
 * Rules:
 *   - expense (purchase/incoming) → stock increases (+qty)
 *   - income  (sale/outgoing)     → stock decreases (−qty)
 *
 * @param {Array} transactions
 * @param {Array} [stockAdjustments=[]]  — manual quantity adjustments from Inventory page
 * @returns {Object} stockMap  — { [normalizedName]: { displayName, qty, unit, lastDate, lastTime, txCount } }
 */
export function computeStockMap(transactions, stockAdjustments = []) {
  const map = {};

  // Process chronologically (oldest first) so stock deltas accumulate correctly
  const sorted = [...transactions].sort((a, b) => {
    const ta = a.createdAt
      ? new Date(a.createdAt).getTime()
      : new Date((a.date || "1970-01-01") + "T" + (a.time || "00:00") + ":00Z").getTime();
    const tb = b.createdAt
      ? new Date(b.createdAt).getTime()
      : new Date((b.date || "1970-01-01") + "T" + (b.time || "00:00") + ":00Z").getTime();
    return ta - tb; // ascending, oldest first
  });

  for (const t of sorted) {
    // Multi-item support: use items[] if present, else fall back to top-level fields
    const itemList = Array.isArray(t.items) && t.items.length > 0
      ? t.items.map((it) => ({ itemName: it.itemName, sackQty: it.sackQty }))
      : [{ itemName: t.itemName, sackQty: t.sackQty != null ? t.sackQty : (t.stockQty || 0) }];

    for (const item of itemList) {
      const key = normItem(item.itemName);
      if (!key) continue;

      const qty   = parseFloat(item.sackQty) || 0;
      const delta = t.type === "expense" ? qty : -qty;

      if (!map[key]) {
        map[key] = {
          displayName: normalizeTitleCase(item.itemName),
          qty: 0,
          unit: "karung",
          lastDate: t.date,
          lastTime: t.time,
          txCount: 0,
        };
      }

      map[key].qty        += delta;
      map[key].lastDate    = t.date;
      map[key].lastTime    = t.time;
      map[key].txCount    += 1;
      // Prefer the transaction's declared stockUnit; fall back to whatever is already in the map; final fallback "karung"
      map[key].unit        = t.stockUnit || map[key].unit || "karung";

      // Always keep displayName as the normalized title-case version
      map[key].displayName = normalizeTitleCase(item.itemName);
    }
  }

  // Apply manual stock adjustments on top of transaction-derived quantities.
  // Adjustments are sorted chronologically so lastDate reflects the most recent event.
  const sortedAdj = [...stockAdjustments].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  for (const adj of sortedAdj) {
    const key = normItem(adj.itemName);
    if (!key) continue;

    if (!map[key]) {
      // Item exists only in adjustments — no transactions yet
      map[key] = {
        displayName: normalizeTitleCase(adj.itemName),
        qty:      0,
        unit:     adj.unit || "karung",
        lastDate: adj.date || null,
        lastTime: adj.time || null,
        txCount:  0,
      };
    }

    map[key].qty += adj.adjustmentQty;
    if (!map[key].lastDate || (adj.date && adj.date >= map[key].lastDate)) {
      map[key].lastTime = adj.date > (map[key].lastDate || "")
        ? (adj.time || null)
        : (adj.time && adj.time > (map[key].lastTime || "") ? adj.time : map[key].lastTime);
      map[key].lastDate = adj.date || map[key].lastDate;
    }
  }

  return map;
}

/**
 * Compute stock as it stood at the END of a specific date.
 * Identical to computeStockMap but only considers transactions and adjustments
 * whose date is <= viewDate.
 *
 * @param {Array}  transactions
 * @param {string} viewDate          — YYYY-MM-DD cutoff date (inclusive)
 * @param {Array}  [stockAdjustments=[]]
 * @returns {Object} stockMap snapshot for that date
 */
export function computeStockMapForDate(transactions, viewDate, stockAdjustments = []) {
  const filteredTx  = transactions.filter((t)   => (t.date   || "") <= viewDate);
  const filteredAdj = stockAdjustments.filter((a) => (a.date  || "") <= viewDate);
  return computeStockMap(filteredTx, filteredAdj);
}