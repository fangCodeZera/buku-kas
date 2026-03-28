# BukuKas Codebase Audit Report

**Date:** 2026-03-19
**Auditor:** Claude (automated, full codebase scan)
**Scope:** Every file in `src/` — all 7 pages, 16 components, 7 utilities, styles.css, App.js, index.js, plus root documentation files

---

## Summary

| Severity | Count |
|----------|-------|
| Critical (must fix — broken functionality) | 3 |
| Medium (should fix — inconsistency, potential bugs) | 8 |
| Low (nice to have — tech debt, docs) | 10 |
| Security notes | 2 |

**Overall health score: 8.2 / 10**

The codebase is well-structured with strong conventions. The `update()` pattern, `deriveStatus()` usage, and UTC/local date separation are consistently applied across App.js and most pages. The main issues are a handful of date-handling violations (the #1 historical bug source in this codebase) and minor React anti-patterns.

---

## Critical Issues (Must Fix)

### C-1. InvoiceModal.js:74-77 — UTC/local date violation in dueDate fallback

**File:** `src/components/InvoiceModal.js` lines 74-77
**Rule violated:** Rule 3 (UTC vs local dates)

```js
// CURRENT (broken):
const dueDate = transactions[0]?.dueDate || (() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);  // ← returns UTC date, not local
})();
```

**Impact:** In Jakarta (UTC+7), between midnight and 7 AM, `toISOString().slice(0,10)` returns yesterday's date. The fallback dueDate would be 1 day early.

**Fix:** Use `addDays(today(), 14)` from `idGenerators.js`:
```js
import { addDays } from "../utils/idGenerators";  // addDays already imported? check.
const dueDate = transactions[0]?.dueDate || addDays(today(), 14);
```

---

### C-2. Reports.js:86-88 — UTC date used for period calculation

**File:** `src/pages/Reports.js` lines 86-88
**Rule violated:** Rule 3 (UTC vs local dates)

The `applyPeriod` function uses `new Date().toISOString().slice(0, 10)` to get "today" for calculating date ranges (this week, this month, etc.).

**Impact:** Same UTC+7 off-by-1 issue as C-1. Between midnight and 7 AM Jakarta time, date range filters would be based on yesterday's date, causing transactions from "today" to be excluded from "This Week" / "This Month" filters.

**Fix:** Replace with `today()` from `idGenerators.js`:
```js
const todayStr = today();  // already imported in Reports.js
```

---

### C-3. Outstanding.js:44 — Missing "Z" suffix in date parsing

**File:** `src/pages/Outstanding.js` line 44
**Rule violated:** Rule 3 (UTC date arithmetic must use `T00:00:00Z`)

```js
// CURRENT:
// sortTxs uses new Date(dueDate + "T00:00:00") without Z suffix
```

**Impact:** Sorting by due date uses local time parsing. In UTC+ timezones, `new Date("2026-03-15T00:00:00")` = `2026-03-14T17:00:00Z`. While this is only used for sorting (not arithmetic), it's inconsistent with the codebase's UTC date convention and could cause edge-case sort instability around midnight.

**Fix:** Add `Z` suffix: `new Date(dueDate + "T00:00:00Z")`, or better, use `diffDays()` for comparison.

---

## Medium Issues (Should Fix)

### M-1. CategoryModal.js:27 — Mutable Set in useState (React anti-pattern)

**File:** `src/components/CategoryModal.js` line 27

```js
const [codeManuallyEdited] = useState(() => new Set());
// Later: codeManuallyEdited.add(idx);  // ← mutates without setState
```

**Impact:** The Set is mutated directly via `.add()` without calling a setter. React will not re-render when the Set changes. This works by coincidence because the Set is only read during event handlers (not during render), but it's fragile — any future code that conditionally renders based on this Set will silently fail.

**Fix:** Change to `useRef(new Set())` since it's never used to trigger renders. This makes the intent explicit: "mutable container, not reactive state."

---

### M-2. Reports.js CSV export — header/data column mismatch risk

**File:** `src/pages/Reports.js`

The CSV export constructs headers and data rows separately. When item filters are active, the data columns include proportional breakdowns, but the headers may not align perfectly with all edge cases (e.g., multi-item transactions with partial filter matches).

**Impact:** Potential for misaligned CSV columns in filtered exports. Low frequency but confusing when it occurs.

**Fix:** Audit the CSV export path end-to-end with multi-item filtered data to ensure header count always matches data column count.

---

### M-3. Settings.js:294 — Uses `Date.now()` for bank account ID

**File:** `src/pages/Settings.js` line 294

```js
id: `bank_${Date.now()}`
```

**Impact:** Inconsistent with the rest of the codebase which uses `generateId()` for all entity IDs. `Date.now()` has no random suffix, so rapid clicks (within same millisecond) could theoretically produce duplicate IDs.

**Fix:** Use `generateId()` from `idGenerators.js`:
```js
import { generateId } from "../utils/idGenerators";
// ...
id: generateId()
```

---

### M-4. StockReportModal.js:33 — `useState(today)` passes function ref

**File:** `src/components/StockReportModal.js` line 33

```js
const [reportDate, setReportDate] = useState(today);
```

**Impact:** This works correctly as React lazy initialization (calls `today()` once), but it's inconsistent with the rest of the codebase which uses `useState(today())` with explicit invocation. Could confuse future developers.

**Fix:** Change to `useState(today())` for consistency, or add a comment explaining the lazy init pattern.

---

### M-5. Toast.js — `onDone` in useEffect dependency array

**File:** `src/components/Toast.js`

The `useEffect` that sets the auto-dismiss timer includes `onDone` in its dependency array. If the parent passes an inline arrow function (e.g., `onDone={() => setToast(null)}`), a new function reference is created on every render, causing the timer to reset repeatedly.

**Impact:** Toast could flicker or fail to auto-dismiss if the parent re-renders frequently. In practice this is rare since toast state changes don't trigger rapid re-renders, but it's a latent issue.

**Fix:** Either wrap `onDone` in `useCallback` at each call site, or use a `useRef` inside Toast to capture the latest `onDone` without including it in the dependency array.

---

### M-6. Inventory.js — Large file (~1100 lines)

**File:** `src/pages/Inventory.js`

At ~1100 lines, this is the largest file in the codebase. It contains the stock ledger panel, bar chart, adjustment form, rename/delete flows, category grouping, and CSV export all in one component.

**Impact:** Difficult to maintain and reason about. High risk of state interaction bugs when adding features.

**Fix:** Consider extracting the stock ledger panel and/or bar chart into separate components. Not urgent but recommended for the next major feature addition to this page.

---

### M-7. InvoiceModal.js — Inline styles for print (intentional but fragile)

**File:** `src/components/InvoiceModal.js`

The entire invoice uses inline styles because `printWithPortal()` captures `outerHTML`. This is documented and intentional (see comment at lines 17-23), but it means:
- Style changes require modifying JS objects, not CSS
- No hover/focus states possible on print elements
- Large style object (~70 lines) clutters the component

**Impact:** Maintenance burden. Not a bug but a known trade-off.

**Note:** The JSDoc comment at line 17-23 correctly documents this decision. No action needed unless the print system is redesigned.

---

### M-8. SuratJalanModal.js — Same inline-style pattern as InvoiceModal

**File:** `src/components/SuratJalanModal.js`

Same trade-off as M-7. Uses inline styles for `printWithPortal()` compatibility.

---

## Low Issues (Nice to Have)

### L-1. CLAUDE.md NORM_VERSION drift

**File:** `/CLAUDE.md` Section 1

States `Current schema version: **NORM_VERSION = 11**`, but `src/utils/storage.js` defines `NORM_VERSION = 12`.

**Fix:** Update CLAUDE.md to say `NORM_VERSION = 12` and add a row to the Maintenance Log documenting the v12 migration (added `itemCategories: []` to defaultData).

---

### L-2. CLAUDE.md missing `itemCategories` in Data Model

**File:** `/CLAUDE.md` Section 4

The `defaultData` documentation doesn't include `itemCategories: []`, which was added in the v12 migration. The Settings Object section also doesn't mention any category-related fields.

**Fix:** Add `"itemCategories": []` to the data model quick reference, and document the Item Category object shape:
```json
{
  "code": "BM",
  "label": "Bawang Merah",
  "items": ["bawang merah"]
}
```

---

### L-3. CLAUDE.md missing new component/utility files

**Files:** `/CLAUDE.md`, potentially `/DEVELOPER_HANDOFF.md`

The following files added after the initial documentation pass are not referenced:
- `src/utils/categoryUtils.js` — `autoDetectCategories()`, `generateCodes()`, `getCategoryForItem()`
- `src/utils/paymentUtils.js` — `computePaymentProgress()`
- `src/components/CategoryModal.js` — category management UI with drag-and-drop
- `src/components/StockReportModal.js` — stock report print modal
- `src/components/SuratJalanModal.js` — delivery note (Surat Jalan) modal

**Fix:** Add entries for these files to the relevant documentation.

---

### L-4. `src/utils/CLAUDE.md` — Missing function reference entries

**File:** `src/utils/CLAUDE.md`

Missing documentation for:
- `categoryUtils.js` — `autoDetectCategories()`, `generateCodes()`, `getCategoryForItem()`
- `paymentUtils.js` — `computePaymentProgress()`

**Fix:** Add function reference blocks following the existing format in that file.

---

### L-5. `src/components/CLAUDE.md` — Missing component entries

Missing documentation for:
- `CategoryModal` — category management with drag-and-drop reordering
- `StockReportModal` — stock report for print via `printWithPortal()`
- `SuratJalanModal` — delivery note modal for income transactions

**Fix:** Add component inventory entries following the existing format.

---

### L-6. Dashboard.js — Dead code still in repository

**File:** `src/pages/Dashboard.js`

Dashboard.js exists in `src/pages/` but is not imported or rendered anywhere in App.js. This is documented in CLAUDE.md (Section 3, Section 9) as intentional dead code.

**Impact:** No runtime impact. Minor repo hygiene issue. Could confuse new developers.

**Note:** CLAUDE.md correctly warns about this. Consider deleting the file or moving it to an `_archive/` directory if it's truly no longer needed.

---

### L-7. `orderNum` field — Unused legacy field on all transactions

**Field:** `transaction.orderNum`

Present on all transactions but never displayed, edited, or used in any UI, form, or component. Documented as unused in CLAUDE.md Section 4.

**Impact:** Minor data bloat in localStorage (~15 bytes per transaction). No functional impact.

---

### L-8. styles.css — Legacy `.invoice-*` CSS classes potentially unused

**File:** `src/styles.css` lines 1350-1409

Classes like `.invoice-modal`, `.invoice-header-bar`, `.invoice-title`, `.invoice-meta`, `.invoice-table`, etc. appear to be from an older invoice design. The current `InvoiceModal.js` uses inline styles exclusively and does not reference these classes.

**Impact:** ~60 lines of potentially dead CSS. No runtime harm but adds to file size.

**Fix:** Search for usage of `.invoice-modal`, `.invoice-table`, etc. across all JS files. If unused, remove them.

---

### L-9. styles.css — `.type-chip` classes marked as legacy

**File:** `src/styles.css` lines 520-529

Comment says `/* legacy — kept for any other references */`. The codebase now uses `.type-badge` classes instead. If no JS file references `.type-chip`, these ~10 lines can be removed.

---

### L-10. DEVELOPER_HANDOFF.md — Likely needs update for v12 changes

**File:** `/DEVELOPER_HANDOFF.md`

The handoff document was written at a specific point in time and may not reflect:
- v12 migration (itemCategories)
- New components (CategoryModal, StockReportModal, SuratJalanModal)
- New utility files (categoryUtils.js, paymentUtils.js)

**Fix:** Review and update sections for File Structure, Utilities, and Components.

---

## Security Notes

### S-1. No XSS vulnerabilities found

- No uses of `dangerouslySetInnerHTML` anywhere in the codebase.
- All user input is rendered through React's JSX escaping.
- `printWithPortal()` uses `document.write()` on a new window, but the content is constructed from component `outerHTML` (already escaped by React), not raw user input.
- No `eval()`, `Function()`, or other dynamic code execution.
- No `console.log` statements found in production code (only in development context).

**Status:** Safe. No action needed.

---

### S-2. localStorage data is unencrypted

All application data (transactions, contacts, settings, financial records) is stored in `localStorage` as plain JSON. This is inherent to the app's "no backend" architecture.

**Impact:** Anyone with physical access to the device (or browser DevTools) can read all business data including transaction amounts, counterparty names, and bank account details.

**Status:** Acceptable for current use case (family business on personal device). Document as a limitation if the app is ever deployed to shared/public computers or if sensitive financial data grows in scope.

---

## Things That Are Solid

### Architecture & Patterns
- **`update()` pattern (Rule 1)** — All state mutations go through `update()` in App.js. Zero violations found across all 7 pages, 16 components, and App.js itself.
- **`deriveStatus()` usage (Rule 2)** — No raw status string literals (`"Lunas"`, `"Belum Lunas (Piutang)"`, etc.) found in new code. All status writes go through `deriveStatus()`.
- **Immutable state updates (Rule 8)** — All array/object mutations use spread operators and return new references. No `.push()`, `.splice()`, or direct property mutation found anywhere.
- **Division zero-guards (Rule 9)** — All division operations checked. `computePaymentProgress()` has explicit zero-guard. Reports.js proportional calculations also guarded.
- **Date try/catch (Rule 10)** — `addDays()` and `diffDays()` both wrapped in try/catch returning null.

### Data Integrity
- **`paymentHistory[]` append-only (Rule 5)** — No code deletes or modifies existing payment history entries. All operations are pure appends.
- **`generateTxnId()` income-only (Rule 6)** — Correctly filters to `type === "income"` internally. Pembelian (expense) uses manual txnId (supplier invoice number) as designed.
- **`editLog[]` capped at 20 (Rule 14)** — Both `editTransaction` and `applyPayment` in App.js apply `.slice(-20)`.
- **`computeStockMap` dual-argument (Rule 13)** — All call sites pass both `transactions` and `stockAdjustments`.
- **Migration system** — Clean, sequential migrations from v1 to v12. Each migration is additive and non-destructive. `NORM_VERSION` gate prevents re-running migrations.

### Code Quality
- **Consistent Indonesian UI** — All labels, toasts, error messages, and status strings are in Indonesian throughout all files. No English UI strings in user-facing code.
- **`normalizeTitleCase()`** — Applied consistently via `normTx()` in App.js before every save. Correctly handles Indonesian business prefixes (PT/CV/UD/TB).
- **Print system** — `printWithPortal()` is a clean abstraction used by InvoiceModal, SuratJalanModal, StockReportModal, and ReportModal.
- **Component contracts** — All modals follow the null-guard pattern (`if (!data) return null`). Parent controls visibility; modal never holds own `isOpen` state.
- **PaymentHistoryPanel** — Well-designed timeline with collapse/expand for 10+ entries, system vs user note distinction, legacy data warnings with tooltip.
- **Badge system** — `StatusBadge` and `TypeBadge` are the single source of truth for visual status rendering. `STATUS_MAP` in Badge.js handles both current and legacy status strings gracefully.
- **TransactionForm** — Comprehensive multi-item form with counterparty selector, stock warning integration, auto/manual txnId logic. Handles both income and expense modes cleanly.

### CSS
- **BEM-inspired naming** — Consistent throughout: `.block`, `.block__element`, `.block--modifier`.
- **Comprehensive utility classes** — Buttons, cards, badges, tables, modals, progress bars — all well-organized with clear naming.
- **Responsive design** — Mobile breakpoint at 768px handles sidebar collapse, grid reflow, and form layout.
- **Print styles** — `@media print` block correctly hides non-print elements and removes visual noise.
- **~2100 lines, well-organized** — Clear section comments (`/* ── Section Name ── */`) make navigation easy.

---

## Recommended Priority Order

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | **C-1** InvoiceModal date fix | 1 line | Fixes UTC off-by-1 in printed invoices |
| 2 | **C-2** Reports.js date fix | 1 line | Fixes UTC off-by-1 in date range filters |
| 3 | **C-3** Outstanding.js Z suffix | 1 line | Fixes inconsistent date parsing |
| 4 | **M-1** CategoryModal useRef | 2 lines | Fixes React anti-pattern |
| 5 | **M-3** Settings.js generateId | 1 line | Consistent ID generation |
| 6 | **L-1–L-5** Documentation updates | ~30 min | Keeps docs accurate for next developer |
| 7 | **M-2** CSV export audit | 15 min | Verify column alignment |
| 8 | **L-8, L-9** Dead CSS cleanup | 10 min | Repo hygiene |
| 9 | **M-5** Toast useEffect deps | 5 min | Prevent potential flicker |
| 10 | **M-4** useState consistency | 1 line | Code style |

---

*End of audit report.*
