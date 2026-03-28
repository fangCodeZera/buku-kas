# BukuKas — Session Summary for Next Claude Code Session

**Last updated:** 2026-03-28
**Purpose:** Paste this into a new Claude Code session as first context to avoid repeating work.

---

## 1. Project Overview

**BukuKas** — digital bookkeeping for a small Indonesian family business (agricultural commodity trading).

- **Stack:** React 19.2.4, react-scripts 5.0.1
- **Architecture:** No router, no backend. All state in `localStorage` only via `saveData()`/`loadData()`.
- **UI language:** Indonesian. All labels, toasts, errors, and status strings are in Bahasa Indonesia.
- **Current schema version:** `NORM_VERSION = 14` (in `src/utils/storage.js`)
- **Single-page app:** Page switching via `page` state in App.js — no React Router.
- **Pages:** Penjualan, Pembelian, Inventory, Contacts, Reports, Outstanding, Settings
- **Dashboard.js was deleted** — it is no longer present anywhere.

---

## 2. What Was Done (Chronological)

### Pre-This-Session (all completed, committed)

1. **Phase 1 — Reverted broken item name/type split**: Earlier attempt at separating item name into type+subtype was reverted after causing regressions.

2. **Phase 2A — Item Catalog system**: Added `itemCatalog[]` to data model. v13 migration auto-populates catalog from existing categories+transactions. Inventory page gained catalog management UI (add/edit/delete catalog items, each with `name`, `defaultUnit`, `subtypes[]`). Stock cards shown per catalog item.

3. **Phase 2A fix — Stock levels on catalog cards + v14 migration**: v14 backfills any items from transactions/adjustments not covered by v13 migration. Cards now show live stock qty.

4. **Phase 2B — TransactionForm catalog dropdowns**: TransactionForm replaced free-text item entry with two-dropdown system: first dropdown selects catalog item, second selects subtype (or "Tanpa Subtype"). Unit auto-fills from catalog's `defaultUnit`. `mapItemToCatalog()` function handles pre-population in edit mode. `__legacy__` sentinel returned when existing item not found in catalog.

5. **Inventory page redesign — Unified cards**: Merged separate catalog management + stock table into single card-per-item layout. Each card shows: item name, unit badge, live stock qty, subtype breakdown, expandable adjustment ledger, action buttons (edit, delete, view reports). "Uncataloged" section shows items in stock/transactions not in any catalog entry. Old stock table removed.

6. **Inventory UI polish**: Simplified single-subtype cards, reduced button sizes, added tooltips.

7. **Invoice notes (catatan)**: Moved `catatan` input from TransactionForm to InvoiceModal. Notes are entered at print time only — not saved to transaction data. This was a deliberate product decision.

8. **Bug fixes round 1 (6 bugs)**:
   - Multi-item `deleteInventoryItem` only checked `t.itemName` not `t.items[]` → fixed to check all items
   - Catalog rename did not cascade to transactions → now uses `renameInventoryItem()`
   - Subtype remove button showed stock warning prematurely → fixed condition
   - `handleImport` didn't run migrations on imported data → now saves then re-reads via `loadData()`
   - Unit hardcoded as "karung" in stock computations → now uses actual `stockUnit` from transaction
   - Contact duplicate check missing in Contacts.js `handleSave` → added case-insensitive guard

9. **Bug fixes round 2 (2 bugs)**:
   - CSV export filename used hardcoded `"today"` string → now uses `today()` function
   - `editLog[].prev` stored full deep copy (2–3 KB × 20 = ~60 KB per tx) → now stores slim snapshot (10 key fields only)

10. **Bug fixes round 3 (8 bugs)**:
    - Multi-item stock warning only checked first item → now collects ALL negative items before calling `onStockWarning`
    - v5 dueDate migration hardcoded `14` days → now uses `t.customDueDays ?? 14`
    - `updateContact` didn't block rename if new name matched another contact → added duplicate guard
    - Week-start day used `getDay()` (Sunday=0) for Monday-start weeks → fixed with `(getDay() + 6) % 7`
    - Escape key missing from ALL modals → added `useEffect` + `keydown` listener to every modal
    - `SuratJalanModal` used `it.stockUnit` (item-level, doesn't exist) → fixed to `t.stockUnit`
    - Misleading comment in Reports.js `all-time` filter → corrected to descriptive comment
    - Backup export filename wrong → fixed (same as round 2 item above — confirmed done in Settings.js)

11. **UX Phase 1 — Submit debounce + consistent toasts**:
    - Added `submitting` state to all form submit handlers: TransactionForm, Inventory (8 handlers), Contacts, Settings, Outstanding
    - Standardized all Indonesian toast messages across all pages

12. **UX Phase 2 — Inline field validation + auto-focus**:
    - Added `fieldErrors` / individual error states to TransactionForm, Inventory, Contacts, Settings, PaymentUpdateModal
    - Red border (`.form-input--error`, `.form-select--error`) + red text below field (`.field-error`)
    - Auto-focus on mount: first field in TransactionForm, adjustment qty, catalog name, business name input for new bank rows
    - PaymentUpdateModal: uses `querySelector("input")` inside ref-div since RupiahInput doesn't forward refs

13. **UX Phase 3 — Last saved timestamp**:
    - `SaveIndicator.js`: tracks `false → true` transition via `prevSaved` ref, records `nowTime()` only on actual save
    - Renders `· HH:MM` in `.save-indicator__time` span (muted gray, 0.9em)
    - CSS `.save-indicator__time` rule added to `styles.css`

### This Session

14. **Completed UX Phase 3**: Added `.save-indicator__time { color: #9ca3af; font-size: 0.9em; }` to `styles.css`. Ran `npm run build` — passed.

15. **Documentation rewrite (INCOMPLETE — see Section 6)**:
    - Launched 6 parallel subagents to rewrite all .md files
    - Most subagents hit rate limits or permission errors without completing
    - Only src/utils/CLAUDE.md was already up-to-date (no changes needed)
    - Root CLAUDE.md subagent provided research but couldn't write (permission denied)
    - src/CLAUDE.md subagent provided research but couldn't write (permission denied)
    - DEVELOPER_HANDOFF.md, src/pages/CLAUDE.md, src/components/CLAUDE.md — hit rate limits, NOT updated

---

## 3. Current State of Key Files

| File | Role | Notes |
|------|------|-------|
| `src/App.js` | Root component, all global state + handlers | ~855 lines. Has all CRUD + catalog handlers |
| `src/utils/storage.js` | localStorage persistence, all migrations | NORM_VERSION=14, migrations v1-v14 |
| `src/utils/idGenerators.js` | ID gen, date utils, formatting | `normalizeTitleCase`, `normItem`, `today`, `nowTime`, `addDays`, `diffDays`, `generateTxnId`, `fmtIDR`, `fmtDate` |
| `src/utils/statusUtils.js` | Status constants + deriveStatus | STATUS.LUNAS / PARTIAL_INCOME / PARTIAL_EXPENSE |
| `src/utils/stockUtils.js` | computeStockMap, computeStockMapForDate | Both require transactions AND stockAdjustments |
| `src/utils/balanceUtils.js` | AR/AP totals, per-contact balance map | computeARandAP, computeCashIncome/Expense/Net |
| `src/utils/categoryUtils.js` | Category auto-detection, code generation | autoDetectCategories, generateCode/s, getCategoryForItem |
| `src/utils/paymentUtils.js` | Payment progress | computePaymentProgress(value, outstanding) |
| `src/utils/printUtils.js` | Print portal | printWithPortal — needed for print modals |
| `src/pages/Penjualan.js` | Income transactions page | Thin wrapper over TransactionPage, type="income" |
| `src/pages/Pembelian.js` | Expense transactions page | Thin wrapper over TransactionPage, type="expense" |
| `src/pages/Inventory.js` | Inventory management | ~1000+ lines. Unified card layout. Catalog CRUD. No old stock table. |
| `src/pages/Contacts.js` | Contact management | Has balanceMap, inline nameError validation |
| `src/pages/Reports.js` | Transaction reports | getMultiItemContribution (was getItemContribution) |
| `src/pages/Outstanding.js` | AR/AP outstanding view | Has highlightTxIds prop for navigation-from-inventory |
| `src/pages/Settings.js` | Settings, import/export | Has bizErrors inline validation, submitting debounce |
| `src/components/TransactionForm.js` | Transaction input form | Catalog dropdowns, not free-text. submitting debounce. fieldErrors. |
| `src/components/TransactionPage.js` | Shared base for Penjualan/Pembelian | Day-view, payment history timeline, SaveIndicator |
| `src/components/SaveIndicator.js` | Autosave status indicator | Shows "Tersimpan ✓ · HH:MM" with lastSavedTime |
| `src/components/StockWarningModal.js` | Stock negative warning | Supports multi-item (data.items[] array) |
| `src/components/PaymentUpdateModal.js` | Record payment modal | amountFieldRef with querySelector for auto-focus |
| `src/components/InvoiceModal.js` | Print invoice | Has catatan note input (entered at print time, not saved) |
| `src/components/SuratJalanModal.js` | Print delivery note | Uses t.stockUnit (fixed — was wrongly using it.stockUnit) |
| `src/components/CategoryModal.js` | Category drag-drop management | Used from Inventory page |
| `src/components/StockReportModal.js` | Printable stock report | Historical date picker, grouped by category |
| `src/components/DeleteConfirmModal.js` | Delete confirmation | Dual-mode: transaction or contact. Has Escape key. |
| `src/components/PaymentHistoryPanel.js` | Payment timeline | Expandable in TransactionPage rows |
| `src/styles.css` | All styles | ~2800+ lines. New classes: `.form-input--error`, `.form-select--error`, `.field-error`, `.save-indicator__time`, inventory card family |

---

## 4. Current Data Model

```json
{
  "transactions": [...],
  "contacts": [...],
  "stockAdjustments": [...],
  "itemCategories": [...],
  "itemCatalog": [...],
  "settings": { ... }
}
```

### Transaction Object
```json
{
  "id":            "1742000000000-abc1234",
  "type":          "income",
  "date":          "2026-03-15",
  "time":          "14:30",
  "createdAt":     "2026-03-15T07:30:00.000Z",
  "orderNum":      "",
  "counterparty":  "Budi Santoso",
  "itemName":      "Bawang Merah Kating",
  "stockQty":      10,
  "stockUnit":     "karung",
  "value":         5215000,
  "outstanding":   1500000,
  "status":        "Belum Lunas (Piutang)",
  "txnId":         "26-03-00009",
  "dueDate":       "2026-03-29",
  "customDueDays": 14,
  "notes":         "",
  "items": [
    {
      "itemName":   "Bawang Merah Kating",
      "sackQty":    10,
      "weightKg":   500,
      "pricePerKg": 10430,
      "subtotal":   5215000
    }
  ],
  "paymentHistory": [
    {
      "id":                "1742000000001-xyz",
      "paidAt":            "2026-03-15T07:30:00.000Z",
      "date":              "2026-03-15",
      "time":              "14:30",
      "amount":            3715000,
      "outstandingBefore": 5215000,
      "outstandingAfter":  1500000,
      "note":              "Pembayaran awal",
      "method":            null
    }
  ],
  "editLog": [
    {
      "at": "2026-03-15T08:00:00.000Z",
      "prev": {
        "date": "2026-03-15",
        "time": "14:30",
        "counterparty": "Budi Santoso",
        "itemName": "Bawang Merah Kating",
        "stockQty": 10,
        "stockUnit": "karung",
        "value": 5215000,
        "outstanding": 1500000,
        "status": "Belum Lunas (Piutang)",
        "dueDate": "2026-03-29",
        "itemNames": ["Bawang Merah Kating"]
      }
    }
  ]
}
```

Note: `editLog[].prev` is a **slim snapshot** (10 fields only, NOT a full copy). Capped at 20 entries.

### Contact Object
```json
{ "id": "...", "name": "Budi Santoso", "email": "", "phone": "", "address": "" }
```

### Stock Adjustment Object
```json
{
  "id": "...", "itemName": "Bawang Merah", "date": "2026-03-15",
  "adjustmentQty": 5, "reason": "Koreksi stok gudang",
  "unit": "karung", "time": "14:30", "adjustedBy": ""
}
```

### Item Category Object
```json
{
  "id": "...", "groupName": "Bawang Putih", "code": "BP",
  "items": ["bawang putih", "bawang putih goodfarmer"]
}
```
`items[]` contains normalized (lowercase, trimmed) item names.

### Item Catalog Object (NEW — v13/v14)
```json
{
  "id":          "...",
  "name":        "Bawang Merah",
  "defaultUnit": "karung",
  "subtypes":    ["Kating", "Bima", "Thailand"]
}
```
- `subtypes[]` are suffix strings. Full item name = `name + " " + subtype` (e.g., "Bawang Merah Kating")
- Items without subtypes are valid — full name = just `name`
- Used by TransactionForm for dropdown selection
- Managed exclusively from Inventory page

### Settings Object
```json
{
  "businessName":             "Usaha Keluarga Saya",
  "address":                  "",
  "phone":                    "",
  "lowStockThreshold":        10,
  "bankAccounts": [
    { "id": "bank_1", "bankName": "", "accountNumber": "", "accountName": "", "showOnInvoice": true }
  ],
  "maxBankAccountsOnInvoice": 1,
  "lastExportDate":           null,
  "defaultDueDateDays":       14
}
```

---

## 5. Architecture Rules (All 15)

1. ALL global state mutations go through `update()` in `App.js`. Never call `setData()` directly anywhere outside App.js.
2. ALL status strings must come from `deriveStatus(type, isPartial)` in `statusUtils.js`. Never write `"Lunas"`, `"Belum Lunas (Piutang)"`, or `"Belum Lunas (Utang)"` as raw string literals in new code.
3. DATE MATH (addDays, diffDays, dueDate): always use `T00:00:00Z` suffix + UTC methods. DATE DISPLAY (today(), transaction.date, viewDate): always use local time methods. Never mix.
4. ALL data model changes require: (a) bump `NORM_VERSION` in storage.js, (b) add migration block in `migrateData()`, (c) update `defaultData`.
5. `paymentHistory[]` is append-only. Never delete or modify existing entries.
6. `generateTxnId()` counts ONLY income transactions. Never pass unfiltered array.
7. `dueDate` calculated once at creation (`date + customDueDays`). Do not recalculate on partial payments. Set to `null` only when `outstanding === 0`.
8. ALL array/object state updates must use spread operators and return new references. Never `.push()`, `.pop()`, `.splice()`, or direct property assignment.
9. ALL division operations must guard against denominator = 0.
10. ALL date operations must be wrapped in `try/catch` returning `null` on failure.
11. Pembelian uses MANUAL txnId (supplier invoice). Penjualan uses AUTO-GENERATED txnId.
12. Always check `Array.isArray(t.items) && t.items.length > 0` before accessing items[]. Fall back to `t.itemName`/`t.stockQty` for legacy data.
13. `computeStockMap` must always receive BOTH `transactions` AND `stockAdjustments`.
14. `editLog[]` capped at 20 entries. `editLog[].prev` stores slim snapshot only (10 key fields — see data model above).
15. Never introduce new runtime npm packages without documenting in CLAUDE.md.
16. *(New)* `itemCatalog[]` is the canonical source for TransactionForm item selection. Each entry: `{ id, name, defaultUnit, subtypes[] }`. Never write raw item names into TransactionForm outside the catalog lookup path.
17. *(New)* `deleteInventoryItem(itemName)` checks ALL `items[]` entries (not just top-level `t.itemName`) before filtering a transaction.

---

## 6. What's In Progress / Remaining

### Documentation Rewrite — INCOMPLETE

The documentation rewrite was the main task of this session. Status of each file:

| File | Status | Notes |
|------|--------|-------|
| `DEVELOPER_HANDOFF.md` | ❌ NOT UPDATED | Subagent hit rate limit. Needs full rewrite. |
| `CLAUDE.md` | ⚠️ PARTIALLY UPDATED | Subagent had research but permission denied. Updates applied manually this session (NORM_VERSION, new handlers, known issues, maintenance log). |
| `src/CLAUDE.md` | ⚠️ NOT YET WRITTEN | Subagent provided findings but was denied. Needs: new CSS classes, submit debounce pattern, field error pattern, catalog item pattern, correct App.js state list. |
| `src/pages/CLAUDE.md` | ❌ NOT UPDATED | Subagent hit rate limit. Needs: Inventory card layout, catalog props, uncataloged section, new local state. |
| `src/components/CLAUDE.md` | ❌ NOT UPDATED | Subagent hit rate limit. Needs: TransactionForm catalog system, multi-item StockWarningModal, SaveIndicator timestamp, Escape key pattern. |
| `src/utils/CLAUDE.md` | ✅ ALREADY UP TO DATE | No changes needed (confirmed by subagent research). |

### Key Research from Failed Subagents (apply to future doc updates)

**For src/CLAUDE.md:**
- App.js global state list should be: `data, page, saved, saveError, editTx, invoiceTxs, sidebarOpen, reportItemFilter, outstandingHighlight, reportState, backupBannerDismissed, suratJalanTx, showStockReport`
- `paidTx`, `deleteTx`, `deleteContact`, `stockWarning` are all LOCAL state in page components, NOT in App.js
- `persist` now manages `saveError` state + has `retrySave()` companion
- New CSS classes to document: `.form-input--error`, `.form-select--error`, `.field-error`, `.save-indicator__time`, inventory card family (`.inventory-cards`, `.inventory-item-card`, etc.)
- styles.css is ~2800+ lines (old doc said ~1500)
- New patterns: submit debounce pattern, field error pattern, catalog dropdown pattern
- Catalog renames do NOT cascade to transactions — `renameInventoryItem()` is separate

**For src/components/CLAUDE.md:**
- TransactionForm: `itemCatalog` prop, two-dropdown item selection, `mapItemToCatalog()` for edit pre-population, `__legacy__` sentinel, `submitting` state, `fieldErrors`, auto-focus on mount
- StockWarningModal: `data.items[]` for multi-item, `data.onCancel` callback
- SaveIndicator: `prevSaved` ref, `lastSavedTime` state, `.save-indicator__time` class
- All modals have Escape key useEffect. Always-mounted modals (DeleteConfirmModal, PaymentUpdateModal, StockWarningModal) need visibility guard. Conditionally-mounted modals (InvoiceModal, etc.) do not.

**For src/pages/CLAUDE.md:**
- Inventory: unified card layout, NOT stock table. Local state includes many useState for card expansion, inline edit modes, catalog form state. Has `catalogWithStock` and `uncatalogedItems` useMemos.
- Outstanding: has `highlightTxIds` and `onClearHighlight` props for navigation from Inventory
- Penjualan/Pembelian: now receive `itemCatalog` prop, `onNavigateOutstanding` (Penjualan only)

**For DEVELOPER_HANDOFF.md:**
- Needs full rewrite of all 13 sections
- Key additions: itemCatalog data model, all new handlers, Inventory card layout in Section 7, TransactionForm catalog system in Section 8, v13/v14 migrations in Section 4

---

## 7. Key Decisions Made

1. **Item catalog is mandatory**: Main items AND subtypes must exist in catalog before being selectable in TransactionForm. No free-text item entry.
2. **Catalog lives in Inventory page**: Managed exclusively there, not in Settings or elsewhere.
3. **Subtypes are suffix strings**: Full item name = `catalogItem.name + " " + subtype`. Single-item (no subtypes) valid — name only.
4. **Invoice catatan is ephemeral**: Typed in InvoiceModal at print time, not saved to transaction. Deliberate product decision.
5. **Unit auto-fills from catalog**: `defaultUnit` fills `stockUnit` when catalog item selected.
6. **Unified Inventory cards**: Old separate stock table removed. Catalog management + stock display merged into one card-per-item UI.
7. **App is desktop-only**: No mobile optimization needed.
8. **editLog slim snapshots**: Only 10 key fields stored per log entry to prevent localStorage bloat.
9. **Import runs migrations**: `handleImport` writes to localStorage then re-reads via `loadData()` to ensure old backups are fully normalized.

---

## 8. Files Changed This Session

In this session (2026-03-28), the following files were modified:
- `src/styles.css` — added `.save-indicator__time { color: #9ca3af; font-size: 0.9em; }` after existing `.save-indicator.saving` rule
- `CLAUDE.md` — updated NORM_VERSION 12→14, added Rules 16–17, updated handler signatures, added bug fixes to Section 9, updated maintenance log
- `SESSION_SUMMARY.md` — this file (created)

In the previous session (commits up to `41ef33e`), these files were modified:
- `src/components/SaveIndicator.js` — added lastSavedTime timestamp
- `src/components/StockWarningModal.js` — multi-item support, onCancel callback
- `src/components/SuratJalanModal.js` — fixed unit bug (t.stockUnit)
- `src/components/PaymentUpdateModal.js` — Escape key, auto-focus, error messages
- `src/components/DeleteConfirmModal.js` — Escape key
- `src/components/InvoiceModal.js` — Escape key, catatan note input
- `src/components/ReportModal.js` — Escape key
- `src/components/CategoryModal.js` — Escape key
- `src/components/StockReportModal.js` — Escape key
- `src/components/TransactionForm.js` — catalog dropdowns, submitting debounce, fieldErrors, auto-focus, multi-item stock warning
- `src/components/TransactionPage.js` — toast standardization
- `src/pages/Inventory.js` — unified cards, catalog CRUD, submitting debounce, adjQtyError/adjReasonError, auto-focus
- `src/pages/Contacts.js` — inline nameError, auto-focus, submitting debounce, duplicate name check
- `src/pages/Settings.js` — bizErrors, submitting, auto-focus, CSV filename fix
- `src/pages/Outstanding.js` — toast standardization, highlightTxIds
- `src/pages/Reports.js` — getMultiItemContribution fix, comment fix
- `src/App.js` — Escape key on EditModal, deleteInventoryItem items[] check, updateContact duplicate guard, handleImport migration, catalog handlers, deleteStockAdjustment, updateItemCategories, navigateToOutstanding, editLog slim snapshot
- `src/utils/storage.js` — NORM_VERSION 14, v13/v14 migrations, addDays customDueDays fix
- `src/styles.css` — .form-input--error, .form-select--error, .field-error, .save-indicator__time, inventory card classes

---

## 9. Git Status

**Last commit:** `41ef33e` — "UX improvements Phase 1-3: submit debounce on all forms, consistent toast messages, inline field validation with auto-focus, last saved timestamp indicator"

**Uncommitted changes (as of 2026-03-28):**
- `src/styles.css` — `.save-indicator__time` rule added (should be committed)
- `CLAUDE.md` — updated (should be committed)
- `SESSION_SUMMARY.md` — this file (should be committed)
- Subagent documentation changes to src/CLAUDE.md, src/pages/CLAUDE.md, src/components/CLAUDE.md — NOT made (subagents hit limits), so those files are unchanged from repo state

**Recommended next commit:**
```
git add src/styles.css CLAUDE.md SESSION_SUMMARY.md
git commit -m "docs: update CLAUDE.md for NORM_VERSION 14, add session summary"
```

---

## 10. Next Session Priorities

1. **Complete documentation rewrite** — the main unfinished task. Do these files in this order:
   - `src/CLAUDE.md` — use research from Section 6 above
   - `src/pages/CLAUDE.md` — read each page file before writing
   - `src/components/CLAUDE.md` — read each component file before writing
   - `DEVELOPER_HANDOFF.md` — comprehensive rewrite of all 13 sections

2. **Build verification** — run `npm run build` after any changes to confirm zero errors.

3. **Consider UX assessment** — previous UX was 7.7/10 before improvements. Now after 3 UX phases, a re-assessment might be warranted.
