```
┌─────────────────────────────────────────────────────┐
│ START OF SESSION CHECKLIST                          │
│ Before any task:                                    │
│ 1. Confirm you have read this file (/CLAUDE.md)     │
│ 2. Read CLAUDE.md in the directory you will modify  │
│ 3. Run: npm start — confirm zero console errors     │
│ 4. State which Rule(s) from Section 2 apply         │
└─────────────────────────────────────────────────────┘
```

---

## 1. What Is This App

**BukuKas** — digital bookkeeping for a small Indonesian family business (agricultural commodity trading).
React 19.2.4, react-scripts 5.0.1. No router. No backend. `localStorage` only.
UI language: **Indonesian**. All labels, toasts, errors, and status strings are in Indonesian.
Current schema version: **NORM_VERSION = 17** (defined in `src/utils/storage.js`).
Single-page app — page switching is state-driven via `page` state in App.js.

---

## 2. Absolute Rules — Read Before Any Change

1. ALL global state mutations go through `update()` in `App.js`. Never call `setData()` directly anywhere outside App.js.
2. ALL status strings must come from `deriveStatus(type, isPartial)` in `statusUtils.js`. Never write `"Lunas"`, `"Belum Lunas (Piutang)"`, or `"Belum Lunas (Utang)"` as raw string literals in new code.
3. DATE MATH (addDays, diffDays, dueDate calculations): always use `T00:00:00Z` suffix and UTC methods (`getUTCDate`, `setUTCDate`). DATE DISPLAY (today(), transaction.date, viewDate): always use local time methods. Never mix.
4. ALL data model changes require three steps: (a) bump `NORM_VERSION` in `storage.js`, (b) add a migration block in `migrateData()`, (c) update `defaultData` with the new field.
5. `paymentHistory[]` is append-only. Never delete or modify existing entries — only append new ones.
6. `generateTxnId()` serial counter counts ONLY income transactions (`type === "income"`). Never pass an unfiltered transactions array to it. Only Penjualan (income) uses auto-generated txnId.
7. `dueDate` is calculated once at creation (`date + customDueDays`). Do not recalculate on partial payments. Set to `null` only when `outstanding === 0`.
8. ALL array/object state updates must use spread operators and return new references. Never use `.push()`, `.pop()`, `.splice()`, or direct property assignment on state objects.
9. ALL division operations must guard against denominator = 0 before dividing (e.g., `val > 0 ? numerator / val : 0`).
10. ALL date operations must be wrapped in `try/catch` returning `null` on failure.
11. Pembelian (expense) transactions use a MANUAL txnId entered by the user (supplier invoice number). Penjualan (income) transactions use AUTO-GENERATED txnId from `generateTxnId()`. Never auto-generate for expense.
12. The `items[]` array holds multiple line items. Always check `Array.isArray(t.items) && t.items.length > 0` before accessing items. Fall back to top-level `t.itemName`/`t.stockQty` for any legacy data that hasn't been migrated.
13. `computeStockMap` must always receive BOTH `transactions` AND `stockAdjustments`. Never call it with only one argument.
14. `editLog[]` on transactions is capped at the last 20 entries via `.slice(-20)`. `editLog[].prev` stores a **slim snapshot** (10 key fields: date, time, counterparty, itemName, stockQty, stockUnit, value, outstanding, status, dueDate, itemNames) — NOT a full transaction copy. This prevents localStorage bloat (~60 KB per transaction if full copies were used).
15. Never introduce new runtime npm packages without documenting the reason in this file's dependencies section and confirming no existing utility already covers the need.
16. `itemCatalog[]` is the canonical source for TransactionForm item selection. Each entry: `{ id, name, defaultUnit, subtypes[] }`. Full item name = `name` (no subtypes) or `name + " " + subtype`. TransactionForm uses smart text inputs with autocomplete (not `<select>` dropdowns). New items/subtypes typed by the user trigger a confirmation dialog then auto-add to the catalog. Never write raw item names into TransactionForm outside the catalog lookup path.
17. `deleteInventoryItem(itemName)` checks ALL `items[]` entries (not just top-level `t.itemName`) before filtering a transaction. This ensures multi-item transactions are correctly handled when the deleted item is a secondary line item.

---

## 3. Navigation Map

| Page Key     | File                         | Nav Label         | Icon        | Badge Source                                  |
|--------------|------------------------------|-------------------|-------------|-----------------------------------------------|
| `penjualan`  | `src/pages/Penjualan.js`     | Penjualan         | `income`    | `penjualanBadge` (near-due income, ≤3 days)   |
| `pembelian`  | `src/pages/Pembelian.js`     | Pembelian         | `expense`   | `pembelianBadge` (near-due expense, ≤3 days)  |
| `inventory`  | `src/pages/Inventory.js`     | Inventaris        | `inventory` | `alertCount` (negative + low-stock items)      |
| `contacts`   | `src/pages/Contacts.js`      | Kontak            | `contacts`  | none                                          |
| `reports`    | `src/pages/Reports.js`       | Laporan           | `reports`   | none                                          |
| `outstanding`| `src/pages/Outstanding.js`   | Piutang & Hutang  | `warning`   | `outstandingBadge` (penjualan + pembelian)    |
| `settings`   | `src/pages/Settings.js`      | Pengaturan        | `settings`  | none                                          |

Both Penjualan and Pembelian use `TransactionPage.js` as their base component. Dashboard.js was **deleted** — it no longer exists anywhere in the codebase.

---

## 4. Data Model Quick Reference

### Transaction Object (current shape)
```json
{
  "id":           "1742000000000-abc1234",
  "type":         "income",
  "date":         "2026-03-15",
  "time":         "14:30",
  "createdAt":    "2026-03-15T07:30:00.000Z",
  "orderNum":     "",
  "counterparty": "Budi Santoso",
  "itemName":     "Bawang Merah",
  "stockQty":     10,
  "stockUnit":    "karung",
  "value":        5215000,
  "outstanding":  1500000,
  "status":       "Belum Lunas (Piutang)",
  "txnId":        "26-03-00009",
  "dueDate":      "2026-03-29",
  "customDueDays": 14,
  "notes":        "",
  "items": [
    {
      "itemName":   "Bawang Merah",
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
    { "at": "2026-03-15T08:00:00.000Z", "prev": {} }
  ]
}
```

Fields added over migration history:
- `items[]` ← v6 migration
- `paymentHistory[]` ← v9 migration
- `paymentHistory[].time` ← v10 migration
- `stockAdjustments` top-level array ← v8
- `stockAdjustments[].time` ← v11 migration
- `stockAdjustments[].adjustedBy` ← v11 migration
- `itemCategories[]` top-level array ← v12 migration
- `itemCatalog[]` top-level array ← v13/v14 migration

Note: `editLog[].prev` is a **slim snapshot** (10 fields only), not a full transaction copy.

Unused legacy fields:
- `orderNum` — exists on all transactions but is not used in any UI, form, or component. Legacy field — safe to ignore or repurpose in the future.

### Settings Object
```json
{
  "businessName":             "Usaha Keluarga Saya",
  "address":                  "",
  "phone":                    "",
  "lowStockThreshold":        10,
  "bankAccounts": [
    {
      "id":            "bank_1",
      "bankName":      "",
      "accountNumber": "",
      "accountName":   "",
      "showOnInvoice": true
    }
  ],
  "maxBankAccountsOnInvoice": 1,
  "lastExportDate":           null,
  "defaultDueDateDays":       14
}
```

### Contact Object
```json
{
  "id":      "1742000000000-abc1234",
  "name":    "Budi Santoso",
  "email":   "",
  "phone":   "",
  "address": ""
}
```

### Stock Adjustment Object
```json
{
  "id":            "1742000000000-abc1234",
  "itemName":      "Bawang Merah",
  "date":          "2026-03-15",
  "adjustmentQty": 5,
  "reason":        "Koreksi stok gudang",
  "unit":          "karung"
}
```

### Item Category Object
```json
{
  "id":        "1742000000000-abc1234",
  "groupName": "Bawang Putih",
  "code":      "BP",
  "items":     ["bawang putih", "bawang putih goodfarmer", "bawang putih kating"]
}
```
`items[]` contains **normalized** item names (lowercase, trimmed — output of `normItem()`).
`code` is a short uppercase identifier, auto-generated by `generateCodes()` or manually edited by user.

### Item Catalog Object (← NEW v13/v14)
```json
{
  "id":          "1742000000000-abc1234",
  "name":        "Bawang Merah",
  "defaultUnit": "karung",
  "subtypes":    ["Kating", "Bima", "Thailand"]
}
```
`subtypes[]` are suffix strings. Full item name = `name + " " + subtype` (e.g. "Bawang Merah Kating").
Items without subtypes are valid — full name = just `name`.
Used by TransactionForm for item autocomplete (smart text inputs, not `<select>` dropdowns). Managed from Inventory page only. New items/subtypes typed during transaction entry are auto-added to the catalog via `onAddCatalogItem`/`onUpdateCatalogItem` after user confirmation.

---

## 5. Handler Signatures (App.js)

```
addTransaction(t)
  Creates new tx with auto txnId (income) or manual (expense),
  paymentHistory[initialEntry], dueDate, createdAt.
  Calls update() → immutable state update + persist.

editTransaction(t)
  Edits existing tx. Preserves txnId (unless month changed for income).
  Appends edit note to paymentHistory if value/outstanding changed.
  editLog capped at 20. Recalculates dueDate if date/terms changed.

deleteTransaction(id)
  Removes tx from transactions array. Stock, AR/AP auto-recomputed.

applyPayment(id, paidAmount, paymentNote = "")
  Appends new entry to paymentHistory[]. Updates outstanding, status, dueDate.
  note = paymentNote || (isFullyPaid ? "Pelunasan" : "Pembayaran sebagian")
  editLog also appended (capped at 20).

createContact(name)
  Adds new contact if name not already present (case-insensitive check).

updateContact(contact)
  Updates contact. If name changed, cascades to all matching transactions.
  BLOCKS rename if another contact already has the same name (case-insensitive).
  Contacts.js should validate before calling — handler silently returns unchanged state on conflict.

handleImport(importedData)
  Writes importedData to localStorage then re-reads via loadData() so migrations run immediately.
  This ensures old backups (pre-v9, pre-v13, etc.) are fully normalized before hitting React state.
  Warning: replaces ALL data. Called from Settings.js.

addStockAdjustment(adj)
  Appends to stockAdjustments[] array.

deleteStockAdjustment(adjustmentId)
  Removes a single stock adjustment by id.

updateItemCategories(categories)
  Replaces entire itemCategories[] array. Called from Inventory category UI.

addCatalogItem(item)
  Appends new catalog item: { id: generateId(), name: normalizeTitleCase(item.name),
  defaultUnit: item.defaultUnit || "karung", subtypes: item.subtypes || [] }

updateCatalogItem(updatedItem)
  Replaces catalog item matching updatedItem.id. Catalog renames do NOT cascade to
  transaction itemNames — use renameInventoryItem() for that separately.

deleteCatalogItem(itemId)
  Removes catalog item by id. Transactions referencing that item are NOT modified.

renameInventoryItem(oldName, newName)
  Updates itemName on ALL items[] entries in transactions AND stockAdjustments.
  Uses normItem() for matching. Also updates top-level t.itemName.

deleteInventoryItem(itemName)
  Removes all transactions where ANY item in items[] matches itemName (normItem() comparison).
  Also removes all stockAdjustments for that item.

handleViewItem(itemName)
  Sets reportItemFilter + navigates to "reports" page.

navigateToOutstanding(txIds)
  Sets outstandingHighlight to txIds array + navigates to "outstanding" page.
  Outstanding page highlights those rows on mount, then clears highlight.
```

### Additional Utility & Component Files

- `src/utils/categoryUtils.js` — `autoDetectCategories()`, `generateCode()`, `generateCodes()`, `getCategoryForItem()`
- `src/utils/paymentUtils.js` — `computePaymentProgress(value, outstanding)`
- `src/utils/balanceUtils.js` — `computeARandAP()`, `computeCashIncome()`, `computeCashExpense()`, `computeNetCash()`
- `src/utils/printUtils.js` — `printWithPortal()` (used by InvoiceModal, SuratJalanModal, ReportModal, StockReportModal)
- `src/components/CategoryModal.js` — category management UI with drag-and-drop reordering and group merging
- `src/components/StockReportModal.js` — printable stock report modal grouped by category
- `src/components/SuratJalanModal.js` — printable delivery note (surat jalan)

---

## 6. Build and Validation Loop

**STARTING A NEW SESSION:**
1. Read this file and the relevant directory CLAUDE.md
2. Run: `npm start`
3. Open browser at http://localhost:3000
4. Open DevTools console — must show zero errors

**BEFORE WRITING ANY CODE:**
1. Re-read the relevant Rule(s) from Section 2
2. If the change involves a date operation: re-read Rule 3
3. If the change involves the data model: re-read Rule 4
4. If the change involves payment history: re-read Rule 5

**AFTER WRITING CODE — mandatory checklist:**
1. Search every touched file for: raw `"Lunas"` / `"Piutang"` / `"Utang"` string literals in new code
2. Search for any `setData()` call outside App.js
3. Search for `.push()` / `.splice()` / direct state mutation
4. Search for division without zero-check
5. Search for date operations outside try/catch
6. Run: `npm start` — zero new console errors
7. Manually test the specific feature changed
8. Run: `npm run build` — must complete with zero errors

**FAILURE RECOVERY:**
- If `npm start` errors: read the full error, check against Section 2 rules, fix, retry. Escalate to user only after 3 failed fix attempts.
- If `npm run build` fails: the build error is more specific. Common causes: unused imports, missing props, JSX type errors. Fix ALL before declaring done.

---

## 7. Web Search Required

Search the web before implementing anything in this list. Do not rely on memory alone.

| Topic | Search Query |
|-------|-------------|
| React hooks API | `[hookName] site:react.dev` |
| Date/timezone edge cases | `javascript date UTC timezone [topic]` |
| CSS browser compatibility | `[property] site:developer.mozilla.org` |
| Any Firebase method | `firebase [method] official docs` |
| Any Supabase method | `supabase [method] official docs` |
| Security (auth, XSS, validation) | `[topic] OWASP 2024` |

**Procedure:** Find OFFICIAL docs only (react.dev, MDN, official SDK docs). Confirm API version matches React 19 / react-scripts 5. Add source URL as code comment. If unclear: implement simplest solution + add TODO comment + tell user.

---

## 8. Sub-Agent Usage

**USE a sub-agent when:**
- Applying the SAME fix to 5+ page files independently (e.g. adding a column to all table pages)
- Task has 2+ clearly independent parts with no shared state

**DO NOT use a sub-agent when:**
- Task involves `App.js` — single authoritative file, must be sequential
- Task involves `storage.js` — NORM_VERSION bump must happen exactly once
- Task involves changing the data model — migrations must be coordinated
- Task involves `styles.css` — class name conflicts possible if two agents edit simultaneously
- Task involves `itemCatalog` — catalog CRUD is coordinated through App.js only

**Sub-agent handoff protocol:**
1. Give the agent the full text of this `/CLAUDE.md`
2. Give the agent the relevant directory `CLAUDE.md`
3. Give the agent the specific files to read
4. State EXACTLY which files to touch and which NOT to touch
5. Cite the specific Rule number from Section 2 most relevant to the task
6. After agent finishes: review changes, run `npm start`, update CLAUDE.md if needed

---

## 9. Known Issues — Never Reintroduce

- **FIXED (pre-2026):** UTC timezone off-by-1 in `addDays`/`diffDays`. Fix: use `T00:00:00Z` suffix + `getUTCDate`/`setUTCDate`. File: `src/utils/idGenerators.js`
- **FIXED (pre-2026):** `today()` returned UTC date not local date. Fix: use `getFullYear`/`getMonth`/`getDate` local methods. File: `src/utils/idGenerators.js`
- **FIXED (pre-2026):** `applyPayment` wrote old v2 status strings. Fix: use `deriveStatus()`. File: `src/App.js`
- **FIXED (pre-2026):** `generateTxnId` counted all transactions not just income. Fix: filter `type === "income"`. File: `src/utils/idGenerators.js`
- **FIXED (pre-2026):** `Dashboard` search state lost on page navigation. Fix: `onSearchChange` prop syncs back to App.js.
- **FIXED (pre-2026):** `dueDate` calculated with local midnight causing off-by-1 in UTC+ timezones. Fix: v5 migration recomputes all dueDates with UTC.
- **FIXED (2026-03-15):** `paymentHistory[0].amount` set to 0 for transactions created before v9 migration. Fix: v10 migration detects `amount === 0` with `(value - outstanding) > 0` and corrects it. File: `src/utils/storage.js`
- **FIXED (2026-03-15):** `time` field missing from paymentHistory entries. Fix: v10 migration backfills `"00:00"`, new entries use `nowTime()`. Files: `src/App.js`, `src/utils/storage.js`
- **FIXED (2026-03-15):** `getItemContribution` in Reports.js only worked for exactly 1 selected item. Fix: renamed to `getMultiItemContribution`, guard changed from `!== 1` to `=== 0`. File: `src/pages/Reports.js`
- **FIXED (2026-03-27):** Multi-item stock warning only collected first negative item. Fix: TransactionForm now collects ALL negative items into `negItems[]` before calling `onStockWarning`. StockWarningModal updated to render bullet list for multi-item case. Files: `src/components/TransactionForm.js`, `src/components/StockWarningModal.js`
- **FIXED (2026-03-27):** v5 dueDate migration used hardcoded `14` days. Fix: uses `t.customDueDays ?? 14`. File: `src/utils/storage.js`
- **FIXED (2026-03-27):** `updateContact` did not block rename if new name collided with existing contact. Fix: added case-insensitive duplicate check; silently returns `d` unchanged on conflict. File: `src/App.js`
- **FIXED (2026-03-27):** Week-start day in Inventory ledger used `getDay()` (Sunday=0) instead of Monday=0. Fix: `(new Date().getDay() + 6) % 7`. File: `src/pages/Inventory.js`
- **FIXED (2026-03-27):** Escape key missing from all modals (DeleteConfirmModal, PaymentUpdateModal, StockWarningModal, InvoiceModal, SuratJalanModal, ReportModal, CategoryModal, StockReportModal, EditModal). Fix: `useEffect` with `keydown` listener added to every modal. Always-mounted modals guard with visibility check; conditionally-mounted modals do not need guard.
- **FIXED (2026-03-27):** `SuratJalanModal` used `it.stockUnit` (item-level field, does not exist). Fix: changed to `t.stockUnit` (transaction-level). File: `src/components/SuratJalanModal.js`
- **FIXED (2026-03-27):** CSV export filename used literal string `"today"`. Fix: uses `today()` function. File: `src/pages/Settings.js`
- **FIXED (2026-03-27):** `editLog[].prev` stored full deep copy (~2–3 KB per entry × 20 = ~60 KB per transaction). Fix: now stores slim 10-field snapshot only. Files: `src/App.js`
- **FIXED (2026-03-27):** `deleteInventoryItem` only checked top-level `t.itemName`, missing secondary items in multi-item transactions. Fix: checks all `items[]` entries using `normItem()`. File: `src/App.js`
- **FIXED (2026-03-27):** Contacts.js `handleSave` allowed duplicate contact names. Fix: inline `nameError` state + case-insensitive check before save. File: `src/pages/Contacts.js`
- **FIXED (2026-03-28):** `.inventory-group-header` rows flickered on hover (`.data-table tbody tr:hover` applied). Fix: added hover-override locking background to `#1e3a5f`. File: `src/styles.css`
- **FIXED (2026-03-28):** Client dropdown in TransactionForm opened on form mount (programmatic auto-focus triggered `onFocus → setCpOpen(true)`). Fix: `skipNextFocusOpen` ref skips the first programmatic focus. File: `src/components/TransactionForm.js`
- **FIXED (2026-03-28):** "Tampilkan stok kosong" toggle in StockReportModal didn't show items absent from `effectiveStockMap`. Fix: reordered null-check; absent items now render with qty=0. File: `src/components/StockReportModal.js`
- **FIXED (2026-03-28):** Phantom category items displayed as raw lowercase keys. Fix: `getDisplayName` fallback uses `normalizeTitleCase()`. File: `src/components/CategoryModal.js`
- **FIXED (2026-03-28):** Catalog base items with 0 stock landed in LAINNYA instead of their category. Fix: groupName-prefix fallback (longest match) in `tableGroups` useMemo. File: `src/pages/Inventory.js`
- **FIXED (2026-03-29):** PERIODE quick-select buttons in stock ledger had no active state. Fix: computed `activePeriod` drives `btn-primary`/`btn-outline` class. File: `src/pages/Inventory.js`
- **FIXED (2026-03-29):** CategoryModal allowed creating duplicate group names. Fix: `commitName` validates via `normItem()`, stays in edit mode with error tooltip on duplicate. File: `src/components/CategoryModal.js`
- **FIXED (2026-03-29):** Manual code edits on parent groups didn't cascade to child groups. Fix: `commitCode` finds children by name-prefix match and recomputes their codes. File: `src/components/CategoryModal.js`

---

## 10. CLAUDE.md Maintenance Log

| Date | What Changed | Why |
|------|-------------|-----|
| 2026-03-15 | Initial CLAUDE.md system created (5 files) | First comprehensive documentation of current codebase state |
| 2026-03-17 | Updated NORM_VERSION 10→11, added v11 migration note | v11: Backfill `time` and `adjustedBy` fields on all stockAdjustments entries |
| 2026-03-17 | Deleted Dashboard.js (dead code), documented `orderNum` as unused | Codebase audit cleanup |
| 2026-03-19 | Updated NORM_VERSION 11→12, added itemCategories to data model, added new files | v12: Added `itemCategories: []` to defaultData for inventory category grouping system |
| 2026-03-27 | Updated NORM_VERSION 12→14, added itemCatalog data model + handlers | v13: Auto-populate itemCatalog from categories+transactions; v14: backfill uncovered items |
| 2026-03-27 | Added Rules 16–17 for itemCatalog and deleteInventoryItem | New catalog system guidance |
| 2026-03-27 | Added missing handlers: deleteStockAdjustment, updateItemCategories, catalog CRUD, navigateToOutstanding | Handlers existed in App.js but were undocumented |
| 2026-03-27 | Added SuratJalanModal, balanceUtils.js, printUtils.js to Additional Files | Missing from previous docs |
| 2026-03-27 | Updated editLog[].prev to document slim snapshot shape | BUG-008 fix: prevents localStorage bloat |
| 2026-03-27 | Added 11 new bug fixes to Section 9 | 8-bug audit + earlier bug fixes in same session |
| 2026-03-27 | Updated updateContact docs (duplicate guard), handleImport (migration path) | Accuracy — behavior had changed |
| 2026-03-28 | Removed Dashboard.js note (file was deleted), updated Navigation Map note | Dashboard.js no longer exists |
| 2026-03-28 | Updated Rule 16 (TransactionForm now uses smart text inputs, not dropdowns); added 6 new bug fixes | Post-inventory-redesign bug fixes session |
| 2026-03-29 | Updated Rule 16 further; added 3 more bug fixes (PERIODE active state, duplicate group names, code cascade) | CategoryModal + Inventory bug fixes |
