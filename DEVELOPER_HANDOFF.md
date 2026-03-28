# BukuKas — Developer Handoff

Digital bookkeeping for a small Indonesian family business (agricultural commodity trading).

**Stack:** React 19.2.4, react-scripts 5.0.1. No router. No backend. `localStorage` only.
**UI language:** Indonesian (all labels, toasts, errors, status strings).

---

## Table of Contents

1. [How to Run](#1-how-to-run)
2. [File Structure](#2-file-structure)
3. [Data Model](#3-data-model)
4. [Migrations](#4-migrations)
5. [App.js — State, Handlers, Render Tree](#5-appjs--state-handlers-render-tree)
6. [Utilities](#6-utilities)
7. [Pages](#7-pages)
8. [Components](#8-components)
9. [Print System](#9-print-system)
10. [CSS — Classes and Structure](#10-css--classes-and-structure)
11. [Architecture Rules](#11-architecture-rules)
12. [Known Issues & Fixed Bugs](#12-known-issues--fixed-bugs)
13. [Tech Debt & Quirks](#13-tech-debt--quirks)

---

## 1. How to Run

```bash
npm start        # dev server at http://localhost:3000
npm run build    # production build — must produce zero errors
npm test         # runs test suite
```

`src/index.js` content:
```js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Session startup checklist:**
1. `npm start` — confirm zero console errors in DevTools
2. Open http://localhost:3000, open DevTools console — must be clean

---

## 2. File Structure

```
src/
├── App.js                   ~855 lines — root component; all global state, handlers, modals
├── index.js                   19 lines — React entry point (ReactDOM.createRoot)
│
├── pages/
│   ├── Penjualan.js           18 lines — income page (thin wrapper around TransactionPage)
│   ├── Pembelian.js           18 lines — expense page (thin wrapper around TransactionPage)
│   ├── Inventory.js        ~1540 lines — table layout grouped by category; catalog CRUD; stock ledger
│   ├── Contacts.js           502 lines — contact list + detail panel
│   ├── Reports.js            469 lines — date-range financial reports
│   ├── Outstanding.js        484 lines — AR/AP dedicated view with highlight nav support
│   └── Settings.js           364 lines — business settings + backup
│
├── components/
│   ├── TransactionPage.js    549 lines — shared base for Penjualan + Pembelian
│   ├── TransactionForm.js   1165 lines — full transaction input form (smart autocomplete, multi-item)
│   ├── InvoiceModal.js       303 lines — printable invoice (A4)
│   ├── ReportModal.js        297 lines — printable landscape report
│   ├── SuratJalanModal.js    278 lines — printable shipping note (A5)
│   ├── PaymentHistoryPanel.js 290 lines — expandable payment timeline row
│   ├── PaymentUpdateModal.js  154 lines — record a full or partial payment
│   ├── DeleteConfirmModal.js  106 lines — confirm delete for transaction or contact
│   ├── MultiSelect.js        151 lines — zero-dependency multi-select dropdown
│   ├── RupiahInput.js        107 lines — currency input → clean integer
│   ├── StockWarningModal.js   78 lines — warn when a sale would push stock negative (multi-item)
│   ├── Badge.js              112 lines — StatusBadge + TypeBadge named exports
│   ├── DueBadge.js            32 lines — due-date countdown display
│   ├── StockChip.js           25 lines — stock quantity coloured pill
│   ├── SaveIndicator.js       41 lines — "Tersimpan ✓ · HH:MM / Menyimpan..." indicator
│   ├── Toast.js               48 lines — auto-dismissing notification (3 seconds)
│   ├── Icon.js                70 lines — inline SVG icon system
│   ├── CategoryModal.js      488 lines — category management UI with drag-and-drop
│   └── StockReportModal.js   330 lines — printable stock report grouped by category
│
├── utils/
│   ├── storage.js            355 lines — NORM_VERSION=14, defaultData, migrateData, loadData, persist
│   ├── idGenerators.js       168 lines — generateId, generateTxnId, fmtIDR, today, addDays, ...
│   ├── statusUtils.js         54 lines — deriveStatus(), STATUS constants, isUnpaid()
│   ├── stockUtils.js         110 lines — computeStockMap(), computeStockMapForDate()
│   ├── balanceUtils.js        73 lines — computeARandAP(), computeCashIncome(), computeNetCash()
│   ├── printUtils.js          30 lines — printWithPortal() — the only print utility
│   ├── categoryUtils.js      310 lines — autoDetectCategories(), generateCode/Codes(), getCategoryForItem()
│   └── paymentUtils.js        20 lines — computePaymentProgress()
│
└── styles.css              ~2800 lines — all styles, BEM-inspired kebab-case

public/
└── index.html                 44 lines — <div id="root"> + <div id="print-portal"> (outside root)
```

**Sub-directory CLAUDE.md files (read these when working in those directories):**
- `src/CLAUDE.md` — import rules, state architecture, CSS conventions, error handling patterns
- `src/pages/CLAUDE.md` — full page inventory, props, local state, shared patterns
- `src/components/CLAUDE.md` — full component inventory, modal contract, badge usage rules
- `src/utils/CLAUDE.md` — function reference, UTC vs local date rules

**Import rules (enforced — violations cause circular dep errors at build time):**
- `pages/` → may import from `components/` and `utils/` only
- `components/` → may import from `utils/` only
- `utils/` → may import from other `utils/` only — **never import React**

---

## 3. Data Model

**Current schema version:** `NORM_VERSION = 14` (defined in `src/utils/storage.js`)

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
        "date":         "2026-03-15",
        "time":         "14:30",
        "counterparty": "Budi Santoso",
        "itemName":     "Bawang Merah Kating",
        "stockQty":     10,
        "stockUnit":    "karung",
        "value":        5215000,
        "outstanding":  1500000,
        "status":       "Belum Lunas (Piutang)",
        "dueDate":      "2026-03-29",
        "itemNames":    ["Bawang Merah Kating"]
      }
    }
  ]
}
```

**txnId rules:**
- `type === "income"` → auto-generated by `generateTxnId()`, format `YY-MM-NNNNN` (e.g. `26-03-00009`)
- `type === "expense"` → manual entry by user (supplier invoice number)

**paymentHistory rules:**
- Append-only. Never delete or modify existing entries.
- `paymentHistory[0]` is always the creation-time entry (may have `amount: 0` for fully-paid-at-creation).
- `paymentHistory[].method` is always `null` — field was designed but never implemented in UI.

**editLog rules:**
- Capped at last 20 entries via `.slice(-20)`.
- `editLog[].prev` is a **slim snapshot** (10 key fields only, NOT a full transaction copy): `date, time, counterparty, itemName, stockQty, stockUnit, value, outstanding, status, dueDate, itemNames`. Full copy would be ~2–3 KB × 20 = ~60 KB per transaction.

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
  "time":          "00:00",
  "adjustmentQty": 5,
  "reason":        "Koreksi stok gudang",
  "unit":          "karung",
  "adjustedBy":    null
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

`items[]` contains normalized item names (lowercase, trimmed — output of `normItem()`). `code` is a short uppercase identifier, auto-generated by `generateCodes()` or manually edited by the user. Stored in the top-level `itemCategories[]` array.

### Item Catalog Object (NEW — v13/v14)

```json
{
  "id":          "1742000000000-abc1234",
  "name":        "Bawang Merah",
  "defaultUnit": "karung",
  "subtypes":    ["Kating", "Bima", "Thailand"]
}
```

- `subtypes[]` are suffix strings. Full item name = `name + " " + subtype` (e.g. "Bawang Merah Kating").
- Items without subtypes are valid — full name = just `name`.
- Used by TransactionForm for dropdown selection — no free-text item entry.
- Managed exclusively from Inventory page.
- Catalog renames do NOT cascade to transactions automatically — must separately call `renameInventoryItem()`.

### defaultData (empty-slate in storage.js)

```js
{
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
}
```

---

## 4. Migrations

Every data model change requires three steps: (a) bump `NORM_VERSION`, (b) add a migration block in `migrateData()`, (c) update `defaultData`.

| Version | What it does |
|---------|-------------|
| v1 | Title-case all `itemName`, `counterparty`, and contact `name` fields |
| v2 | Backfill `createdAt` on all transactions |
| v3 | Migrate old status strings to current simplified scheme |
| v4+v5 | Recompute all `dueDate` fields using UTC-correct `addDays` (local midnight caused off-by-1 in UTC+ timezones). Uses `t.customDueDays ?? 14`. No explicit version check — baked into the main migration loop. |
| v6 | Wrap single-item transactions into `items[]` array |
| v7 | Migrate flat `bankName/bankAccount/bankAccountName` to `bankAccounts[]` array |
| v8 | Add `stockAdjustments: []` top-level array (no migration code — guard sets it if undefined) |
| v9 | Backfill `paymentHistory[]` for all existing transactions |
| v10 | (a) Fix `paymentHistory[0].amount === 0` bug from v9; (b) backfill `time` field on all paymentHistory entries |
| v11 | Backfill `time` and `adjustedBy` fields on all `stockAdjustments` |
| v12 | Add `itemCategories: []` top-level array (no migration code — defaultData shallow-merge handles it) |
| v13 | Auto-populate `itemCatalog[]` from existing `itemCategories[]` + transactions. Runs only when catalog is empty. For each category group: name becomes catalog entry name, items with matching prefix become subtypes. Uncovered items added as standalone entries. |
| v14 | Backfill any items from transactions/stockAdjustments not covered by v13 catalog. Fixes items that were in `itemCategories.items[]` under a cross-prefix group (e.g. "Bawang Shallot France" under "Bawang Merah") — v13 marked them as `covered` but never created entries for them. |

**Note on v4/v5:** The version counter skipped explicit blocks for these — the dueDate recomputation logic is written inline in the migration function and runs on every migration pass. The result is correct UTC-based dueDates regardless of original stored value.

---

## 5. App.js — State, Handlers, Render Tree

### Global useState

| State | Type | Purpose |
|-------|------|---------|
| `data` | Object | Full app data — transactions, contacts, stockAdjustments, itemCategories, itemCatalog, settings |
| `page` | string | Current page key — drives which page component renders |
| `saved` | boolean | Save indicator (true = recently saved) |
| `saveError` | boolean | localStorage quota exceeded |
| `editTx` | Object \| null | Opens global EditModal; set via `setEditTx(transaction)` |
| `invoiceTxs` | Array \| null | Opens InvoiceModal |
| `sidebarOpen` | boolean | Sidebar expanded/collapsed |
| `reportItemFilter` | string \| null | Pre-fills item filter when navigating from Inventory to Reports |
| `outstandingHighlight` | Array \| null | Array of tx IDs to highlight on Outstanding page; set by `navigateToOutstanding()` |
| `reportState` | Object \| null | `{ transactions, dateFrom, dateTo }` — opens ReportModal |
| `backupBannerDismissed` | boolean | Hides "backup overdue" banner for this session |
| `suratJalanTx` | Object \| null | Opens SuratJalanModal |
| `showStockReport` | boolean | Opens StockReportModal from Inventory |

### Core Patterns

```js
// persist — debounced 500ms localStorage write with error handling
// Sets saved=false immediately, writes after 500ms idle, sets saved=true on success
// Sets saveError=true (and keeps saved=false) on quota error
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

// retrySave — immediate (non-debounced) retry for quota-error recovery
// Called when user clicks "Coba Lagi" in the save error banner
const retrySave = useCallback(() => {
  const ok = saveData(data);
  if (ok) { setSaved(true); setSaveError(false); }
}, [data]);

// update — THE ONLY way to mutate app state
const update = (fn) =>
  setData((d) => {
    const nd = fn(d);
    persist(nd);
    return nd;
  });
```

### useMemo Computations

| Name | Inputs | Returns |
|------|--------|---------|
| `stockMap` | `data.transactions`, `data.stockAdjustments` | `{ [normItemName]: { displayName, qty, unit, lastDate, lastTime, txCount } }` |
| `globalAR, globalAP` | `data.transactions` | numbers — total outstanding AR/AP |
| `alertCount` | `stockMap`, `threshold` | count of negative + low-stock items |
| `penjualanBadge` | `data.transactions` | count of income near-due (≤3 days) |
| `pembelianBadge` | `data.transactions` | count of expense near-due (≤3 days) |
| `outstandingBadge` | `penjualanBadge + pembelianBadge` | combined badge count |
| `balanceMap` | `data.transactions` | `{ [lowerName]: { totalIncome, totalExpense, ar, ap, netOut, txs } }` |

**Note:** `threshold` is NOT a useMemo — it is a plain derived const:
```js
const threshold = data.settings.lowStockThreshold ?? 10;
```

### Save Error Banner

When `saveError === true`, renders an **inline, non-dismissible red banner** above page content:

```jsx
// Appears at the top of <main className="main-content">
// Background: #fef2f2, border: 1px solid #fca5a5 (no CSS class — fully inline-styled)
<div role="alert" style={{ background: "#fef2f2", border: "1px solid #fca5a5", ... }}>
  <strong style={{ color: "#991b1b" }}>⚠️ Gagal menyimpan data!</strong>
  <div style={{ fontSize: 12, color: "#b91c1c" }}>
    Penyimpanan lokal (localStorage) mungkin penuh. ...
    Segera ekspor backup dari halaman Pengaturan...
  </div>
  <button onClick={retrySave}          className="btn btn-primary btn-sm">Coba Lagi</button>
  <button onClick={() => setPage("settings")} className="btn btn-outline btn-sm">Buka Pengaturan</button>
</div>
```

This banner is **distinct from the backup banner** (`.backup-banner`):
- Save error: full red, non-dismissible, shown when localStorage write fails
- Backup banner: amber `.backup-banner` class, dismissible, shown when no export in >7 days

### Backup Banner Logic

```js
const lastExport = data.settings.lastExportDate;
const daysSinceExport = lastExport
  ? (new Date().getTime() - new Date(lastExport).getTime()) / (1000 * 3600 * 24)
  : Infinity;
const showBackupWarning = daysSinceExport > 7;
```

Renders a `.backup-banner` above the page content when `showBackupWarning && !backupBannerDismissed`. Has "Ekspor Sekarang" inline link (calls `quickExport()`) and a ✕ dismiss button.

### Handlers

```
addTransaction(t)
  Income: auto-generates txnId via generateTxnId(d.transactions, nt.date).
  Expense: uses t.txnId as-is (manual, supplier invoice number).
  Creates paymentHistory[0] with initial payment amount.
  Sets dueDate = outstanding > 0 ? addDays(date, customDueDays) : null.
  Auto-creates contact if counterparty not already present.
  Calls update().

editTransaction(t)
  If income and YY-MM prefix changed: regenerates txnId.
  Recalculates dueDate if date or customDueDays changed (keeps existing if unchanged).
  Appends editPaymentEntry to paymentHistory if value/outstanding changed.
  Caps editLog at last 20 entries via .slice(-20). editLog[].prev = slim snapshot (10 fields).
  Calls update().

deleteTransaction(id)
  Removes from transactions[]. Stock + AR/AP auto-recomputed via useMemo.

applyPayment(id, paidAmount, paymentNote = "")
  Appends new paymentHistory entry.
  Updates outstanding, status (via deriveStatus), dueDate.
  Auto-note: isFullyPaid ? "Pelunasan" : "Pembayaran sebagian" (used if paymentNote empty).
  Appends to editLog (capped at 20). editLog[].prev = slim snapshot.

createContact(name)
  Adds new contact only if name not present (case-insensitive).

updateContact(contact)
  Updates contact fields.
  If name changed: cascades update to all transactions matching old name.
  BLOCKS rename if another contact already has the same name (case-insensitive).
  Returns d unchanged on conflict — Contacts.js validates before calling.

handleImport(importedData)
  DESTRUCTIVE — replaces ALL data.
  Writes importedData to localStorage then re-reads via loadData() so migrations run
  immediately. This ensures old backups (pre-v9, pre-v13, etc.) are fully normalized
  before hitting React state — not just on the next reload.

addStockAdjustment(adj)
  Appends to stockAdjustments[].

deleteStockAdjustment(adjustmentId)
  Removes from stockAdjustments[] by id string.

updateItemCategories(categories)
  Replaces entire itemCategories[] array. Called from Inventory category UI.

addCatalogItem(item)
  Appends new catalog item: { id: generateId(), name: normalizeTitleCase(item.name),
  defaultUnit: item.defaultUnit || "karung", subtypes: item.subtypes || [] }

updateCatalogItem(updatedItem)
  Replaces catalog item matching updatedItem.id.
  Note: catalog renames do NOT cascade to transaction itemNames — call renameInventoryItem() separately.

deleteCatalogItem(itemId)
  Removes catalog item by id. Transactions referencing that item are NOT modified.

renameInventoryItem(oldName, newName)
  Updates itemName on ALL items[] entries in transactions AND stockAdjustments.
  Uses normItem() for matching. Also updates top-level t.itemName.

deleteInventoryItem(itemName)
  Removes all transactions where ANY item in items[] matches itemName (normItem() comparison).
  Also removes all stockAdjustments for that item.
  Note: checks ALL items[] entries, not just top-level t.itemName — handles multi-item transactions.

handleViewItem(itemName)
  Sets reportItemFilter state + navigates page to "reports".

navigateToOutstanding(txIds)
  Sets outstandingHighlight to txIds array + navigates to "outstanding" page.
  Outstanding page highlights those rows on mount, then calls onClearHighlight to reset.
```

### EditModal Component (defined inside App.js)

This is a function component defined at the top of App.js — not a separate file.

```js
function EditModal({ transaction, contacts, transactions = [], stockMap, itemCatalog = [], onSave, onClose, onCreateContact, onAddCatalogItem, onUpdateCatalogItem }) {
  const [stockWarn, setStockWarn] = useState(null);

  // Escape key support
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Temporarily remove this transaction's stock from map (multi-item aware)
  // so TransactionForm sees the pre-edit stock baseline for negative-stock warnings.
  const adjustedStockMap = useMemo(() => {
    const m = { ...stockMap };
    const itemList = Array.isArray(transaction.items) && transaction.items.length > 0
      ? transaction.items
      : [{ itemName: transaction.itemName, sackQty: transaction.stockQty }];
    for (const item of itemList) {
      const key = normItem(item.itemName);
      if (m[key]) {
        const origDelta = transaction.type === "expense"
          ? parseFloat(item.sackQty) || 0
          : -(parseFloat(item.sackQty) || 0);
        m[key] = { ...m[key], qty: m[key].qty - origDelta };
      }
    }
    return m;
  }, [stockMap, transaction]);

  return (
    <div className="edit-modal-overlay" role="dialog" aria-modal="true">
      <div className="edit-modal-box">
        <TransactionForm
          initial={transaction}
          contacts={contacts}
          transactions={transactions}
          stockMap={adjustedStockMap}
          itemCatalog={itemCatalog}
          onStockWarning={setStockWarn}
          onCreateContact={onCreateContact}
          onAddCatalogItem={onAddCatalogItem}
          onUpdateCatalogItem={onUpdateCatalogItem}
          onSave={(t) => { onSave(t); onClose(); }}
          onCancel={onClose}
        />
        <StockWarningModal data={stockWarn} onClose={() => setStockWarn(null)} />
      </div>
    </div>
  );
}
```

**Key detail:** `adjustedStockMap` iterates all `transaction.items[]` (not just top-level `itemName`) to correctly remove the full multi-item stock contribution before showing the edit form.

### Navigation (navItems array)

| key | label | icon | badge |
|-----|-------|------|-------|
| `penjualan` | Penjualan | `income` | `penjualanBadge` |
| `pembelian` | Pembelian | `expense` | `pembelianBadge` |
| `inventory` | Inventaris | `inventory` | `alertCount` |
| `contacts` | Kontak | `contacts` | — |
| `reports` | Laporan | `reports` | — |
| `outstanding` | Piutang & Hutang | `warning` | `outstandingBadge` |
| `settings` | Pengaturan | `settings` | — |

### Full Render Tree (App.js main content section)

```jsx
{page === "penjualan" && (
  <Penjualan
    transactions={data.transactions}  contacts={data.contacts}
    stockMap={stockMap}               itemCatalog={data.itemCatalog || []}
    threshold={threshold}             defaultDueDateDays={data.settings.defaultDueDateDays || 14}
    onAdd={addTransaction}            onEdit={setEditTx}
    onDelete={deleteTransaction}      onInvoice={setInvoiceTxs}
    onMarkPaid={applyPayment}         onCreateContact={createContact}
    onSuratJalan={setSuratJalanTx}    onNavigateOutstanding={navigateToOutstanding}
    saved={saved}
  />
)}
{page === "pembelian" && (
  <Pembelian
    transactions={data.transactions}  contacts={data.contacts}
    stockMap={stockMap}               itemCatalog={data.itemCatalog || []}
    threshold={threshold}             defaultDueDateDays={data.settings.defaultDueDateDays || 14}
    onAdd={addTransaction}            onEdit={setEditTx}
    onDelete={deleteTransaction}      onInvoice={setInvoiceTxs}
    onMarkPaid={applyPayment}         onCreateContact={createContact}
    onNavigateOutstanding={navigateToOutstanding}
    saved={saved}
    {/* No onSuratJalan — surat jalan is income-only */}
  />
)}
{page === "inventory" && (
  <Inventory
    stockMap={stockMap}               threshold={threshold}
    onViewItem={handleViewItem}       onAddAdjustment={addStockAdjustment}
    onRenameItem={renameInventoryItem} onDeleteItem={deleteInventoryItem}
    onDeleteAdjustment={deleteStockAdjustment}
    itemCategories={data.itemCategories || []}
    onUpdateCategories={updateItemCategories}
    transactions={data.transactions}  stockAdjustments={data.stockAdjustments || []}
    onStockReport={() => setShowStockReport(true)}
    itemCatalog={data.itemCatalog || []}
    onAddCatalogItem={addCatalogItem}
    onUpdateCatalogItem={updateCatalogItem}
    onDeleteCatalogItem={deleteCatalogItem}
  />
)}
{page === "contacts" && (
  <Contacts
    contacts={data.contacts}          transactions={data.transactions}
    balanceMap={balanceMap}
    onAddContact={(c) => update((d) => ({ ...d, contacts: [...d.contacts, c] }))}
    onUpdateContact={updateContact}
    onDeleteContact={(id) => update((d) => ({ ...d, contacts: d.contacts.filter((c) => c.id !== id) }))}
    onDeleteTransaction={deleteTransaction}
    onEditTransaction={setEditTx}     onMarkPaid={applyPayment}
  />
)}
{page === "reports" && (
  <Reports
    transactions={data.transactions}  contacts={data.contacts}
    settings={data.settings}          onInvoice={setInvoiceTxs}
    onReport={setReportState}         initItemFilter={reportItemFilter}
    onClearItemFilter={() => setReportItemFilter(null)}
  />
)}
{page === "outstanding" && (
  <Outstanding
    transactions={data.transactions}  onEdit={setEditTx}
    onMarkPaid={applyPayment}         onDelete={deleteTransaction}
    onInvoice={setInvoiceTxs}
    highlightTxIds={outstandingHighlight}
    onClearHighlight={() => setOutstandingHighlight(null)}
  />
)}
{page === "settings" && (
  <Settings
    settings={data.settings}
    onSave={(s) => update((d) => ({ ...d, settings: s }))}
    onImport={handleImport}
  />
)}
```

### Global Modal Renders (App.js bottom of return)

```jsx
{editTx && (
  <EditModal
    transaction={editTx}            contacts={data.contacts}
    transactions={data.transactions} stockMap={stockMap}
    itemCatalog={data.itemCatalog || []}
    onSave={editTransaction}        onClose={() => setEditTx(null)}
    onCreateContact={createContact}
    onAddCatalogItem={addCatalogItem}
    onUpdateCatalogItem={updateCatalogItem}
  />
)}
{invoiceTxs && (
  <InvoiceModal
    transactions={invoiceTxs}       settings={data.settings}
    onClose={() => setInvoiceTxs(null)}
  />
)}
{suratJalanTx && (
  <SuratJalanModal
    transaction={suratJalanTx}      settings={data.settings}
    onClose={() => setSuratJalanTx(null)}
  />
)}
{reportState && (
  <ReportModal
    transactions={reportState.transactions}
    settings={data.settings}
    dateFrom={reportState.dateFrom}  dateTo={reportState.dateTo}
    onClose={() => setReportState(null)}
  />
)}
{showStockReport && (
  <StockReportModal
    stockMap={stockMap}             categories={data.itemCategories || []}
    settings={data.settings}        transactions={data.transactions}
    stockAdjustments={data.stockAdjustments || []}
    onClose={() => setShowStockReport(false)}
  />
)}
```

---

## 6. Utilities

### idGenerators.js

```js
generateId()
  → "${Date.now()}-${Math.random().toString(36).slice(2,9)}"
  Example: "1742000000000-abc1234"

generateTxnId(transactions, dateStr)
  → "YY-MM-NNNNN" (e.g. "26-03-00009")
  ⚠ RULE: Only counts type === "income" transactions.
     Pass the full transactions array — it filters internally.
     Serial = highest existing + 1, padded to 5 digits.

fmtIDR(n)
  → "Rp 5.215.000"
  Uses Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })

today()
  → "YYYY-MM-DD" in LOCAL timezone
  Uses getFullYear(), getMonth()+1, getDate() — local methods, NOT UTC

addDays(dateStr, days)
  → "YYYY-MM-DD" or null on failure
  Parses as `dateStr + "T00:00:00Z"` (Z mandatory)
  Uses setUTCDate(getUTCDate() + days) — UTC methods mandatory
  Wrapped in try/catch → null on failure

diffDays(date1Str, date2Str)
  → number (positive = date2 is future) or null
  Same UTC parsing. Math: (date2 - date1) / (1000 * 60 * 60 * 24)

nowTime()
  → "HH:MM" via toTimeString().slice(0, 5)
  Always pads hours (midnight = "00:00" not "0:00")

fmtDate(d)
  → "15 Mar 2026" (Indonesian locale) or "-" if falsy
  Parses as `d + "T00:00:00"` (local, no Z)

normItem(s)
  → trimmed lowercase string. Used as stockMap key ONLY.

normalizeTitleCase(s)
  → Title Case with PT/CV/UD/TB uppercased

toCommaDisplay(digits), numToDisplay(n), displayToNum(s)
  → Rupiah display helpers used internally by RupiahInput
```

**Date math rule (critical):**
- Calculations (`addDays`, `diffDays`, `dueDate`): always `T00:00:00Z` + UTC methods
- Display (`today()`, `fmtDate()`, showing `t.date`): always local time methods
- **Never mix the two.**

### statusUtils.js

```js
STATUS.LUNAS           = "Lunas"
STATUS.PARTIAL_INCOME  = "Belum Lunas (Piutang)"
STATUS.PARTIAL_EXPENSE = "Belum Lunas (Utang)"

deriveStatus(type, isPartial)
  → STATUS.LUNAS | STATUS.PARTIAL_INCOME | STATUS.PARTIAL_EXPENSE
  Logic: !isPartial → LUNAS; else type==="income" ? PARTIAL_INCOME : PARTIAL_EXPENSE

isUnpaid(status)
  → boolean (true if PARTIAL_INCOME or PARTIAL_EXPENSE)
```

**Rule:** Never write `"Lunas"`, `"Belum Lunas (Piutang)"`, or `"Belum Lunas (Utang)"` as raw string literals. Always use `deriveStatus()` or `STATUS.*`.

### stockUtils.js

```js
computeStockMap(transactions, stockAdjustments = [])
  → { [normItemName]: { displayName, qty, unit, lastDate, lastTime, txCount } }
  ⚠ RULE: Must receive BOTH arguments. Never call with only one.
  Logic: expense = +qty (incoming stock), income = -qty (outgoing stock).
  Key = normItem() (lowercase), displayName = normalizeTitleCase().
  unit: uses the actual stockUnit from each transaction (NOT hardcoded "karung").

computeStockMapForDate(transactions, viewDate, stockAdjustments = [])
  → Same shape, filtered to date <= viewDate
```

### balanceUtils.js

```js
computeARandAP(transactions)
  → { ar: number, ap: number }
  AR = sum of outstanding for type==="income" && outstanding > 0
  AP = sum of outstanding for type==="expense" && outstanding > 0

computeCashIncome(transactions)  → sum of (value - outstanding) for income
computeCashExpense(transactions) → sum of (value - outstanding) for expense
computeNetCash(transactions)     → computeCashIncome - computeCashExpense
```

### categoryUtils.js

```js
generateCode(groupName)
  → Short uppercase code from a single group name.
  Multi-word: first letter of each word ("Bawang Putih" → "BP").
  Single-word: consonants only, capped at 4 ("Ketumbar" → "KTMB").

generateCodes(groupNames)
  → { [groupName]: code } map with parent-child awareness.
  If "Lada Mulya" has parent "Lada", child code = parent code + suffix.
  Example: { "Lada": "LD", "Lada Mulya": "LDM" }

autoDetectCategories(stockMap, existingCategories = [])
  → Merged array of categories: existing (updated) + new auto-detected.
  Groups uncategorized items by shared word-level prefix (capped at 2 words).
  Merges into existing categories when group name matches.

getCategoryForItem(normalizedItemName, categories)
  → Object | null — the category containing this item, or null.
```

### paymentUtils.js

```js
computePaymentProgress(value, outstanding)
  → { percent: number } | null
  Returns null if value is 0 (cannot compute).
  percent = Math.round(((value - outstanding) / value) * 100)
```

### printUtils.js

See [Section 9 — Print System](#9-print-system).

---

## 7. Pages

### Penjualan.js / Pembelian.js (18 lines each)

Thin wrappers. Pass `type`, `title`, `accentColor` to `<TransactionPage {...props}>`.

- Penjualan: `type="income"`, `accentColor="#10b981"` (green), passes `onSuratJalan`
- Pembelian: `type="expense"`, `accentColor="#ef4444"` (red), no `onSuratJalan`

Both now receive `itemCatalog` and `onNavigateOutstanding` from App.js and pass them through to TransactionPage.

### Inventory.js (~1540 lines)

**Purpose:** Table layout grouped by category — rows for catalog entries (base + subtypes) organized under category group headers. Expandable per-item stock ledger, inline adjustment form, catalog CRUD. "Lainnya — UNC" group catches items not matched to any category.

**Layout:** `tableGroups` useMemo produces groups of flat item rows. Each group has a dark navy `.inventory-group-header` row followed by item rows. The old card layout (`inventory-item-card`) CSS classes remain in `styles.css` but the JSX no longer renders cards.

**Local state (key groups):**
- Ledger: `expandedStockItem`, `ledgerTypeFilter`, `ledgerDateFrom`, `ledgerDateTo`, `adjDeleteConfirm`
- Adjustment form: `adjTarget`, `adjDir`, `adjQtyStr`, `adjReason`, `adjQtyError`, `adjReasonError`, `submitting`
- Catalog management: `catalogForm`, `catalogFormError`, `catalogSubtypeError`, `deleteCatalogConfirm`, `removeSubtypeConfirm`
- General: `search`, `sortBy`, `sortDir`, `inventoryDate`, `toast`, `showCategoryModal`, `deleteTarget`, `renameTarget`, `renameNewName`, `renameError`, `renameMergeConfirm`

**Key useMemos:**
- `activeStockMap` — returns today's `stockMap` or `computeStockMapForDate(...)` for historical view
- `tableGroups` — builds flat item rows from `itemCatalog` (base + each subtype) + uncataloged items from `activeStockMap`, groups them using `getCategoryForItem()` with a groupName-prefix fallback for zero-stock base items, applies search filter and sort. Returns `[{ groupName, code, items[] }]`, "Lainnya" group last.
- `ledgerEntries` / `visibleLedgerEntries` — stock history entries for the expanded item, filtered by type and date range, reversed for newest-first display.

**buildStockLedger — the core ledger computation (useMemo):**

This runs when `expandedStockItem`, `transactions`, or `stockAdjustments` changes:

```js
// 1. Build entries from transactions (checks all items[] entries)
transactions.forEach((t) => {
  const itemList = Array.isArray(t.items) && t.items.length > 0
    ? t.items
    : [{ itemName: t.itemName, sackQty: t.sackQty ?? (t.stockQty || 0) }];
  itemList.forEach((it) => {
    if (normItem(it.itemName) !== expandedStockItem) return;
    entries.push({
      id: t.id, type: "transaction",
      date: t.date, time: t.time || "00:00",
      delta: t.type === "expense" ? qty : -qty,
      counterparty: t.counterparty, txType: t.type,
      txnId: t.txnId, unit: t.stockUnit || "karung",
    });
  });
});

// 2. Build entries from stockAdjustments
stockAdjustments.forEach((a) => {
  if (normItem(a.itemName) !== expandedStockItem) return;
  entries.push({ id: a.id, type: "adjustment", date: a.date, time: a.time || "00:00",
    delta: a.adjustmentQty || 0, reason: a.reason || "", unit: a.unit || "karung" });
});

// 3. Sort chronologically oldest-first, then compute running total
```

**Date-range filter (visibleLedgerEntries useMemo):**
Filters by `ledgerTypeFilter` ("all" | "transaction" | "adjustment") and date range, then reverses for newest-first display.

**Quick-select presets:**
- Hari Ini, Minggu Ini (Monday start: `(getDay() + 6) % 7`), Bulan Ini, Semua

### Contacts.js (502 lines)

**Local state:** `search`, `alphaFilter` (default `"all"`), `sortBy` (default `"nameAsc"`), `selected` (contact id | null), `editMode`, `form`, `deleteTx`, `paidTx`, `toast`, `submitting`, `deleteContactId`, `expandedTxId`, `nameError`

- `nameError` — inline error for duplicate contact name validation
- `submitting` — debounce guard for double-submit

**Layout modes:**
- `contacts-page contacts-page--full` when `!selected`
- `contacts-page contacts-page--split` when `selected !== null`

**Sort options (3):** `nameAsc`, `nameDesc`, `txCount` (transaction count desc)

**Alpha filter:** `.alpha-filter` row of A–Z buttons. Disabled when letter has no contacts (`.alpha-btn--empty`). "Semua" button resets to all.

### Reports.js (469 lines)

**Local state:** `dateFrom`, `dateTo`, `selectedClients`, `selectedItems`, `period`, `inventoryFilterItem`, `toast`, `confirmCount`

**Period presets:** `daily`, `weekly`, `fortnight`, `monthly`, `all-time`

**Key internal function:**
```js
getMultiItemContribution(t, selItems)
// Returns null when: selItems.length === 0 (no filter)
// Returns null when: transaction has NO matching items
// Returns object { filteredItems, otherItems, combinedSubtotal,
//   combinedProportionalOutstanding, combinedCashValue, totalTransactionValue, totalOutstanding }
```

### Outstanding.js (484 lines)

**Props (updated):**
- `transactions`, `onEdit`, `onMarkPaid`, `onDelete`, `onInvoice` — standard
- `highlightTxIds: Array | null` — tx IDs to highlight on mount (from `navigateToOutstanding`)
- `onClearHighlight: () => void` — called after rows are scrolled to, to reset App.js state

**Highlight behavior:** `OutstandingTable` receives `highlightTxIds`, scrolls first matching row into view via `firstHighlightRef`, applies visual CSS class on matching rows.

**Local state (top-level):** `sortBy`
**Local state (OutstandingTable):** `deleteTx`, `paidTx`, `toast`, `page`, `expandedTxId`

Two sections: Piutang (income outstanding) + Hutang (expense outstanding). `PAGE_SIZE = 50`.
Sort options: `nearestDue`, `furthestDue`, `smallestOut`, `largestOut`.

### Settings.js (364 lines)

**Local state:** `form`, `flash`, `submitting`, `importMsg`, `bizErrors`, `dueDaysStr`, `lowStockStr`, `maxBankStr`, `fileRef`

- `submitting` — debounce guard for save and export
- `bizErrors` — object with per-field validation errors (e.g. `{ businessName: "..." }`)

Features: business info form, bank account CRUD, JSON export (updates `lastExportDate`), JSON import with validation.

---

## 8. Components

### TransactionPage.js (549 lines)

Shared base for Penjualan and Pembelian. **Any change here affects both pages.**

**Props:** All props from pages plus `itemCatalog: Array` (passed through to TransactionForm).

**Local state:** `showForm`, `search`, `searchCategory`, `sortBy`, `stockWarn`, `deleteTx`, `paidTx`, `toast`, `viewDate`, `overdueDismissed`, `dueSoonDismissed`, `expandedTxId`, `dateNavRef`

**Search/filter/sort:** Filters to `type === type && date === viewDate`, then by search category (invoiceNo | itemName | klien), then sorts.

**Day navigation:** `viewDate` state, default `today()`. ‹ / › buttons use `addDays`. Date click opens hidden `<input type="date">` via `dateNavRef.current.showPicker()`. "Hari Ini" button shown when `viewDate !== today()`.

**Stock warning flow:**
1. TransactionForm detects negative stock → calls `onStockWarning({ items: negItems, item, current, selling, onConfirm, onCancel })`
2. TransactionPage sets `stockWarn` state → renders `<StockWarningModal data={stockWarn} .../>`
3. User proceeds → `stockWarn.onConfirm()` → saves transaction
4. User cancels → `onCancel()` + `onClose()` clears modal

**Surat Jalan button:** Only renders when `type === "income" && onSuratJalan` is defined.

### TransactionForm.js (1165 lines)

**Props:** `onSave`, `onCancel`, `initial`, `contacts`, `transactions`, `stockMap`, `onStockWarning`, `onCreateContact`, `defaultDueDateDays`, `initType`, `itemCatalog`, `onAddCatalogItem`, `onUpdateCatalogItem`

**Key behaviors:**
- **Smart text-input item system**: Each item row has two text inputs with autocomplete dropdowns, NOT `<select>` elements:
  1. **Nama Barang** input: free text, shows dropdown of matching `itemCatalog[].name` values as the user types. Catalog match is stored in `catalogItemId` + `matchedCatalog` per row.
  2. **Tipe** input (optional, shown only after Nama Barang is filled): free text, shows dropdown of `matchedCatalog.subtypes[]` values. User can type a subtype not yet in the catalog.
  3. Full item name saved = `itemNameInput + " " + itemTypeInput` (or just `itemNameInput` if no type).
  4. Unit auto-fills from `catalogItem.defaultUnit` of matched entry.
  5. Stock display per item row (current qty from `stockMap` shown inline).
- **`mapItemFromCatalog(itemName)`**: Used in edit mode pre-population. Walks catalog to find matching `name` or `name + " " + subtype`. Falls back to free text (no `__legacy__` sentinel — the form simply shows raw item name when no match found, allowing edit without data loss).
- **New-item confirmation dialog** (`newItemConfirm` state): If the user types an item name or subtype not in the catalog, a confirmation dialog appears before save. On confirm, the form calls `onAddCatalogItem()` or `onUpdateCatalogItem()` to update the catalog, then proceeds to save. This allows the catalog to grow organically from transaction entry.
- **`submitting` state**: Boolean flag, prevents double-submit.
- **`errors` object**: Per-field inline validation. Error border applied via `iStyle()` helper, `.field-error` class for error text below the field.
- **Auto-focus on mount**: Counterparty input receives focus. `skipNextFocusOpen` ref prevents the programmatic focus from opening the counterparty dropdown.
- **Multi-item stock warning**: Collects ALL negative items into `negItems[]` array, then calls `onStockWarning({ items: negItems, item: negItems[0].item, current: negItems[0].current, selling: negItems[0].selling, onConfirm, onCancel })`.
- Income txnId: read-only display, auto-generated on save.
- Expense txnId: editable input (supplier invoice number).
- Multi-item support: `items[]` array with Add/Remove row buttons, auto-totals.

### PaymentHistoryPanel.js (290 lines)

**Props:** `transaction`, `onClose`

Rendered as vertical timeline using `colSpan` to span full table width below a transaction row.

- Progress bar: 160px, gradient green, from `(value - outstanding) / value`
- System notes (e.g. "Pelunasan") → plain display labels, NOT "Catatan:"
- User notes → shown as "Catatan: [text]" in italic grey
- `(data lama)` suffix entries → ⚠ icon with tooltip, NOT raw text
- 10+ entries: shows first 3 + expand toggle + last 1
- Pending node (dashed amber dot) when `outstanding > 0`

### PaymentUpdateModal.js (154 lines)

**Props:** `transaction | null`, `onConfirm(paidAmount, paymentNote)`, `onCancel`

Pre-fills with full outstanding. Live preview shows Lunas vs remaining. Note field max 100 chars.

**Auto-focus:** Uses `amountFieldRef` with `querySelector("input")` inside ref-div since RupiahInput does not forward refs. 50ms setTimeout after transaction changes.

**Escape key:** Calls `onCancel()`. Guards with `if (!transaction) return` — always-mounted modal.

### DeleteConfirmModal.js (106 lines)

**Props:** `transaction? | null`, `isContact?`, `contact?`, `onConfirm`, `onCancel`

Transaction delete: warns about stock/balance side effects.
Contact delete: clarifies transactions are NOT deleted.

**Escape key:** Guards with `isContact ? !!contact : !!transaction` — always-mounted modal.

### InvoiceModal.js (303 lines)

**Props:** `transactions`, `settings`, `onClose`

100% inline-styled (the `s` object). `modalRef` on outer modal div (has `data-invoice-doc` attribute). `data-no-print="true"` on close button and actions bar.

**`catatan` / invoice notes:** Has `invoiceNote` text area entered at print time in the modal. Notes are NOT saved to transaction data — they exist only in local `useState("")` while the modal is open. Deliberate product decision.

**Print approach:** `printWithPortal()` with embedded `<style>`. Signature section (`.inv-sig`) and flex spacer (`.inv-spacer`) are `display:none` on screen via inline style; `!important` in the print CSS overrides to reveal them.

**Sections in JSX order:**
1. Header (business name + INVOICE title, invoice number, date, due date)
2. Kepada block (billing counterparty)
3. Line items table (6 cols: No, Jenis Barang, Karung, Berat Kg, Harga/Kg, Total)
4. Totals (Subtotal + optional Sisa Tagihan + Grand Total row)
5. Bank details (filtered by `showOnInvoice`, limited by `maxBankAccountsOnInvoice`)
6. `.inv-spacer` (hidden on screen, `flex:1` in print)
7. `.inv-sig` signature section (hidden on screen, shown in print)
8. Footer (Dibuat timestamp)
9. Actions bar (Cetak Invoice + Tutup — `data-no-print`)

### SuratJalanModal.js (278 lines)

**Props:** `transaction`, `onClose`

Note: `settings` is passed by App.js at the call site but the component only destructures `{ transaction, onClose }`.

Uses `t.stockUnit` (transaction-level) — NOT `it.stockUnit` (item-level, does not exist).

**`getScale(itemCount)` — 4 presets** for font/spacing based on number of line items.

### StockWarningModal.js (78 lines)

**Props:**
- `data: { items: Array<{item, current, selling}>, item?, current?, selling?, onConfirm: () => void, onCancel?: () => void } | null`
- `onClose: () => void`

TransactionForm passes both the `items` array AND flat `item/current/selling` fields. When `items.length > 1`: renders bullet list. Single item: renders prose format using flat fields.

**Escape key:** Calls `data.onCancel?.()` + `onClose()`. Guards with `if (!data) return` — always-mounted modal.

### ReportModal.js (297 lines)

**Props:** `transactions`, `settings`, `dateFrom`, `dateTo`, `onClose`

**11 columns:** No, Tanggal, No. Invoice, Klien, Barang, Stok, Jenis, Status, Jatuh Tempo, Nilai (Rp), Piutang/Hutang.

**Print:** Uses `window.print()` directly (NOT `printWithPortal`). Print styles come from the existing `@media print` block in `styles.css` (not the portal block). Was not migrated to the portal approach.

### Badge.js — StatusBadge + TypeBadge

**StatusBadge:** Maps status string → `{ label, bg, color, tooltip }` coloured pill. Handles all current + legacy status strings.
**TypeBadge:** `type="income"` → green "Penjualan"; `type="expense"` → red "Pembelian".

### SaveIndicator.js (41 lines)

**Props:** `saved: boolean`

- Tracks `false → true` transition via `prevSaved` ref
- Records `nowTime()` into internal `lastSavedTime` state ONLY on actual save
- Shows "Tersimpan ✓ · HH:MM" when saved with timestamp in `<span className="save-indicator__time">` (muted gray, 0.9em)
- Shows "Menyimpan..." when `saved === false`
- Note: `lastSavedTime` is internal state — it is NOT a prop

### Icon.js (70 lines)

**Props:** `name`, `size` (default 18), `color` (default `"currentColor"`)

**Available names:** `income`, `expense`, `inventory`, `contacts`, `reports`, `warning`, `settings`, `menu`, `plus`, `edit`, `trash`, `invoice`, `check`, `clock`, `search`, `download`, `link`, `upload`, `eye`, `adjust`, `truck`, `dashboard`

### Other Components (brief)

| Component | Props | Notes |
|-----------|-------|-------|
| `DueBadge` | `dueDate`, `outstanding` | Renders "—" when outstanding ≤ 0 |
| `StockChip` | `qty`, `unit`, `threshold` | Green/amber/red based on level |
| `Toast` | `message`, `type`, `onDone` | Auto-dismisses after 3s |
| `MultiSelect` | `options`, `selected`, `onChange`, `placeholder` | Zero-dependency, search + select-all |
| `RupiahInput` | `value`, `onChange`, `hasError`, `placeholder` | Displays formatted Rupiah, emits integer |
| `CategoryModal` | `categories`, `stockMap`, `onSave`, `onClose` | Drag-and-drop category management; auto-detects groups on mount; group merge via drag. Duplicate group name validation: stays in edit mode with error if name already exists. Manual code edits cascade to child groups (groups whose name starts with the edited group's name). |
| `StockReportModal` | `stockMap`, `categories`, `settings`, `transactions`, `stockAdjustments`, `onClose` | Printable stock report grouped by category; historical date picker; prints via `printWithPortal()` |

---

## 9. Print System

### Architecture

```
public/index.html
  <div id="root"></div>           ← React app mounts here
  <div id="print-portal"></div>   ← OUTSIDE React, always empty on screen
```

`styles.css` global rules:
```css
#print-portal { display: none; }
@media print {
  body.print-portal-active #root         { display: none !important; }
  body.print-portal-active #print-portal { display: block !important; }
}
```

### printWithPortal(htmlString) — src/utils/printUtils.js

```js
export const printWithPortal = (htmlString) => {
  const portal = document.getElementById("print-portal");
  if (!portal) {
    console.error("printWithPortal: #print-portal not found");
    window.print();
    return;
  }
  portal.innerHTML = htmlString;
  document.body.classList.add("print-portal-active");
  try {
    window.print();   // synchronous — blocks until print dialog closes
  } finally {
    document.body.classList.remove("print-portal-active");
    portal.innerHTML = "";
  }
};
```

**Key design facts:**
- `window.print()` is synchronous on desktop browsers — `finally{}` runs only after the dialog closes
- `body.print-portal-active` has **zero screen CSS** — only `@media print` rules — no visual flash
- `@page` rules in `@media print` cannot be scoped by body class — they apply globally. Each document embeds its own `@page` inside the portal's `<style>` tag, never in `styles.css`

### Per-document print sizes

| Document | @page size | margin | Method |
|----------|-----------|--------|--------|
| Invoice (InvoiceModal) | A4 portrait | 12mm | `printWithPortal` |
| Surat Jalan (SuratJalanModal) | A5 portrait | 8mm | `printWithPortal` |
| Report (ReportModal) | default (landscape set by CSS) | default | `window.print()` directly |
| Stock Report (StockReportModal) | A4 portrait | varies | `printWithPortal` |

**ReportModal uses `window.print()` directly** (not the portal) — its `@media print` styles live in the original block in `styles.css` (around line 1433). This was the pre-portal approach and was not migrated.

---

## 10. CSS — Classes and Structure

`src/styles.css` — ~2800 lines. BEM-inspired kebab-case throughout.

### Color Palette

| Role | Value |
|------|-------|
| Primary blue | `#007BFF` / `#007bff` |
| Dark blue | `#0056b3` |
| Deep navy | `#1e3a5f` |
| Green (income/lunas) | `#10b981` |
| Dark green | `#059669` |
| Red (expense/delete) | `#ef4444` |
| Amber (outstanding) | `#f59e0b` |
| Indigo (invoice no) | `#6366f1` |
| Purple (surat jalan) | `#8b5cf6` |
| Page background | `#f0f6ff` |
| Card surface | `#fff` |
| Border | `#c7ddf7` |
| Muted text | `#6b7280` |
| Very muted | `#9ca3af` |

### Layout & Navigation

```
.app-shell, .sidebar, .sidebar--open, .sidebar--closed
.sidebar__logo, .sidebar__nav, .sidebar__foot
.main-content
.page-header, .page-title, .page-content
.nav-item, .nav-item--active, .nav-item__icon, .nav-item__badge
```

### Cards & Grid

```
.table-card
.summary-card, .summary-card--clickable, .summary-card--active, .summary-card--blue
.summary-card__label, .summary-card__value, .summary-card__tag, .summary-card__sub
.mini-card, .mini-card__label, .mini-card__value
.summary-grid, .summary-grid--2, .summary-grid--3
```

### Buttons

```
.btn, .btn-sm, .btn-lg
.btn-primary, .btn-secondary, .btn-outline, .btn-danger, .btn-danger-outline, .btn-paid
.action-btn
.action-btn--edit, .action-btn--delete, .action-btn--invoice, .action-btn--paid
.action-btn--history, .action-btn--history-badge
.action-btn--surat-jalan   ← purple truck icon button (#f5f3ff bg, #8b5cf6 border)
```

### Inputs & Search

```
.search-input, .date-input, .sort-select
.search-bar-wrapper, .search-bar__category, .search-bar__input, .search-bar__sort
.search-icon
.filter-bar, .filter-btn, .filter-btn--active
.active-filter-chip, .active-filter-chip__clear
.form-input--error    ← red border on invalid input fields
.form-select--error   ← red border on invalid select fields
.field-error          ← red error text displayed below invalid field
```

### Tables

```
.data-table
.th-center, .th-right, .th-check
.td-center, .td-right, .td-check, .td-date, .td-name, .td-value
.row-alt   ← alternating row — scoped override exists for contacts-history-table
```

### Badges

```
.badge
.stock-chip    ← qty coloured pill
.order-num     ← invoice number pill (indigo)
.stock-delta   ← +/- stock change
```

### Modals

```
.modal-overlay, .modal-box, .modal-title, .modal-body, .modal-actions
.edit-modal-overlay, .edit-modal-box   ← EditModal wrapper (App.js inline component)
```

### Toast & Alerts

```
.toast
.alert-banner, .alert-banner--warning, .alert-banner--danger
.backup-banner, .backup-banner__text, .backup-banner__link, .backup-banner__dismiss
```

Backup banner: `background: #fef3c7; border: 1.5px solid #f59e0b` — amber warning style.

### Payment Progress

```
.payment-progress-wrap, .payment-progress-bar, .payment-progress-bar__fill, .payment-progress-pct
```

### Payment Timeline

```
.payment-timeline
.payment-timeline__node, .payment-timeline__dot
.payment-timeline__dot--lunas, .payment-timeline__dot--empty
.payment-timeline__line
.payment-timeline__datetime, .payment-timeline__label, .payment-timeline__details, .payment-timeline__meta
```

### Empty State

```
.empty-state
.empty-state-icon, .empty-state-title, .empty-state-subtitle
```

### Transaction Day Navigation

```
.tx-date-nav                  ← flex row with colored left border (accentColor)
.tx-date-nav__arrow           ← ‹ › buttons
.tx-date-nav__center          ← flex:1 middle section
.tx-date-nav__date-text       ← clickable date label
.tx-date-nav__today-pill      ← "Hari ini" / "Mendatang" pill
.tx-date-nav__hidden-input    ← opacity:0 date input triggered by date text click
.tx-date-nav__today-btn       ← "Hari Ini" button (only shows when not on today)
```

### Day Summary Cards

```
.day-summary-row      ← 3-column grid
.day-summary-card     ← individual summary card
.day-summary-card__label, .day-summary-card__value, .day-summary-card__sub
```

### Items List (multi-item in table cells)

```
.item-list, .item-list__row, .item-list__bullet, .item-list__subtotal
```

### Reports

```
.item-filter-primary, .item-filter-secondary
.item-filter-value-primary, .item-filter-value-secondary, .item-filter-note
.report-stok-item, .report-stok-in, .report-stok-out, .report-stok-cell
```

### Save Indicator

```
.save-indicator, .save-indicator.saved, .save-indicator.saving
.save-indicator__time   ← muted gray (#9ca3af), 0.9em — timestamp after checkmark
```

### Inventory Cards

```
.inventory-cards               ← grid container for all catalog item cards
.inventory-item-card           ← individual catalog item card
.inventory-item-card__header   ← card header: item name + stock + unit badge + actions
.inventory-item-card__name     ← item name text
.inventory-item-card__unit-badge ← small unit pill
.inventory-item-card__stock-row ← stock quantity display row
.inventory-item-card__subtype-name  ← subtype label in breakdown list
.inventory-item-card__subtype-qty   ← subtype stock quantity
.inventory-item-card__subtype-actions ← per-subtype action buttons
.inventory-item-card__add-subtype ← add new subtype form row
.inventory-item-card__body     ← card body content area
.inventory-item-card__header-actions ← header-level action buttons
.inventory-item-card--uncataloged ← modifier for uncataloged section cards
```

### Contact Layout & Alpha Filter

```
.contacts-page, .contacts-page--full, .contacts-page--split
.contacts-list-panel, .contacts-detail-panel
.alpha-filter, .alpha-btn, .alpha-btn--active, .alpha-btn--empty, .alpha-btn--all
.contacts-sort-row, .contacts-sort-label, .contacts-count
```

### Contact Items & Detail

```
.contact-item, .contact-item--active
.contact-item__left, .contact-item__middle, .contact-item__right
.contact-item__name, .contact-item__sub, .contact-item__tag, .contact-item__tag--ar, .contact-item__tag--ap
.contacts-detail-hdr, .contacts-detail-hdr__name, .contacts-detail-back
.contacts-table-scroll, .contacts-history-table
```

### Stock Ledger

```
.stock-ledger-wrap
.stock-ledger-header, .stock-ledger-title, .stock-ledger-subtitle
.stock-ledger-summary-box, .stock-ledger-summary-box__title, .__row, .__item, .__item-label, .__item-value
.stock-ledger-filters, .stock-ledger-filter-group, .stock-ledger-filter-label
.stock-ledger-date-range, .stock-ledger-date-input, .stock-ledger-date-label
.stock-ledger-timeline
.stock-ledger-entry, .stock-ledger-entry__track, .stock-ledger-entry__dot
.stock-ledger-entry__dot--diamond ← square rotated 45° (for adjustments)
.stock-ledger-entry__line, .stock-ledger-entry__body
.stock-ledger-entry__datetime, .stock-ledger-entry__label
.stock-ledger-entry__delta, .stock-ledger-entry__running
```

### Utility

```
.whitespace-nowrap    ← white-space: nowrap
.hidden               ← display: none
.md\:table-cell       ← display: table-cell (responsive show)
.text-muted           ← muted gray text
.section-subtitle     ← section heading subtitle
```

### Surat Jalan Modal

```
.surat-jalan-overlay, .surat-jalan-modal
.surat-jalan-controls, .surat-jalan-preview, .surat-jalan-doc
.surat-jalan-doc__title, .surat-jalan-doc__title-line
.surat-jalan-doc__info, .surat-jalan-doc__info-block, .__info-row, .__info-label, .__info-value
.surat-jalan-doc__info-value--blank, .surat-jalan-doc__table
.surat-jalan-doc__total, .surat-jalan-doc__notes, .surat-jalan-doc__signatures
.surat-jalan-doc__sig-block, .__sig-label, .__sig-space, .__sig-line, .__sig-name
.surat-jalan-print-tip
```

### Invoice Modal Print Classes

```
.inv-spacer    ← display:none on screen; flex:1 in print CSS — pushes content down
.inv-sig       ← display:none on screen; display:grid (2-col) in print CSS
.inv-sig-block, .inv-sig-label, .inv-sig-space, .inv-sig-line, .inv-sig-name
```

These classes only appear in the embedded `<style>` of `InvoiceModal.handlePrint()` — not in `styles.css`.

### Print Portal (styles.css)

```css
#print-portal { display: none; }
@media print {
  body.print-portal-active #root         { display: none !important; }
  body.print-portal-active #print-portal { display: block !important; }
}
```

There is also an original `@media print` block (around line 1433) that handles ReportModal's `window.print()` approach — hides sidebar, nav, action buttons, etc. for that specific use case.

---

## 11. Architecture Rules

From `CLAUDE.md` Section 2 — absolute constraints:

1. **All global state mutations go through `update()` in App.js.** Never call `setData()` directly outside App.js.

2. **All status strings must come from `deriveStatus(type, isPartial)`.** Never write `"Lunas"`, `"Belum Lunas (Piutang)"`, or `"Belum Lunas (Utang)"` as raw string literals in new code.

3. **DATE MATH** (`addDays`, `diffDays`, `dueDate` calculations): always use `T00:00:00Z` + UTC methods (`getUTCDate`, `setUTCDate`). **DATE DISPLAY** (`today()`, `t.date` display): always use local methods. **Never mix.**

4. **All data model changes require three steps:** (a) bump `NORM_VERSION`, (b) add migration block in `migrateData()`, (c) update `defaultData`.

5. **`paymentHistory[]` is append-only.** Never delete or modify existing entries.

6. **`generateTxnId()` counts ONLY income transactions.** Never pass an unfiltered array to it.

7. **`dueDate` calculated once at creation** (`date + customDueDays`). Do not recalculate on partial payments. Set to `null` only when `outstanding === 0`.

8. **All array/object state updates use spread operators.** Never use `.push()`, `.splice()`, direct property assignment on state objects.

9. **All division operations must guard against denominator = 0** (`val > 0 ? num / val : 0`).

10. **All date operations wrapped in `try/catch` returning `null` on failure.**

11. **Pembelian = MANUAL txnId. Penjualan = AUTO-GENERATED txnId.** Never auto-generate for expense.

12. **`items[]` access:** always check `Array.isArray(t.items) && t.items.length > 0` first. Fall back to top-level `t.itemName`/`t.stockQty` for legacy data.

13. **`computeStockMap` must always receive BOTH `transactions` AND `stockAdjustments`.** Never call with one argument.

14. **`editLog[]` capped at last 20 entries** via `.slice(-20)`. `editLog[].prev` is a slim snapshot (10 key fields, NOT a full copy).

15. **Never introduce new runtime npm packages** without documenting reason in `CLAUDE.md` and confirming no existing utility covers the need.

16. **`itemCatalog[]` is the canonical source for TransactionForm item selection.** Each entry: `{ id, name, defaultUnit, subtypes[] }`. TransactionForm uses smart text inputs (not `<select>` dropdowns) with autocomplete against the catalog. New items and subtypes typed by the user trigger a confirmation dialog then auto-add to the catalog via `onAddCatalogItem()` / `onUpdateCatalogItem()`. Never bypass this flow to write raw item names without catalog lookup.

17. **`deleteInventoryItem(itemName)` checks ALL `items[]` entries** (not just top-level `t.itemName`) before filtering a transaction. This ensures multi-item transactions are correctly handled when the deleted item is a secondary line item.

---

## 12. Known Issues & Fixed Bugs

All previously fixed — do not reintroduce.

| Fixed | File | What was wrong | Fix |
|-------|------|---------------|-----|
| pre-2026 | `idGenerators.js` | UTC off-by-1 in `addDays`/`diffDays` | `T00:00:00Z` + `setUTCDate`/`getUTCDate` |
| pre-2026 | `idGenerators.js` | `today()` returned UTC date not local | Use local `getFullYear`/`getMonth`/`getDate` |
| pre-2026 | `App.js` | `applyPayment` wrote old v2 status strings | Use `deriveStatus()` |
| pre-2026 | `idGenerators.js` | `generateTxnId` counted all transactions, not just income | Filter `type === "income"` |
| pre-2026 | `storage.js` | `dueDate` calculated with local midnight (off-by-1 in UTC+) | v5 migration recomputed all dueDates with UTC |
| 2026-03-15 | `storage.js` | `paymentHistory[0].amount` set to 0 for pre-v9 data | v10 migration detects `amount === 0` with `(value - outstanding) > 0` and corrects |
| 2026-03-15 | `App.js`, `storage.js` | `time` field missing from paymentHistory | v10 migration backfills `"00:00"`, new entries use `nowTime()` |
| 2026-03-15 | `Reports.js` | `getItemContribution` only worked for exactly 1 item | Renamed to `getMultiItemContribution`, guard changed from `!== 1` to `=== 0` |
| 2026-03-16 | `Inventory.js` | Midnight transactions (`time = "00:00"`) hidden in stock ledger | Removed erroneous `entry.time !== "00:00"` suppression |
| 2026-03-27 | `App.js` | `deleteInventoryItem` only checked `t.itemName`, missed secondary items | Fixed: checks all `items[]` entries using `normItem()` comparison |
| 2026-03-27 | `App.js` | Catalog rename did not cascade to transactions | Fixed: Inventory calls `renameInventoryItem()` when catalog item name changes |
| 2026-03-27 | `App.js` | `handleImport` didn't run migrations on imported data | Fixed: writes to localStorage then re-reads via `loadData()` |
| 2026-03-27 | `stockUtils.js` | Unit hardcoded as "karung" in stock computations | Fixed: uses actual `stockUnit` from each transaction |
| 2026-03-27 | `Contacts.js` | `handleSave` allowed duplicate contact names | Fixed: inline `nameError` + case-insensitive check |
| 2026-03-27 | `Settings.js` | CSV export filename used hardcoded `"today"` string | Fixed: uses `today()` function |
| 2026-03-27 | `App.js` | `editLog[].prev` stored full deep copy (~60 KB per tx) | Fixed: now stores slim snapshot (10 key fields only) |
| 2026-03-27 | `TransactionForm.js` | Multi-item stock warning only checked first item | Fixed: collects ALL negative items into `negItems[]` array |
| 2026-03-27 | `storage.js` | v5 dueDate migration hardcoded `14` days | Fixed: uses `t.customDueDays ?? 14` |
| 2026-03-27 | `App.js` | `updateContact` didn't block rename if new name matched another contact | Fixed: added case-insensitive duplicate check; returns `d` unchanged |
| 2026-03-27 | `Inventory.js` | Week-start used `getDay()` (Sunday=0) not Monday=0 | Fixed: `(getDay() + 6) % 7` |
| 2026-03-27 | All modals | Escape key missing from all modals | Fixed: `useEffect` + `keydown` listener added to every modal |
| 2026-03-27 | `SuratJalanModal.js` | Used `it.stockUnit` (item-level field, doesn't exist) | Fixed: changed to `t.stockUnit` (transaction-level) |
| 2026-03-27 | All forms | Forms could be double-submitted | Fixed: `submitting` state guard on all form submit handlers |
| 2026-03-27 | All forms | Inline field validation missing | Fixed: `fieldErrors` / `nameError` / `bizErrors` states with `.form-input--error` / `.field-error` CSS |
| 2026-03-28 | `SaveIndicator.js` | Only showed saved state, no timestamp | Fixed: internal `lastSavedTime` state + `.save-indicator__time` CSS |
| 2026-03-28 | `styles.css` | `.inventory-group-header` rows flickered on hover (`.data-table tbody tr:hover` applied) | Fixed: added `.inventory-group-header:hover` override locking background to `#1e3a5f` |
| 2026-03-28 | `TransactionForm.js` | Client dropdown opened automatically on form mount (programmatic auto-focus triggered `onFocus` → `setCpOpen(true)`) | Fixed: `skipNextFocusOpen` ref skips the first programmatic focus event |
| 2026-03-28 | `StockReportModal.js` | "Tampilkan stok kosong" toggle didn't show items absent from `effectiveStockMap` | Fixed: reordered null-check so items with no stockMap entry pass through when toggle is ON; renders qty=0 |
| 2026-03-28 | `CategoryModal.js` | Phantom/deleted category items displayed as raw lowercase keys (e.g. "bawang aloy") | Fixed: `getDisplayName` fallback now calls `normalizeTitleCase(normName)` instead of returning the raw key |
| 2026-03-28 | `Inventory.js` | Catalog base items with 0 stock landed in "LAINNYA — UNC" instead of their category | Fixed: `tableGroups` useMemo has a groupName-prefix fallback after `getCategoryForItem` returns null; longest-match wins |
| 2026-03-29 | `Inventory.js` | PERIODE quick-select buttons in stock ledger had no active state | Fixed: computed `activePeriod` from `ledgerDateFrom`/`ledgerDateTo` state; active button gets `btn-primary`, others `btn-outline` |
| 2026-03-29 | `CategoryModal.js` | Creating a group with a duplicate name was allowed | Fixed: `commitName` validates against existing names via `normItem()`; stays in edit mode on duplicate and shows error tooltip |
| 2026-03-29 | `CategoryModal.js` | Manual code edits on parent groups didn't cascade to child groups | Fixed: `commitCode` finds child groups by name-prefix match and recomputes their codes as `parentCode + suffix`; removes children from `codeManuallyEdited` set |

---

## 13. Tech Debt & Quirks

**InvoiceModal is 100% inline-styled** (the `s` object). Intentional for `outerHTML` capture, but means print CSS overrides require `!important` to beat inline style specificity. The `data-invoice-doc` attribute + `.inv-sig`/`.inv-spacer` classes are the targeted workaround.

**ReportModal uses `window.print()` directly**, not `printWithPortal`. Its print styles live in the original `@media print` block in `styles.css`. It was not migrated to the portal approach. If migrating it, the `@media print` block in styles.css would need to be removed/scoped.

**SuratJalanModal is Penjualan-only.** `onSuratJalan` is only passed in App.js for Penjualan, not Pembelian.

**`balanceUtils.js` is separate from `stockUtils.js`** even though both are imported together in App.js. `computeARandAP` lives in `balanceUtils.js`.

**No explicit v4 or v5 migration version checks** in `migrateData()`. The dueDate recomputation runs inline as part of the main v1–v6 transaction loop. Effective regardless.

**`.contacts-history-table .row-alt td { background: #fff }`** scoped override neutralises the global `.data-table .row-alt` for contacts only.

**`stockAdjustments` array introduced in v8** with no actual data migration — a guard sets `stockAdjustments: []` if undefined on existing installations.

**`paymentHistory[].method` is always `null`.** Payment method (cash/transfer) was designed into the data model but never implemented in any UI.

**`transaction.orderNum`** field exists on all transactions but does not appear in any UI column, table, or form. Unused legacy field — safe to ignore or repurpose.

**`deleteStockAdjustment(adjustmentId)`** expects the `id` string, not the full adjustment object.

**`Contacts.onAddContact`** is passed as an inline function in App.js render (`(c) => update(...)`) rather than a named handler. Minor inconsistency — does not affect functionality.

**Inventory.js is the largest file (~1540 lines).** Now uses a table layout with category group headers instead of the old catalog item cards. Contains stock ledger panel, catalog management, adjustment form, rename/delete flows, category grouping, CSV export all in one component. Several state variables from the old card layout (`addSubtypeTarget`, `addSubtypeInput`, `addSubtypeError`, `handleAddSubtype`, `stockColor`) are still declared but unused — they produce ESLint warnings on every build. Consider cleaning these up or extracting the stock ledger panel into a separate component when adding the next major feature.

**itemCatalog vs itemCategories coexistence.** Two separate systems:
- `itemCategories[]` — display grouping for StockReportModal and CategoryModal
- `itemCatalog[]` — item selection source for TransactionForm dropdowns
They serve different purposes and are managed independently. Catalog renames do NOT cascade to transactions automatically — must call `renameInventoryItem()` separately. The v13/v14 migration auto-populates catalog from categories but they are not kept in sync after that.

**Free-text fallback in TransactionForm.** When editing a transaction whose item no longer exists in the current catalog, `mapItemFromCatalog()` returns with an empty `catalogItemId`. The form shows the raw item name in the text input, allowing edit without data loss. The user can type to match an existing catalog entry or type a new name (which will prompt to add it to the catalog on save).

**Invoice catatan is ephemeral.** The notes (`catatan`) field in InvoiceModal exists only in local modal state — not saved to transaction data. This is a deliberate product decision: notes are entered at print time only.

**localStorage data is unencrypted.** All application data (transactions, contacts, financial records, bank account details) is stored as plain JSON in localStorage. Acceptable for current use case (personal device, family business) but not suitable for shared or public computers.
