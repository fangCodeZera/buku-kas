# src/ — Architecture & Conventions

## Import Rules

- `pages/` may import from `components/` and `utils/` only — never cross-page imports
- `components/` may import from `utils/` only — never from `pages/`
- `utils/` may import from other `utils/` files only — **never import React or any component**
- Violating these rules risks circular dependency errors at build time

---

## State Architecture

### The `update()` Pattern

All state mutations in this app go through a single helper in `App.js`:

```js
// From App.js — copy this pattern exactly
const update = (fn) =>
  setData((d) => {
    const nd = fn(d);
    persist(nd);     // schedules debounced localStorage write
    return nd;
  });

// Usage:
const deleteTransaction = (id) =>
  update((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
```

**What belongs in local component state:**
- UI-only state: `showForm`, `search`, `sortBy`, `selected` (checkbox selections)
- Modal visibility: `deleteTx`, `paidTx`, `expandedTxId`
- Toast messages: `toast`
- Transient error strings: `error`
- `submitting` — boolean debounce flag to prevent double-submit
- `fieldErrors` — object with per-field error messages
- `nameError` — inline contact name error string
- `exportFormat` — JSON/CSV selector in Settings and Reports

**What must go through App.js `update()`:**
- Any change to `transactions[]`, `contacts[]`, `stockAdjustments[]`, `itemCatalog[]`, `itemCategories[]`, or `settings`
- Payment applications, transaction edits, deletions, imports, archive/unarchive

**Global state variables in App.js:**
- `data` — full app data
- `page` — current page key
- `saved` — save status (true = saved to localStorage)
- `saveError` — localStorage quota error flag
- `editTx` — opens global EditModal; null = hidden
- `invoiceTxs` — opens InvoiceModal; null = hidden
- `sidebarOpen` — sidebar expanded/collapsed (auto-collapses at ≤1024px)
- `reportItemFilter` — pre-filter from Inventory "Lihat" button
- `outstandingHighlight` — array of tx IDs to highlight on Outstanding page
- `reportState` — `{ transactions, dateFrom, dateTo }` — opens ReportModal
- `backupBannerDismissed` — hides backup banner for session
- `suratJalanTx` — opens SuratJalanModal; null = hidden
- `showStockReport` — opens StockReportModal

**Key computed values (all in App.js via `useMemo`):**
- `stockMap` — from `computeStockMap(data.transactions, data.stockAdjustments)`
- `balanceMap` — per-contact AR/AP summary, passed to Contacts.js
- `globalAR`, `globalAP` — from `computeARandAP(data.transactions)`
- `penjualanBadge`, `pembelianBadge`, `outstandingBadge` — near-due counts (≤3 days)
- `alertCount` — negative + low-stock item count

**`persist` and `retrySave` pattern:**

```js
// persist manages saveError state
const persist = useCallback((nd) => {
  setSaved(false);
  setSaveError(false);
  clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => {
    const ok = saveData(nd);
    if (ok) { setSaved(true); setSaveError(false); }
    else { setSaveError(true); }
  }, 500);
}, []);

// retrySave — immediate retry for quota-error recovery
const retrySave = useCallback(() => {
  const ok = saveData(data);
  if (ok) { setSaved(true); setSaveError(false); }
}, [data]);
```

---

## CSS Conventions

**Naming pattern:** BEM-inspired kebab-case. Block name + double-dash modifier.
Examples: `.btn`, `.btn--primary`, `.summary-card`, `.summary-card__label`

**Color values used throughout (from styles.css):**

| Role | Value |
|------|-------|
| Primary blue | `#007bff` |
| Dark blue | `#0056b3` |
| Deep navy | `#1e3a5f` |
| Green (income/lunas) | `#10b981` |
| Dark green | `#059669` |
| Red (expense/delete) | `#ef4444` |
| Amber (outstanding/warning) | `#f59e0b` |
| Indigo (invoice no) | `#6366f1` |
| Page background | `#f0f6ff` |
| Card surface | `#fff` |
| Border | `#c7ddf7` |
| Muted text | `#6b7280` |
| Very muted | `#9ca3af` |

**Existing utility classes — always reuse before creating new ones:**

```
Layout:     .app-shell, .sidebar, .main-content, .page-header, .page-content
Cards:      .table-card, .summary-card, .summary-card__label, .summary-card__value
            .mini-card, .mini-card__label, .mini-card__value
Grid:       .summary-grid, .summary-grid--2, .summary-grid--3
Buttons:    .btn, .btn-sm, .btn-primary, .btn-secondary, .btn-outline, .btn-danger
            .btn-danger-outline, .btn-paid, .action-btn, .action-btn--edit
            .action-btn--delete, .action-btn--invoice, .action-btn--paid
            .action-btn--history, .action-btn--history-badge
Inputs:     .search-input, .date-input, .sort-select
Search bar: .search-bar-wrapper, .search-bar__category, .search-bar__input, .search-bar__sort
Table:      .data-table, .th-center, .th-right, .th-check, .td-center, .td-right
            .td-check, .td-date, .td-name, .td-value, .row-alt
Badges:     .badge, .nav-item__badge, .stock-chip, .order-num, .stock-delta
Text:       .text-muted, .whitespace-nowrap, .hidden, .section-subtitle
Alerts:     .alert-banner, .alert-banner--warning, .alert-banner--danger, .backup-banner
Filter:     .filter-bar, .pagination-bar
Modals:     .modal-overlay, .modal-box, .modal-title, .modal-body, .modal-actions
            .edit-modal-overlay, .edit-modal-box
Toast:      .toast
Progress:   .payment-progress-wrap, .payment-progress-bar, .payment-progress-bar__fill
            .payment-progress-pct
Timeline:   .payment-timeline, .payment-timeline__* (full set in styles.css)
Payment row:.payment-history-row, .payment-history-cell
Items:      .item-list, .item-list__row, .item-list__bullet, .item-list__subtotal
Reports:    .item-filter-primary, .item-filter-secondary, .item-filter-value-primary
            .item-filter-value-secondary, .item-filter-note
Save:       .save-indicator, .save-indicator.saved, .save-indicator.saving
            .save-indicator__time
Contact:    .contact-item, .contact-item--active, .contact-detail-card
Form valid: .form-input--error, .form-select--error, .field-error
Inventory:  .inventory-group-header (hover locked to #1e3a5f — do not remove)
            .inventory-item-card, .inventory-item-card__* (full set in styles.css)
            .inventory-item-card--uncataloged
Category:   (removed — CategoryModal.js deleted in T16)
Utility:    .whitespace-nowrap, .hidden, .md\:table-cell
```

**Rule:** Always search `styles.css` before adding a new CSS class. The file is 2938 lines and likely has what you need.

---

## Error Handling Pattern

**Date operation pattern** (copy exactly):
```js
// From idGenerators.js
export const addDays = (dateStr, days) => {
  try {
    if (!dateStr || typeof dateStr !== "string") return null;
    const d = new Date(dateStr + "T00:00:00Z");   // ← Z is mandatory
    if (isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + days);           // ← UTC methods mandatory
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
};
```

**Division safety pattern** (copy exactly):
```js
const combinedProportionalOutstanding = totalTransactionValue > 0
  ? Math.round((combinedSubtotal / totalTransactionValue) * totalOutstanding)
  : 0;
```

**Array fallback pattern** (copy exactly):
```js
// From stockUtils.js — always check before using items[]
const itemList = Array.isArray(t.items) && t.items.length > 0
  ? t.items.map((it) => ({ itemName: it.itemName, sackQty: it.sackQty }))
  : [{ itemName: t.itemName, sackQty: t.sackQty != null ? t.sackQty : (t.stockQty || 0) }];
```

**Number coercion pattern** (copy exactly):
```js
const val = Number(t.value) || 0;
const out = Number(t.outstanding) || 0;
```

**Submit debounce pattern** (prevents double-submit):
```js
const [submitting, setSubmitting] = useState(false);
const handleSubmit = () => {
  if (submitting) return;
  setSubmitting(true);
  try {
    // ... save logic
  } finally {
    setSubmitting(false);
  }
};
// Button: disabled={submitting}
```

**Field error pattern** (inline validation):
```js
const [fieldErrors, setFieldErrors] = useState({});
const validate = () => {
  const errs = {};
  if (!form.name.trim()) errs.name = "Nama wajib diisi.";
  setFieldErrors(errs);
  return Object.keys(errs).length === 0;
};
// JSX:
// <input className={`form-input${fieldErrors.name ? " form-input--error" : ""}`} />
// {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
```

---

## Catalog Autocomplete System

TransactionForm uses smart text inputs (not `<select>` dropdowns) for item selection:

```
// Per item row — two text inputs with live autocomplete:
// 1. Nama Barang: free text, autocomplete against activeCatalog[].name
//    activeCatalog = itemCatalog filtered to non-archived (or has active subtypes)
// 2. Tipe (shown after Nama Barang filled): free text, autocomplete against
//    matchedCatalog.subtypes[] filtered by archivedSubtypes[]
//    — user can type new subtypes not yet in catalog
// Unit auto-fills from catalogItem.defaultUnit when catalog match found
//
// mapItemFromCatalog(itemName):
//   - Walks catalog to find matching name or name + " " + subtype
//   - Not found: returns empty catalogItemId (free-text fallback)
//
// New item/subtype confirmation dialog fires before save if user typed an unknown name.
// On confirm, calls onAddCatalogItem() or onUpdateCatalogItem() to grow the catalog.
//
// Required props: itemCatalog, onAddCatalogItem, onUpdateCatalogItem
// Optional props: onUnarchiveCatalogItem, onUnarchiveSubtype, onUnarchiveContact
```

---

## Date Handling — UTC vs Local

**USE UTC** (`T00:00:00Z` + `getUTCDate`/`setUTCDate`):
- `addDays(dateStr, days)` — date arithmetic
- `diffDays(date1, date2)` — days between dates
- `dueDate` calculations — always UTC
- Badge counts in App.js (todayMs + `T00:00:00Z`)

**USE LOCAL** (`getFullYear()`/`getMonth()`/`getDate()`):
- `today()` — must return user's local date
- `transaction.date` field — what date the user sees on their clock
- `viewDate` in TransactionPage/Inventory — calendar date the user is viewing

**Why this matters:** Jakarta is UTC+7. At 2AM on March 15, `new Date().toISOString().slice(0,10)` returns `"2026-03-14"` (UTC). Wrong for display. But `new Date("2026-03-15T00:00:00")` (no Z) in Jakarta = `"2026-03-14T17:00:00Z"`, causing date arithmetic to lose a day. Both bugs are fixed; don't reintroduce them.

**NEVER DO:**
```js
new Date(dateStr + "T00:00:00")   // no Z = local time = off-by-1 in UTC+
new Date().toISOString().slice(0, 10)  // UTC date, not local
```
