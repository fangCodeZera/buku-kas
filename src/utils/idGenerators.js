/**
 * utils/idGenerators.js
 * Pure utility functions: ID generation, formatting helpers, constants.
 * No state, no UI — safe to import anywhere.
 */

/** Generate a unique ID using timestamp + random suffix */
export const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** Format a number as Indonesian Rupiah currency string */
export const fmtIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);

/**
 * Return today's date as YYYY-MM-DD in the user's LOCAL timezone.
 *
 * Why local here, not UTC:
 *   This date is used for RECORDING transactions and DISPLAYING the calendar
 *   view — both of which must match what the user sees on their clock.
 *   e.g. Jakarta (UTC+7) at 2AM on 14 March: local date = "2026-03-14",
 *   but new Date().toISOString() = "2026-03-13T19:00:00Z" — wrong day.
 *
 * Contrast with addDays() / diffDays() which parse stored YYYY-MM-DD strings
 * as UTC midnight (T00:00:00Z) for arithmetic — those stay UTC intentionally.
 */
export const today = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

/**
 * Add N calendar days to a YYYY-MM-DD date string.
 * Returns a YYYY-MM-DD string, or null if the input is invalid.
 * Uses local midnight to avoid DST shifts.
 */
export const addDays = (dateStr, days) => {
  try {
    if (!dateStr || typeof dateStr !== "string") return null;
    // Parse as UTC midnight — avoids local-timezone offset shifting the date
    // e.g. Jakarta (UTC+7): "2026-03-09T00:00:00" local = "2026-03-08T17:00:00Z"
    // which makes toISOString() return "2026-03-08", losing a day before we add any.
    const d = new Date(dateStr + "T00:00:00Z");
    if (isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10); // always YYYY-MM-DD in UTC
  } catch {
    return null;
  }
};

/**
 * Return the number of days from date1 to date2 (positive = date2 is in the future).
 * Both args are YYYY-MM-DD strings. Returns null if either is invalid.
 */
export const diffDays = (date1Str, date2Str) => {
  try {
    if (!date1Str || !date2Str) return null;
    // UTC midnight for both — consistent with addDays, no timezone drift
    const d1 = new Date(date1Str + "T00:00:00Z");
    const d2 = new Date(date2Str + "T00:00:00Z");
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

/** Return current time as HH:MM */
export const nowTime = () => new Date().toTimeString().slice(0, 5);

/** Format a YYYY-MM-DD date string to readable Indonesian format */
export const fmtDate = (d) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

/** Normalize an item name for use as a map key (trimmed, lowercase) */
export const normItem = (s) => (s || "").trim().toLowerCase();

/**
 * Normalize a string to title case for consistent display storage.
 * Each word's first letter is uppercased, rest lowercased.
 * E.g. "bawang PUTIH" → "Bawang Putih", "  garlic  " → "Garlic"
 * Safe with numbers/special chars (e.g. "Supplier 8U1H" → "Supplier 8u1h").
 */
export const normalizeTitleCase = (s) => {
  if (!s) return "";
  const titleCased = s
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
    
  return titleCased.replace(/\b(Pt|Cv|Ud|Tb)\b/gi, (match) => match.toUpperCase());
};

/**
 * Generate a human-readable transaction ID in the format YY-MM-XXXXX.
 * The XXXXX serial resets each calendar year and is based on existing
 * transactions that share the same YY- prefix.
 *
 * @param {Array}  transactions - current transactions array (to count existing serials)
 * @param {string} dateStr      - YYYY-MM-DD date of the new transaction
 * @returns {string} e.g. "26-03-00001"
 */
export const generateTxnId = (transactions, dateStr) => {
  const yy = (dateStr || today()).slice(2, 4);  // "2026-03-10" → "26"
  const mm = (dateStr || today()).slice(5, 7);  // "2026-03-10" → "03"
  const prefix = `${yy}-`;

  // Find the highest existing serial for this year (not just count — avoids
  // duplicate IDs after deletions). Parse the last 5 chars of each matching txnId.
  const maxSerial = (transactions || []).reduce((max, t) => {
    if (t.type !== "income") return max; // only income transactions use auto-generated IDs
    if (!t.txnId || !t.txnId.startsWith(prefix)) return max;
    const num = parseInt(t.txnId.slice(-5), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  const serial = String(maxSerial + 1).padStart(5, "0");
  return `${yy}-${mm}-${serial}`;
};



// ─── Rupiah Input Formatting Helpers ─────────────────────────────────────────

/**
 * Convert a raw digit string (no commas) to a comma-formatted display string.
 * E.g. "5000000" → "5,000,000"
 */
export const toCommaDisplay = (digits) => {
  if (!digits || digits === "0" || digits === "") return "";
  const stripped = digits.replace(/^0+/, "") || "0";
  if (stripped === "0") return "";
  return stripped.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/**
 * Convert a stored numeric value to a comma-formatted display string.
 * E.g. 1500000 → "1,500,000"
 */
export const numToDisplay = (n) => {
  if (!n || n === 0) return "";
  const s = Math.round(Number(n)).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/**
 * Parse a comma-formatted display string to a clean integer for storage.
 * E.g. "1,500,000" → 1500000
 */
export const displayToNum = (s) => {
  const digits = s.replace(/[^0-9]/g, "");
  if (!digits) return 0;
  return parseInt(digits.replace(/^0+/, "") || "0", 10);
};