# BukuKas — Developer Handoff

Digital bookkeeping for a small Indonesian family business (agricultural commodity trading).

**Stack:** React 19.2.4, react-scripts 5.0.1. No router. Supabase backend (USE_SUPABASE=true).
**UI Language:** Indonesian (all labels, toasts, status strings).
**Schema version:** NORM_VERSION = 18 (in `src/utils/storage.js`).
**Storage key:** `"bukukas_data_v2"` (`STORAGE_KEY` in `storage.js`) — used only for import/export; live data is in Supabase.
**Print portal:** `<div id="print-portal">` in `public/index.html` — used by `printWithPortal()`.

---

## 1. How to Run

```bash
npm install
npm start        # dev server at http://localhost:3000
npm run build    # production build
```

---

## 2. File Structure with Line Counts

```
src/
  App.js                          1623  Root component — all state, all handlers, nav, Supabase integration
  styles.css                      3051  All styling (BEM-inspired, no CSS modules)
  index.js                              React root render

  utils/
    storage.js                     406  loadData, saveData, defaultData, NORM_VERSION, migrateData
    idGenerators.js                171  generateId, fmtIDR, today, addDays, diffDays, nowTime,
                                        fmtDate, normItem, normalizeTitleCase, generateTxnId,
                                        toCommaDisplay, numToDisplay, displayToNum
    statusUtils.js                  54  STATUS constants, deriveStatus, isUnpaid, LEGACY_STATUS_MAP
    categoryUtils.js               315  generateCode, generateCodes, autoDetectCategories, getCategoryForItem
    paymentUtils.js                 20  computePaymentProgress
    balanceUtils.js                 72  computeARandAP, computeCashIncome, computeCashExpense, computeNetCash
    printUtils.js                   47  printWithPortal, escapeHtml
    stockUtils.js                  114  computeStockMap, computeStockMapForDate
    textFormatter.js               387  ASCII dot matrix layout engine (formatInvoice, formatSuratJalan, wrapText)
    AuthContext.js                 103  AuthProvider, useAuth — session state, signIn (with login audit log), signOut
    supabaseClient.js               19  Creates Supabase client (anon key only, env var validated)
    supabaseStorage.js             ~600  Full Supabase field mapping, save/load/delete helpers, saveActivityLog, loadActivityLog
    storageConfig.js                ~30  USE_SUPABASE flag
    realtimeManager.js             ~100  subscribeToChanges, subscribeToPresence (Phase 5)
    conflictDetector.js             ~86  ConflictError class, checkVersion (Phase 5)

  pages/
    Penjualan.js                    18  Income page — thin wrapper: TransactionPage type="income"
    Pembelian.js                    18  Expense page — thin wrapper: TransactionPage type="expense"
    Inventory.js                  1665  Stock inventory with catalog table + ledger
    Contacts.js                    639  Contact list + detail panel + transaction history
    Reports.js                     504  Date-range financial report + CSV/JSON export
    Outstanding.js                 557  AR/AP outstanding transactions view
    Settings.js                    554  Business settings + JSON/CSV backup/restore + printer type toggle
    ArchivedItems.js               286  Archived catalog items — restore or delete
    ArchivedContacts.js            222  Archived contacts — restore or delete
    ActivityLog.js                 312  Audit trail viewer — Pemilik-only, reads activity_log table

  components/
    TransactionPage.js             652  Shared base: Penjualan + Pembelian day-view
    TransactionForm.js            1430  Full transaction input form (multi-item, catalog autocomplete)
    PaymentHistoryPanel.js         290  Expandable payment timeline
    PaymentUpdateModal.js          183  Record payment modal
    DeleteConfirmModal.js          105  Dual-mode (transaction/contact) delete confirm
    InvoiceModal.js                337  Printable A4 invoice
    SuratJalanModal.js             289  Printable A4 delivery note
    DotMatrixPrintModal.js         122  Dot matrix preview + print modal (invoice & surat jalan)
    ReportModal.js                 312  Printable A4 report modal (opened from Reports page)
    StockWarningModal.js            77  Negative-stock warning
    CategoryModal.js               488  Category management with drag-and-drop
    StockReportModal.js            330  Printable stock report
    Badge.js                       113  StatusBadge, TypeBadge (named exports)
    DueBadge.js                     32  Due date status badge
    MultiSelect.js                 151  Zero-dep multi-select dropdown
    RupiahInput.js                 107  Comma-formatted Rupiah currency input
    SaveIndicator.js                41  "Tersimpan ✓ · HH:MM" / "Menyimpan..." indicator
    StockChip.js                    25  Coloured stock qty pill
    Toast.js                        50  Auto-dismissing 3-second notification
    Icon.js                         72  Inline SVG icon system
    ConflictModal.js                63  Non-blocking conflict warning, 8s auto-dismiss (Phase 5)
    SaveErrorModal.js               91  Blocks UI on Supabase write failure (Phase 4)
```

---

## 3. Data Model

All data lives in a single localStorage key (`"bukukas_data_v2"`). The full object shape:

```json
{
  "transactions":     [],
  "contacts":         [],
  "stockAdjustments": [],
  "itemCategories":   [],
  "itemCatalog":      [],
  "settings": {
    "businessName":             "Usaha Keluarga Saya",
    "address":                  "",
    "phone":                    "",
    "lowStockThreshold":        10,
    "bankAccounts":             [],
    "maxBankAccountsOnInvoice": 1,
    "lastExportDate":           null,
    "defaultDueDateDays":       14,
    "printerType":              "A4"
  },
  "_normVersion": 18
}
```

### Transaction fields
- `id` — timestamp-random string from `generateId()`
- `type` — `"income"` | `"expense"`
- `date` — `"YYYY-MM-DD"` (local timezone)
- `time` — `"HH:MM"`
- `createdAt` — ISO 8601 UTC string
- `orderNum` — legacy, unused in UI
- `counterparty` — title-cased contact name
- `itemName` — title-cased primary item name (mirrors `items[0].itemName`)
- `stockQty` — legacy (use `items[].sackQty`)
- `stockUnit` — unit string at transaction level (e.g. "karung")
- `value` — total transaction value in IDR
- `outstanding` — remaining unpaid amount (0 = fully paid)
- `status` — one of `STATUS.*` constants from statusUtils.js
- `txnId` — `"YY-MM-NNNNN"` for income (auto); supplier invoice no for expense (manual)
- `dueDate` — `"YYYY-MM-DD"` or `null` (null when fully paid)
- `customDueDays` — days until due, set at creation
- `notes` — free-text field
- `items[]` — multi-item line items: `{ itemName, sackQty, weightKg, pricePerKg, subtotal }`
- `paymentHistory[]` — append-only: `{ id, paidAt, date, time, amount, outstandingBefore, outstandingAfter, note, method }`
- `editLog[]` — capped at 20: `{ at, prev: { 11-field slim snapshot } }`

### Contact fields
- `id`, `name`, `email`, `phone`, `address`, `archived` (boolean, v16)

### Item Catalog fields
- `id`, `name`, `defaultUnit`, `subtypes[]`, `archived` (boolean, v15), `archivedSubtypes[]` (v15)
- Full item name = `name` or `name + " " + subtype`

### Stock Adjustment fields
- `id`, `itemName`, `date`, `time`, `adjustmentQty`, `reason`, `unit`, `adjustedBy` (v11, nullable)

### Item Category fields
- `id`, `groupName`, `code`, `items[]` — `items[]` contains normalized (lowercase) item names

### Bank Account fields (in settings.bankAccounts[])
- `id`, `bankName`, `accountNumber`, `accountName`, `showOnInvoice`

---

## 4. Migrations (migrateData in storage.js)

Runs on every `loadData()`. Skipped when `_normVersion >= NORM_VERSION`. Applies all transforms unconditionally (idempotent).

| Version | What it does |
|---------|-------------|
| v1 | Title-case all `itemName`, `counterparty`, `contact.name` |
| v2 | Backfill `createdAt` from `date+time` or `new Date()` |
| v3 | Migrate legacy status strings (`LEGACY_STATUS_MAP`) to `STATUS.*` values |
| v4 | Backfill missing `dueDate` from `date + customDueDays` |
| v5 | Recompute ALL dueDates using UTC-correct `addDays` (`T00:00:00Z`) — fixes off-by-1 in UTC+ zones. Uses `t.customDueDays ?? 14`. |
| v6 | Wrap single-item transactions into `items[]` array for multi-item support |
| v7 | Migrate flat `bankName`/`bankAccount`/`bankAccountName` fields to `bankAccounts[]` array |
| v8 | Add `stockAdjustments: []` top-level array (defaultData shallow-merge handles it, no code needed) |
| v9 | Backfill `paymentHistory[]` for all existing transactions |
| v10 | (a) Fix `paymentHistory[0].amount=0` where `(value-outstanding)>0`; (b) Backfill `time` field on all paymentHistory entries |
| v11 | Backfill `time` and `adjustedBy` fields on all `stockAdjustments` |
| v12 | Add `itemCategories: []` top-level array (defaultData shallow-merge handles it) |
| v13 | Auto-populate `itemCatalog` from `itemCategories + transactions` (only when catalog was empty) |
| v14 | Backfill items from transactions/adjustments not covered by v13 catalog (catches items in categories under a different prefix) |
| v15 | Add `archived: false` and `archivedSubtypes: []` fields to all catalog items |
| v16 | Add `archived: false` field to all contacts |
| v17 | Deduplicate `itemCatalog` by normalized name — merges subtypes and archivedSubtypes from duplicates into first entry |
| v18 | Add `printerType: "A4"` to settings (for dot matrix printer support) |

---

## 5. App.js — Complete Reference

### useState
```js
// Data + persistence
const [data,                  setData]                  = useState(loadData);
const [saved,                 setSaved]                 = useState(true);
const [saveError,             setSaveError]             = useState(false);
const [saveErrorModal,        setSaveErrorModal]        = useState(null);  // { message, retryFn } | null — Supabase errors
const [appLoading,            setAppLoading]            = useState(USE_SUPABASE);  // true while loading from Supabase

// Auth (Supabase)
// user, profile, session come from useAuth() — not useState in App.js

// Navigation
const [page,                  setPage]                  = useState("penjualan");
const [sidebarOpen,           setSidebarOpen]           = useState(() => window.innerWidth > 1024);

// Cross-page navigation state
const [reportItemFilter,      setReportItemFilter]      = useState(null);   // item name pre-filter from Inventory "Lihat"
const [outstandingHighlight,  setOutstandingHighlight]  = useState(null);   // tx ID array to highlight on Outstanding page
const [txPageHighlight,       setTxPageHighlight]       = useState(null);   // { txId, date } — highlight a tx on Penjualan/Pembelian from ActivityLog "Lihat"
const [reportState,           setReportState]           = useState(null);   // { transactions, dateFrom, dateTo } — opens ReportModal

// UI state
const [backupBannerDismissed, setBackupBannerDismissed] = useState(false);
const [editTx,                setEditTx]                = useState(null);   // opens EditModal
const [invoiceTxs,            setInvoiceTxs]            = useState(null);   // opens InvoiceModal (A4)
const [suratJalanTx,          setSuratJalanTx]          = useState(null);   // opens SuratJalanModal (A4)
const [showStockReport,       setShowStockReport]       = useState(false);
const [dotMatrixData,         setDotMatrixData]         = useState(null);   // { transaction, mode } — opens DotMatrixPrintModal

// Conflict detection (Phase 5)
const [conflictUpdatedBy,     setConflictUpdatedBy]     = useState(null);
const [showConflictModal,     setShowConflictModal]     = useState(false);
```

### useRef
```js
const saveTimer = useRef();  // debounce timer handle for persist()
```

### useMemo
```js
const stockMap        // computeStockMap(data.transactions, data.stockAdjustments)
const { ar, ap }      // computeARandAP(data.transactions)
const alertCount      // negative + low-stock items from stockMap
const { penjualanBadge, pembelianBadge, outstandingBadge }  // near-due badge counts (≤3 days)
const balanceMap      // per-contact { totalIncome, totalExpense, ar, ap, netOut, txs }
```

### useEffect
```js
// beforeunload guard — warns if unsaved during 500ms debounce
// resize handler — auto-collapse sidebar when window.innerWidth <= 1024
```

### Core helpers
```js
const persist = useCallback(...)   // debounced 500ms localStorage write; sets saved/saveError
const retrySave = useCallback(...)  // immediate retry write
const update = (fn) => setData(...)  // ALL mutations go through this
const normTx = (t) => ...           // title-cases itemName + counterparty before save
const ensureContact = (cp, contacts) => ...  // auto-creates contact for new counterparty
```

### Print routing handlers (v18)
```js
const handleInvoice = (txOrArray) => {
  // Checks data.settings.printerType
  // "Dot Matrix" → setDotMatrixData({ transaction: txOrArray, mode: "invoice" })
  // "A4" → setInvoiceTxs(txOrArray)
};

const handleSuratJalan = (tx) => {
  // Checks data.settings.printerType
  // "Dot Matrix" → setDotMatrixData({ transaction: tx, mode: "suratJalan" })
  // "A4" → setSuratJalanTx(tx)
};
```

These wrappers are passed as `onInvoice` and `onSuratJalan` props to all pages. No useCallback — matches existing handler pattern.

### Navigation helpers
```js
const handleViewItem = (itemName) => { setReportItemFilter(itemName); setPage("reports"); };
const navigateToOutstanding = (txIds) => { setOutstandingHighlight(txIds); setPage("outstanding"); };
// onViewTransaction (inline in ActivityLog JSX):
//   Finds tx by txnId or internal id; sets txPageHighlight({ txId: tx.id, date: tx.date });
//   then setPage("penjualan" or "pembelian").
```

### Audit log helper
```js
const logActivity = useCallback((action, entityType, entityId, changes = {}) => {
  // Non-blocking — .catch() swallows all errors, never triggers SaveErrorModal
  // user_name from profile?.full_name || user.email
  // entityId must be the computed txnId (from newTx/updated), NOT nt.txnId (which is undefined for new income txs)
}, [user, profile]);
```

### Handlers
```
addTransaction, editTransaction, deleteTransaction, applyPayment,
createContact, archiveContact, unarchiveContact, deleteContact, updateContact,
handleImport, addStockAdjustment, deleteStockAdjustment, updateItemCategories,
addCatalogItem, updateCatalogItem, deleteCatalogItem,
archiveCatalogItem, unarchiveCatalogItem, archiveSubtype, unarchiveSubtype,
renameInventoryItem, deleteInventoryItem, handleViewItem, navigateToOutstanding, quickExport
```

### JSX render tree
```
<div className="app-shell">
  <aside className="sidebar">
    sidebar__logo, sidebar__meta, sidebar__ar-ap, sidebar__nav (navItems), sidebar__foot
  </aside>
  <main className="main-content">
    {saveError && <SaveErrorBanner>}
    {showBackupWarning && !backupBannerDismissed && <BackupBanner>}
    {page === "penjualan"        && <Penjualan ...>}
    {page === "pembelian"        && <Pembelian ...>}
    {page === "inventory"        && <Inventory ...>}
    {page === "archivedItems"    && <ArchivedItems ...>}
    {page === "contacts"         && <Contacts ...>}
    {page === "archivedContacts" && <ArchivedContacts ...>}
    {page === "activityLog"      && profile?.role === "owner" && <ActivityLog ...>}
    {page === "reports"          && <Reports ...>}
    {page === "outstanding"      && <Outstanding ...>}
    {page === "settings"         && <Settings ...>}
  </main>
  {editTx       && <EditModal ...>}
  {invoiceTxs   && <InvoiceModal ...>}
  {suratJalanTx && <SuratJalanModal ...>}
  {reportState  && <ReportModal ...>}
  {showStockReport && <StockReportModal ...>}
  {dotMatrixData && <DotMatrixPrintModal ...>}
</div>
```

`EditModal` is a local function component defined inside App.js (not exported). It wraps `TransactionForm` in a modal overlay and computes `adjustedStockMap` to exclude the current transaction's stock contribution before stock-warning validation.

---

## 6. Utilities

### src/utils/idGenerators.js
| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `generateId()` | `()` | `string` | `"timestamp-randomhex"` |
| `fmtIDR(n)` | `(n: number)` | `string` | `"Rp 5.215.000"` using id-ID locale |
| `today()` | `()` | `string` | `"YYYY-MM-DD"` **LOCAL** timezone |
| `addDays(dateStr, days)` | `(string, number)` | `string\|null` | **UTC** arithmetic. Returns null on invalid input. |
| `diffDays(date1Str, date2Str)` | `(string, string)` | `number\|null` | Positive = date2 in future. UTC. |
| `nowTime()` | `()` | `string` | `"HH:MM"` current local time |
| `fmtDate(d)` | `(string\|falsy)` | `string` | `"15 Mar 2026"` or `"-"` |
| `normItem(s)` | `(string\|falsy)` | `string` | Trimmed lowercase. Use as map key only, never display. |
| `normalizeTitleCase(s)` | `(string\|falsy)` | `string` | Title-cased. PT/CV/UD/TB uppercased. |
| `generateTxnId(transactions, dateStr)` | `(Array, string)` | `string` | `"YY-MM-NNNNN"`. Filters to income only. |
| `toCommaDisplay(digits)` | `(string)` | `string` | `"5,000,000"` — internal to RupiahInput |
| `numToDisplay(n)` | `(number)` | `string` | `"5,000,000"` — internal to RupiahInput |
| `displayToNum(s)` | `(string)` | `number` | `5000000` — internal to RupiahInput |

### src/utils/statusUtils.js
| Export | Description |
|--------|-------------|
| `STATUS` | `{ LUNAS, PARTIAL_INCOME, PARTIAL_EXPENSE }` — use these, never raw strings |
| `deriveStatus(type, isPartial)` | Returns the correct STATUS.* for a transaction |
| `isUnpaid(status)` | Returns boolean — true for PARTIAL_INCOME or PARTIAL_EXPENSE |
| `LEGACY_STATUS_MAP` | Used ONLY inside storage.js migrateData() |

### src/utils/balanceUtils.js
| Function | Returns |
|----------|---------|
| `computeARandAP(transactions)` | `{ ar, ap }` — outstanding amounts only |
| `computeCashIncome(transactions)` | `number` — sum of (value − outstanding) for income |
| `computeCashExpense(transactions)` | `number` — sum of (value − outstanding) for expense |
| `computeNetCash(transactions)` | `number` — cashIncome − cashExpense |

### src/utils/stockUtils.js
| Function | Returns |
|----------|---------|
| `computeStockMap(transactions, stockAdjustments)` | `{ [normName]: { displayName, qty, unit, lastDate, lastTime, txCount } }` |
| `computeStockMapForDate(transactions, viewDate, stockAdjustments)` | Same shape, filtered to date ≤ viewDate |

Stock rules: expense = `+qty` (purchase adds stock), income = `−qty` (sale removes stock).
Always pass BOTH arguments — never omit `stockAdjustments`.

### src/utils/categoryUtils.js
| Function | Notes |
|----------|-------|
| `generateCode(groupName)` | Single group — no parent-child awareness |
| `generateCodes(groupNames[])` | All groups together — parent-child aware codes |
| `autoDetectCategories(stockMap, existingCategories)` | Groups uncategorized items by shared 2-word prefix |
| `getCategoryForItem(normName, categories)` | Returns category object or null |

### src/utils/paymentUtils.js
`computePaymentProgress(value, outstanding)` → `{ percent }` or `null` if value=0.

### src/utils/printUtils.js
| Export | Description |
|--------|-------------|
| `printWithPortal(htmlString)` | Injects into `#print-portal`, adds `print-portal-active` class to body, calls `window.print()` synchronously, cleans up in `finally{}`. |
| `escapeHtml(str)` | Escapes `&`, `<`, `>`, `"`, `'` for safe insertion into raw HTML template literals outside React. **Not** for JSX text nodes (React escapes those automatically — applying escapeHtml to JSX would cause double-encoding). |

### src/utils/textFormatter.js (NEW — v18)
ASCII layout engine for dot matrix printing. Pure functions, no React, no DOM.

**Exports:**
| Function | Signature | Returns |
|----------|-----------|---------|
| `formatInvoice(transactions, settings, options)` | `(Array, Object, Object?)` | `string` — full 80-column ASCII invoice |
| `formatSuratJalan(transaction, settings, options)` | `(Object, Object, Object?)` | `string` — full 80-column ASCII surat jalan |

**Options objects:**
- `formatInvoice` options: `{ note: string }` — appended as "Catatan Invoice:" in footer
- `formatSuratJalan` options: `{ platNomor: string, catatanPengiriman: string }` — plate number in meta, delivery note in footer

**Internal helpers:** `padRight`, `padLeft`, `centerText`, `fmtNum`, `fmtRp`, `getItemsArray`, `wrapText`

**`wrapText(str, width)`:** Word-boundary wrapping that returns an array of strings each ≤ width chars. Hard-truncates a single word that alone exceeds the width. Used by `formatItemsTable` and `formatSuratJalanItems` for long item names via `flatMap`.

**Invoice column widths (total = 80):**
No(3) + `" | "` + Barang(24) + `" | "` + Krg(6) + `" | "` + Berat(9) + `" | "` + Harga/Kg(10) + `" | "` + Subtotal(13)

**Surat Jalan column widths (total = 80):**
No(3) + `" | "` + Barang(50) + `" | "` + Jumlah(8) + `" | "` + Satuan(10)

**Invoice layout sections:** `formatInvoiceHeader(settings)` → `formatInvoiceMeta(transactions)` → `formatItemsTable(transactions)` → `formatInvoiceFooter(transactions, settings)`

**Surat Jalan layout sections:** `formatSuratJalanHeader(settings)` → `formatSuratJalanMeta(transaction)` → `formatSuratJalanItems(transaction)` → `formatSuratJalanFooter()`

Uses `fmtDate()` from idGenerators for consistent date formatting. Flattens all transactions' items into one invoice (matching InvoiceModal's flatMap behavior).

---

## 7. Pages

### Penjualan.js / Pembelian.js
Thin wrappers — just pass props to `TransactionPage` with `type`, `title`, `accentColor`.

### components/TransactionPage.js (shared base for both)
**Props:**
```
type, title, accentColor,
transactions, contacts, stockMap, threshold, defaultDueDateDays,
onAdd, onEdit, onDelete, onInvoice, onMarkPaid, onCreateContact,
onSuratJalan?,          (income only — Penjualan passes this, Pembelian does not)
onNavigateOutstanding?,
saved, itemCatalog,
onAddCatalogItem, onUpdateCatalogItem, onUnarchiveCatalogItem, onUnarchiveSubtype, onUnarchiveContact,
initViewDate?,          (string YYYY-MM-DD — sets viewDate on mount/change; from App.js txPageHighlight)
highlightTxIds?,        (string[] — tx internal IDs to flash; from App.js txPageHighlight)
onClearHighlight?       (callback — called when flash clears; resets txPageHighlight to null)
```

**Local state:**
```
showForm, search, searchCategory ("invoiceNo"|"itemName"|"klien"), sortBy,
stockWarn, deleteTx, paidTx, toast, viewDate, overdueDismissed, dueSoonDismissed, expandedTxId,
flashIds (Set)          — IDs currently highlighted; synced from highlightTxIds prop
```

**Key useMemos:** `filtered` — transactions of correct type for viewDate, filtered by search, sorted.

**Behaviors:**
- Day navigation: prev/next date buttons + date picker, defaults to today
- 3-part search bar: category dropdown + text input + sort select
- Payment progress bar in Nilai cell for all payment states
- `[🕐]` history button with red badge when `paymentHistory.length > 1`
- `expandedTxId` — only one PaymentHistoryPanel open at a time
- Overdue and near-due banners (each dismissible per session)
- **External navigation highlight:** When `initViewDate` changes, `viewDate` is synced via `useEffect`. When `highlightTxIds` changes, `flashIds` is populated. Highlighted rows get `.tx-row--flash` (blue, 3s CSS fade-out animation). First highlighted row is scrolled into view (50ms setTimeout). Flash cleared on first user interaction (click/keydown/scroll) after 500ms debounce — same pattern as `Outstanding.js`.

### pages/Inventory.js
**Props:**
```
stockMap, threshold, onViewItem, onAddAdjustment,
onRenameItem?, onDeleteItem?, onDeleteAdjustment?,
itemCategories?, onUpdateCategories?,
transactions?, stockAdjustments?,
onStockReport?,
itemCatalog?, onAddCatalogItem?, onUpdateCatalogItem?, onDeleteCatalogItem?,
onArchiveCatalogItem?, onUnarchiveCatalogItem?, onArchiveSubtype?, onUnarchiveSubtype?,
onNavigateToArchive?
```

**Layout:** Table grouped by category. Group header rows (dark navy). Base item rows + indented subtype rows. "LAINNYA — UNC" group catches uncataloged items. Items with 0 stock still show if in catalog.

**Key local state:** `search`, `sortBy`, `sortDir`, `inventoryDate`, `showCategoryModal`, `expandedStockItem`, `ledgerTypeFilter`, `ledgerDateFrom`, `ledgerDateTo`, `adjDeleteConfirm`, plus adjustment/rename/delete/catalog modal states.

**Key useMemos:**
- `activeStockMap` — `stockMap` (today) or `computeStockMapForDate(...)` for historical dates
- `tableGroups` — flat rows from catalog + uncataloged, grouped, with groupName-prefix fallback for zero-stock items

**Ledger:** Expandable per-item panel with transaction history, running totals, date filter, type filter, PERIODE quick-select (Hari Ini / Minggu Ini / Bulan Ini / Semua) with active state.

### pages/Contacts.js
**Props:** `contacts, transactions, balanceMap, onAddContact, onUpdateContact, onDeleteContact, onArchiveContact?, onUnarchiveContact?, onNavigateToArchive?, onDeleteTransaction?, onEditTransaction?, onMarkPaid?`

**Layout:** Left panel (contact list with A–Z alpha filter) + right panel (detail card with AR/AP, transaction history).

**Key behaviors:**
- `txCountMap` useMemo determines whether to offer Archive vs Delete
- `nameError` inline validation for duplicate names before save
- `submitting` debounce guard on save

### pages/Reports.js
**Props:** `transactions, contacts, settings, onReport?, initItemFilter?, onClearItemFilter?`
Note: `onInvoice` prop is not used in the current code (was removed). `onReport` triggers ReportModal via App.js.

**Key state:** `dateFrom`, `dateTo`, `selectedClients`, `selectedItems`, `period`, `toast`, `confirmCount`, `exportFormat`

**Export:** Can export JSON (raw localStorage) or CSV. CSV format has 14 columns. JSON export tracks `lastExportDate` in settings.

**Internal:** `getMultiItemContribution(t, selItems)` — computes item breakdown for multi-item transactions when item filter active.

### pages/Outstanding.js
**Props:** `transactions, onEdit, onMarkPaid, onDelete, onInvoice, highlightTxIds?, onClearHighlight?`

**Layout:** Two `OutstandingTable` sections (Piutang / Hutang). Each section paginated 50/page.

**Highlight behavior:** `OutstandingTable` receives `flashIds` (Set — derived from parent's `highlightTxIds` array). Each row also computes a permanent class from `dueDate`: `.outstanding-row--overdue` (past due) or `.outstanding-row--near-due` (≤3 days). Flash rows additionally get `.outstanding-row--flash` (blue). Flash is cleared on first user interaction (click/keydown/scroll) after a 500ms debounce. First flash row is scrolled into view (50ms setTimeout after render).

**Sort options:** Jatuh Tempo Terdekat / Terjauh / Outstanding Terkecil / Terbesar. Null dueDates sort to end.

### pages/Settings.js
**Props:** `settings, transactions, onSave, onImport`

**Features:** Business info, bank accounts CRUD, due-date defaults, low-stock threshold, **printer type toggle (A4 / Dot Matrix)**, JSON backup export, CSV export (14-column), JSON import.

**Key state:** `form, flash, submitting, importMsg, exportFormat, bizErrors, dueDaysStr, lowStockStr, maxBankStr`

The `form` state includes `printerType` (initialized from `settings.printerType || "A4"`). The "Format Cetak" section uses `.filter-btn` / `.filter-btn--active` toggle buttons. `onSave(form)` persists the full form including `printerType`.

**CSV export:** 14-column format: Tanggal, Waktu, No. Invoice, Klien, Jenis, Barang, Karung, Berat (Kg), Harga/Kg, Subtotal, Nilai Total, Status, Sisa Tagihan, Jatuh Tempo. Expands `items[]` into separate rows. Includes BOM (`\uFEFF`) for Excel compatibility.

### pages/ActivityLog.js (Pemilik-only)
**Props:** `currentUser, profile, onLoadLog, onBack, onViewTransaction?`

**Access guard:** Renders "Akses ditolak" message when `profile?.role !== "owner"`. Also gated in App.js nav items and in the JSX render condition.

**Filter bar:** Aksi (select), Entitas (select), Dari tanggal, Sampai tanggal, Reset Filter button. All filters trigger `loadLogs()` via `useCallback` deps.

**Table columns:** Waktu (timestamp), Pengguna (user_name), Aksi (color-coded badge), Entitas (type + id), Detail (formatted changes), Lihat button.

**Action badge colors:**
| Action | Color |
|--------|-------|
| `create` | Green `#10b981` |
| `edit` | Amber `#f59e0b` |
| `delete` | Red `#ef4444` |
| `payment` | Blue `#007bff` |
| `stock_adjustment` | Indigo `#6366f1` |
| `login`, `export`, `import` | Gray `#6b7280` |

**Entity ID display (`isTxnId` helper):**
- Pattern `/^\d{2}-\d{2}-\d{4,5}$/` — matches txnId format (e.g. `26-04-00023`)
- txnId match → displayed as `#26-04-00023` in indigo bold
- Old internal IDs → displayed as `#90vxehs` (last 6 chars) in gray
- Non-transaction entities → `#xxxxxx` (last 6 chars) in gray

**"Lihat" button:** Shown for `entity_type === "transaction"` and `action !== "delete"`. Calls `onViewTransaction(log.entity_id)`. The App.js handler finds the tx by `txnId` OR internal `id`, sets `txPageHighlight`, then navigates to penjualan/pembelian.

**`formatChanges(changes, entityType)`:** Returns `[{ label, val }]` array for rendering the Detail column. Recognizes: `type`, `items`, `value`, `counterparty`, `amount`, `note`, `name`, `itemName`, `qty`. Returns null for `settings` and `auth` entity types.

### pages/Login.js
**Props:** none (reads `signIn` from `useAuth()`)

**State:** `email`, `password`, `error`, `submitting`, `showPassword`

**Features:**
- Standard email + password form with Indonesian labels
- Password show/hide toggle button (eye icon, `tabIndex=-1`) — toggles `type="password"` / `type="text"`
- Error messages localized to Indonesian ("Email atau kata sandi salah." etc.)
- Submit button disabled while `submitting` or when email/password are empty
- On success: AuthContext updates `user` state; App.js re-renders to main shell automatically

### pages/ArchivedItems.js
**Props:** `itemCatalog, stockMap, transactions, onUnarchiveCatalogItem, onUnarchiveSubtype, onDeleteCatalogItem, onViewItem, onBack`

Shows all archived catalog items and individually archived subtypes. Permanent delete only allowed when `txCountMap[normItem(name)] === 0`.

### pages/ArchivedContacts.js
**Props:** `contacts, transactions, onUnarchiveContact, onDeleteContact, onBack`

Shows only `contacts.filter(c => c.archived)`. Permanent delete blocked when `txCountMap[name.toLowerCase()] > 0`.

---

## 8. Components

### TransactionForm.js
Full transaction input form. Uses smart text inputs (NOT `<select>`) for item selection.

**Item autocomplete system:**
1. **Nama Barang** input: free text, autocomplete against `activeCatalog[].name`
2. **Tipe** input (shown after Nama Barang filled): free text, autocomplete against `matchedCatalog.subtypes[]`
3. Unit auto-fills from `catalogItem.defaultUnit` on catalog match
4. `mapItemFromCatalog(itemName)` — used in edit mode; returns `{ itemNameInput, itemTypeInput, catalogItemId, matchedCatalog }`
5. New item/subtype confirmation dialog (`newItemConfirm` state) before save
6. On confirm: calls `onAddCatalogItem()` or `onUpdateCatalogItem()`

**`activeCatalog`:** Filters out fully-archived items that have no active subtypes. Archived base items with at least one active subtype still appear.

**Duplicate item detection (`checkDuplicate`):** Before each save, scans `items[]` for rows with the same `normItem(name)` + `pricePerKg`. If a duplicate pair is found and neither row has `duplicateConfirmed: true`, shows `duplicateItemConfirm` dialog. User can confirm (rows will be merged) or cancel (to fix manually).

**Merge-on-save (`mergeItems`):** Called in `doSave()` after duplicate confirmation. Groups rows by `normItem(name) + pricePerKg` and sums `sackQty`, `weightKg`, `subtotal`. Merged result replaces the `items[]` before the transaction is saved.

**`blankItem()`:** Each new item row initializes with `duplicateConfirmed: false`.

**Sequential stock deduction:** Each item row in the multi-item form computes `committedQty` — the sum of the same item's qty from all prior rows. This value is used to adjust the "stok saat ini" and "akan dijual" display lines, giving accurate per-row stock feedback during form entry.

**Double-submit guard:** `setSubmitting(true)` is called as the very first line of `handleSubmit`, before validation runs (prevents race on rapid double-click). Each validation early-return path calls `setSubmitting(false)`. `doSave` is wrapped in `try/finally { setSubmitting(false) }`.

**`customDueDays` minimum:** `doSave` enforces `Math.max(1, Number(customDueDays) || 14)` — prevents 0-day due dates.

**Key state:** `form` (all field values), `items[]` (per-row state with `duplicateConfirmed`), `cpOpen`/`cpQuery` (counterparty dropdown), `itemNameOpen`/`itemTypeOpen` (per-row dropdowns), `errors` (per-field), `submitting`, `newItemConfirm`, `duplicateItemConfirm`, `txnIdInput` (expense only), `skipNextFocusOpen` ref.

**Multi-item stock warning:** Collects ALL items that would go negative into `negItems[]`, calls `onStockWarning({ items: negItems, item, current, selling, onConfirm, onCancel: () => setSubmitting(false) })`.

### PaymentHistoryPanel.js
Rendered in a `<tr colSpan={...}>` below a transaction row. Vertical timeline.

System notes ("Pelunasan", etc.) shown as display labels only. User notes shown as "Catatan: [text]". Data lama entries show ⚠ icon. 10+ entries: shows first 3 + expand toggle + last 1. Pending node (dashed amber dot) when `outstanding > 0`.

### PaymentUpdateModal.js
**Props:** `transaction, onConfirm(amount, note), onCancel`
Pre-fills with full outstanding. Shows live preview. Note resets when transaction changes. Auto-focus via setTimeout(50ms) + `querySelector("input")` on ref-div (RupiahInput doesn't forward refs). Always-mounted — guards Escape key with `if (!transaction) return`.

### DeleteConfirmModal.js
**Props:** `transaction?, isContact?, contact?, onConfirm, onCancel`
Always-mounted — guards Escape key with visibility check.

### InvoiceModal.js
**Props:** `transactions, settings, onClose`
Prints via `printWithPortal()`. Bank accounts filtered by `showOnInvoice` + limited by `maxBankAccountsOnInvoice`. Invoice notes (`invoiceNote` state) NOT saved — session-only. Used only when `printerType === "A4"`.

### SuratJalanModal.js
**Props:** `transaction, onClose`
Uses `t.stockUnit` (transaction-level). Inline styles throughout for print portal compatibility. Used only when `printerType === "A4"`.

### DotMatrixPrintModal.js (NEW — v18)
**Props:** `transaction, mode, settings, onClose`
- `mode`: `"invoice"` | `"suratJalan"`
- `transaction`: array when mode is `"invoice"` (matches `invoiceTxs`), single object when mode is `"suratJalan"`

**Local state:** `invoiceNote`, `platNomor`, `catatanPengiriman` — input fields rendered above the preview, conditional on `mode`.

Computes formatted ASCII text via `useMemo` (deps: `transaction, mode, settings, invoiceNote, platNomor, catatanPengiriman`) using `formatInvoice(transaction, settings, { note: invoiceNote })` or `formatSuratJalan(transaction, settings, { platNomor, catatanPengiriman })`. Preview updates live as user types in input fields.

Renders preview in `.dot-matrix-preview` `<pre>` block (monospace, gray background, scrollable). "Konfirmasi Cetak" button manually escapes `&`, `<`, `>` then calls `printWithPortal()` with inline-styled `<pre>` (Courier New, 12pt, line-height 1). "Batal" button and Escape key close the modal. Conditionally mounted — no Escape guard needed.

Note: Uses manual `replace(/&/g, ...)` chain in `handlePrint` rather than `escapeHtml()` from `printUtils.js` — both approaches are equivalent.

### StockWarningModal.js
**Props:** `data: { items[], item?, current?, selling?, onConfirm, onCancel? } | null, onClose`
Multi-item: renders bullet list. Single-item: renders prose. Always-mounted — guards Escape.

### CategoryModal.js
**Props:** `categories, stockMap, onSave, onClose`
On mount: runs `autoDetectCategories()`. HTML5 drag-and-drop: item drag = move, group drag onto group = merge. Duplicate group name validation via `normItem()`. Code edits cascade to children by prefix match. Escape key: no guard (conditionally mounted).

### StockReportModal.js
**Props:** `stockMap, categories, settings, transactions, stockAdjustments, onClose`
Date picker for historical snapshots. Toggle for zero-stock items. Guard: renders null if stockMap falsy. Escape key: no guard (conditionally mounted).

### Badge.js
- `StatusBadge({ status })` — colored pill. Valid: `STATUS.LUNAS` (green), `STATUS.PARTIAL_INCOME` (amber), `STATUS.PARTIAL_EXPENSE` (red). Also handles legacy v1/v2 strings.
- `TypeBadge({ type })` — "Penjualan" (green) or "Pembelian" (red).
- Default export is `StatusBadge`.

### DueBadge.js
**Props:** `dueDate?, outstanding?`
Renders `—` when outstanding ≤ 0. Shows days remaining, "Hari Ini", or overdue in red.

### MultiSelect.js
**Props:** `options[], selected[], onChange, placeholder?`
Zero-dependency multi-select with search + select-all. Used by Reports.js for client/item filters.

### RupiahInput.js
**Props:** `value, onChange(numericValue), hasError?, placeholder?`
Displays comma-formatted input, stores integer. Does NOT forward refs — use ref on a wrapping div.

### SaveIndicator.js
**Props:** `saved: boolean`
Tracks `false → true` transition internally. Shows "Tersimpan ✓ · HH:MM" when saved. Shows "Menyimpan..." when unsaved.

### StockChip.js
**Props:** `qty, unit, threshold?`
Green (>threshold), amber (0..threshold), red (negative).

### Toast.js
**Props:** `message, type?, onDone?`
Auto-dismisses after 3 seconds. Slide-in animation.

### Icon.js
**Props:** `name, size?, color?`
Inline SVG icons. Valid names: `income, expense, inventory, contacts, reports, warning, settings, menu, plus, edit, trash, invoice, check, clock, search, download, link, upload, eye, adjust, truck, dashboard`

### ConflictModal.js (Phase 5)
**Props:** `conflictUpdatedBy?, showModal: boolean, onClose`
Non-blocking conflict warning — shown when a realtime update from another user conflicts with an in-flight save. 8-second auto-dismiss. Backdrop click and Escape key close it. Conditionally mounted.

### SaveErrorModal.js (Phase 4)
**Props:** `error?, onDismiss?, onRetry?`
Blocks UI when a Supabase write fails. Shows error message with Retry and Dismiss buttons.

### AuthContext.js (src/utils/)
**Exports:** `AuthProvider` (component), `useAuth()` (hook)

**Context value:** `{ user, profile, session, loading, signIn, signOut }`

**`signIn(email, password)`:**
1. Calls `supabase.auth.signInWithPassword`
2. Awaits `fetchProfile(data.user.id)` to get `full_name`
3. Fires non-blocking `saveActivityLog({ user_name: prof?.full_name || email, action: 'login', ... })` — failure never prevents login
4. Returns auth data; AuthContext updates user/profile state automatically via `onAuthStateChange`

**`handleSession`:** Fetches profile, force-signs-out inactive accounts (`is_active === false`).

**`fetchProfile(userId)`:** Queries `profiles` table for `id, email, full_name, role, is_active`.

---

## 9. Print System

BukuKas has two print paths:

### A4 Print Path (Standard)
Used when `settings.printerType === "A4"` (default). All printing goes through `printWithPortal(htmlString)` in `src/utils/printUtils.js`.

1. Sets `innerHTML` of `#print-portal` (in `public/index.html`)
2. Adds `body.print-portal-active` class
3. `@media print` CSS in `styles.css` hides `#root` and shows `#print-portal`
4. `window.print()` (synchronous)
5. Removes class + clears portal in `finally{}`

**Rule:** Print-bound components (InvoiceModal, SuratJalanModal, StockReportModal) must use 100% inline styles on the printable area. Do NOT use CSS classes in the printed content — they won't be available in the portal context.

### Dot Matrix Print Path (v18)
Used when `settings.printerType === "Dot Matrix"`. Optimized for Epson LX-300+II with 9.5×11 NCR paper.

1. `handleInvoice` / `handleSuratJalan` in App.js check `data.settings.printerType`
2. If "Dot Matrix": opens `DotMatrixPrintModal` with preview
3. `textFormatter.js` generates 80-column ASCII text (monospace, pipe-separated columns)
4. User reviews in `<pre>` preview, clicks "Konfirmasi Cetak"
5. Same `printWithPortal()` is called with `<pre>` wrapped in inline styles (Courier New, 12pt, line-height 1)

**Scope:** Invoice (Penjualan + Pembelian) and Surat Jalan only. Reports and stock reports always use A4.

---

## 10. CSS Structure

File: `src/styles.css` — 3051 lines. BEM-inspired kebab-case. No CSS modules.

**Color palette:**
| Role | Value |
|------|-------|
| Primary blue | `#007bff` |
| Dark blue | `#0056b3` |
| Deep navy | `#1e3a5f` |
| Green (income/lunas) | `#10b981` |
| Red (expense/delete) | `#ef4444` |
| Amber (warning/partial) | `#f59e0b` |
| Indigo (invoice no) | `#6366f1` |
| Page background | `#f0f6ff` |
| Card surface | `#fff` |
| Border | `#c7ddf7` |
| Muted text | `#6b7280` |

**Key class families:**
- Layout: `.app-shell`, `.sidebar`, `.main-content`, `.page-header`
- Cards: `.table-card`, `.summary-card`, `.mini-card`
- Buttons: `.btn`, `.btn-sm`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger`, `.action-btn`, `.action-btn--edit`, `.action-btn--delete`, `.action-btn--invoice`, `.action-btn--paid`, `.action-btn--history`
- Table: `.data-table`, `.th-center`, `.th-right`, `.td-center`, `.td-right`, `.row-alt`
- Modals: `.modal-overlay`, `.modal-box`, `.modal-title`, `.modal-body`, `.modal-actions`
- Forms: `.form-input--error`, `.form-select--error`, `.field-error`
- Inventory: `.inventory-group-header` (hover locked to `#1e3a5f` to prevent flicker)
- Dot matrix: `.dot-matrix-preview` (monospace pre block for preview)
- Flash highlight: `.outstanding-row--flash` (static blue `#dbeafe` — Outstanding page); `.tx-row--flash` (animated blue `#bfdbfe` → transparent over 3s — Penjualan/Pembelian "Lihat" navigation from ActivityLog)
- Print: `@media print` section hides `#root`, shows `#print-portal`; `#print-portal pre { page-break-inside: auto; }`

Always search `styles.css` before adding a new class.

---

## 11. Architecture Rules

1. **Import hierarchy:** `pages/` → `components/` → `utils/`. Never import across levels (no `pages/` imports from other `pages/`; no `components/` imports from `pages/`; no `utils/` imports React).
2. **State architecture:** All mutations through `update()` in App.js. Local component state for UI-only (show/hide, search, sort, toast).
3. **Date arithmetic:** Always UTC (`T00:00:00Z` + `setUTCDate`). Today/display: always local (`getFullYear`, `getMonth`, `getDate`).
4. **Division safety:** Always guard `denominator > 0` before dividing.
5. **Modal pattern:** Parent holds `null`-or-data state. Modal renders `null` when data is `null`. Always-mounted modals guard Escape key. Conditionally-mounted modals don't need guard.
6. **Catalog:** `itemCatalog[]` is canonical for item selection. `itemCategories[]` is for grouping/display. They are synced by `addCatalogItem` and `updateCatalogItem`.
7. **Print routing:** `handleInvoice` / `handleSuratJalan` in App.js check `printerType` setting to route to A4 or Dot Matrix modal. Pages never check printer type directly.

---

## 12. Known Issues & Fixed Bugs

See Section 9 of `CLAUDE.md` for full bug fix history.

Key patterns to never reintroduce:
- UTC off-by-1: never use `new Date(dateStr + "T00:00:00")` (no Z) for date arithmetic
- Status strings: never write `"Lunas"` etc. as raw literals — use `deriveStatus()` or `STATUS.*`
- `setData()` outside App.js: never call it directly
- `.push()` on state arrays: never mutate state in place
- `generateTxnId` with expense transactions: filter to income only (function handles this internally)
- `editLog[].prev` as full copy: only store the 11-field slim snapshot
- `deleteInventoryItem` checking only `t.itemName`: must check all `items[]` entries
- `setSubmitting(true)` after validation: always set it as the first line of `handleSubmit` to block rapid double-clicks
- `doSave` without `try/finally`: always wrap save logic so `setSubmitting(false)` runs on any throw
- `customDueDays = 0`: enforce minimum of 1 via `Math.max(1, ...)` in doSave
- `ensureContact` missing `archived: false`: auto-created contacts must include all required fields
- `escapeHtml` applied to JSX text variables: React escapes JSX text automatically; applying `escapeHtml` to JSX variables causes double-encoding. Only use `escapeHtml` in raw HTML template literals (like `printWithPortal` strings).
- Ledger loop breaking on first item match: must accumulate ALL matching item rows in multi-item transactions
- CSV export without BOM: always prepend `\uFEFF` for Excel compatibility with Indonesian characters
- Invoice date from `today()`: always use `transactions[0]?.date` for invoice date
- `logActivity` with `nt.txnId` for income: `txnId` is generated inside `update()` state fn — always use `newTx?.txnId` (for create) or `updated?.txnId || nt.txnId` (for edit) so the generated ID is captured correctly
- ActivityLog entity_id for transactions: use `isTxnId()` pattern check before displaying — old entries have internal IDs, new entries have `YY-MM-NNNNN` format

---

## 13. Tech Debt & Quirks

- `orderNum` field exists on all transactions but is never used in UI. Legacy field.
- `stockQty` top-level field on transactions is legacy — multi-item support uses `items[].sackQty`. Both coexist.
- `TransactionPage.js` lives in `src/components/` not `src/pages/`, despite being a page-level component. This is because both Penjualan and Pembelian import it as a component.
- `fmtDate()` in `idGenerators.js` parses dates as local midnight (`T00:00:00` without Z), which is correct for display purposes but inconsistent with UTC-only addDays/diffDays. A comment in the source explains this intentional exception.
- `balanceMap` in App.js builds its `txs[]` array per-contact using `[...map[key].txs, t]` which creates new array references in a loop — technically O(n²) but acceptable for current data sizes.
- `Reports.js` `onInvoice` prop is not used in the current code (the import reference was removed).
- The sidebar's AR/AP display uses emoji (💚/❤️) for piutang/hutang — not accessible.
- `SuratJalanModal` receives `settings` prop from App.js but the component only destructures `{ transaction, onClose }` — settings are unused internally.
- `Settings.js` and `Reports.js` both have an `exportFormat` local state (JSON/CSV selector) independently — they don't share state.
- `DotMatrixPrintModal` uses a manual `replace()` chain to escape HTML in `handlePrint` rather than importing `escapeHtml` from `printUtils.js` — both are equivalent; no functional difference.
- `M9` (`contactBalance` in TransactionForm recomputed on every render) is still present — acceptable for current data sizes.
- `autoDetectCategories` in `categoryUtils.js` is O(n²) worst case — acceptable for <200 items. Performance comment in source.
- `SuratJalanModal` uses transaction-level `t.stockUnit` for all item rows — per-item unit field doesn't exist on `items[]` (known design limitation).
