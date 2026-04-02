# BukuKas — Developer Handoff

Digital bookkeeping for a small Indonesian family business (agricultural commodity trading).

**Stack:** React 19.2.4, react-scripts 5.0.1. No router. No backend. `localStorage` only.
**UI Language:** Indonesian (all labels, toasts, status strings).
**Schema version:** NORM_VERSION = 17 (in `src/utils/storage.js`).
**Storage key:** `"bukukas_data_v2"` (`STORAGE_KEY` in `storage.js`).
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
  App.js                          1054  Root component — all state, all handlers, nav
  styles.css                      2917  All styling (BEM-inspired, no CSS modules)
  index.js                              React root render

  utils/
    storage.js                     392  loadData, saveData, defaultData, NORM_VERSION, migrateData
    idGenerators.js                168  generateId, fmtIDR, today, addDays, diffDays, nowTime,
                                        fmtDate, normItem, normalizeTitleCase, generateTxnId,
                                        toCommaDisplay, numToDisplay, displayToNum
    statusUtils.js                  54  STATUS constants, deriveStatus, isUnpaid, LEGACY_STATUS_MAP
    categoryUtils.js               310  generateCode, generateCodes, autoDetectCategories, getCategoryForItem
    paymentUtils.js                 20  computePaymentProgress
    balanceUtils.js                 72  computeARandAP, computeCashIncome, computeCashExpense, computeNetCash
    printUtils.js                   30  printWithPortal
    stockUtils.js                  114  computeStockMap, computeStockMapForDate

  pages/
    Penjualan.js                    18  Income page — thin wrapper: TransactionPage type="income"
    Pembelian.js                    18  Expense page — thin wrapper: TransactionPage type="expense"
    Inventory.js                  1662  Stock inventory with catalog table + ledger
    Contacts.js                    634  Contact list + detail panel + transaction history
    Reports.js                     476  Date-range financial report + CSV/JSON export
    Outstanding.js                 557  AR/AP outstanding transactions view
    Settings.js                    480  Business settings + JSON/CSV backup/restore
    ArchivedItems.js               286  Archived catalog items — restore or delete
    ArchivedContacts.js            219  Archived contacts — restore or delete

  components/
    TransactionPage.js             600  Shared base: Penjualan + Pembelian day-view
    TransactionForm.js            1282  Full transaction input form (multi-item, catalog autocomplete)
    PaymentHistoryPanel.js         290  Expandable payment timeline
    PaymentUpdateModal.js          174  Record payment modal
    DeleteConfirmModal.js          105  Dual-mode (transaction/contact) delete confirm
    InvoiceModal.js                337  Printable invoice
    SuratJalanModal.js             284  Printable delivery note
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
    "defaultDueDateDays":       14
  },
  "_normVersion": 17
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

---

## 5. App.js — Complete Reference

### useState
```js
const [data,                  setData]                  = useState(loadData);
const [page,                  setPage]                  = useState("penjualan");
const [saved,                 setSaved]                 = useState(true);
const [saveError,             setSaveError]             = useState(false);
const [editTx,                setEditTx]                = useState(null);
const [invoiceTxs,            setInvoiceTxs]            = useState(null);
const [sidebarOpen,           setSidebarOpen]           = useState(() => window.innerWidth > 1024);
const [reportItemFilter,      setReportItemFilter]      = useState(null);
const [outstandingHighlight,  setOutstandingHighlight]  = useState(null);
const [reportState,           setReportState]           = useState(null);
const [backupBannerDismissed, setBackupBannerDismissed] = useState(false);
const [suratJalanTx,          setSuratJalanTx]          = useState(null);
const [showStockReport,       setShowStockReport]       = useState(false);
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

### Handlers (see Section 5 of CLAUDE.md for full signatures)
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
    {page === "reports"          && <Reports ...>}
    {page === "outstanding"      && <Outstanding ...>}
    {page === "settings"         && <Settings ...>}
  </main>
  {editTx       && <EditModal ...>}
  {invoiceTxs   && <InvoiceModal ...>}
  {suratJalanTx && <SuratJalanModal ...>}
  {reportState  && <ReportModal ...>}
  {showStockReport && <StockReportModal ...>}
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
`printWithPortal(htmlString)` — injects into `#print-portal`, adds `print-portal-active` class to body, calls `window.print()` synchronously, cleans up in finally{}.

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
onSuratJalan?,        (income only — Penjualan passes this, Pembelian does not)
onNavigateOutstanding?,
saved, itemCatalog,
onAddCatalogItem, onUpdateCatalogItem, onUnarchiveCatalogItem, onUnarchiveSubtype, onUnarchiveContact
```

**Local state:**
```
showForm, search, searchCategory ("invoiceNo"|"itemName"|"klien"), sortBy,
stockWarn, deleteTx, paidTx, toast, viewDate, overdueDismissed, dueSoonDismissed, expandedTxId
```

**Key useMemos:** `filtered` — transactions of correct type for viewDate, filtered by search, sorted.

**Behaviors:**
- Day navigation: prev/next date buttons + date picker, defaults to today
- 3-part search bar: category dropdown + text input + sort select
- Payment progress bar in Nilai cell for all payment states
- `[🕐]` history button with red badge when `paymentHistory.length > 1`
- `expandedTxId` — only one PaymentHistoryPanel open at a time
- Overdue and near-due banners (each dismissible per session)

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

**Highlight behavior:** `OutstandingTable` receives `flashIds` (internal — passed from parent's `highlightTxIds`). Rows with matching IDs get `.flash-row` CSS class. First matching row scrolled into view via ref on mount.

**Sort options:** Jatuh Tempo Terdekat / Terjauh / Outstanding Terkecil / Terbesar. Null dueDates sort to end.

### pages/Settings.js
**Props:** `settings, transactions, onSave, onImport`

**Features:** Business info, bank accounts CRUD, due-date defaults, low-stock threshold, JSON backup export, CSV export (14-column), JSON import.

**Key state:** `form, flash, submitting, importMsg, exportFormat, bizErrors, dueDaysStr, lowStockStr, maxBankStr`

**CSV export:** 14-column format: Tanggal, Waktu, No. Invoice, Klien, Jenis, Barang, Karung, Berat (Kg), Harga/Kg, Subtotal, Nilai Total, Status, Sisa Tagihan, Jatuh Tempo. Expands `items[]` into separate rows. Includes BOM (`\uFEFF`) for Excel compatibility.

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

**Key state:** `form` (all field values), `items[]` (per-row state), `cpOpen`/`cpQuery` (counterparty dropdown), `itemNameOpen`/`itemTypeOpen` (per-row dropdowns), `errors` (per-field), `submitting`, `newItemConfirm`, `txnIdInput` (expense only), `skipNextFocusOpen` ref.

**Multi-item stock warning:** Collects ALL items that would go negative into `negItems[]`, calls `onStockWarning({ items: negItems, item, current, selling, onConfirm, onCancel })`.

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
Prints via `printWithPortal()`. Bank accounts filtered by `showOnInvoice` + limited by `maxBankAccountsOnInvoice`. Invoice notes (`invoiceNote` state) NOT saved — session-only.

### SuratJalanModal.js
**Props:** `transaction, onClose`
Uses `t.stockUnit` (transaction-level). Inline styles throughout for print portal compatibility.

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

---

## 9. Print System

All printing goes through `printWithPortal(htmlString)` in `src/utils/printUtils.js`.

1. Sets `innerHTML` of `#print-portal` (in `public/index.html`)
2. Adds `body.print-portal-active` class
3. `@media print` CSS in `styles.css` hides `#root` and shows `#print-portal`
4. `window.print()` (synchronous)
5. Removes class + clears portal in `finally{}`

**Rule:** Print-bound components (InvoiceModal, SuratJalanModal, StockReportModal) must use 100% inline styles on the printable area. Do NOT use CSS classes in the printed content — they won't be available in the portal context.

---

## 10. CSS Structure

File: `src/styles.css` — 2917 lines. BEM-inspired kebab-case. No CSS modules.

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
- Print: `@media print` section hides `#root`, shows `#print-portal`

Always search `styles.css` before adding a new class.

---

## 11. Architecture Rules

1. **Import hierarchy:** `pages/` → `components/` → `utils/`. Never import across levels (no `pages/` imports from other `pages/`; no `components/` imports from `pages/`; no `utils/` imports React).
2. **State architecture:** All mutations through `update()` in App.js. Local component state for UI-only (show/hide, search, sort, toast).
3. **Date arithmetic:** Always UTC (`T00:00:00Z` + `setUTCDate`). Today/display: always local (`getFullYear`, `getMonth`, `getDate`).
4. **Division safety:** Always guard `denominator > 0` before dividing.
5. **Modal pattern:** Parent holds `null`-or-data state. Modal renders `null` when data is `null`. Always-mounted modals guard Escape key. Conditionally-mounted modals don't need guard.
6. **Catalog:** `itemCatalog[]` is canonical for item selection. `itemCategories[]` is for grouping/display. They are synced by `addCatalogItem` and `updateCatalogItem`.

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

---

## 13. Tech Debt & Quirks

- `orderNum` field exists on all transactions but is never used in UI. Legacy field.
- `stockQty` top-level field on transactions is legacy — multi-item support uses `items[].sackQty`. Both coexist.
- `TransactionPage.js` lives in `src/components/` not `src/pages/`, despite being a page-level component. This is because both Penjualan and Pembelian import it as a component.
- `fmtDate()` in `idGenerators.js` parses dates as local midnight (`T00:00:00` without Z), which is correct for display purposes but inconsistent with UTC-only addDays/diffDays.
- `balanceMap` in App.js builds its `txs[]` array per-contact using `[...map[key].txs, t]` which creates new array references in a loop — technically O(n²) but acceptable for current data sizes.
- `Reports.js` `onInvoice` prop is not used in the current code (the import reference was removed).
- The sidebar's AR/AP display uses emoji (💚/❤️) for piutang/hutang — not accessible.
- `SuratJalanModal` receives `settings` prop from App.js but the component only destructures `{ transaction, onClose }` — settings are unused internally.
- `Settings.js` and `Reports.js` both have an `exportFormat` local state (JSON/CSV selector) independently — they don't share state.
