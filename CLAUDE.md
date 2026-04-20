┌─────────────────────────────────────────────────────┐
│ START OF SESSION CHECKLIST                          │
│ Before any task:                                    │
│ 1. Confirm you have read this file (/CLAUDE.md)     │
│ 2. Read CLAUDE.md in the directory you will modify  │
│ 3. Run: npm start — confirm zero console errors     │
│ 4. State which Rule(s) from Section 2 apply         │
└─────────────────────────────────────────────────────┘

---

## 1. What Is This App

**BukuKas** — digital bookkeeping for a small Indonesian family business (agricultural commodity trading).
React 19.2.4, react-scripts 5.0.1. No router. Supabase backend (`USE_SUPABASE=true`).
UI language: **Indonesian**. All labels, toasts, errors, and status strings are in Indonesian.
Current schema version: **NORM_VERSION = 18** (defined in `src/utils/storage.js`).
Single-page app — page switching is state-driven via `page` state in App.js.
Storage key: `"bukukas_data_v2"` (defined in `storage.js` as `STORAGE_KEY`) — used for import/export backup only; live data lives in Supabase.

---

## 2. Absolute Rules — Read Before Any Change

1. ALL global state mutations go through `update()` in `App.js`. Never call `setData()` directly anywhere outside App.js.
2. ALL status strings must come from `deriveStatus(type, isPartial)` in `statusUtils.js`. Never write `"Lunas"`, `"Belum Lunas (Piutang)"`, or `"Belum Lunas (Utang)"` as raw string literals in new code.
3. DATE MATH (addDays, diffDays, dueDate calculations): always use `T00:00:00Z` suffix and UTC methods (`getUTCDate`, `setUTCDate`). DATE DISPLAY (today(), transaction.date, viewDate): always use local time methods. Never mix.
4. ALL data model changes require three steps: (a) bump `NORM_VERSION` in `storage.js`, (b) add a migration block in `migrateData()`, (c) update `defaultData` with the new field.
5. `paymentHistory[]` is append-only. Never delete or modify existing entries — only append new ones.
6. `generateTxnId()` serial counter counts ONLY income transactions (`type === "income"`). Pass the FULL transactions array — the function internally filters. Only Penjualan (income) uses auto-generated txnId.
7. `dueDate` is calculated once at creation (`date + customDueDays`). On edit: only recalculate if date or customDueDays changed; keep existing if unchanged. Set to `null` only when `outstanding === 0`.
8. ALL array/object state updates must use spread operators and return new references. Never use `.push()`, `.pop()`, `.splice()`, or direct property assignment on state objects.
9. ALL division operations must guard against denominator = 0 before dividing (e.g., `val > 0 ? numerator / val : 0`).
10. ALL date operations must be wrapped in `try/catch` returning `null` on failure.
11. Pembelian (expense) transactions use a MANUAL txnId entered by the user (supplier invoice number). Penjualan (income) transactions use AUTO-GENERATED txnId from `generateTxnId()`. Never auto-generate for expense.
12. The `items[]` array holds multiple line items. Always check `Array.isArray(t.items) && t.items.length > 0` before accessing items. Fall back to top-level `t.itemName`/`t.stockQty` for any legacy data.
13. `computeStockMap` must always receive BOTH `transactions` AND `stockAdjustments`. Never call it with only one argument.
14. `editLog[]` on transactions is capped at the last 20 entries via `.slice(-20)`. `editLog[].prev` stores a **slim snapshot** (11 key fields: date, time, counterparty, itemName, stockQty, stockUnit, value, outstanding, status, dueDate, itemNames) — NOT a full transaction copy.
15. Never introduce new runtime npm packages without documenting the reason in this file's dependencies section and confirming no existing utility already covers the need.
16. `itemCatalog[]` is the canonical source for TransactionForm item selection. Each entry: `{ id, name, defaultUnit, subtypes[], archived, archivedSubtypes[] }`. Full item name = `name` (no subtypes) or `name + " " + subtype`. TransactionForm uses smart text inputs with autocomplete (not `<select>` dropdowns). New items/subtypes typed by the user trigger a confirmation dialog then auto-add to the catalog. Never write raw item names into TransactionForm outside the catalog lookup path.
17. `deleteInventoryItem(itemName)` checks ALL `items[]` entries (not just top-level `t.itemName`) before filtering a transaction. This ensures multi-item transactions are correctly handled when the deleted item is a secondary line item.
18. Contacts have an `archived` boolean field (v16). Active contacts: `archived === false`. Archived contacts shown in `ArchivedContacts` page. Catalog items have `archived` + `archivedSubtypes[]` (v15). Archived items shown in `ArchivedItems` page. Archiving and deletion are independent operations.
19. `deleteCatalogItem` and `deleteContact` both have a safety guard: they refuse to delete if any transaction references that item/contact. Permanent delete is only allowed for zero-transaction entities.

---

## 3. Navigation Map

| Page Key           | File                            | Nav Label        | Icon        | Badge Source                                  |
|--------------------|---------------------------------|------------------|-------------|-----------------------------------------------|
| `penjualan`        | `src/pages/Penjualan.js`        | Penjualan        | `income`    | `penjualanBadge` (near-due income, ≤3 days)   |
| `pembelian`        | `src/pages/Pembelian.js`        | Pembelian        | `expense`   | `pembelianBadge` (near-due expense, ≤3 days)  |
| `inventory`        | `src/pages/Inventory.js`        | Inventaris       | `inventory` | `alertCount` (negative + low-stock items)      |
| `contacts`         | `src/pages/Contacts.js`         | Kontak           | `contacts`  | none                                          |
| `reports`          | `src/pages/Reports.js`          | Laporan          | `reports`   | none                                          |
| `outstanding`      | `src/pages/Outstanding.js`      | Piutang & Hutang | `warning`   | `outstandingBadge` (penjualan + pembelian)    |
| `settings`         | `src/pages/Settings.js`         | Pengaturan       | `settings`  | none                                          |
| `archivedItems`    | `src/pages/ArchivedItems.js`    | (no nav link)    | —           | Reached via Inventory "Arsip" button          |
| `archivedContacts` | `src/pages/ArchivedContacts.js` | (no nav link)    | —           | Reached via Contacts "Arsip" button           |
| `activityLog`      | `src/pages/ActivityLog.js`      | Log Aktivitas    | `clock`     | none — Pemilik only (`profile.role === "owner"`) |

Both Penjualan and Pembelian use `src/components/TransactionPage.js` as their base component.
Dashboard.js was **deleted** — it no longer exists anywhere in the codebase.

---

## 4. Data Model Quick Reference

### defaultData (from storage.js)
```json
{
  "transactions": [],
  "contacts": [],
  "stockAdjustments": [],
  "itemCategories": [],
  "itemCatalog": [],
  "settings": {
    "businessName": "Usaha Keluarga Saya",
    "address": "",
    "phone": "",
    "lowStockThreshold": 10,
    "bankAccounts": [],
    "maxBankAccountsOnInvoice": 1,
    "lastExportDate": null,
    "defaultDueDateDays": 14
  }
}
```

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
    { "itemName": "Bawang Merah", "sackQty": 10, "weightKg": 500, "pricePerKg": 10430, "subtotal": 5215000 }
  ],
  "paymentHistory": [
    {
      "id": "1742000000001-xyz", "paidAt": "2026-03-15T07:30:00.000Z",
      "date": "2026-03-15", "time": "14:30", "amount": 3715000,
      "outstandingBefore": 5215000, "outstandingAfter": 1500000,
      "note": "Pembayaran awal", "method": null
    }
  ],
  "editLog": [
    { "at": "2026-03-15T08:00:00.000Z", "prev": {
      "date": "2026-03-15", "time": "14:30", "counterparty": "Budi Santoso",
      "itemName": "Bawang Merah", "stockQty": 10, "stockUnit": "karung",
      "value": 5215000, "outstanding": 1500000, "status": "Belum Lunas (Piutang)",
      "dueDate": "2026-03-29", "itemNames": ["Bawang Merah"]
    }}
  ]
}
```
`orderNum` — exists on all transactions, not used in any UI. Legacy field, safe to ignore.

### Contact Object
```json
{ "id": "1742000000000-abc1234", "name": "Budi Santoso", "email": "", "phone": "", "address": "", "archived": false }
```

### Item Catalog Object (v13/v14/v15)
```json
{
  "id": "1742000000000-abc1234", "name": "Bawang Merah", "defaultUnit": "karung",
  "subtypes": ["Kating", "Bima", "Thailand"], "archived": false, "archivedSubtypes": []
}
```

### Stock Adjustment Object
```json
{
  "id": "1742000000000-abc1234", "itemName": "Bawang Merah", "date": "2026-03-15",
  "time": "14:30", "adjustmentQty": 5, "reason": "Koreksi stok gudang",
  "unit": "karung", "adjustedBy": null
}
```

### Item Category Object
```json
{ "id": "1742000000000-abc1234", "groupName": "Bawang Putih", "code": "BP",
  "items": ["bawang putih", "bawang putih goodfarmer"] }
```
`items[]` contains normalized item names (lowercase, trimmed — output of `normItem()`).

---

## 5. Handler Signatures (App.js)

```
addTransaction(t)
  Creates new tx. Auto-generates txnId for income; uses t.txnId for expense.
  Creates initialPayment in paymentHistory[]. Calculates dueDate.
  Sets createdAt = new Date().toISOString(). Auto-creates contact if new counterparty.

editTransaction(t)
  Edits existing tx. Preserves txnId unless YY-MM prefix changed (income only).
  Appends "Transaksi diedit" entry to paymentHistory if value/outstanding changed.
  editLog capped at 20. Recalculates dueDate only if date or customDueDays changed.

deleteTransaction(id)
  Removes tx from transactions array.

applyPayment(id, paidAmount, paymentNote = "")
  Appends new entry to paymentHistory[]. Updates outstanding, status, dueDate.
  note = paymentNote || (isFullyPaid ? "Pelunasan" : "Pembayaran sebagian")

createContact(name)
  Adds new contact (archived: false) if name not already present (case-insensitive).

archiveContact(contactId)       Sets contact.archived = true.
unarchiveContact(contactId)     Sets contact.archived = false.
deleteContact(contactId)        Permanently deletes. BLOCKED if contact has transactions.

updateContact(contact)
  Updates contact. If name changed, cascades to all matching transactions.
  BLOCKS rename if another contact already has the same name.

handleImport(importedData)
  Writes to localStorage then re-reads via loadData() to run migrations.
  Warning: replaces ALL data.

addStockAdjustment(adj)         Appends to stockAdjustments[].
deleteStockAdjustment(id)       Removes a single stock adjustment by id.
updateItemCategories(categories) Replaces entire itemCategories[].

addCatalogItem(item)
  Appends new catalog item. Merges subtypes if same name already exists.
  Also auto-creates a matching itemCategories entry if none exists.

updateCatalogItem(updatedItem)
  Replaces catalog item by id. Syncs matching itemCategories entry's items[].

deleteCatalogItem(itemId)
  Removes catalog item. BLOCKED if any transaction references this item.
  Also removes matching itemCategories entry + stockAdjustments for those item names.

archiveCatalogItem(itemId)       Sets archived = true (base only, not subtypes).
unarchiveCatalogItem(itemId)     Sets archived = false (archivedSubtypes unchanged).
archiveSubtype(itemId, name)     Adds name to archivedSubtypes[].
unarchiveSubtype(itemId, name)   Removes name from archivedSubtypes[].

renameInventoryItem(oldName, newName)
  Updates itemName on ALL items[] entries in transactions + stockAdjustments.

deleteInventoryItem(itemName)
  Removes all transactions where ANY item in items[] matches. Removes matching adjustments.

handleViewItem(itemName)         Sets reportItemFilter + navigates to "reports".
navigateToOutstanding(txIds)     Sets outstandingHighlight + navigates to "outstanding".
```

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
5. If the change involves catalog or archive: re-read Rules 16–19

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
- If `npm run build` fails: common causes: unused imports, missing props, JSX type errors. Fix ALL before declaring done.

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

---

## 8. Sub-Agent Usage

**USE a sub-agent when:**
- Applying the SAME fix to 5+ page files independently
- Task has 2+ clearly independent parts with no shared state

**DO NOT use a sub-agent when:**
- Task involves `App.js` — single authoritative file, must be sequential
- Task involves `storage.js` — NORM_VERSION bump must happen exactly once
- Task involves changing the data model — migrations must be coordinated
- Task involves `styles.css` — class name conflicts possible
- Task involves `itemCatalog` — catalog CRUD is coordinated through App.js only

**Sub-agent handoff protocol:**
1. Give the agent the full text of this `/CLAUDE.md`
2. Give the agent the relevant directory `CLAUDE.md`
3. State EXACTLY which files to touch and which NOT to touch
4. Cite the specific Rule number from Section 2 most relevant to the task
5. After agent finishes: review changes, run `npm start`, update CLAUDE.md if needed

---

## 9. Known Issues — Never Reintroduce

- **FIXED (pre-2026):** UTC timezone off-by-1 in `addDays`/`diffDays`. Fix: use `T00:00:00Z` + `getUTCDate`/`setUTCDate`. File: `src/utils/idGenerators.js`
- **FIXED (pre-2026):** `today()` returned UTC date not local date. Fix: use local `getFullYear`/`getMonth`/`getDate`. File: `src/utils/idGenerators.js`
- **FIXED (pre-2026):** `applyPayment` wrote old v2 status strings. Fix: use `deriveStatus()`. File: `src/App.js`
- **FIXED (pre-2026):** `generateTxnId` counted all transactions not just income. Fix: filter `type === "income"`. File: `src/utils/idGenerators.js`
- **FIXED (pre-2026):** `dueDate` calculated with local midnight causing off-by-1 in UTC+ timezones. Fix: v5 migration recomputes all dueDates with UTC.
- **FIXED (2026-03-15):** `paymentHistory[0].amount` set to 0 by v9 migration when initial payment existed. Fix: v10 corrects it. File: `src/utils/storage.js`
- **FIXED (2026-03-15):** `time` field missing from paymentHistory entries. Fix: v10 backfills `"00:00"`. Files: `src/App.js`, `src/utils/storage.js`
- **FIXED (2026-03-15):** `getItemContribution` only worked for exactly 1 selected item. Fix: renamed to `getMultiItemContribution`, guard changed. File: `src/pages/Reports.js`
- **FIXED (2026-03-27):** Multi-item stock warning only collected first negative item. Fix: collects ALL into `negItems[]`. Files: `src/components/TransactionForm.js`, `src/components/StockWarningModal.js`
- **FIXED (2026-03-27):** v5 dueDate migration used hardcoded `14` days. Fix: uses `t.customDueDays ?? 14`. File: `src/utils/storage.js`
- **FIXED (2026-03-27):** `updateContact` did not block rename collision. Fix: case-insensitive duplicate check added. File: `src/App.js`
- **FIXED (2026-03-27):** Inventory ledger week-start used `getDay()` (Sunday=0). Fix: `(getDay() + 6) % 7`. File: `src/pages/Inventory.js`
- **FIXED (2026-03-27):** Escape key missing from all modals. Fix: `useEffect` keydown listener on every modal. Files: all modal components.
- **FIXED (2026-03-27):** `SuratJalanModal` used `it.stockUnit` (does not exist). Fix: changed to `t.stockUnit`. File: `src/components/SuratJalanModal.js`
- **FIXED (2026-03-27):** CSV export filename used literal `"today"`. Fix: uses `today()` function. File: `src/pages/Settings.js`
- **FIXED (2026-03-27):** `editLog[].prev` stored full deep copy (~60 KB per transaction). Fix: slim 11-field snapshot. File: `src/App.js`
- **FIXED (2026-03-27):** `deleteInventoryItem` only checked top-level `t.itemName`. Fix: checks all `items[]`. File: `src/App.js`
- **FIXED (2026-03-27):** Contacts.js allowed duplicate contact names. Fix: inline `nameError` state + check. File: `src/pages/Contacts.js`
- **FIXED (2026-03-28):** `.inventory-group-header` hover flickered. Fix: hover-override CSS. File: `src/styles.css`
- **FIXED (2026-03-28):** Client dropdown opened on form mount. Fix: `skipNextFocusOpen` ref. File: `src/components/TransactionForm.js`
- **FIXED (2026-03-28):** "Tampilkan stok kosong" toggle missed absent items. Fix: reordered null-check. File: `src/components/StockReportModal.js`
- **FIXED (2026-03-28):** Phantom category items displayed as raw lowercase keys. Fix: `normalizeTitleCase()` fallback. File: `src/components/CategoryModal.js`
- **FIXED (2026-03-28):** Catalog base items with 0 stock landed in LAINNYA. Fix: groupName-prefix fallback in `tableGroups`. File: `src/pages/Inventory.js`
- **FIXED (2026-03-29):** PERIODE quick-select buttons had no active state. Fix: `activePeriod` drives button class. File: `src/pages/Inventory.js`
- **FIXED (2026-03-29):** CategoryModal allowed duplicate group names. Fix: `commitName` validates via `normItem()`. File: `src/components/CategoryModal.js`
- **FIXED (2026-03-29):** Manual code edits on parent groups didn't cascade to children. Fix: `commitCode` finds children by prefix match. File: `src/components/CategoryModal.js`
- **FIXED (2026-04-05):** `doSave` had no `try/finally` — `submitting` stayed true permanently on throw. Fix: wrapped in `try/finally { setSubmitting(false) }`. File: `src/components/TransactionForm.js`
- **FIXED (2026-04-05):** `setSubmitting(true)` was called after validation — race on double-click. Fix: moved to first line of `handleSubmit`. File: `src/components/TransactionForm.js`
- **FIXED (2026-04-05):** `customDueDays = 0` created immediately-overdue transactions. Fix: `Math.max(1, ...)` in `doSave`. File: `src/components/TransactionForm.js`
- **FIXED (2026-04-05):** `PaymentUpdateModal` had no double-submit guard. Fix: `submitting` state + `try/finally`. File: `src/components/PaymentUpdateModal.js`
- **FIXED (2026-04-05):** Inventory ledger missed duplicate same-item rows in multi-item transactions. Fix: accumulate ALL matching item rows. File: `src/pages/Inventory.js`
- **FIXED (2026-04-05):** Reports.js CSV missing BOM — Excel garbled Indonesian characters. Fix: prepend `\uFEFF`. File: `src/pages/Reports.js`
- **FIXED (2026-04-05):** InvoiceModal showed today's date instead of transaction date. Fix: `fmtDate(transactions[0]?.date)`. File: `src/components/InvoiceModal.js`
- **FIXED (2026-04-05):** `ensureContact` missing `archived: false`. Fix: added to object literal. File: `src/App.js`
- **FIXED (2026-04-05):** `categoryUtils.js` used `.push()` on state-adjacent objects. Fix: immutable spread. File: `src/utils/categoryUtils.js`
- **FIXED (2026-04-05):** `Contacts.js` `handleSave` had no `finally` around `setSubmitting(false)`. Fix: wrapped in `try/finally`. File: `src/pages/Contacts.js`
- **FIXED (2026-04-05):** Reports.js export filename was `Laporan__sd_.csv` for all-time period. Fix: `dateFrom || "semua"`. File: `src/pages/Reports.js`
- **FIXED (2026-04-05):** XSS via innerHTML in `printWithPortal` A4 path. Fix: `escapeHtml` export + import validation with `stripTags`. Files: `src/utils/printUtils.js`, `src/pages/Settings.js`
- **FIXED (2026-04-05):** Import validation insufficient. Fix: financial bounds, nested array checks, `settings` structure, HTML tag stripping. File: `src/pages/Settings.js`
- **FIXED (2026-04-05):** Vestigial legacy `@media print` block interfered with Ctrl+P. Fix: removed. File: `src/styles.css`
- **FIXED (2026-04-01):** `Settings.js` `handleSave` set `submitting` after validation — same H7 race as TransactionForm. Fix: moved to first line, added `setSubmitting(false)` on early return. File: `src/pages/Settings.js`
- **FIXED (2026-04-01):** `Settings.js` `defaultDueDateDays` validated `n >= 0`, allowing 0 to be saved. 0 silently fell back to 14 in TransactionForm (`|| 14`). Fix: validate `n >= 1`. File: `src/pages/Settings.js`
- **FIXED (2026-04-01):** `Reports.js` `exportCSV` used `data:` URI with implicit ~2MB browser limit. Fix: changed to `Blob + URL.createObjectURL`, matching Settings.js pattern. File: `src/pages/Reports.js`
- **FIXED (2026-04-08):** Save error banner ("localStorage mungkin penuh") was shown in Supabase mode on write failure. Fix: added `!USE_SUPABASE` guard — banner only renders in localStorage mode; Supabase failures are handled exclusively by `SaveErrorModal`. File: `src/App.js`
- **FIXED (2026-04-08):** `addCatalogItem` supabase operation saved the catalog item but not the auto-created `itemCategories` entry. Fix: `Promise.all([sbSaveItemCatalogItem, sbSaveItemCategories])`. File: `src/App.js`
- **FIXED (2026-04-08):** `updateCatalogItem` supabase operation saved only the catalog item, not the synced `itemCategories` changes. Fix: `Promise.all([sbSaveItemCatalogItem, sbSaveItemCategories])`. File: `src/App.js`
- **FIXED (2026-04-08):** `deleteCatalogItem` supabase operation only called `sbDeleteItemCatalogItem`, leaving the pruned `itemCategories` out of sync in Supabase. Fix: `Promise.all([sbDeleteItemCatalogItem, sbSaveItemCategories])`. File: `src/App.js`
- **FIXED (2026-04-08):** `saveItemCategories` duplicate key violation — `persistToSupabase` was called inside `setData(fn)`, which React StrictMode double-invokes, creating two concurrent delete→insert sequences that race. Fix (primary): moved `persistToSupabase` **outside** `setData` in `update()` by reading from `dataRef.current` instead of the functional updater pattern. Fix (defense-in-depth): added `isSavingCategories` mutex lock in `saveItemCategories`. Files: `src/App.js`, `src/utils/supabaseStorage.js`
- **FIXED (2026-04-08):** Inventory showed each item twice after page reload — React StrictMode double-invokes `useEffect`, causing `loadDataFromSupabase` to fire twice and potentially overwrite in-flight state. Fix: `loadedRef = useRef(false)` guard ensures load runs exactly once per mount. File: `src/App.js`
- **FIXED (2026-04-08):** `deleteCatalogItem` and `archiveCatalogItem` UI did not update until browser refresh. Root cause (Cause A): `dataRef.current` was only synced via `useEffect` (after React commits), so any `update()` call fired before the effect ran used a stale snapshot — `fn(dataRef.current)` either missed the item or operated on pre-deletion data, causing `setData` to receive unchanged state. Fix: added `dataRef.current = nd` synchronously inside `update()` before `setData(nd)`, so subsequent calls always read the latest computed data. File: `src/App.js`
- **FIXED (2026-04-12):** ActivityLog PENGGUNA column showed raw email for login entries. Root cause: `saveActivityLog` was called with `data.user.email` before `fetchProfile` resolved. Fix: `await fetchProfile(data.user.id)` before the `saveActivityLog` call; `user_name` uses `prof?.full_name || email`. File: `src/utils/AuthContext.js`
- **FIXED (2026-04-12):** ActivityLog ENTITAS column showed full internal IDs (e.g. `1775933722773-90vxehs`) for old transaction entries. Fix: added `isTxnId(id)` helper (`/^\d{2}-\d{2}-\d{4,5}$/`) — IDs matching the txnId pattern display as-is; others are truncated to last 6 chars with `#` prefix. File: `src/pages/ActivityLog.js`
- **FIXED (2026-04-12):** ActivityLog ENTITAS column was missing `#` prefix for new-format txnId entries (e.g. `26-04-00023` showed without `#`). Fix: both branches of `isTxnId` check now prepend `#`. File: `src/pages/ActivityLog.js`
- **FIXED (2026-04-12):** ActivityLog "Lihat" button navigated to the page but found no transaction when `entity_id` was an internal ID (old log entries). Fix: `onViewTransaction` now tries `t.txnId === entityId` first, then falls back to `t.id === entityId`. File: `src/App.js`
- **FIXED (2026-04-12):** ActivityLog "Lihat" button navigated to the correct page but `viewDate` stayed on today — transaction was not visible. Fix: `onViewTransaction` sets `txPageHighlight({ txId: tx.id, date: tx.date })`; TransactionPage now accepts `initViewDate` + `highlightTxIds` + `onClearHighlight` props that sync `viewDate` and flash the matching row (same pattern as Outstanding.js). Files: `src/App.js`, `src/components/TransactionPage.js`
- **FIXED (2026-04-12):** `logActivity` in `addTransaction` passed `nt.txnId` as `entityId` — which is always `undefined` for income transactions because `txnId` is generated inside the `update()` state function. Fix: use `newTx?.txnId` (retrieved from post-update state via `nd.transactions.find`). Same pattern applied to `editTransaction`: use `updated?.txnId || nt.txnId`. File: `src/App.js`
- **FIXED (2026-04-12):** No React error boundary — any unhandled render error produced a blank white screen with no recovery path for users. Fix: Created ErrorBoundary.js class component (getDerivedStateFromError + componentDidCatch) with Indonesian fallback UI and "Muat Ulang" reload button. Wrapped `<App />` in src/index.js. Files: `src/components/ErrorBoundary.js`, `src/index.js`
- **FIXED (2026-04-12):** signOut() relied entirely on async onAuthStateChange callback to clear user/session/profile state — brief window where JWT was invalid but app still showed user as logged in, causing SaveErrorModal instead of login redirect. Fix: Added synchronous `setSession(null); setUser(null); setProfile(null)` before `await supabase.auth.signOut()`. File: `src/utils/AuthContext.js`
- **FIXED (2026-04-12):** Contacts.js Edit button did not clear nameError state — validation error from a previously edited contact persisted visually when opening a different contact for editing. Fix: Added `setNameError("")` to Edit button onClick handler. File: `src/pages/Contacts.js`
- **FIXED (2026-04-12):** Supabase field mappers did not coerce numeric fields — PostgREST returns NUMERIC/DECIMAL columns as strings, causing string concatenation instead of arithmetic in stock calculations. Fix: Added `Number() || 0` coercion to all numeric fields in `mapTransaction` (including nested items[] and paymentHistory[]) and `mapStockAdjustment`; `mapCatalogItem` reviewed — no NUMERIC/DECIMAL fields, no changes needed. File: `src/utils/supabaseStorage.js`
- **FIXED (2026-04-12):** `update()` retry re-ran `fn` on already-mutated state — `addTransaction`, `applyPayment`, and `addStockAdjustment` all appended again on retry, causing duplicate transactions, corrupted payment outstanding values, and duplicate stock adjustments. Fix: Changed retry closure for append-style operations to only retry the Supabase write (`persistToSupabase`) using the already-computed `nd`, not re-run `update(fn)`. Idempotent operations (edit, delete, archive) unchanged. File: `src/App.js`
- **FIXED (2026-04-12):** No session idle timeout — users stayed logged in indefinitely when leaving the app unattended. Fix: Added 15-minute idle timeout to AuthContext.js via `useEffect` + `setTimeout` on user activity events (`mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`). On timeout: `signOut()` is called and `idleTimedOut` flag is set. Login.js shows Indonesian message "Sesi Anda telah berakhir karena tidak aktif. Silakan masuk kembali." when flag is set. Flag is not cleared by `signOut()` — only cleared on successful re-login via `clearIdleTimedOut()`. Files: `src/utils/AuthContext.js`, `src/pages/Login.js`
- **FIXED (2026-04-13):** `generateTxnId` collision — two simultaneous income transactions could receive the same txnId if Realtime had not yet synced the other user's transaction into local state. Long-term fix: `txn_counters` table + `next_txn_serial()` Postgres RPC (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`) — atomic serial assignment seeded from existing data. `addTransaction` is now `async` and calls `getNextTxnSerial(date)` before `update()` in Supabase mode; falls back to `generateTxnId()` on RPC failure. `generateTxnId()` unchanged as localStorage fallback. **Short-term collision detection toast KEPT as defense-in-depth — do not remove.** Files: `src/App.js`, `src/utils/supabaseStorage.js`
- **FIXED (2026-04-13):** `PasswordChangeModal` could be dismissed without setting a password — "Nanti Saja" button, Escape key handler, and backdrop click all allowed bypass. Fix: removed "Nanti Saja" button, removed `onCancel` prop, removed `useEffect` Escape listener. Modal overlay has no `onClick` handler. Also added show/hide eye toggles to both password fields using the `.login-password-toggle` + `Icon name="eye"` pattern from Login.js. File: `src/App.js`
- **FIXED (2026-04-14):** `deleteContact` supabaseOperation fired even when guard blocked deletion — `update()` calls `supabaseOperation(nd)` unconditionally regardless of whether the state function returned `d` unchanged. Fix: supabaseOperation now receives `nd` and checks `nd.contacts.some(c => c.id === contactId)` before calling `sbDeleteContact`. Same defensive guard added to `deleteCatalogItem` (checks `nd.itemCatalog`). File: `src/App.js`
- **FIXED (2026-04-14):** `getNextTxnSerial` used local-time date parsing (`T00:00:00` without Z), violating Rule 3. Could produce wrong `YY-MM` prefix at month/year boundaries near midnight in UTC+ zones. Fix: changed to `T00:00:00Z` + `getUTCFullYear`/`getUTCMonth`. File: `src/utils/supabaseStorage.js`
- **FIXED (2026-04-14):** `fmtTimestamp` in ActivityLog.js mixed UTC date (`toISOString().slice(0,10)`) with local time (`getHours`/`getMinutes`). Users active between 00:00–07:00 Jakarta time saw off-by-1 dates. Fix: consistent local-time date extraction using `getFullYear`/`getMonth`/`getDate`. File: `src/pages/ActivityLog.js`
- **ADDED (2026-04-15):** Stock/weight quantities displayed without thousand separators — hard to read for large numbers. Fix: Added `fmtQty()` utility to `idGenerators.js` (`toLocaleString("id-ID")`). Applied to all read-only quantity/weight display locations: `Inventory.js` (mismatch warning), `TransactionPage.js` (sack qty column), `Reports.js` (stock column), `StockChip.js`, `SuratJalanModal.js` (items + total). `InvoiceModal.js` already used `.toLocaleString("id-ID")` — unchanged. `textFormatter.js` updated to use its internal `fmtNum()` for qty (consistent with price/weight formatting already there). Input fields unchanged.
- **ADDED (2026-04-15):** Delete confirmation modal required only one click — no friction before permanent data deletion. Fix: Added `confirmInput` state to `DeleteConfirmModal.js` — "Ya, Hapus" button disabled (opacity 0.5, `cursor: not-allowed`) until user types `"hapus"` (case-insensitive). Input resets on both Batal and Ya Hapus. Applies to all `DeleteConfirmModal` uses: transaction deletes (TransactionPage.js, Contacts.js, Outstanding.js) and contact deletes (Contacts.js).
- **ADDED (2026-04-15):** Total Pemasukan and Total Pengeluaran summary cards visible to Karyawan on Laporan page. Fix: Wrapped all three summary cards (Total Pemasukan, Total Pengeluaran, Laba/Rugi) in single `{isOwner && (...)}` conditional in `Reports.js`. Eliminated the previous separate `...(isOwner ? [Laba/Rugi] : [])` spread. Karyawan sees transaction list, filters, and export button only.
- **FIXED (2026-04-15):** SuratJalanModal client address rendered with wrong font size, faded color, and misaligned indent. Fix: Changed `fontSize: sc.bodyFont - 1` → `sc.bodyFont`, removed `color: "#64748b"`, changed `paddingLeft: 8` → `marginLeft: 98` (90px label min-width + 8px flex gap) to align with value column. File: `src/components/SuratJalanModal.js`.
- **FIXED (2026-04-15):** TransactionDetailModal payment history section had illegibly faded text colors and no payment summary. Fix: Added payment summary bar (progress bar + Dibayar/Sisa amounts using `computePaymentProgress`). Fixed note color `#9ca3af` → `#374151`, date color → `#6b7280`, "Sisa setelah" color `#d1d5db` → `#6b7280`, amount weight 600 → 700, size 12 → 13, color → `#1e3a5f`. File: `src/components/TransactionDetailModal.js`.
- **ADDED (2026-04-15):** Decimal quantity inputs (Jumlah Karung, Berat KG in TransactionForm; stock adjustment qty in Inventory) used plain text inputs with no locale formatting. Fix: Created `QtyInput.js` — decimal-aware controlled input modeled on RupiahInput.js. Uses `isFocusedRef` to suppress prop-sync during typing, accepts `.` or `,` as decimal separator, formats with `toLocaleString("id-ID")` on blur. Applied to Jumlah Karung, Berat (Kg) in TransactionForm.js and adjustment qty in Inventory.js. Inventory.js `adjQtyRef` auto-focus updated to `querySelector("input")` pattern (wrapper div ref). Files: `src/components/QtyInput.js`, `src/components/TransactionForm.js`, `src/pages/Inventory.js`.
- **FIXED (2026-04-16):** TransactionDetailModal totals and payment summary visually disconnected — "Sisa Tagihan" was far from "Dibayar" in a different section. Fix: Removed "Sisa Tagihan" from old totals row; created unified payment block (Total Nilai → thin divider → Sudah Dibayar in green → Sisa Tagihan in amber or "Lunas ✓" in green → progress bar). Removed duplicate summary bar from Section 6. File: `src/components/TransactionDetailModal.js`.
- **FIXED (2026-04-16):** QtyInput.js only formatted on blur — thousand separators (id-ID dots) did not appear while typing. Fix: Rewrote `handleChange` to format live on every keystroke using `toLocaleString("id-ID")`. Trailing comma preserved during decimal input so user can finish typing the decimal part. `onFocus` selects all text for easy replacement. File: `src/components/QtyInput.js`.
- **CHANGED (2026-04-16):** A4 Surat Jalan "KEPADA YTH" layout — client name and address were beside the label (flex row). Changed to stacked: label on one line, client name below it, address below that. File: `src/components/SuratJalanModal.js`.
- **CHANGED (2026-04-16):** Dot matrix Surat Jalan format redesigned: removed company name from header (only "SURAT JALAN" centered); Plat Mobil row always shown (blank when not provided); footer labels changed from "Pengirim,/Penerima," → "TANDA TERIMA,/HORMAT KAMI,"; signature lines changed from underscores to parentheses with spaces. File: `src/utils/textFormatter.js`.
- **CHANGED (2026-04-16):** Dot matrix Surat Jalan: removed "No :" (invoice number) row from print output. `Tanggal` line now appears first (full width), followed by `Kepada`. File: `src/utils/textFormatter.js`.
- **CHANGED (2026-04-16):** Dot matrix Surat Jalan modal: removed placeholder text from "Plat Nomor Kendaraan" input and "Catatan Pengiriman" textarea. File: `src/components/DotMatrixPrintModal.js`.
- **FIXED (2026-04-16):** `mapSettings` did not coerce numeric fields — `lowStockThreshold`, `maxBankAccountsOnInvoice`, `defaultDueDateDays` were returned as raw strings from PostgREST, causing potential arithmetic bugs. Fix: Added `Number() || 0` coercion matching `mapTransaction` pattern. File: `src/utils/supabaseStorage.js`.
- **FIXED (2026-04-16):** `addCatalogItem` new-item path was missing `archived: false` and `archivedSubtypes: []` on the created object. Strict `=== false` checks and future mappers could mishandle these items. Fix: Added both fields to the new-item object literal. File: `src/App.js`.
- **FIXED (2026-04-16):** Contacts inline `onAddContact` supabaseOperation called only `sbSaveContact`, missing `logActivity`. Contacts created from the Contacts page were invisible in the audit trail. Fix: Wrapped in `Promise.all([sbSaveContact, logActivity('create','contact',...)])` matching the `createContact` pattern. File: `src/App.js`.
- **FIXED (2026-04-16):** `editTransaction` used local `generateTxnId()` when an income transaction's date changes YY-MM prefix — same collision race as the `addTransaction` H2 fix. Fix: `editTransaction` is now `async`; pre-computes `precomputedTxnId = await getNextTxnSerial(nt.date)` before `update()` in Supabase mode; state function uses `precomputedTxnId || generateTxnId(...)` as fallback. File: `src/App.js`.
- **FIXED (2026-04-16):** `QtyInput.fmtNum(0)` returned `""` — a field pre-filled with 0 appeared blank, indistinguishable from an empty field. Fix: null/undefined produces `""`, all other values (including 0) use `toLocaleString("id-ID")`. File: `src/components/QtyInput.js`.
- **FIXED (2026-04-16):** `TransactionForm` validate() — zero `sackQty` passed the `< 0` check and reached the subtotal check, showing "Total harus positif" instead of a quantity-level error. Fix: added `else if (Number(it.sackQty) === 0)` branch with message "Jumlah karung harus lebih dari 0", which fires before the subtotal check. File: `src/components/TransactionForm.js`.
- **FIXED (2026-04-16):** Reports.js CSV export filename was `Laporan_semua_sd_semua` when no date range was selected. Fix: three-branch filename logic — neither set → `Laporan_semua`; only `dateFrom` set → `Laporan_mulai_[dateFrom]`; both set → `Laporan_[dateFrom]_sd_[dateTo]`. File: `src/pages/Reports.js`.
- **NOTE (2026-04-16):** Inventory.js `adjQtyRef` auto-focus call already used optional chaining (`adjQtyRef.current?.querySelector("input")?.focus()`) — no change needed.
- **FIXED (2026-04-17):** False-positive conflict modal after `applyPayment`. Root cause: `saveTransaction()` writes `(tx.version || 0) + 1` to Supabase but `applyPayment()` kept the old version in local state. On the next edit, `checkVersion()` compared local (old) vs Supabase (incremented) and incorrectly fired the conflict modal even with no concurrent edit. Fix: added `version: (t.version || 0) + 1` to the spread inside `applyPayment()`'s `update()` state function, mirroring exactly what `saveTransaction()` writes. `saveTransaction()` and `checkVersion()` not touched. File: `src/App.js`.
- **FIXED (2026-04-17):** Payment progress bar was hidden (returning text label / null) when 0% paid. Fix: removed the `pct <= 0` early-return branches in `TransactionPage.js` and `Outstanding.js` — the bar now renders at all percentages including 0% (empty grey track, no green fill). Files: `src/components/TransactionPage.js`, `src/pages/Outstanding.js`.
- **CHANGED (2026-04-17):** Edit entry in payment history timeline now shows three labeled fields instead of bare Sebelum/Setelah. New entries written by `editTransaction()` include `valueBefore`, `valueAfter`, `statusBefore`, `statusAfter` fields and use note `"Transaksi Diedit"`. `PaymentHistoryPanel.js` detects both old (`"Transaksi diedit — nilai diperbarui"`) and new note strings for backward compatibility; old entries still show single-line format. Files: `src/App.js`, `src/components/PaymentHistoryPanel.js`.
- **CHANGED (2026-04-17):** Edit entry in payment history now includes "Sudah Dibayar" line (four fields total: Total Nilai / Sudah Dibayar / Sisa Tagihan / Status). `editPaymentEntry` in `editTransaction()` gains `paidBefore` and `paidAfter` fields (`Math.max(0, value - outstanding)`). Display updated to show four lines in order; `?? 0` fallback guards entries written before this change. Files: `src/App.js`, `src/components/PaymentHistoryPanel.js`.
- **FIXED (2026-04-17):** `editTransaction()` did not increment `version` in local state — `...nt` spread carried the old version, causing false-positive conflict modal on the next edit (same root cause as the `applyPayment` fix). Fix: added `version: (x.version || 0) + 1` to the `return { ...nt, ... }` spread inside `update()`, using `x.version` (pre-edit transaction). File: `src/App.js`.
- **CHANGED (2026-04-17):** `TransactionDetailModal.js` payment history section now renders edit entries (`note === "Transaksi Diedit"` or `"Transaksi diedit — nilai diperbarui"`) matching `PaymentHistoryPanel.js` format. New entries show label "Transaksi Diedit" + four labeled lines (Total Nilai / Sudah Dibayar / Sisa Tagihan / Status). Old entries without `valueAfter` fall back to "Sisa setelah: Rp X". Regular payment entries unchanged. File: `src/components/TransactionDetailModal.js`.
- **FIXED (2026-04-20):** `renameInventoryItem` only updated transactions and stock adjustments — if `oldName` matched a catalog entry, that entry's name went stale and its subtype combined names were not cascaded. Fix: rewrote `renameInventoryItem` to (1) find a matching catalog entry via `normItem` comparison, (2) build a `nameMap` of every old variant → new variant (base name + `"${base} ${sub}"` for each subtype), (3) apply `mapName` across all transactions (`t.itemName`, `t.items[].itemName`) and stock adjustments, (4) update the catalog entry's name in state, (5) persist all touched transactions, adjustments, and the catalog entry via `Promise.all`. Catalog match captured by ID in closure variable (`catalogMatchId`) to avoid false matches in the Supabase callback. **Retry safety:** `catalogMatchId` is assigned with `if (catalogMatch) catalogMatchId = catalogMatch.id` — never `catalogMatch?.id || null`. On retry, `fn` re-runs on already-renamed state so `find()` returns `undefined`; the `if` guard prevents overwriting the captured ID to `null`, ensuring the Supabase callback still saves the catalog entry. No-op when `oldName` has no catalog entry (uncatalogued path unchanged). File: `src/App.js`
- **ADDED (2026-04-20):** Catalog rename UI was unreachable — `handleUpdateCatalogItem`'s rename cascade (`onRenameItem` for base name + each subtype's combined name) existed but no UI button opened the catalog edit form with an existing item pre-populated. Fix: added "Edit Barang" action button (position #2 in action row) on catalogued base item rows and subtype rows. Visible only when `isToday && (row.catalogItem || row.isSubtype)`. Base rows pass `row.catalogItem` directly; subtype rows fall back to `row.parentCatalogItem` (since `row.catalogItem` is `null` for subtypes). The onClick handler computes `target = row.catalogItem || row.parentCatalogItem` and returns early if target is falsy — a defensive no-op guarding against any future row-construction change that produces a subtype row without `parentCatalogItem`. Duplicate-name guard at line 603 blocks collision saves with inline error. "Ubah Nama" button remains hidden on catalogued/subtype rows (B10 fix preserved). File: `src/pages/Inventory.js` **SUPERSEDED by B2 — see REMOVED entry below.**
- **REMOVED (2026-04-20):** "Edit Barang" action button on catalogued/subtype rows removed — it was a stopgap added in the same session (B12) to open the catalog edit form for renames. With B13 fixing `renameInventoryItem` to handle catalog + subtype cascade atomically, the form-based rename path (`handleUpdateCatalogItem → onRenameItem`) would have double-fired the cascade. The "Ubah Nama" button is now used instead. File: `src/pages/Inventory.js`
- **CHANGED (2026-04-20):** "Ubah Nama" button visibility on Inventory rows — condition changed from `isToday && !row.catalogItem && !row.isSubtype` to `isToday && !row.isSubtype`. Catalogued base rows now show "Ubah Nama"; subtype rows remain hidden (subtype rename deferred to B3). `openRename` extended with `isCatalogued = false` third param stored in `renameTarget`. `handleRenameConfirm` now blocks merge for catalogued items: if `renameTarget.isCatalogued && !isSameKey && newName in activeStockMap`, shows error "Nama ini sudah dipakai oleh item lain. Pilih nama yang belum ada." and returns (merging catalog entries is unsafe — deferred). Uncatalogued merge-confirm behavior unchanged. File: `src/pages/Inventory.js` **EXTENDED by B3 — subtype rows now also show Ubah Nama; see ADDED entry below.**
- **ADDED (2026-04-20):** Subtype rename (B3). New `renameSubtype(parentCatalogId, oldSub, newSub)` handler in App.js — atomically (1) replaces `oldSub` with `newSub` in `parent.subtypes[]`, (2) cascades the combined name (`"${parent.name} ${oldSub}"` → `"${parent.name} ${newSub}"`) across all `t.itemName`, `t.items[].itemName`, and `stockAdjustments[].itemName`, (3) persists all touched transactions, adjustments, and the updated parent catalog entry via `Promise.all`. No closure-capture needed — `parentCatalogId` is passed directly and `nd.itemCatalog.find(c.id === parentCatalogId)` is stable across retries. Wired as `onRenameSubtype` prop to Inventory. `openRename` extended with fourth param `subtypeContext = null` (`{ parentCatalogId, subtypeName, parentName }`). `handleRenameConfirm` dispatches to the subtype branch when `renameTarget.subtypeContext` is present: validates parent prefix unchanged (error "Nama parent tidak bisa diubah..."); strips prefix to get `newSub`; checks `newSub` against all parent subtypes including archived (error "Tipe ini sudah ada..."); calls `onRenameSubtype`. Ubah Nama button condition changed to `{isToday && (` — now shows on all rows including subtypes; onClick builds `subtypeContext` for subtype rows. Files: `src/App.js`, `src/pages/Inventory.js`
- **REMOVED (2026-04-20):** Dead cascade code in `handleUpdateCatalogItem` (lines 616–625) — the `if (original && normItem(original.name) !== ...)` block that called `onRenameItem` for base name + each subtype. This logic duplicated `renameInventoryItem` (B13). With the Edit Barang button gone, `handleUpdateCatalogItem` is unreachable via the catalog Simpan button and only called for subtype/unit edits where name is unchanged. File: `src/pages/Inventory.js`
- **FIXED (2026-04-20):** `renameInventoryItem` and `renameSubtype` both updated `itemCatalog` atomically but left `itemCategories` stale — renamed items appeared as uncategorized phantoms in the Inventory UI until the user manually re-ran Kelola Kategori. Fix: both handlers now update `itemCategories` inside the same `update()` state function and persist via `sbSaveItemCategories(nd.itemCategories, user.id)` in the Supabase callback. `renameInventoryItem`: finds the matching category by `normItem(cat.groupName) === normItem(oldName)`, rebuilds with `groupName: newName` + new base key + new subtype combined keys; `sbSaveItemCategories` guarded by `catalogMatchId` (uncatalogued path unchanged). `renameSubtype`: finds category by `normItem(cat.groupName) === normItem(parent.name)`, rebuilds `items[]` using `updatedSubtypes` (post-rename map of `parent.subtypes`) — NOT `parent.subtypes` directly (pre-rename ref); `sbSaveItemCategories` always called (renameSubtype only fires on catalogued items). Pattern matches `updateCatalogItem` at line 1213. File: `src/App.js`
- **ADDED (2026-04-20):** Kelola Kategori Phase 1 — archive-aware filter + toggle (B17). `CategoryModal` gains `itemCatalog` prop. Two `useMemo` sets (`archivedCatalogKeys`, `activeCatalogKeys`) keyed only on `itemCatalog`; subtypes evaluated independently of base archive status. `showArchived` toggle (default `false`): off=active keys only; on=active+archived. Orphan keys (in neither set) always hidden in both modes; one-shot `console.warn("[CategoryModal] Detected orphan keys...")` on mount. Category groups hidden entirely when 0 visible items, except when `editingName === cat.id`. Uncategorized section: archived keys hidden when toggle off; uncataloged-with-txs keys (not in catalog at all) always shown. `handleSave` untouched — archived items keep their category references across saves. `Inventory.js` passes `itemCatalog` prop. CSS: `.cat-modal__item-pill--archived` (opacity 0.55 + strikethrough), `.cat-modal__archive-toggle`, `.cat-modal__archive-hint`. Files: `src/components/CategoryModal.js`, `src/pages/Inventory.js`, `src/styles.css`

---

## 11. Known Limitations (Not Bugs — Documented Behaviour)

These are intentional product constraints or accepted trade-offs. Do not attempt to fix without explicit instruction.

1. **Catalog deletion requires multiple steps when subtypes exist.** `deleteCatalogItem` matches by `itemId` only. A base item with subtypes cannot be deleted as a single action — user must handle each subtype first. No UI guidance for this flow exists.
2. **Catalog items with zero transactions cannot be archived via a rule — they can only be deleted.** The archive button works unconditionally, but archived zero-transaction items are invisible in normal catalog flow (they appear only in ArchivedItems page).
3. **Import in Supabase mode uses Promise.allSettled for upsert sync.** Partial failures show a warning toast. Full failure still writes to local React state. `handleImport` is `async` — runs local migrations first (via `loadData()`), then upserts each entity (transactions, contacts, stockAdjustments, itemCatalog, itemCategories, settings) to Supabase. The Settings.js import button is always enabled.
4. **Page resets to Penjualan on every browser refresh.** `page` state is in-memory only (no router). All navigation is lost on refresh. Known architectural constraint — no router is used by design.
5. **Cloudflare DDoS/rate limiting not yet active on custom domain.** App is hosted on Cloudflare Pages (buku-kas.pages.dev) — Cloudflare edge protection and CDN are already active. Full rate limiting rules require a custom domain (~$10-15/year). Once a domain is purchased: (a) add custom domain in Cloudflare Pages settings, (b) update Supabase URL Configuration with new domain, (c) tighten CSP connect-src to specific Supabase project URL, (d) enable custom rate limiting rules. Current protection: Cloudflare Pages built-in DDoS protection + security headers in public/_headers.
6. **Supabase free tier auto-pauses after 1 week of inactivity.** Graceful detection is implemented — app shows an Indonesian "Database Sedang Istirahat" screen with instructions for the owner to restore via Supabase Dashboard. An external keep-alive cron (cron-job.org, every 5 days) is also configured to prevent pauses proactively.

---

## 10. CLAUDE.md Maintenance Log

| Date | What Changed | Why |
|------|-------------|-----|
| 2026-03-15 | Initial CLAUDE.md system created (5 files) | First comprehensive documentation of current codebase state |
| 2026-03-17 | Updated NORM_VERSION 10→11, added v11 migration note | v11: Backfill `time` and `adjustedBy` fields on all stockAdjustments entries |
| 2026-03-17 | Deleted Dashboard.js (dead code), documented `orderNum` as unused | Codebase audit cleanup |
| 2026-03-19 | Updated NORM_VERSION 11→12, added itemCategories to data model | v12: Added `itemCategories: []` to defaultData |
| 2026-03-27 | Updated NORM_VERSION 12→14, added itemCatalog data model + handlers | v13/v14: itemCatalog system |
| 2026-03-27 | Added Rules 16–17, all missing handlers, bug fixes | Catalog + archive system |
| 2026-03-28 | Updated Rule 16 (smart text inputs); added 6 new bug fixes | Post-inventory-redesign |
| 2026-03-29 | Added 3 more bug fixes (PERIODE, duplicate names, code cascade) | CategoryModal + Inventory |
| 2026-04-02 | Full rewrite from source code. NORM_VERSION=17. Added v15/v16/v17 migrations, archive system (Rules 18–19), ArchivedItems + ArchivedContacts pages, archive/unarchive handlers, stockUtils.js, exportFormat state. Confirmed TransactionPage.js lives in components/. | Comprehensive code audit |
| 2026-04-05 | NORM_VERSION=18. Added 15 new bug fixes to Section 9 (XSS/import validation, double-submit, invoice date, CSV BOM, ledger accumulation, etc.). DEVELOPER_HANDOFF.md updated with all line counts, new TransactionForm behaviors, DotMatrixPrintModal state, escapeHtml export, textFormatter signatures with options param. | Post-audit fixes session |
| 2026-04-01 | Second audit (post-v18 changes). Added 3 new bug fixes to Section 9: Settings.js H7 race, defaultDueDateDays allows 0, Reports.js CSV data: URI limit. Updated AUDIT.md with second audit results. | Second audit session |
| 2026-04-06 | Deep doc scan. Fixed stale line counts across all 5 CLAUDE.md files and DEVELOPER_HANDOFF.md. Added missing ReportModal.js (312 lines) and DotMatrixPrintModal (122 lines) to component docs. Fixed Outstanding.js highlight docs: CSS class is `.outstanding-row--flash` (not `.flash-row`); flash cleared on first user interaction, not permanent. | Documentation sync |
| 2026-04-07 | Phase 0 complete: @supabase/supabase-js installed, supabaseClient.js created (anon key only, env var validated), HTTP security headers added via public/_headers and netlify.toml, deployment config ready. | Backend migration Phase 0 |
| 2026-04-07 | Phase 1 complete: Full Supabase schema created. 8 tables: profiles, transactions, contacts, item_catalog, stock_adjustments, item_categories, app_settings, activity_log. RLS enabled on all tables. Role-aware policies (owner/staff). 10 indexes. updated_at triggers on 6 tables. Auth trigger creates profile on user signup. | Backend migration Phase 1 |
| 2026-04-07 | Phase 3 complete: Authentication added. AuthContext.js manages session state. Login.js page in Indonesian. App.js auth gate added (hooks-safe: conditionals after all hooks). Sidebar shows logged-in user name and role. Session persists on refresh. | Backend migration Phase 3 |
| 2026-04-07 | Phase 4 complete: localStorage replaced with Supabase. supabaseStorage.js created with full field mapping. storageConfig.js USE_SUPABASE=true. SaveErrorModal.js blocks UI on write failure. All 23 handlers updated. Import disabled in Supabase mode. App loads data from Supabase on mount. | Backend migration Phase 4 |
| 2026-04-08 | Phase 4 post-implementation audit complete. 4 bugs found and fixed: saveError banner guard (!USE_SUPABASE), addCatalogItem/updateCatalogItem/deleteCatalogItem all now sync itemCategories to Supabase via Promise.all. All field mappings in supabaseStorage.js verified correct. | Phase 4 audit |
| 2026-04-08 | Phase 4 Bug Fix 2: Rewrote saveItemCategories() with guaranteed sequential delete-then-insert (.gte('created_at','1970-01-01') pattern). Fixed inventory double-render caused by React StrictMode double-invoking useEffect load (loadedRef guard). Cleared all test data from Supabase. | Phase 4 bug fixes |
| 2026-04-08 | Phase 4 Bug Fix 3: Root-cause fix for saveItemCategories duplicate key. Moved persistToSupabase outside setData() in update() using dataRef pattern — prevents React StrictMode from double-invoking concurrent Supabase writes. Added isSavingCategories mutex as defense-in-depth. Cleared all test data from Supabase. | Phase 4 bug fixes |
| 2026-04-08 | Phase 4 Bug Fix 4: Fixed stale UI after deleteCatalogItem and archiveCatalogItem. Root cause: dataRef.current only updated via useEffect (async), so rapid successive update() calls read stale snapshots. Fix: added `dataRef.current = nd` synchronously inside update() before setData(nd). One-line change; no other handlers touched. | Phase 4 bug fixes |
| 2026-04-08 | Phase 4 Comprehensive Audit complete. 1 CRITICAL, 4 HIGH, 1 MEDIUM, 1 LOW found. CRITICAL: updateContact cascade saves only contact row, not affected transaction rows (Supabase/state divergence on refresh). HIGH: deleteCatalogItem orphans stock_adjustments in Supabase; createContact always calls sbSaveContact even if contact already exists (duplicate row); quickExport reads localStorage in Supabase mode (empty backup). MEDIUM: deleteInventoryItem pollutes data state with _deleteInventoryIds. RLS SELECT policies need to-role verification. Added Section 11 Known Limitations. Phase 5 blocked until CRITICAL fixed. | Phase 4 audit |
| 2026-04-08 | Phase 4 Critical Bug Fixes: Fixed updateContact cascade — transactions now saved to Supabase on contact rename (cascadedTxs Promise.all). Fixed deleteCatalogItem — adjIdsToDelete captured in state fn before filter, sbDeleteStockAdjustment called for each orphaned row. Fixed createContact — supabaseOperation now checks nd.contacts for newContact.id before calling sbSaveContact (eliminates duplicate rows). Fixed quickExport — exports React state (not localStorage) in Supabase mode via Blob+createObjectURL; backup warning banner hidden in Supabase mode (!USE_SUPABASE guard). Verified RLS SELECT policies: all tables TO authenticated, no public/anon access. Cleared all test data from Supabase. | Phase 4 critical bug fixes |
| 2026-04-08 | Phase 4 Bug Fix Round 2: Fixed saveItemCategories with promise queue (serializes concurrent calls — root cause was multiple onAddCatalogItem calls from multi-item transactions firing sbSaveItemCategories simultaneously). Fixed createContact two-layer duplicate guard: state fn in onAddContact inline handler now checks for name collision; Contacts.js handleSave now validates duplicate name before calling onAddContact. Fixed quickExport with useCallback([data,user]) — always serializes current React state, uses Blob+createObjectURL+body.appendChild pattern. Added subtype guidance UX in TransactionForm.js newItemConfirm dialog — detects when typed baseName starts with an existing catalog item name and shows guidance to use "+ Tambah Tipe" instead. Added title tooltip to Inventory.js "+ Tambah Tipe" button. Cleared all test data from Supabase (was: 7 contacts, 3 transactions). | Phase 4 bug fix round 2 |
| 2026-04-08 | Phase 4 Bug Fix: Settings.js Ekspor Backup now reads from React state (data prop) in Supabase mode instead of localStorage. data prop added to Settings component and passed from App.js. exportJSON uses Blob+createObjectURL pattern. Root cause: quickExport (backup banner) was never called in Supabase mode because showBackupWarning = !USE_SUPABASE guards the banner — the actual export button is in Settings.js. | Phase 4 bug fix |
| 2026-04-09 | Pre-Phase 5 fixes: Fixed deleteInventoryItem state pollution — _deleteInventoryIds removed from returned data state, replaced with closure variables (txIdsToDelete, adjIdsToDelete) outside update(), same pattern as deleteCatalogItem. JSON backup exports are now clean. Fixed saveItemCategories promise queue — added .catch() that resets _categoriesSaveQueue to Promise.resolve() after any error, then re-throws so persistToSupabase still triggers SaveErrorModal. Queue now recovers after failures instead of breaking permanently. | Pre-Phase 5 fixes |
| 2026-04-09 | Phase 5 Part 1: Created realtimeManager.js (subscribeToChanges, subscribeToPresence), conflictDetector.js (ConflictError, checkVersion), ConflictModal.js (non-blocking, 8s auto-dismiss, Escape + backdrop dismiss). Supabase Realtime enabled on all 4 tables (transactions, contacts, stock_adjustments, item_catalog) via MCP SQL. | Phase 5 Part 1 |
| 2026-04-09 | Phase 5 Part 2: Wired realtime + conflict detection into App.js. Exported mapTransaction/mapContact/mapStockAdjustment/mapCatalogItem from supabaseStorage.js. Added isEdit=false param to saveTransaction and saveContact — calls checkVersion before upsert, throws ConflictError on mismatch. persistToSupabase now catches err.isConflict: sets conflictUpdatedBy+showConflictModal, calls setSaved(true) to prevent stuck saving state. handleRealtimeUpdate (useCallback, uses setData directly — NEVER update()) handles INSERT/UPDATE/DELETE for all 4 realtime tables. Realtime useEffect subscribes on user mount. handlePresenceChange + presence useEffect track online users (depends on [user, profile]). editTransaction and updateContact pass isEdit=true to sbSaveTransaction/sbSaveContact respectively. ConflictModal rendered conditionally in JSX. Presence section in sidebar shows online users with green dot. Presence CSS added: .presence-section, .presence-label, .presence-user, .presence-dot. MCP verification: INSERT+DELETE on transactions table both returned expected rows. | Phase 5 Part 2 |
| 2026-04-11 | Phase 6 complete: Audit Trail wired end-to-end. saveActivityLog + loadActivityLog added to supabaseStorage.js. logActivity non-blocking helper added to App.js (useCallback, .catch() swallows errors — never triggers SaveErrorModal). All 17 handlers wired: addTransaction, editTransaction, deleteTransaction, applyPayment, createContact, archiveContact, unarchiveContact, deleteContact, updateContact, addStockAdjustment, deleteStockAdjustment, addCatalogItem, updateCatalogItem, deleteCatalogItem, archiveCatalogItem, unarchiveCatalogItem, settings onSave. quickExport logs export action. Login logging added to AuthContext.js signIn (non-blocking, fire-and-forget). New page ActivityLog.js (Pemilik-only, filter bar, table with action/entity/detail columns, Indonesian labels). Added to navItems (Pemilik-only via profile.role === "owner"). No NORM_VERSION bump — activity_log is Supabase-only. | Phase 6 Audit Trail |
| 2026-04-12 | ActivityLog bug fixes: (1) Login entries now log display name via `fetchProfile` (AuthContext.js). (2) `isTxnId()` helper added — old internal IDs truncated to `#last6`, new txnId-format IDs shown as `#26-04-00023`. (3) `onViewTransaction` falls back to internal `id` match for old log entries. (4) Fixed `logActivity` passing `nt.txnId` (undefined for income) — now uses `newTx?.txnId` (create) / `updated?.txnId || nt.txnId` (edit). (5) TransactionPage gains `initViewDate`, `highlightTxIds`, `onClearHighlight` props — "Lihat" from ActivityLog now jumps to the correct date and flashes the specific row. (6) `.tx-row--flash` CSS added (3s fade-out animation, `#bfdbfe` start). CLAUDE.md Section 1 updated: NORM_VERSION=18, Supabase backend noted. DEVELOPER_HANDOFF.md: updated line counts (App.js 1623, TransactionPage 652, ActivityLog 312, styles.css 3051), added new state vars, props, component sections. | ActivityLog polish + documentation sync |
| 2026-04-12 | Added ErrorBoundary.js component — wraps App in index.js with Indonesian fallback UI | No error boundary meant any render error produced a blank white screen for non-technical users |
| 2026-04-12 | Fixed signOut() async race (H3), Contacts nameError persistence (M2), noscript Indonesian (M3), meta description (M4) | Four surgical fixes from comprehensive audit |
| 2026-04-12 | Added Number() coercion to all numeric fields in supabaseStorage.js mappers (H1 audit fix) | Silent string concatenation bug in stock calculations when PostgREST returns numeric strings |
| 2026-04-12 | Fixed C2 retry duplication bug — append-style handlers now retry Supabase write only, not state mutation | Prevented duplicate transactions and payment corruption on SaveErrorModal retry |
| 2026-04-12 | Implemented 15-minute session idle timeout — auto sign-out with Indonesian "sesi berakhir" message on Login.js | Security requirement before go-live |
| 2026-04-13 | Fixed remaining audit items: H2 short-term collision detection toast, M6 import items[] validation, L2 CSV filename, L4 presence sort, L5 CSP font-src. All audit findings now resolved or explicitly deferred with documented rationale. | Pre-deployment audit cleanup |
| 2026-04-13 | Phase 7 complete: Deployed to Netlify (frabjous-gecko-a0ad5c.netlify.app). Environment variables configured. Supabase URL Configuration updated (Site URL + Redirect URL). Attack Protection reviewed — Captcha skipped (not needed for private family app), leaked password prevention requires custom SMTP (deferred). Cloudflare setup deferred until custom domain is purchased. Family member accounts to be created at in-person client meeting. All audit findings resolved or explicitly deferred. | Go-live deployment |
| 2026-04-18 | Migrated hosting from Netlify to Cloudflare Pages. New URL: https://buku-kas.pages.dev. Build command: npm run build, publish directory: build, auto-deploys on push to main. Supabase Site URL + Redirect URLs updated to new domain. No build minute limits (500 builds/month free tier). Cloudflare edge DDoS protection + CDN now active by default. | Hosting migration |
| 2026-04-13 | Post-go-live features: (1) Password reset flow on Login.js via Supabase resetPasswordForEmail, (2) Staff restrictions on Reports.js — net profit hidden from Karyawan, (3) JSON import re-enabled for Supabase mode with upsert sync via Promise.allSettled. | Post-deployment feature batch |
| 2026-04-13 | Added PasswordChangeModal — detects Supabase PASSWORD_RECOVERY event in AuthContext.js, shows inline modal in App.js with new password + confirmation fields, validates min 6 chars + match, updates via supabase.auth.updateUser(). Modal is uncloseable (no Escape, no backdrop, no skip button); both fields have show/hide eye toggles. | Completes the password reset flow |
| 2026-04-13 | Fixed backup reminder banner: removed `!USE_SUPABASE` guard (banner now shows in Supabase mode), added Pemilik-only guard (`profile?.role === "owner"`), updated banner text to Indonesian spec, changed "Ekspor Sekarang" to navigate to Settings page instead of inline export. Removed unused `quickExport` and `STORAGE_KEY` import. | Banner was silently disabled in production |
| 2026-04-13 | H2 long-term fix: atomic txnId via Supabase `next_txn_serial()` RPC. `txn_counters` table (INSERT ON CONFLICT DO UPDATE RETURNING), seeded from existing data. `addTransaction` is now async, calls `getNextTxnSerial(date)` before `update()` in Supabase mode, falls back to `generateTxnId()` on RPC error. Short-term collision toast kept as defense-in-depth. | Eliminates duplicate invoice numbers in multi-user scenario |
| 2026-04-13 | Added Supabase pause detection — `isSupabaseReachable()` health check (5s timeout) in supabaseStorage.js. `DatabasePausedScreen` inline component shows friendly Indonesian message with Supabase Dashboard link. Integrated into both initial load catch and write-failure path in `persistToSupabase`. | Graceful handling of Supabase free tier auto-pause |
| 2026-04-13 | Forced PasswordChangeModal: removed "Nanti Saja" skip button, removed Escape key handler, removed `onCancel` prop, removed backdrop click dismissal. Added show/hide eye toggles to both password fields (`.login-password-toggle` + `Icon name="eye"` pattern). Submit button now centered, full-width. Removed unused `clearPasswordRecovery` from App.js `useAuth()` destructure. | Users arriving via reset link must complete password change — cannot bypass |
| 2026-04-13 | CSV export (Reports.js): renamed columns "Nilai Total" → "Total Transaksi" and "Nilai (Rp)" → "Sudah Dibayar" for clarity. Thousand-separator formatting was added then reverted — Excel misinterpreted dot-separated numbers inconsistently. Raw integers kept for CSV compatibility. | Improved CSV column clarity |
| 2026-04-14 | Post-deployment audit fixes: H1 deleteContact/deleteCatalogItem supabaseOperation guard (check `nd` before Supabase delete), M1 getNextTxnSerial UTC parsing (`T00:00:00Z` + `getUTCFullYear`/`getUTCMonth`), M3 console.log gated to dev-only in realtimeManager.js, L1 handleExport try/finally in Settings.js, L3 fmtTimestamp consistent local time in ActivityLog.js. 0 Critical findings in fourth comprehensive audit. | Fourth post-deployment audit — all actionable findings resolved |
| 2026-04-14 | Restored quickExport on backup reminder banner — "Ekspor Sekarang" now triggers immediate JSON download via Blob+createObjectURL without page navigation. Fixed ESLint useCallback dependency warning (added eslint-disable comment for update dependency, matching existing handler pattern). | Backup banner UX improvement |
| 2026-04-15 | Three UX improvements: fmtQty for stock numbers, delete confirmation input, Laporan card restrictions for Karyawan | User request — readability, data safety, role-based access |
| 2026-04-15 | Five UX fixes: SuratJalan address alignment, TransactionDetailModal payment summary bar + color fixes, QtyInput.js created and wired into TransactionForm + Inventory | User request — layout fidelity, readability, locale-formatted quantity inputs |
| 2026-04-16 | Restructured TransactionDetailModal payment block; fixed QtyInput live formatting on keystroke | UI polish — payment clarity, input UX consistency |
| 2026-04-16 | A4 Surat Jalan KEPADA YTH stacked layout; dot matrix format redesign (no company name, always Plat Mobil, new footer labels) | User request — layout/format changes to Surat Jalan printing |
| 2026-04-16 | Dot matrix Surat Jalan: restructured meta to two-column layout (KEPADA YTH/TANGGAL row 1, client name row 2, address+PLAT MOBIL row 3); items table changed from 4-column to 3-column (NO./JENIS BARANG/JUMLAH BARANG) merging qty+unit into one cell | User request — format spec update |
| 2026-04-16 | Four audit bug fixes: (1) mapSettings numeric coercion — added Number()\|\|0 to lowStockThreshold, maxBankAccountsOnInvoice, defaultDueDateDays; (2) addCatalogItem new-item path now includes archived:false + archivedSubtypes:[]; (3) Contacts inline onAddContact supabaseOperation now calls logActivity('create','contact',...) matching createContact pattern; (4) editTransaction is now async — pre-computes txnId via getNextTxnSerial(nt.date) when YY-MM prefix changes in Supabase mode, falls back to generateTxnId() on RPC error. Files: src/utils/supabaseStorage.js, src/App.js | Post-audit surgical fixes |
| 2026-04-16 | Four UX/cosmetic fixes: (1) QtyInput.fmtNum(0) now returns "0" not ""; (2) TransactionForm validate() zero sackQty now shows "Jumlah karung harus lebih dari 0" before subtotal check; (3) Reports.js CSV filename three-branch logic (semua / mulai_[from] / [from]_sd_[to]); (4) Inventory.js adjQtyRef auto-focus was already using optional chaining — no change needed. Files: src/components/QtyInput.js, src/components/TransactionForm.js, src/pages/Reports.js | Post-audit UX polish |
| 2026-04-17 | Fixed false-positive conflict modal after applyPayment — applyPayment now increments `version` in local state to match what saveTransaction() writes to Supabase. File: src/App.js | Bug fix — stale version in local state caused spurious conflict detection on next edit |
| 2026-04-17 | Two UI fixes: (1) Progress bar now visible at 0% (empty grey track) in TransactionPage and Outstanding — removed pct<=0 early-return; (2) Edit payment history entry now shows three labeled fields (Total Nilai / Sisa Tagihan / Status) for new entries; old entries retain backward-compatible single-line display. Files: src/components/TransactionPage.js, src/pages/Outstanding.js, src/App.js, src/components/PaymentHistoryPanel.js | User request — progress bar visibility and edit log clarity |
| 2026-04-17 | Added "Sudah Dibayar" line to edit log display — four fields now shown (Total Nilai / Sudah Dibayar / Sisa Tagihan / Status). editPaymentEntry gains paidBefore + paidAfter with Math.max(0,...) guard. Files: src/App.js, src/components/PaymentHistoryPanel.js | User request — clearer edit history |
| 2026-04-17 | Fixed editTransaction() not incrementing version in local state — same root cause as applyPayment fix. Added `version: (x.version \|\| 0) + 1` to return spread inside update(). File: src/App.js | Bug fix — false-positive conflict modal on consecutive edits |
| 2026-04-17 | TransactionDetailModal payment history now renders edit entries identically to PaymentHistoryPanel — four labeled fields for new entries, "Sisa setelah" fallback for old entries, regular entries unchanged. File: src/components/TransactionDetailModal.js | User request — UI consistency |
| 2026-04-18 | Added contact name search bar to Outstanding.js — `contactSearch` filters both piutangTxs and hutangTxs useMemos; input above sort control (.search-input, maxWidth 320px); OutstandingTable key includes contactSearch for page reset. Wired TransactionDetailModal into Contacts.js transaction rows — click row opens modal, all four action buttons call e.stopPropagation(). Files: src/pages/Outstanding.js, src/pages/Contacts.js | User request — search UX + contact page detail modal |
| 2026-04-18 | Fixed Outstanding.js empty state when contactSearch has no results — now shows 🔍 "Tidak ada hasil untuk '[term]'" + subtext instead of misleading "Semua bersih!". Original message unchanged when contactSearch is empty. File: src/pages/Outstanding.js | Bug fix — misleading empty state on search |
| 2026-04-18 | Added Jenis column (Penjualan/Pembelian badge) to Contacts.js transaction history table — third column after No. Invoice, before Item. Inline badge style matches TransactionPage.js/Reports.js. File: src/pages/Contacts.js | User request — UX clarity |
| 2026-04-18 | Fixed dot matrix invoice: blank line between bank account groups in formatInvoiceFooter; removed placeholder from Catatan Invoice textarea in DotMatrixPrintModal.js. Files: src/utils/textFormatter.js, src/components/DotMatrixPrintModal.js | User request — spacing + UI polish |
| 2026-04-18 | Redesigned dot matrix invoice format to match physical invoice. formatInvoiceHeader: removed business name/address/phone, now outputs "I N V O I C E" centered (left 69 chars) + "Page 1 of 1" right (11 chars). formatInvoiceMeta: blank left + Invoice No/Date right-aligned (rows 1–2), "Kepada :" left + "Note : [invoiceNote]" right (row 3), client name/address left-aligned without labels, removed Jatuh Tempo. formatItemsTable: removed Krg column, new 5-column layout (No 6 + Jenis Barang 32 + Berat 14 + Harga 14 + Total 14 = 80), no trailing SEP_MAJOR. formatInvoiceFooter: removed LUNAS/SISA TAGIHAN/transaction-notes, total row right-aligned + SEP_MAJOR, bank info as NAME BANK/ACCOUNT NUMBER/ACCOUNT NAME labels, signature block with parentheses. formatInvoice() passes note to formatInvoiceMeta instead of formatInvoiceFooter. Surat Jalan functions untouched. File: src/utils/textFormatter.js | User request — physical invoice format match |
| 2026-04-18 | Expanded editTransaction() diff to capture ALL changed fields — 7 scalar fields (counterparty, date, value/outstanding/paid, status, dueDate, notes) + full items array diff (added/removed/changed with per-field before/after). editPaymentEntry now conditionally includes only changed-field keys via spread. Display updated in PaymentHistoryPanel.js and TransactionDetailModal.js: IIFE format-switcher detects new entries via `counterpartyBefore/dateBefore/itemsAdded/notesBefore/dueDateBefore !== undefined`, shows only present fields; falls back to 4-field format (valueBefore/valueAfter) for old entries; falls back to "Sebelum→Setelah" for very old entries. Files: src/App.js, src/components/PaymentHistoryPanel.js, src/components/TransactionDetailModal.js | User request — full audit trail for all edit types |
| 2026-04-18 | Renamed edit payment entry note "Transaksi Diedit" → "Detail Perubahan" — 7 occurrences across App.js (note field), PaymentHistoryPanel.js (SYSTEM_NOTES array, getDisplayLabel return, 2× isEdit detection, filter condition), TransactionDetailModal.js (2× isEdit detection + display label). Backward-compat string "Transaksi diedit — nilai diperbarui" unchanged. Files: src/App.js, src/components/PaymentHistoryPanel.js, src/components/TransactionDetailModal.js | User request — label rename |
| 2026-04-18 | FIXED: checkVersion called with already-incremented local version — saveTransaction() and saveContact() in supabaseStorage.js both compared `tx.version`/`contact.version` (post-increment in local state) against Supabase's stored version (pre-increment), causing false-positive conflict modals on every edit/payment. Fix: changed to `(tx.version \|\| 1) - 1` and `(contact.version \|\| 1) - 1` — passes the version Supabase currently has, not the incremented local value. File: src/utils/supabaseStorage.js | Bug fix — false-positive conflict detection after applyPayment/editTransaction version sync fixes |
| 2026-04-18 | FIXED: QtyInput clears to blank when value is 0 — typing appended to "0" (e.g. "50" → "500"). Fix: `handleFocus` clears `display` to `""` when `value === 0`; `handleBlur` restores display to `"0"` when field is left empty (`display.trim() === ""`). Non-zero values unchanged. File: src/components/QtyInput.js | Bug fix — zero-value input UX |
| 2026-04-18 | ADDED: Idle timeout survives device sleep/shutdown — setTimeout alone stops when the device sleeps. Fix: `resetTimer()` now writes `Date.now()` to `localStorage['buku-kas-last-activity']` on every activity event. `visibilitychange` listener checks the gap on app resume; if gap > IDLE_TIMEOUT_MS, calls `signOut()` + `setIdleTimedOut(true)`. `signOut()` clears the localStorage key. Cleanup removes the visibilitychange listener. setTimeout timer unchanged (handles in-session idle). File: src/utils/AuthContext.js | Security fix — idle timeout bypass via device sleep |
| 2026-04-18 | "Impor Backup" button in Settings.js now hidden when CSV format is selected — wrapped in `{exportFormat === "json" && ...}` conditional. Import only supports JSON; button was misleadingly visible for CSV. File: src/pages/Settings.js | UI fix — import button visibility |
| 2026-04-19 | Reports.js transaction table redesigned: new columns No/No.Invoice/Tanggal/Klien/Barang/Krg/Berat/Harga.Kg/Subtotal (always visible) + 5 optional toggle columns (Sudah Dibayar default-on; Total Nilai/Sisa Tagihan/Piutang.Hutang/Jenis default-off). Multi-item transactions render one row per item + subtotal row; single-item transactions render one row. Optional cols shown on single-item row or subtotal row only (not on continuation item rows). Role guard: financial cols hidden from Karyawan. Grand total "Sudah Dibayar" shown below table. `getMultiItemContribution` retained as dead code. `StatusBadge`, `DueBadge` imports removed (no longer used in table). Summary cards, filters, CSV export, print modal unchanged. File: src/pages/Reports.js | User request — table redesign |
| 2026-04-19 | Reports.js table: three small fixes — (1) subtotal row label "Subtotal Txn #N:" → "Total:"; (2) removed isOwner restriction from all financial optional columns (Sudah Dibayar/Total Nilai/Sisa Tagihan/Piutang.Hutang) — all authenticated users now see all columns; summary cards isOwner restriction unchanged; (3) border-top 1.5px #cbd5e1 added to first row of each transaction group (txIdx > 0) for visual separation between transactions. File: src/pages/Reports.js | User request — table polish |
| 2026-04-19 | Reports.js Piutang/Hutang column now shows status badge instead of number — outstanding>0 + income → "Piutang" green (#d1fae5/#065f46); outstanding>0 + expense → "Hutang" red (#fee2e2/#991b1b); outstanding===0 → "Lunas" green. Inline IIFE badge, no external component. File: src/pages/Reports.js | User request — column UX |
| 2026-04-19 | Reports.js table: payment rows added after all transaction rows. Rows sourced from ALL `transactions` (not `filtered`) — filtered by payment date only. Income: green left border + `#f0fdf4` bg + "Pembayaran Diterima" badge; expense: red left border + `#fff1f2` bg + "Pembayaran Dilakukan" badge. `EDIT_NOTES` constant module-level. `paymentCount` useMemo counts from ALL `transactions`. Grand total bar shows "N pembayaran" when count > 0. File: src/pages/Reports.js | User request — payment rows in report table |
| 2026-04-19 | Reports.js default period changed from "monthly" to "daily" — `dateFrom` initializer changed from first-of-month to `today()`. File: src/pages/Reports.js | User request |
| 2026-04-19 | Reports.js payment row source changed from `filtered` to ALL `transactions` — payment rows extracted from `filtered.map()` into a separate `transactions.flatMap()` block at end of tbody. `paymentCount` useMemo changed from `filtered` to `transactions`. Allows payments made today on last-week transactions to appear in daily Laporan view. File: src/pages/Reports.js | User request — payment rows missed when parent transaction outside date range |
| 2026-04-19 | Reports.js table now shown when `paymentCount > 0` even if `filtered.length === 0`. Empty state condition changed from `filtered.length === 0` → `filtered.length === 0 && paymentCount === 0`. Grand total bar condition changed from `filtered.length > 0` → `filtered.length > 0 \|\| paymentCount > 0`. File: src/pages/Reports.js | Bug fix — payment rows were hidden when no transactions matched the date filter |
| 2026-04-19 | Reports.js payment row rendering restructured: (1) inline payments rendered immediately after their parent transaction row(s) inside `filtered.map()`; (2) orphan payments (from transactions outside date filter) rendered in a separate IIFE block after `filtered.map()` with a separator row "Pembayaran dari transaksi di luar periode ini:"; (3) `mkPaymentRows(t, payments, keyPrefix)` and `visiblePmtFilter(ph)` extracted as in-render helpers before `return (`; (4) `grandTotalPaid` useMemo added — sums `(value - outstanding)` for filtered transactions + `ph.amount` for all visible payment rows; (5) Option B payment row content: txnId in No.Invoice cell, counterparty in Klien, badge + note in Barang, Sisa before→after line with "✓ Lunas" when settled, signed amount in Sudah Dibayar, Lunas ✓ or remaining amount in Sisa Tagihan; (6) grand total bar now uses `grandTotalPaid`. File: src/pages/Reports.js | User request — payment rows restructured with inline + orphan separation |
| 2026-04-19 | Four fixes across three files: (1) Reports.js `handleGenerateReport` — empty guard now checks `paymentCount === 0` too; confirm threshold uses `filtered.length + paymentCount > 50`; both `onReport` calls now pass `allTransactions, colSudahDibayar, colTotalNilai, colSisaTagihan, colPiutang, colJenis`; (2) App.js `<ReportModal>` wired with all new props from `reportState`; (3) ReportModal.js fully rewritten — accepts new props, per-item rows matching screen table (single row / multi rows + subtotal), inline + orphan payment rows (print-friendly, no background colors), column-aware thead + colgroup + optCells, Grand Total Sudah Dibayar below table, company name toggle checkbox (UI-only, above docRef), summary section unchanged; removed DueBadge + STATUS imports no longer needed. Files: src/pages/Reports.js, src/App.js, src/components/ReportModal.js | User request — print report matches screen table |
| 2026-04-19 | ReportModal.js print visual polish — (1) grand total net cash (income adds, expense subtracts) applied to both ReportModal grandTotalPaid and Reports.js grandTotalPaid; (2) transaction first-item rows: bg #f8fafc always, borderTop 2px solid #cbd5e1 for txIdx > 0 (removed alternating rowAlt); (3) multi-item additional rows: white bg, paddingLeft 16 on item name cell; (4) subtotal rows: bg #f1f5f9, "Total:" label #64748b 10px italic, value #1e3a5f bold, Sudah Dibayar #10b981 bold (`optCellsForRow(t, true)` via new `isSubtotal` param); (5) payment rows: borderLeft 2px solid #94a3b8, white bg, 10px text #475569, +/− colored #10b981/#ef4444 bold, Sisa line 9px #94a3b8 italic; (6) orphan separator: bg #fef9c3, color #854d0e, 10px italic; (7) grand total div: borderTop 2px solid #1e3a5f, fontSize 12, fontWeight 600, color #1e3a5f, padding 8; (8) @media print block added to print style string (thead repeat + page-break-inside avoid). File: src/components/ReportModal.js | User request — print visual polish |
| 2026-04-19 | FIXED: grandTotalPaid double-counted payments from filtered transactions. `allPaymentsNet` now skips any transaction already in `filteredNet` via `filteredIds` Set. Same fix applied to ReportModal.js. Files: src/pages/Reports.js, src/components/ReportModal.js | Bug fix — orphan payment totals were being double-counted |
| 2026-04-19 | ReportModal.js print layout restructured to match physical laporan format. Header: 3-column (left=biz name+address 13px/11px, center=LAPORAN TRANSAKSI 18px bold, right=date+period+count 11px). Period block section removed (info moved to header right). Columns: replaced separate Berat (Kg) + Harga/Kg with single combined "Berat Kg @ Harga" column (format: "[fmtQty(weightKg)] Kg @ [fmtQty(pricePerKg)]"). Column order now: NO\|NO.INVOICE\|TANGGAL\|KLIEN\|BARANG\|BERAT KG @ HARGA\|KRG\|SUBTOTAL\|[optional cols]. totalCols: 9→8. subtotal colSpan: 8→7. Payment row blank cells: 4→3. Grand total label: "Grand Total Sudah Dibayar:" → "Grand Total IDR". Reports.js screen table NOT touched. File: src/components/ReportModal.js | User request — match physical laporan print format |
| 2026-04-19 | ReportModal.js: added two print-option toggles alongside existing company name toggle. "Tampilkan pembayaran di luar periode" (`showOrphanPayments`, default true) — hides orphan payment rows + separator when unchecked; inline payment rows unaffected. "Tampilkan ringkasan laba/rugi" (`showSummary`, default true) — hides entire summary section (Total Pemasukan/Pengeluaran/Laba Bersih) when unchecked. Toggle bar uses `flexWrap: wrap` and `gap: 24` for clean layout. File: src/components/ReportModal.js | User request — print option toggles |
| 2026-04-19 | Reports.js `exportCSV()` fully rewritten to match new table structure. Headers: No/No.Invoice/Tanggal/Klien/Barang/Berat Kg @ Harga/Krg/Subtotal/Sudah Dibayar/Total Nilai/Sisa Tagihan/Jenis/Status/Jatuh Tempo/Tipe Baris. Transaction rows: one per item (multi-item first row fills all tx fields, subsequent rows fill only Barang/Berat@Harga/Krg/Subtotal). Payment rows: inline (from `filtered`) then orphan (from `transactions` not in `filtered`), each signed (+income/-expense). Grand total row: all blank except Sudah Dibayar = `grandTotalPaid`, Tipe Baris = "Grand Total". Removed old contrib/getMultiItemContribution logic from export (function itself retained). BOM preserved, raw numbers (no fmtIDR), filename logic unchanged. File: src/pages/Reports.js | User request — CSV matches new table structure |
| 2026-04-19 | FIXED: False "Database Sedang Istirahat" screen on cold start — `loadDataFromSupabase` catch block now retries `isSupabaseReachable()` up to 3 times with 3s between attempts before setting `databasePaused(true)`. Handles Supabase free-tier compute wake time (2–8s). `isSupabaseReachable()` in supabaseStorage.js and `persistToSupabase` catch handler unchanged. File: src/App.js | Bug fix — false pause screen on cold start after idle period |
| 2026-04-19 | FIXED: URL hash `#access_token` never cleared after password reset — `onAuthStateChange` callback now calls `window.history.replaceState(null, "", window.location.pathname)` when hash contains "access_token", preventing PASSWORD_RECOVERY from re-triggering on page reload. File: src/utils/AuthContext.js | Bug fix — forced password change modal reappeared on reload |
| 2026-04-19 | FIXED: Duplicate category codes not blocked — `CategoryModal.js` now has `codeError` state; `commitCode()` checks for duplicate codes before closing input and sets `codeError` message if found (returns early keeping input open); `handleCodeKeyDown` Escape clears `codeError`; code input wrapped in `<span style="position:relative">` with absolute-positioned error tooltip below input; `onChange` clears `codeError` on each keystroke. File: src/components/CategoryModal.js | Bug fix — duplicate codes were silently allowed |
| 2026-04-19 | FIXED: Delete confirm modal in Inventory.js understated destruction scope — added warning sentence "Jika transaksi tersebut juga mengandung barang lain, seluruh transaksi ikut terhapus." before the "Tidak dapat dibatalkan." line for uncatalogued item delete. File: src/pages/Inventory.js | Bug fix — multi-item transaction deletion not communicated to user |
| 2026-04-19 | FIXED: "Ubah Nama" button visible on catalogued inventory rows — condition changed from `{isToday && (...)}` to `{isToday && !row.catalogItem && !row.isSubtype && (...)}`. Catalogued items and subtypes must be renamed via catalog edit form (which syncs the catalog entry); the old rename path only updated transactions and stock adjustments, leaving the catalog stale. File: src/pages/Inventory.js | Bug fix — renaming catalogued item via Ubah Nama created uncatalogued item |
| 2026-04-19 | REMOVED: Dead `isNew` code path from Inventory.js adjustment modal — `adjNewName`/`setAdjNewName` state removed; `handleAdjConfirm` `finalName` simplified from ternary to `adjTarget.itemName` directly; `{adjTarget.isNew && <div>...</div>}` JSX block removed; modal title simplified from ternary to template literal. `isNew: false` in `openAdj()` left as-is (harmless). File: src/pages/Inventory.js | Cleanup — dead code path could create uncatalogued items if accidentally re-enabled |
| 2026-04-19 | REMOVED: Orphan `isNew: false` property from `openAdj()` in Inventory.js — `setAdjTarget({ itemName, unit: unit || "karung" })` (no isNew field). The `isNew` property was dead code (always false, never read after prior cleanup). File: src/pages/Inventory.js | Cleanup — removes last remnant of dead isNew code path |
| 2026-04-19 | ADDED: Activity log pagination — `loadActivityLog` in `supabaseStorage.js` now uses `.range(offset, offset + PAGE_SIZE)` instead of `.limit(200)`; returns `{ rows: Array, hasMore: boolean }` instead of raw Array; `PAGE_SIZE = 50`. `ActivityLog.js` updated: `logs` → `allLogs`, added `loadingMore`/`page`/`hasMore` states; `loadLogs(pageNum)` is a plain async function (not useCallback); `useEffect` on filter deps calls `loadLogs(0)` to reset; "Muat Lebih Banyak" button below table-card calls `loadLogs(page + 1)`; footer shows "masih ada entri lebih lama" when `hasMore`; removed `useCallback` import. Files: `src/utils/supabaseStorage.js`, `src/pages/ActivityLog.js` | Feature — prevents performance degradation as activity log grows |
| 2026-04-20 | B12: Added "Edit Barang" action button to catalogued/subtype rows in Inventory.js — **SUPERSEDED by B2 in the same session.** | Stopgap — unnecessary after B13 fixed renameInventoryItem |
| 2026-04-20 | B13: Rewrote `renameInventoryItem` in App.js — now atomically renames catalog entry name + cascades all subtype combined names ("Base Sub" → "NewBase Sub") on transactions and stock adjustments in a single update() call. Uncatalogued path unchanged. Catalog match captured by ID in closure variable (`catalogMatchId`) using `if (catalogMatch) catalogMatchId = catalogMatch.id` (not `?.id \|\| null`) for retry safety — retry re-runs `fn` on already-renamed state, so find() returns undefined; the if-guard prevents clearing the captured ID. | Data integrity — catalog entry name went stale when a catalogued item was renamed; subtype combined names were not cascaded |
| 2026-04-20 | B2: Removed Edit Barang stopgap button; unhid Ubah Nama on catalogued base rows (`isToday && !row.isSubtype`); deleted dead cascade in `handleUpdateCatalogItem`; extended `openRename` with `isCatalogued` param; added merge-block guard in `handleRenameConfirm` for catalogued items. | Closes rename UX loop for base items — renameInventoryItem now handles catalog atomically; subtype rename deferred to B3 |
| 2026-04-20 | B3: Added `renameSubtype(parentCatalogId, oldSub, newSub)` to App.js; wired as `onRenameSubtype` prop to Inventory; extended `openRename` with `subtypeContext` param; added subtype branch in `handleRenameConfirm` (parent-prefix guard + merge-block + `onRenameSubtype` dispatch); Ubah Nama button condition changed to `{isToday && (` — now shows on all rows. | Completes subtype rename with full cascade — base + subtype both handled atomically through dedicated handlers |
| 2026-04-20 | B16: Fixed `itemCategories` staleness bug in `renameInventoryItem` (B13) and `renameSubtype` (B15) — both now sync `itemCategories` atomically inside `update()` and persist via `sbSaveItemCategories`. Pattern mirrors `updateCatalogItem`. | Renamed items were rendering as uncategorized phantoms in Inventory UI |
| 2026-04-20 | B17: Phase 1 archive-aware filter in CategoryModal — `itemCatalog` prop, `archivedCatalogKeys`/`activeCatalogKeys` memos, `showArchived` toggle, orphan warn on mount, category group hiding, uncataloged-with-txs always shown. CSS: `--archived` pill, toggle + hint classes. | Kelola Kategori was showing archived items inconsistently with main Inventory view |
