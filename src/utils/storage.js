/**
 * utils/storage.js
 * localStorage persistence helpers.
 * All storage concerns are isolated here — no UI, no React.
 */
import { deriveStatus, LEGACY_STATUS_MAP } from "./statusUtils";
import { addDays, generateId, normItem } from "./idGenerators";

export const STORAGE_KEY    = "bukukas_data_v2";
export const NORM_VERSION   = 14; // bump when a new migration is needed

export const defaultData = {
  transactions: [],
  contacts: [],
  stockAdjustments: [],
  itemCategories: [],
  itemCatalog: [],
  settings: {
    businessName: "Usaha Keluarga Saya",
    address: "",
    phone: "",
    lowStockThreshold: 10,
    bankAccounts: [],
    maxBankAccountsOnInvoice: 1,
    lastExportDate: null,
    defaultDueDateDays: 14,
  },
};

/** Simple title-case — mirrors normalizeTitleCase from idGenerators (no import needed here) */
const tc = (s) =>
  (s || "").trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * One-time migration: normalize all itemName / counterparty / contact names
 * to title case. Runs only when normVersion < NORM_VERSION in stored data.
 *
 * v1: title-case names
 * v2: backfill createdAt
 * v3: migrate old status strings to simplified "Belum Lunas (Piutang|Utang)" scheme
 * v6: wrap single-item transactions into items[] array for multi-item support
 * v7: migrate flat bankName/bankAccount/bankAccountName to bankAccounts[] array
 * v8: add stockAdjustments[] top-level array (no migration code needed — defaultData shallow-merge handles it)
 * v9: backfill paymentHistory[] for all existing transactions
 * v10: (a) fix paymentHistory[0].amount=0 where (value - outstanding) > 0 (v9 bug);
 *      (b) backfill time field on all existing paymentHistory entries
 * v11: backfill time and adjustedBy fields on all existing stockAdjustments
 * v12: add itemCategories[] top-level array (no migration code needed — defaultData shallow-merge handles it)
 * v13: auto-populate itemCatalog from itemCategories + transactions (only ran when catalog was empty)
 * v14: backfill any items from transactions/adjustments not covered by v13 catalog
 *      (fixes items that were in itemCategories.items[] but didn't match the groupName prefix,
 *       so were silently excluded from the catalog in v13)
 */
function migrateData(data) {
  if ((data._normVersion || 0) >= NORM_VERSION) return data;

  const transactions = (data.transactions || []).map((t) => {
    // ── v1 + v2 fields ────────────────────────────────────────────────────────
    const itemName     = tc(t.itemName);
    const counterparty = tc(t.counterparty);
    const createdAt    = t.createdAt || (
      t.date && t.time
        ? `${t.date}T${t.time}:00.000Z`
        : new Date().toISOString()
    );

    // ── v3: migrate status to new simplified scheme via statusUtils ──────────
    let status = t.status;
    if (status in LEGACY_STATUS_MAP) {
      status = LEGACY_STATUS_MAP[status] ?? deriveStatus(t.type, true);
    } else if (status !== "Lunas" && !status?.startsWith("Belum Lunas")) {
      status = deriveStatus(t.type, (t.outstanding || 0) > 0);
    }

    // ── v4 + v5: set / recompute dueDate using UTC-correct addDays ───────────
    // v4 backfilled missing dueDates; v5 recomputes ALL existing dueDates because
    // the prior addDays used local-midnight which caused an off-by-1 in UTC+
    // timezones (e.g. Jakarta UTC+7: "2026-03-09" local = "2026-03-08" UTC,
    // so +14 produced "2026-03-22" instead of "2026-03-23").
    // Now addDays uses T00:00:00Z — always correct regardless of timezone.
    const out = Number(t.outstanding) || 0;
    let dueDate;
    if (out === 0) {
      dueDate = null; // fully paid — no due tracking
    } else {
      // Always recompute from tx.date so existing off-by-1 data is corrected
      dueDate = addDays(t.date, t.customDueDays ?? 14) ?? null;
    }

    // ── v6: wrap single-item transactions into items[] array ─────────────────
    const hasItems = Array.isArray(t.items) && t.items.length > 0;
    const items = hasItems
      ? t.items
      : [{
          itemName:   itemName,
          sackQty:    t.sackQty != null ? t.sackQty : (t.stockQty || 0),
          weightKg:   t.weightKg   || 0,
          pricePerKg: t.pricePerKg || 0,
          subtotal:   t.value      || 0,
        }];

    // ── v9: backfill paymentHistory for existing transactions ─────────────────
    let paymentHistory = t.paymentHistory;
    if (!paymentHistory) {
      const val        = Number(t.value) || 0;
      const outNow     = Number(t.outstanding) || 0;
      const initialPaid = val - outNow;
      if (outNow === 0) {
        paymentHistory = [{
          id:                generateId(),
          paidAt:            createdAt,
          date:              t.date || "",
          time:              "00:00",
          amount:            val,
          outstandingBefore: val,
          outstandingAfter:  0,
          note:              "Lunas (data lama — riwayat tidak tersedia)",
          method:            null,
        }];
      } else {
        paymentHistory = [{
          id:                generateId(),
          paidAt:            createdAt,
          date:              t.date || "",
          time:              "00:00",
          amount:            initialPaid > 0 ? initialPaid : 0,
          outstandingBefore: val,
          outstandingAfter:  outNow,
          note:              initialPaid > 0
            ? "Pembayaran awal (data lama — riwayat tidak tersedia)"
            : "Belum ada pembayaran (data lama — riwayat tidak tersedia)",
          method:            null,
        }];
      }
    }

    // ── v10: (a) backfill time on all entries; (b) fix first entry amount=0 ──
    paymentHistory = paymentHistory.map((entry, idx) => {
      let fixed = entry.time != null ? entry : { ...entry, time: "00:00" };
      // Fix first entry where amount was incorrectly set to 0 by v9 migration
      // but there was actually an initial payment (value - outstanding > 0)
      if (idx === 0 && fixed.amount === 0) {
        const val     = Number(t.value) || 0;
        const outNow  = Number(t.outstanding) || 0;
        const paid    = val - outNow;
        if (paid > 0) {
          fixed = {
            ...fixed,
            amount:           paid,
            outstandingAfter: outNow,
            note:             "Pembayaran awal (data lama — riwayat tidak tersedia)",
          };
        }
      }
      return fixed;
    });

    return { ...t, itemName, counterparty, createdAt, status, dueDate, items, paymentHistory };
  });

  const contacts = (data.contacts || []).map((c) => ({
    ...c,
    name: tc(c.name),
  }));

  // ── v7: migrate flat bank fields to bankAccounts[] ───────────────────────
  const s = data.settings || {};
  let settings = s;
  if (!Array.isArray(s.bankAccounts)) {
    const firstAccount = (s.bankName || s.bankAccount || s.bankAccountName)
      ? [{
          id:            "bank_1",
          bankName:      s.bankName        || "",
          accountNumber: s.bankAccount     || "",
          accountName:   s.bankAccountName || "",
          showOnInvoice: true,
        }]
      : [];
    const { bankName, bankAccount, bankAccountName, ...rest } = s;
    settings = {
      ...rest,
      bankAccounts: firstAccount,
      maxBankAccountsOnInvoice: s.maxBankAccountsOnInvoice ?? 1,
    };
  }

  // ── v11: backfill time and adjustedBy on existing stockAdjustments ──────────
  const stockAdjustments = (data.stockAdjustments || []).map((a) => ({
    ...a,
    time:       a.time       != null ? a.time       : "00:00",
    adjustedBy: a.adjustedBy != null ? a.adjustedBy : null,
  }));

  // ── v12: add itemCategories array ──────────────────────────────────────────
  const itemCategories = data.itemCategories || [];

  // ── v13: auto-populate itemCatalog from itemCategories + transactions ───────
  let itemCatalog = data.itemCatalog || [];
  if (itemCatalog.length === 0) {
    // Collect all item names + units from transactions and stock adjustments
    const itemUnits = new Map(); // normItem key → { displayName, units[] }
    for (const t of transactions) {
      const itList = Array.isArray(t.items) && t.items.length > 0
        ? t.items
        : [{ itemName: t.itemName }];
      for (const it of itList) {
        if (!it.itemName) continue;
        const key = normItem(it.itemName);
        if (!itemUnits.has(key)) itemUnits.set(key, { displayName: it.itemName, units: [] });
        if (t.stockUnit) itemUnits.get(key).units.push(t.stockUnit);
      }
    }
    for (const a of (data.stockAdjustments || [])) {
      if (!a.itemName) continue;
      const key = normItem(a.itemName);
      if (!itemUnits.has(key)) itemUnits.set(key, { displayName: a.itemName, units: [] });
      if (a.unit) itemUnits.get(key).units.push(a.unit);
    }

    const mostCommonUnit = (units) => {
      if (!units || !units.length) return "karung";
      const cnt = {};
      for (const u of units) cnt[u] = (cnt[u] || 0) + 1;
      return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
    };

    const covered = new Set();
    const catalog = [];

    // Primary: build entries from itemCategories
    for (const cat of itemCategories) {
      if (!cat.groupName) continue;
      const groupNorm = normItem(cat.groupName);
      const subtypes = [];
      for (const normFullName of (cat.items || [])) {
        covered.add(normFullName);
        if (normFullName === groupNorm) continue;
        if (normFullName.startsWith(groupNorm + " ")) {
          const subtypePart = normFullName.slice(groupNorm.length + 1).trim();
          if (subtypePart) subtypes.push(tc(subtypePart));
        }
      }
      covered.add(groupNorm);
      const units = [];
      for (const n of (cat.items || [])) {
        const e = itemUnits.get(n);
        if (e) units.push(...e.units);
      }
      catalog.push({ id: generateId(), name: tc(cat.groupName), defaultUnit: mostCommonUnit(units), subtypes });
    }

    // Fallback: items in transactions not covered by any category
    for (const [normName, { displayName, units }] of itemUnits) {
      if (!covered.has(normName)) {
        catalog.push({ id: generateId(), name: tc(displayName), defaultUnit: mostCommonUnit(units), subtypes: [] });
      }
    }

    itemCatalog = catalog;
  }

  // ── v14: backfill items from transactions/adjustments not covered by itemCatalog ──
  // Fixes items that were in itemCategories.items[] under a different group prefix
  // (e.g. "Bawang Shallot France" under "Bawang Merah") — v13 added them to `covered`
  // but never created catalog entries for them.
  const allItemUnitsV14 = new Map(); // normKey → { displayName, units[] }
  for (const t of transactions) {
    const itList = Array.isArray(t.items) && t.items.length > 0
      ? t.items
      : [{ itemName: t.itemName }];
    for (const it of itList) {
      if (!it.itemName) continue;
      const key = normItem(it.itemName);
      if (!allItemUnitsV14.has(key)) allItemUnitsV14.set(key, { displayName: it.itemName, units: [] });
      if (t.stockUnit) allItemUnitsV14.get(key).units.push(t.stockUnit);
    }
  }
  for (const a of stockAdjustments) {
    if (!a.itemName) continue;
    const key = normItem(a.itemName);
    if (!allItemUnitsV14.has(key)) allItemUnitsV14.set(key, { displayName: a.itemName, units: [] });
    if (a.unit) allItemUnitsV14.get(key).units.push(a.unit);
  }

  // An item is "covered" if it matches a catalog entry's name OR name+subtype
  const coveredV14 = new Set();
  for (const cat of itemCatalog) {
    coveredV14.add(normItem(cat.name));
    for (const sub of (cat.subtypes || [])) {
      coveredV14.add(normItem(cat.name + " " + sub));
    }
  }

  const mostCommonUnitV14 = (units) => {
    if (!units || !units.length) return "karung";
    const cnt = {};
    for (const u of units) cnt[u] = (cnt[u] || 0) + 1;
    return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
  };

  const newV14Entries = [];
  for (const [normName, { displayName, units }] of allItemUnitsV14) {
    if (!coveredV14.has(normName)) {
      newV14Entries.push({
        id:          generateId(),
        name:        tc(displayName),
        defaultUnit: mostCommonUnitV14(units),
        subtypes:    [],
      });
    }
  }
  if (newV14Entries.length > 0) {
    itemCatalog = [...itemCatalog, ...newV14Entries];
  }

  return { ...data, transactions, contacts, settings, stockAdjustments, itemCategories, itemCatalog, _normVersion: NORM_VERSION };
}

/**
 * Load persisted data from localStorage.
 * Falls back to defaultData on parse errors or first run.
 * Runs one-time migration to normalize names if needed.
 */
export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultData, _normVersion: NORM_VERSION };
    const parsed = JSON.parse(raw);
    // Shallow merge so new defaultData keys are always present
    const merged = { ...defaultData, ...parsed };
    // Run migration — if data was already current, returns unchanged reference
    const migrated = migrateData(merged);
    // Persist migrated data immediately so the next load is instant
    if (migrated !== merged) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch { /* ignore */ }
    }
    return migrated;
  } catch {
    return { ...defaultData, _normVersion: NORM_VERSION };
  }
}

/**
 * Save the full app data object to localStorage.
 * Returns true on success, false on quota/write error.
 */
export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("[BukuKas] saveData failed:", e);
    return false;
  }
}