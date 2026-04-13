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
- **SHORT-TERM FIX (2026-04-13):** `generateTxnId` collision — two simultaneous income transactions can receive the same txnId if Realtime has not yet synced the other user's transaction into local state. Short-term fix: post-save collision detection in `addTransaction` fires a warning toast "⚠️ Nomor faktur mungkin duplikat — periksa dan perbaiki secara manual." when a duplicate txnId is detected in local state after save. **Do NOT remove this check when the long-term fix is added — keep both as defense-in-depth.** Long-term fix: Supabase DB sequence (txn_counters table with SERIAL column per YY-MM key, using `SELECT nextval(...)` or `INSERT ... ON CONFLICT DO UPDATE ... RETURNING serial`). File: `src/App.js`

---

## 11. Known Limitations (Not Bugs — Documented Behaviour)

These are intentional product constraints or accepted trade-offs. Do not attempt to fix without explicit instruction.

1. **Catalog deletion requires multiple steps when subtypes exist.** `deleteCatalogItem` matches by `itemId` only. A base item with subtypes cannot be deleted as a single action — user must handle each subtype first. No UI guidance for this flow exists.
2. **Catalog items with zero transactions cannot be archived via a rule — they can only be deleted.** The archive button works unconditionally, but archived zero-transaction items are invisible in normal catalog flow (they appear only in ArchivedItems page).
3. **Import is temporarily disabled in Supabase mode.** `handleImport` in App.js guards with `if (USE_SUPABASE)` and shows a bare `alert()`. No permanent disabled-state is shown in the Settings UI. To be addressed when a Supabase-aware import flow is implemented.
4. **Page resets to Penjualan on every browser refresh.** `page` state is in-memory only (no router). All navigation is lost on refresh. Known architectural constraint — no router is used by design.
5. **Cloudflare DDoS/rate limiting not yet active.** Requires a custom domain (~$10-15/year). Once a domain is purchased: (a) register or transfer domain to Cloudflare Registrar, (b) add Cloudflare DNS pointing to Netlify, (c) update Netlify custom domain settings, (d) update Supabase URL Configuration with new domain, (e) tighten CSP connect-src to specific Supabase project URL. Current protection: Netlify built-in DDoS protection + security headers in public/_headers and netlify.toml.
6. **Supabase free tier auto-pauses after 1 week of inactivity.** With 5-7 daily users this is unlikely to trigger. If it does: app will show SaveErrorModal on any write. User must visit Supabase Dashboard to unpause. Options: upgrade plan, set up external cron ping, or add graceful error handling that explains the pause to users.

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
