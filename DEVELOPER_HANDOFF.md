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
  App.js                          1830  Root component — all state, all handlers, nav, Supabase integration
  styles.css                      3051  All styling (BEM-inspired, no CSS modules)
  index.js                              React root render

  utils/
    storage.js                     406  loadData, saveData, defaultData, NORM_VERSION, migrateData
    idGenerators.js                190  generateId, fmtIDR, fmtQty, today, addDays, diffDays, nowTime,
                                        fmtDate, normItem, normalizeTitleCase, generateTxnId,
                                        toCommaDisplay, numToDisplay, displayToNum
                                        fmtQty: formats numeric qty/weight with id-ID locale (dot thousands separator).
                                        Returns "-" for null/undefined. Use for all read-only stock qty display.
    statusUtils.js                  54  STATUS constants, deriveStatus, isUnpaid, LEGACY_STATUS_MAP
    paymentUtils.js                 20  computePaymentProgress
    balanceUtils.js                 72  computeARandAP, computeCashIncome, computeCashExpense, computeNetCash
    printUtils.js                   47  printWithPortal, escapeHtml
    stockUtils.js                  114  computeStockMap, computeStockMapForDate
    textFormatter.js               416  ASCII dot matrix layout engine (formatInvoice, formatSuratJalan, wrapText); formatSuratJalanFooter removes sigLine + brackets (T67); when no catatan: one blank line before labels (T68); when catatan: blank line after catatan (T68); formatInvoiceFooter: else branch adds blank line when no bank accounts, sigLine + brackets removed (T70)
    AuthContext.js                 175  AuthProvider, useAuth — session state, signIn (with login audit log), signOut, 15-min idle timeout; `ignoringSessionRef` guards onAuthStateChange during idle sign-out (T23); clears #access_token hash on auth state change to prevent PASSWORD_RECOVERY re-trigger on reload
    supabaseClient.js               19  Creates Supabase client (anon key only, env var validated)
    supabaseStorage.js             445  Full Supabase field mapping, save/load/delete helpers, saveActivityLog, loadActivityLog, getNextTxnSerial, isSupabaseReachable
    storageConfig.js                ~30  USE_SUPABASE flag
    realtimeManager.js             ~100  subscribeToChanges, subscribeToPresence (Phase 5)
    conflictDetector.js             ~86  ConflictError class, checkVersion (Phase 5)

  pages/
    Penjualan.js                    18  Income page — thin wrapper: TransactionPage type="income"
    Pembelian.js                    18  Expense page — thin wrapper: TransactionPage type="expense"
    Inventory.js                  ~1884  Stock inventory with catalog table + ledger — groups derived from itemCatalog (no itemCategories); permanent delete (catalog/subtype) requires typing "hapus" (T24); "Tambah Barang Baru" form requires ≥1 non-empty subtype — "Tambah" button always enabled, clicking with no valid subtype shows blocking modal (T54, replaces T49 disabled-button behavior); opens with one pre-filled empty input, defaultUnit hardcoded to "karung" (T48/T49); base item rows hidden when zero stock AND zero transactions (T50); subtype rows with 0 stock + 0 txCount + 0 adjCount hidden by default (T55) — "Tampilkan item tanpa stok & transaksi" toggle reveals them (label updated T72); handleAddSubtype checks both subtypes+archivedSubtypes for duplicates (T60); rename guard checks all catalog entries not just stockMap (T60); hasTx checks include archivedSubtypes (T60); uncatalogued item delete requires typing "hapus" (T60); ledgerEntries sort uses date+time only, ignoring createdAt (T71)
    Contacts.js                    672  Contact list + detail panel + transaction history; handleSave uses editingContact (from contacts array) not sel (from filtered withBalance) — prevents silent add-instead-of-edit when search is active (T61); archive/delete confirm handlers call setEditMode(false) (T61); progress bar at 0% returns null not "0%" text (T61); payment history colSpan corrected 8→9 (T62)
    Login.js                       241  Login page — email/password, idle-timeout banner, forgot-password flow
    Reports.js                     573  Date-range financial report + CSV/JSON export (Laba/Rugi + financial cols hidden from Karyawan; redesigned item-level table); chip dismiss + Reset Filter both sync inventoryFilterItem↔selectedItems (T63); orphanPayments + paymentCount both respect typeFilter (T63)
    Outstanding.js                 557  AR/AP outstanding transactions view
    Settings.js                    617  Business settings + JSON/CSV backup/restore + printer type toggle; handleSave flushes unblurred numeric fields into finalForm (T64); import syncs form/dueDaysStr/lowStockStr/maxBankStr from parsed.settings on success (T64); NORM_VERSION from storage.js (T64)
    ArchivedItems.js               286  Archived catalog items — restore or delete
    ArchivedContacts.js            222  Archived contacts — restore or delete
    ActivityLog.js                 351  Audit trail viewer — Pemilik-only, reads activity_log table; loadMoreError state separates load-more failures from initial-load failures so first-page data stays visible on retry (T65)

  components/
    TransactionPage.js             652  Shared base: Penjualan + Pembelian day-view
    TransactionForm.js            1496  Full transaction input form (multi-item, catalog autocomplete); Tipe field required — missing-type blocking modal (T52)
    PaymentHistoryPanel.js         334  Expandable payment timeline — newest-first order (T29); PendingNode at top
    PaymentUpdateModal.js          183  Record payment modal
    DeleteConfirmModal.js          125  Dual-mode (transaction/contact) delete confirm — requires typing "hapus" to enable confirm button
    InvoiceModal.js                337  Printable A4 invoice
    SuratJalanModal.js             289  Printable A4 delivery note
    DotMatrixPrintModal.js         127  Dot matrix preview + print modal (invoice & surat jalan); both modes render single `<pre>` on screen and print — surat jalan bold-title split removed (T67); modal-box maxWidth 750; `<pre>` style lineHeight:1.2 only (T69 final)
    ToggleSwitch.js                 65  Reusable toggle switch — track+thumb, #007bff/#cbd5e1, keyboard accessible (role=switch, Space/Enter)
    ReportModal.js                 590  Printable landscape report modal — 3-col header, 8 fixed cols + 5 optional, two collapsible tables, print options bar with ToggleSwitch (Tampilan: company name/summary; Sertakan: printTable1/printTable2), Grand Total IDR. Defaults (T25): showCompanyName=false, showSummary=false, printTable1=true, printTable2=false. grandTotalPaid = table1Total + table2Total (T26 — each 0 when its toggle is off)
    StockWarningModal.js            77  Negative-stock warning
    StockReportModal.js            ~430  Printable stock report — derives groupings from itemCatalog prop (active entries = groups, active subtypes = members, uncatalogued → "Lainnya", archived → "Barang Diarsipkan"). Toggles: showZeroStock, showCompanyName (default OFF — T53), showArchivedItems (default OFF). Base rows hidden when baseQty===0 && baseTxCount===0 even with showZeroStock ON (T53 — mirrors Inventory T50)
    Badge.js                       113  StatusBadge, TypeBadge (named exports)
    DueBadge.js                     32  Due date status badge
    ErrorBoundary.js               118  React class error boundary — catches unhandled render errors, auto-retries up to 3× (3s delay each); shows "Coba Lagi" + "Muat Ulang" buttons
    MultiSelect.js                 151  Zero-dep multi-select dropdown
    RupiahInput.js                 107  Comma-formatted Rupiah currency input
    QtyInput.js                     87  Decimal quantity input — live id-ID locale formatting on keystroke, dot thousands, comma decimal, trailing comma preserved
    SaveIndicator.js                41  "Tersimpan ✓ · HH:MM" / "Menyimpan..." indicator
    StockChip.js                    25  Coloured stock qty pill
    Toast.js                        50  Auto-dismissing 3-second notification
    Icon.js                         72  Inline SVG icon system; `contacts` icon = clean single-person silhouette (circle head + body arc) — replaced clipped group icon in T66
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
const [reportState,           setReportState]           = useState(null);   // { transactions, allTransactions, dateFrom, dateTo, selectedItems, colSudahDibayar, colTotalNilai, colSisaTagihan, colPiutang, colJenis } — opens ReportModal

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

// Password reset completion
const [showPasswordChange,    setShowPasswordChange]    = useState(false);

// Supabase pause detection
const [databasePaused,        setDatabasePaused]        = useState(false);

// App-level toast (e.g. txnId collision warning, import success)
const [toast,                 setToast]                 = useState(null);
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
// passwordRecovery guard — opens PasswordChangeModal when passwordRecovery && user
```

### Core helpers
```js
const persist = useCallback(...)         // debounced 500ms localStorage write; sets saved/saveError
const retrySave = useCallback(...)       // immediate retry write
const persistToSupabase = useCallback(async (operation, retryFn) => ...)
                                         // async Supabase write; on failure shows SaveErrorModal with retryFn
const update = (fn, supabaseOperation) => { ... }
                                         // ALL mutations go through this; computes nd = fn(dataRef.current),
                                         // syncs dataRef.current = nd synchronously, calls setData(nd),
                                         // then calls persistToSupabase with retry = () => update(fn, supabaseOperation)
                                         // NOTE (C2 fix): append-style handlers (addTransaction, applyPayment,
                                         // addStockAdjustment) call update(fn) with NO supabaseOperation, then
                                         // call persistToSupabase directly — retry closure only re-runs the
                                         // Supabase write, never the state mutation. Idempotent handlers
                                         // (edit, delete, archive) still use update(fn, supabaseOperation).
const normTx = (t) => ...               // title-cases itemName + counterparty before save
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
renameInventoryItem, deleteInventoryItem, handleViewItem, navigateToOutstanding,
quickExport  — useCallback; immediate JSON backup download from backup reminder banner;
             serializes current React state via Blob+createObjectURL; updates
             lastExportDate in state and Supabase; logs export via logActivity
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
  {saveErrorModal && <SaveErrorModal ...>}
  {showConflictModal && <ConflictModal ...>}
  {showPasswordChange && <PasswordChangeModal ...>}
  {toast && <Toast ...>}
</div>
```

`EditModal` is a local function component defined before `App` in App.js (not exported). It wraps `TransactionForm` in a modal overlay and computes `adjustedStockMap` to exclude the current transaction's stock contribution before stock-warning validation.

`PasswordChangeModal` is a local function component defined before `App` in App.js (not exported). It is shown when `passwordRecovery && user` — i.e. the user arrived via a Supabase password reset email link. Validates min 6 chars and password match; calls `updatePassword(newPassword)` from AuthContext on submit. Modal is **uncloseable** — no Escape key, no backdrop click, no skip button. Both password fields have show/hide eye toggles (`.login-password-toggle` pattern from Login.js).

`DatabasePausedScreen` is a local function component defined before `App` in App.js (not exported). It replaces the entire app UI (full-screen, not a modal) when `databasePaused === true`. Shown when `isSupabaseReachable()` returns false — either on initial load failure or after a write failure in `persistToSupabase`. Shows an Indonesian explanation and a "Coba Lagi" button that calls `window.location.reload()`.

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
- `formatInvoice` options: `{ note: string }` — shown as "Note       : [note]" in meta section (right-aligned, line 3)
- `formatSuratJalan` options: `{ platNomor: string, catatanPengiriman: string }` — plate number in meta, delivery note in footer

**Separator constants:** `SEP_MAJOR = "=".repeat(80)` (section divider), `SEP_MINOR = "_".repeat(80)` (column header divider — underscore chosen over `-` for continuous baseline on dot matrix printers; T34). Spacing between rows is provided by `line-height: 1.2` on the `<pre>` elements in `DotMatrixPrintModal.js` rather than blank lines in the text (T36).

**Internal helpers:** `padRight`, `padLeft`, `centerText`, `fmtNum`, `fmtRp`, `getItemsArray`, `wrapText`

**`wrapText(str, width)`:** Word-boundary wrapping that returns an array of strings each ≤ width chars. Hard-truncates a single word that alone exceeds the width. Used by `formatItemsTable` and `formatSuratJalanItems` for long item names via `flatMap`.

**Invoice column widths (total = 80):**
No(6) + Jenis Barang(32) + Berat(14) + Harga(14) + Total(14) = 80. No `|` separators. No Krg column.

**Surat Jalan column widths (total = 80):**
No(3) + `" | "` + Barang(50) + `" | "` + Jumlah(21) = 80

**Invoice layout sections:** `formatInvoiceHeader()` (no args) → `formatInvoiceMeta(transactions, contacts, note)` → `formatItemsTable(transactions)` → `formatInvoiceFooter(transactions, settings)`

**Invoice format (current):**
- Header: `"I N V O I C E"` centered full 80 cols. No business name/address/phone/page number.
- Meta: Two-column surat jalan style. Row 1: `KEPADA YTH :` (left 40) + `TANGGAL : [date]` (right 40). Row 2: client name (left 40) + `NO. INVOICE : [txnId]` (right 40). Row 3+: address lines (left 40, wrapped to 40) paired with CATATAN lines (right 40) — `CATATAN : ` label (10 chars) on first note line, continuation lines indented 10 spaces; right column blank when note is empty (CATATAN label not rendered). `maxRows = Math.max(addrLines.length, noteLines.length, 1)` — always at least one row before SEP_MINOR. Note wrapped to 30 chars per line (40 − 10 label).
- Items: header row (No/Jenis Barang/Berat (Kg)/Harga/Total), SEP_MINOR, item rows. Berat shows `"[n] kg"`, Harga shows `"Rp [n]"`, Total shows `"Rp [n]"`. No trailing separator (footer adds SEP_MAJOR after total row).
- Footer: SEP_MAJOR → `"TOTAL : Rp [amount]"` right-aligned → bank accounts (`NAME BANK : / ACCOUNT NUMBER : / ACCOUNT NAME :` format, one block per account) → blank line → `"TANDA TERIMA,"` left / `"HORMAT KAMI,"` right → 3 blank lines → `"(                          )"` left + `"(                          )"` right. No LUNAS/SISA TAGIHAN. No transaction notes.

**Surat Jalan layout sections:** `formatSuratJalanHeader()` (no args — no company name) → `formatSuratJalanMeta(transaction, platNomor, contacts)` → `formatSuratJalanItems(transaction)` → `formatSuratJalanFooter(catatanPengiriman)`

**Dot matrix Surat Jalan format (current):**
- Header: only `"SURAT JALAN"` centered — no company name
- Meta row 1: `KEPADA YTH :` (left 40 chars) + `TANGGAL : [date]` (right 40 chars). Row 2: client name (left 40) + `NO. INVOICE : [txnId]` (right 40); txnId falls back to `"—"`. Row 3: client address line 0 (left 40, wrapped to 40) + `PLAT MOBIL : [plate]` (right 40, always shown). Continuation address lines full-width below if needed.
- Items table: 3 columns — NO.(3) + ` | ` + JENIS BARANG(50) + ` | ` + JUMLAH BARANG(21) = 80. Header ALL CAPS. JUMLAH BARANG value = `"[qty] [unit]"` (e.g. `"500 karung"`) — no separate Satuan column.
- Catatan line: only if `catatanPengiriman` non-empty
- Footer: `TANDA TERIMA,` (left) / `HORMAT KAMI,` (right) with `(                          )` sig lines
- `formatSuratJalan` signature: `(transaction, _settings, options, contacts)` — `_settings` unused, kept for API compatibility with callers

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

**Key local state:** `search`, `sortBy`, `sortDir`, `inventoryDate`, `expandedStockItem`, `ledgerTypeFilter`, `ledgerDateFrom`, `ledgerDateTo`, `adjDeleteConfirm`, plus adjustment/rename/delete/catalog modal states.

**Key useMemos:**
- `activeStockMap` — `stockMap` (today) or `computeStockMapForDate(...)` for historical dates
- `tableGroups` — flat rows from catalog + uncataloged, grouped by catalog entry (base = group header, subtypes = members, uncatalogued → "Lainnya"). No longer depends on `itemCategories`.

**Ledger:** Expandable per-item panel with transaction history, running totals, date filter, type filter, PERIODE quick-select (Hari Ini / Minggu Ini / Bulan Ini / Semua) with active state.

**Adjustment qty input:** Uses `QtyInput` (not plain `<input>`). `adjQtyRef` is on a wrapper `<div>` (QtyInput doesn't forward refs). Auto-focus on modal open uses `adjQtyRef.current?.querySelector("input")?.focus()`. `adjQtyStr` state holds a number (0 when empty) after first QtyInput onChange; validation `!adjQtyStr` catches 0 as falsy.

### pages/Contacts.js
**Props:** `contacts, transactions, balanceMap, onAddContact, onUpdateContact, onDeleteContact, onArchiveContact?, onUnarchiveContact?, onNavigateToArchive?, onDeleteTransaction?, onEditTransaction?, onMarkPaid?`

**Layout:** Left panel (contact list with A–Z alpha filter) + right panel (detail card with AR/AP, transaction history).

**Key behaviors:**
- `txCountMap` useMemo determines whether to offer Archive vs Delete
- `nameError` inline validation for duplicate names before save
- `submitting` debounce guard on save

### pages/Reports.js
**Props:** `transactions, contacts, settings, onReport?, initItemFilter?, onClearItemFilter?, profile?`
Note: `onInvoice` prop is not used in the current code (was removed). `onReport` triggers ReportModal via App.js.

**Key state:** `dateFrom`, `dateTo`, `selectedClients`, `selectedItems`, `period` (default `"daily"`), `toast`, `confirmCount`, `exportFormat`, `detailTx`, `colSudahDibayar` (default true), `colTotalNilai` (false), `colSisaTagihan` (false), `colPiutang` (false), `colJenis` (false)

**Default period:** `"daily"` — `dateFrom` and `dateTo` both initialize to `today()`. Previously `"monthly"`.

**Role-based visibility:** `isOwner = profile?.role === "owner"`. Summary cards (Total Pemasukan, Total Pengeluaran, Laba/Rugi) hidden from Karyawan (`{isOwner && (...)}` block). All optional table columns (including financial cols) visible to all authenticated users — no role restriction on the table.

**Export:** Can export JSON or CSV. Both use Blob+createObjectURL. CSV export is unaffected by column toggle state — always exports full data. CSV format has 15 columns: No | No. Invoice | Tanggal | Klien | Barang | Berat Kg @ Harga | Krg | Subtotal | Sudah Dibayar | Total Nilai | Sisa Tagihan | Jenis | Status | Jatuh Tempo | Tipe Baris. Transaction rows: one per item (multi-item first row fills all tx fields; subsequent rows fill only Barang/Berat@Harga/Krg/Subtotal). Payment rows: inline (from `filtered`) then orphan (from `transactions` not in `filtered`), Sudah Dibayar signed (+income/−expense). Grand total row at bottom: Sudah Dibayar = `grandTotalPaid`, Tipe Baris = "Grand Total". BOM preserved for Excel UTF-8. `getMultiItemContribution` not used in CSV export but retained for other callers.

**Transaction table structure (redesigned 2026-04-19):**
- Fixed columns: No | No.Invoice | Tanggal | Klien | Barang | Krg | Berat (Kg) | Harga/Kg | Subtotal
- Optional toggle columns (shown above table as `filter-btn` toggles): Sudah Dibayar (default on), Total Nilai, Sisa Tagihan, Piutang/Hutang, Jenis
- **Single-item transactions:** one row — optional cols shown on that row
- **Multi-item transactions:** one row per item (first row has No/txnId/date/client; continuation rows have those cells blank) + a subtotal row (`Total:` right-aligned label, total value) — optional cols shown on subtotal row only, blank on item rows
- Row no. counts transactions, not rows
- First/subtotal rows: `background: #f8fafc`; continuation item rows: `background: #ffffff`
- `border-top: 1.5px solid #cbd5e1` applied to the first row of every transaction group except the first (`txIdx > 0`) — visually separates transaction groups
- Clicking first row (single or multi) opens `TransactionDetailModal`
- Table renders when `filtered.length > 0 || paymentCount > 0`. Empty state ("Tidak ada data untuk filter ini.") shown only when both are 0.
- Grand total below table: `N transaksi [· N pembayaran] | Grand Total Sudah Dibayar: Rp [sum]` — shown when `filtered.length > 0 || paymentCount > 0`; `· N pembayaran` shown only when `paymentCount > 0`
- **Piutang/Hutang column** shows a status badge (not a number): `outstanding > 0 + income` → "Piutang" green; `outstanding > 0 + expense` → "Hutang" red; `outstanding === 0` → "Lunas" green. Inline IIFE, no external component.
- **Payment rows** — two groups:
  - **Inline:** rendered immediately after their parent transaction row(s) inside `filtered.map()`. Filtered by `visiblePmtFilter` (payment date in range, amount > 0, not an edit note).
  - **Orphan:** rendered after all `filtered.map()` rows in a separate IIFE block. Covers payments from transactions whose transaction date is outside the filter range, but whose payment date is within. Preceded by a separator row: "Pembayaran dari transaksi di luar periode ini:". Only shown when orphan rows exist.
  - Content (Option B): No column blank; No.Invoice = txnId (income: indigo, expense: dark); Tanggal = payment date; Klien = counterparty; Barang = badge ("Pembayaran Diterima"/"Pembayaran Dilakukan") + note, with `Sisa: Rp X → Rp Y [✓ Lunas]` line below. Sudah Dibayar = `+` (income green) or `-` (expense red) amount. Sisa Tagihan = remaining amount or "Lunas ✓". Not clickable.
  - `visiblePmtFilter(ph)` and `mkPaymentRows(t, payments, keyPrefix)` are in-render helpers defined before `return (`.
- `paymentCount` useMemo counts from ALL `transactions` (not `filtered`) — consistent with orphan payment coverage.
- `grandTotalPaid` useMemo: sums `(value - outstanding)` for `filtered` transactions PLUS `ph.amount` for all visible payment rows across ALL transactions. Used in grand total bar.

**Internal:** `getMultiItemContribution(t, selItems)` — retained as dead code (no longer used in table rendering; still used in `income`/`expense` useMemos for summary cards).

### pages/Outstanding.js
**Props:** `transactions, onEdit, onMarkPaid, onDelete, onInvoice, highlightTxIds?, onClearHighlight?`

**Layout:** Two `OutstandingTable` sections (Piutang / Hutang). Each section paginated 50/page.

**Contact search:** `contactSearch` state (string, default `""`). Input rendered above the sort control — full-width up to 320px, `.search-input` class, placeholder "Cari kontak...". Filters both `piutangTxs` and `hutangTxs` in their `useMemo` by `t.counterparty.toLowerCase().includes(search)`. Both `OutstandingTable` keys include `contactSearch` so changing the search resets pagination to page 0 (same mechanism as sort change). When `contactSearch` is non-empty and both arrays are empty, the empty state shows 🔍 "Tidak ada hasil untuk '[term]'" + subtext instead of the 🎉 "Semua bersih!" message.

**Highlight behavior:** `OutstandingTable` receives `flashIds` (Set — derived from parent's `highlightTxIds` array). Each row also computes a permanent class from `dueDate`: `.outstanding-row--overdue` (past due) or `.outstanding-row--near-due` (≤3 days). Flash rows additionally get `.outstanding-row--flash` (blue). Flash is cleared on first user interaction (click/keydown/scroll) after a 500ms debounce. First flash row is scrolled into view (50ms setTimeout after render).

**Sort options:** Jatuh Tempo Terdekat / Terjauh / Outstanding Terkecil / Terbesar. Null dueDates sort to end.

### pages/Settings.js
**Props:** `settings, transactions, onSave, onImport`

**Features:** Business info, bank accounts CRUD, due-date defaults, low-stock threshold, **printer type toggle (A4 / Dot Matrix)**, JSON backup export, CSV export (14-column), JSON import.

**Key state:** `form, flash, submitting, importMsg, exportFormat, bizErrors, dueDaysStr, lowStockStr, maxBankStr`

The `form` state includes `printerType` (initialized from `settings.printerType || "A4"`). The "Format Cetak" section uses `.filter-btn` / `.filter-btn--active` toggle buttons. `onSave(form)` persists the full form including `printerType`.

**CSV export:** 14-column format: Tanggal, Waktu, No. Invoice, Klien, Jenis, Barang, Karung, Berat (Kg), Harga/Kg, Subtotal, Nilai Total, Status, Sisa Tagihan, Jatuh Tempo. Expands `items[]` into separate rows. Includes BOM (`\uFEFF`) for Excel compatibility.

**"Impor Backup" button** is only rendered when `exportFormat === "json"` — hidden when CSV is selected, since import only supports JSON format.

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
**Props:** none (reads `signIn`, `resetPassword`, `idleTimedOut`, `clearIdleTimedOut` from `useAuth()`)

**State:** `email`, `password`, `error`, `submitting`, `showPassword`, `showForgotPassword`, `resetEmail`, `resetStatus`, `resetError`

**Features:**
- Standard email + password form with Indonesian labels
- Password show/hide toggle button (eye icon, `tabIndex=-1`) — toggles `type="password"` / `type="text"`
- Error messages localized to Indonesian ("Email atau kata sandi salah." etc.)
- Submit button disabled while `submitting` or when email/password are empty
- **Idle timeout banner:** When `idleTimedOut === true`, shows amber alert box between subtitle and form: "Sesi Anda telah berakhir karena tidak aktif. Silakan masuk kembali." Inline styles only (no CSS class). `role="alert"` for accessibility.
- On success: `clearIdleTimedOut()` called to reset the banner flag; AuthContext updates `user` state; App.js re-renders to main shell automatically
- **Forgot password flow (complete):** "Lupa Password?" link → reset view → user enters email → `resetPassword(email)` sends Supabase email → user clicks link in email → app opens, Supabase fires `PASSWORD_RECOVERY` event → AuthContext sets `passwordRecovery = true` → App.js `useEffect([passwordRecovery, user])` opens `PasswordChangeModal` → user enters new password + confirmation → `updatePassword(newPassword)` calls `supabase.auth.updateUser()` → success toast "Kata sandi berhasil diubah." and modal closes. The `PasswordChangeModal` is **uncloseable** — user must complete the password change to dismiss it (no Escape, no backdrop, no skip button).

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

**Quantity inputs:** Jumlah Karung and Berat (Kg) use `QtyInput` (not plain `<input>`). `onChange` receives a number and calls `setItem(idx, "sackQty"/"weightKg", n)`. Item state for these fields is a number after first interaction (starts as `""` until QtyInput fires onChange).

**Multi-item stock warning:** Collects ALL items that would go negative into `negItems[]`, calls `onStockWarning({ items: negItems, item, current, selling, onConfirm, onCancel: () => setSubmitting(false) })`.

### PaymentHistoryPanel.js
Rendered in a `<tr colSpan={...}>` below a transaction row. Vertical timeline.

System notes ("Pelunasan", etc.) shown as display labels only. User notes shown as "Catatan: [text]". Data lama entries show ⚠ icon. 10+ entries: shows first 3 + expand toggle + last 1. Pending node (dashed amber dot) when `outstanding > 0`.

**Edit entries:** Detected when `entry.note === "Transaksi diedit — nilai diperbarui"` (old, legacy) OR `entry.note === "Detail Perubahan"` (current, written by `editTransaction` from 2026-04-18 onward). New entries include `valueBefore`, `valueAfter`, `paidBefore`, `paidAfter`, `statusBefore`, `statusAfter` fields — displayed as four labeled lines: "Total Nilai: X → Y", "Sudah Dibayar: A → B", "Sisa Tagihan: C → D", "Status: Old → New". `paidBefore`/`paidAfter` are `Math.max(0, value - outstanding)`. Entries from the previous session (with `valueAfter` but without `paidBefore`) use `?? 0` fallback so "Sudah Dibayar" shows Rp 0 safely. Oldest entries (missing `valueAfter`) fall back to single-line "Sebelum: X → Setelah: Y". Both note strings are in `SYSTEM_NOTES` so they are never shown as user notes. `paymentCount` filter excludes both strings.

### PaymentUpdateModal.js
**Props:** `transaction, onConfirm(amount, note), onCancel`
Pre-fills with full outstanding. Shows live preview. Note resets when transaction changes. Auto-focus via setTimeout(50ms) + `querySelector("input")` on ref-div (RupiahInput doesn't forward refs). Always-mounted — guards Escape key with `if (!transaction) return`.

### DeleteConfirmModal.js
**Props:** `transaction?, isContact?, contact?, onConfirm, onCancel`
Always-mounted — guards Escape key with visibility check.
**Confirmation input:** User must type `"hapus"` (case-insensitive) into a text input before "Ya, Hapus" button becomes enabled. Input resets to `""` on both Batal and confirm. Applies to both transaction and contact delete modes.

### InvoiceModal.js
**Props:** `transactions, settings, onClose`
Prints via `printWithPortal()`. Bank accounts filtered by `showOnInvoice` + limited by `maxBankAccountsOnInvoice`. Invoice notes (`invoiceNote` state) NOT saved — session-only. Used only when `printerType === "A4"`.

### SuratJalanModal.js
**Props:** `transaction, contacts, onClose`
Uses `t.stockUnit` (transaction-level). Inline styles throughout for print portal compatibility. Used only when `printerType === "A4"`. Client address looked up from `contacts[]` by case-insensitive name match.

**KEPADA YTH layout (current):** Stacked — label on its own line (`display: block`), client name on the next line (bold), address on the line below that. Previously label and name were side-by-side in a flex row.

### TransactionDetailModal.js
**Props:** `transaction, onClose`
Read-only popup shown when the user clicks a transaction row (outside action buttons). Conditionally mounted — no Escape guard needed.

Displays: type/status badges, txnId, date/time, counterparty, items table (sackQty × weightKg × pricePerKg = subtotal), total, outstanding, dueDate, notes, payment history.

**Section 4 — Unified payment block:** "Total Nilai" row (bold `#1e3a5f` label, income/expense colored value) → thin divider (`1px solid #e5e7eb`) → "Sudah Dibayar" in green `#10b981` (value = `t.value - t.outstanding`, guarded with `|| 0`) → "Sisa Tagihan" in amber `#f59e0b` with value when `outstanding > 0`, or "Lunas ✓" in green with no value when `outstanding === 0` → `computePaymentProgress` bar with %. No standalone Sisa Tagihan anywhere else.

**Section 6 — Payment history entries:** Label "Riwayat Pembayaran (N)". History displayed most-recent-first (`[...history].reverse()`). No duplicate summary bar in this section.

Edit entries (`note === "Detail Perubahan"` or `"Transaksi diedit — nilai diperbarui"`): show label "Detail Perubahan" (no amount). New-format entries (with `valueAfter`) display four labeled lines: "Total Nilai: X → Y", "Sudah Dibayar: A → B", "Sisa Tagihan: C → D", "Status: Old → New" (using `paidBefore ?? 0` / `paidAfter ?? 0` fallback). Old-format entries (without `valueAfter`) show "Sisa setelah: Rp X". Regular entries: green/amber dot, amount bold navy `#1e3a5f` (13px 700), date/time `#6b7280`, note `#374151` (system notes as-is; user notes prefixed "Catatan:"), "Sisa setelah" `#6b7280`.

### DotMatrixPrintModal.js (NEW — v18)
**Props:** `transaction, mode, settings, onClose`
- `mode`: `"invoice"` | `"suratJalan"`
- `transaction`: array when mode is `"invoice"` (matches `invoiceTxs`), single object when mode is `"suratJalan"`

**Local state:** `invoiceNote`, `platNomor`, `catatanPengiriman` — input fields rendered above the preview, conditional on `mode`. The `platNomor` input and `catatanPengiriman` textarea have no placeholder text (labels describe each field).

Computes formatted ASCII text via `useMemo` (deps: `transaction, mode, settings, invoiceNote, platNomor, catatanPengiriman`) using `formatInvoice(transaction, settings, { note: invoiceNote })` or `formatSuratJalan(transaction, settings, { platNomor, catatanPengiriman })`. Preview updates live as user types in input fields.

Renders preview: when `mode === "suratJalan"`, splits `formattedText` on `"\n"` — `lines[0]` ("SURAT JALAN") shown as a centered bold 20px div (letterSpacing 4, borderBottom 2px replaces the `====` line dropped via `lines.slice(2)`), body in `.dot-matrix-preview` `<pre style={{ marginTop: 8, lineHeight: 1.2 }}>` (8px gap below title border, 1.2 line-height for uniform row spacing). When `mode === "invoice"`, single `.dot-matrix-preview` `<pre style={{ lineHeight: 1.2 }}>`. "Konfirmasi Cetak" mirrors the same split for Surat Jalan: title in 20pt bold div + body in inline-styled `<pre>` (`margin-top:8px;line-height:1.2`); invoice path uses `line-height:1.2` (T36) (Courier New, 12pt, no bold, line-height 1 — T22: Arial and bold Courier New both tried and reverted). "Batal" button and Escape key close the modal. Conditionally mounted — no Escape guard needed.

Note: Uses manual `replace(/&/g, ...)` chain in `handlePrint` rather than `escapeHtml()` from `printUtils.js` — both approaches are equivalent.

### StockWarningModal.js
**Props:** `data: { items[], item?, current?, selling?, onConfirm, onCancel? } | null, onClose`
Multi-item: renders bullet list. Single-item: renders prose. Always-mounted — guards Escape.

### StockReportModal.js
**Props:** `stockMap, itemCatalog, settings, transactions, stockAdjustments, onClose`
Date picker for historical snapshots. Toggle for zero-stock items. Groups derived from `itemCatalog`: active catalog entries = group headers, active subtypes = members, items not in any catalog entry → "Lainnya". Archived catalog items and archived subtypes excluded. Guard: renders null if stockMap falsy. Escape key: no guard (conditionally mounted).

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

### QtyInput.js
**Props:** `value, onChange(numericValue), hasError?, placeholder?, style?, className?, onBlur?`
Decimal-aware quantity input with live id-ID locale formatting on every keystroke (dot thousands, comma decimal). Key behaviors:
- **Live formatting:** `handleChange` strips non-digit/non-comma chars, formats the integer part with `toLocaleString("id-ID")`, appends `,decPart` for decimals. Display updates on every keystroke.
- **Trailing comma:** Preserved in display when user types `1.500,` — lets user finish typing the decimal without the comma being stripped.
- **`onFocus`:** Sets `isFocusedRef = true`. If `value === 0`, clears `display` to `""` so typing replaces the zero cleanly. Otherwise selects all text for easy replacement.
- **`onBlur`:** Clears `isFocusedRef`. Cleans up trailing comma/incomplete decimal by reformatting from `value` prop. If display is left empty (user deleted everything or focused+blurred a zero field), restores display to `"0"`.
- **Prop sync:** Suppressed while focused (`isFocusedRef`) to prevent live display from being overwritten during mid-decimal typing.
- **`onChange`:** Always receives a JavaScript number (`parseFloat` result, or `0` for empty/invalid).
- **`fmtNum(n)`:** `null`/`undefined` → `""` (empty placeholder); all other values including `0` → `toLocaleString("id-ID")`. So `fmtNum(0)` → `"0"`, not blank.
- Does NOT forward refs — use a wrapping div ref for auto-focus (see `adjQtyRef` in Inventory.js).

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

### AuthContext.js (src/utils/) — ~130 lines
**Exports:** `AuthProvider` (component), `useAuth()` (hook)

**Context value:** `{ user, profile, session, loading, signIn, signOut, resetPassword, idleTimedOut, clearIdleTimedOut, passwordRecovery, updatePassword, clearPasswordRecovery }`

**`signIn(email, password)`:**
1. Calls `supabase.auth.signInWithPassword`
2. Awaits `fetchProfile(data.user.id)` to get `full_name`
3. Fires non-blocking `saveActivityLog({ user_name: prof?.full_name || email, action: 'login', ... })` — failure never prevents login
4. Returns auth data; AuthContext updates user/profile state automatically via `onAuthStateChange`

**`signOut()`:** Synchronously clears `session`, `user`, `profile` state, then `await supabase.auth.signOut()`, then `ignoringSessionRef.current = false`. Does NOT clear `idleTimedOut` — the flag must survive sign-out so Login.js can show the session-expired banner.

**`handleSession`:** Fetches profile, force-signs-out inactive accounts (`is_active === false`).

**`fetchProfile(userId)`:** Queries `profiles` table for `id, email, full_name, role, is_active`.

**Idle timeout (15 minutes):**
- `IDLE_TIMEOUT_MS = 15 * 60 * 1000`
- `ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"]`
- `useEffect` depends on `[user]` — starts timer when user logs in, cleans up on logout
- `resetTimer()` clears and restarts a `setTimeout`; each activity event calls `resetTimer()`
- On timeout: `ignoringSessionRef.current = true`, then `await signOut()`, then `setIdleTimedOut(true)` — order matters so flag outlives cleared state; `ignoringSessionRef` blocks token-refresh race via `onAuthStateChange`
- Same pattern in `handleVisibilityChange` (sleep/resume path)
- `idleTimedOut` state: NOT cleared in `signOut()` — only `clearIdleTimedOut()` resets it (called after successful re-login in Login.js); `clearIdleTimedOut` also clears `ignoringSessionRef`
- **T23 race fix:** `ignoringSessionRef = useRef(false)` — set before idle sign-out, cleared after. `onAuthStateChange` returns early when true, preventing Supabase's token auto-refresh from restoring the session mid-logout.
- All event listeners use `{ passive: true }` for performance

### Role-Based Restrictions (Karyawan vs Pemilik)

**Pemilik (owner) has full access to all features.**

**Karyawan (staff) restrictions:**
- Cannot access Log Aktivitas page (not shown in sidebar navigation — gated by `profile.role === "owner"` in `navItems` and in JSX render condition)
- Cannot see any summary cards on Laporan page (Total Pemasukan, Total Pengeluaran, Laba/Rugi are all hidden — controlled by `{isOwner && (...)}` block in Reports.js). Karyawan sees only the transaction list, filters, and export button.
- Cannot see the weekly backup reminder banner (controlled by `profile?.role === "owner"` guard in App.js `showBackupWarning` computation)
- All other features are identical: create/edit/delete transactions, manage contacts, inventory, print invoices, export reports, stock adjustments

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

### Dot Matrix Printer & Paper Specs

| Property | Value |
|---|---|
| Printer model | Epson LX-300 II |
| Paper | Continuous Form 9½ × 11 inch, 3-ply NCR |
| Character width | 80 chars per line (confirmed by physical print — `=` separator fills exactly) |
| Font | Courier New 12pt, line-height 1.2 |
| `LINE_WIDTH` constant | `80` in `textFormatter.js` |

**Column widths — invoice items table (T56):**
`COL_NO=6, COL_BARANG=28, COL_BERAT=14, COL_HARGA=16, COL_TOTAL=16` (sum = 80). Harga and Total widened from 14 to 16 to prevent large Rp values merging with adjacent columns.

**Surat Jalan title width fix (T56):** The bold 20px "SURAT JALAN" title `<div>` is constrained with `display:inline-block; width:fit-content` wrapper so its border matches the `<pre>` body width exactly, eliminating the right-side gap on screen preview and print output.

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
6. **Catalog:** `itemCatalog[]` is canonical for item selection. `itemCategories[]` is for grouping/display. Any catalog rename MUST update BOTH `itemCatalog` AND `itemCategories` atomically in the same `update()` call. Two atomic rename paths exist: (a) base item rename — "Ubah Nama" on a base row calls `renameInventoryItem(oldName, newName)` which updates the catalog entry name, cascades all subtype combined names on transactions/adjustments, syncs `itemCategories` (groupName + items[]), and persists everything via `Promise.all`; (b) subtype rename — "Ubah Nama" on a subtype row calls `renameSubtype(parentCatalogId, oldSub, newSub)` which replaces `oldSub` in `parent.subtypes[]`, cascades `"${parent.name} ${oldSub}"` → `"${parent.name} ${newSub}"` across transactions/adjustments, syncs `itemCategories.items[]` (groupName unchanged), and persists via `Promise.all`. Pattern follows `updateCatalogItem` (line 1213). Never rename via the catalog edit form's Simpan button — `handleUpdateCatalogItem` no longer cascades name changes (only reachable for subtype/unit edits via `handleAddSubtype`).
7. **Print routing:** `handleInvoice` / `handleSuratJalan` in App.js check `printerType` setting to route to A4 or Dot Matrix modal. Pages never check printer type directly.

---

## 12. Known Issues & Fixed Bugs

See Section 9 of `CLAUDE.md` for full bug fix history.

### T57 — Dot matrix follow-up: restore preview width, restore bank account spacing (2026-04-29)

**Fix 1 — Surat Jalan screen preview too narrow (`DotMatrixPrintModal.js`):** The T56 `display:inline-block;width:fit-content` wrapper on the screen preview caused the modal preview to shrink to `<pre>` content width, leaving a large right gap in the modal. Fix: removed the wrapper from the screen preview JSX — reverted to `<>` fragment (title `<div>` and `<pre>` as siblings). The print portal surat jalan path retains the `display:inline-block;width:fit-content` wrapper (needed for print alignment — unrelated to screen layout).

**Fix 2 — Bank account spacing (`textFormatter.js`):** T56 removed all blank lines between bank account entries, which caused multiple bank accounts to appear visually merged. Fix: restored `if (idx > 0) lines.push("")` between groups (one blank line before each account entry after the first). No blank lines added between individual fields (`NAME BANK` / `ACCOUNT NUMBER` / `ACCOUNT NAME`) within the same group.

**Files:** `src/components/DotMatrixPrintModal.js`, `src/utils/textFormatter.js`.

---

### T56 — Dot matrix print fixes: column widths, footer overflow, surat jalan gap (2026-04-29)

Four fixes based on physical Epson LX-300 II print test.

**Fix 1 — Invoice items table column widths (`textFormatter.js`):** COL_BARANG reduced from 32 → 28; COL_HARGA and COL_TOTAL each increased from 14 → 16. Sum still 80. Large `Rp` values no longer overflow into adjacent columns.

**Fix 2 — Invoice footer blank lines (`textFormatter.js`):** Removed blank line separator between bank account entries (removed `if (idx > 0) lines.push("")` and unused `idx` param). Reduced signature block leading blank lines from 3 → 2. Prevents footer from overflowing to a second page on normal-length invoices.

**Fix 3 — Surat Jalan title width gap (screen) (`DotMatrixPrintModal.js`):** Wrapped the title `<div>` + `<pre>` in `<div style={{ display: "inline-block", width: "fit-content" }}>`. The bold 20px title was stretching to full modal width while the `<pre>` content is narrower, creating a visible right-side gap. `fit-content` constrains the wrapper to the `<pre>` width.

**Fix 4 — Surat Jalan title width gap (print) (`DotMatrixPrintModal.js`):** Same outer `display:inline-block;width:fit-content` wrapper applied to the print portal HTML string for the surat jalan path. Invoice mode in both screen and print paths completely untouched.

**Files:** `src/utils/textFormatter.js`, `src/components/DotMatrixPrintModal.js`.

---

### T16 — Remove Kelola Kategori / itemCategories (2026-04-25)

**Phase 1 (App.js):** Removed `itemCategories` state, `updateItemCategories` handler, all `sbSaveItemCategories` calls, and `generateCode` import. `addCatalogItem`, `updateCatalogItem`, `deleteCatalogItem`, `renameInventoryItem`, `renameSubtype`, and `handleImport` no longer read or write `itemCategories`. `<Inventory>` and `<StockReportModal>` render props cleaned up.

**Phase 2:** Deleted `src/components/CategoryModal.js` and `src/utils/categoryUtils.js` entirely (zero remaining code imports). Removed from `Inventory.js`: `CategoryModal` import, `showCategoryModal` state, `itemCategories`/`onUpdateCategories` props, "Kelola Kategori" button. `tableGroups` useMemo now groups directly by `itemCatalog` entry — base item name = group header, subtypes = group members, uncatalogued items → "Lainnya". `handleConfirmDelete` no longer calls `onUpdateCategories`. `StockReportModal.js` now receives `itemCatalog` prop and derives groupings from it — archived entries excluded, active subtypes listed, uncatalogued items in "Lainnya".

**Fixed audit F5:** `handleDeleteRow` in Inventory.js now checks subtype transaction counts (via `txCountMap[normItem(\`${row.catalogItem.name} ${s}\`)]`) when deciding archive vs delete for base catalog rows.

**Files:** `src/App.js`, `src/pages/Inventory.js`, `src/components/StockReportModal.js`, deleted `src/components/CategoryModal.js`, deleted `src/utils/categoryUtils.js`. Bundle: 186.27 kB (−2.48 kB vs previous).

---

### T21 — Item catalog code field (2026-04-25)

Added a `code` field to catalog items. Code is auto-generated on creation, shown as a clickable pill in Inventory group headers, and editable inline.

**`src/utils/supabaseStorage.js`:**
- `mapCatalogItem` gains `code: row.code || ''`
- `saveItemCatalogItem` upserts `code: item.code || ''`

**`src/App.js`:**
- `generateItemCode(name)` module-level helper: multi-word → uppercase initials; single-word → consonants (max 4 chars), fallback to first 2 chars
- `addCatalogItem` new-item path: `code: item.code || generateItemCode(normalizedName)`
- Merge path (existing item) unchanged — no code overwrite on subtype merge

**`src/pages/Inventory.js`:**
- State: `editingCodeId`, `editingCodeVal`, `codeWarning`
- `commitCode(catalogItem, newCode)`: trims + uppercases; if no change → close; if duplicate → keeps input open, sets warning with "Tetap Simpan?" text; if clean → saves + closes
- Warning tooltip: "Tetap Simpan" + "Batal" buttons, both using `onMouseDown` with `e.preventDefault()` to prevent `onBlur` racing before the click
- `onBlur` guarded: `if (!codeWarning) commitCode(...)` — when warning is showing, blur is a no-op
- `groupCatalogItem` now derived regardless of `isToday` — code pill visible on historical dates
- Static code pill: `onClick` guarded by `if (!isToday) return`; `cursor: isToday ? "pointer" : "default"`; `title` only shown on `isToday`
- `+ Tambah Tipe` button: wrapped in `{groupCatalogItem && isToday && (...)}` — hidden on historical dates
- Escape handler updated to include `editingCodeId`

**`src/components/StockReportModal.js`:**
- `groupedData` now pushes `code: cat.code || ''` alongside `groupName`/`items`
- Group header `<td>` renders code as a grey suffix span when `group.code` is set

**Existing items:** Supabase `code` column defaults to `''`. Shows "—" until user clicks and sets a code.

**Bundle:** 187.19 kB.

---

### T20 — ErrorBoundary auto-recovery (2026-04-25)

**Improvement:** ErrorBoundary now attempts silent auto-recovery before requiring user action.

- `retryCount` state (initial 0) + `_retryTimer` instance variable
- `componentDidCatch`: if `retryCount < 3`, schedules `setTimeout(3000)` to reset `hasError: false` and increment `retryCount`
- Transient errors (Supabase reconnect, realtime timeout, momentary render failure) recover silently without the user ever seeing the error screen
- Persistent errors re-throw and the screen reappears; after 3 failed attempts the subtitle changes to "Silakan coba lagi atau muat ulang halaman."
- `handleManualRetry`: class property arrow function, clears pending timer + calls `setState({ hasError: false })` — no page reload
- `componentWillUnmount`: clears `_retryTimer` to prevent setState-after-unmount
- Two buttons: "Coba Lagi" (blue, manual retry) + "Muat Ulang" (white/grey, page reload)

**File:** `src/components/ErrorBoundary.js`. Bundle: 186.50 kB (+190 B).

---

### T19 — StockReportModal subtype grouping fix when base is archived (2026-04-25)

**Bug fix:** Archiving a base catalog item broke subtype grouping in `StockReportModal` — active subtypes fell into "Lainnya" because the old code filtered out the entire catalog entry. Fix: replaced `activeCatalog` filter with full iteration over `(itemCatalog || [])`. Only the base row push is gated on `if (!cat.archived)`. Subtypes block unchanged — filtered by `archivedSubtypes[]` independently.

**File:** `src/components/StockReportModal.js`.

---

### T18 — Inventory.js base row always shown for active catalogued items (2026-04-25)

**Bug fix:** Base item rows disappeared from Inventory `tableGroups` after a subtype was added, if the base item had 0 stock and 0 transactions. The compound condition `!cat.archived && (!hasSubtypes || baseQty > 0 || baseTxCount > 0)` hid base rows unnecessarily. Fix: replaced with simply `if (!cat.archived)`. Removed unused `hasSubtypes`, `baseQty`, `baseTxCount` variable declarations.

**File:** `src/pages/Inventory.js`.

---

### T17 — StockReportModal zero-stock fix + company name toggle (2026-04-25)

**Bug fix — showZeroStock:** Catalog items with no stock history (no transactions, no adjustments) were invisible even when "Tampilkan stok kosong" was on because `effectiveStockMap` only contains items that have been traded. Fix: `categorized.add(key)` now runs unconditionally before the `if (entry)` check. Added `else if (showZeroStock)` branch for both base items and subtypes — pushes `{ displayName, qty: 0, unit: "karung" }` when no stockMap entry exists.

**New toggle — showCompanyName:** `useState(true)`. Company name + address block in header wrapped in `{showCompanyName && (...)}`. Toggle rendered in controls bar alongside `showZeroStock` toggle.

**File:** `src/components/StockReportModal.js`. Bundle: 186.31 kB (+41 B).

---

### T15 — ToggleSwitch component + checkbox replacement (2026-04-25)

**New component:** `src/components/ToggleSwitch.js` — props: `checked`, `onChange`, `label`, `hint?`. Fully keyboard accessible (`role="switch"`, `tabIndex=0`, Space/Enter keys). Track 44×24px, thumb 18×18px with ✓/✕ icon. Colors: `#007bff` active, `#cbd5e1` inactive.

**Checkboxes replaced:**
- `ReportModal.js`: `showCompanyName`, `showSummary`
- `StockReportModal.js`: `showZeroStock`
**New state in ReportModal.js:** `printTable1` (default true), `printTable2` (default true). Control DOM inclusion inside `docRef` — when false the section is absent from `outerHTML` captured by `printWithPortal`. Table 1 wrapped in `{printTable1 && <div...>}`. Table 2 condition: `orphanPaymentGroups.length > 0 && printTable2`. Print options bar reorganised into two labeled groups: "Tampilan" and "Sertakan saat cetak".

**Excluded:** `Settings.js` bank account `showOnInvoice` checkbox — intentional, different semantics (per-item data field, not a UI toggle).

**Files:** `src/components/ToggleSwitch.js` (new, ~65 lines), `src/components/ReportModal.js`, `src/components/StockReportModal.js`

---

### T14 — Reports two-table layout (2026-04-24)

**Problem:** Orphan payment rows (payments made today on transactions outside the date filter) appeared at the bottom of a single combined table with only a separator row. Users had no way to collapse them separately from transaction rows.

**Fix:** Split into two independent collapsible cards:
- **Table 1**: transactions within date filter with nested inline payment rows (`table1Open` state, default true)
- **Table 2**: orphan payments only, shown conditionally when `orphanPayments.length > 0` (`table2Open` state, default true)
- `orphanPayments` is a named `useMemo` (not inline IIFE) so grand total footer and Table 2 both reference it
- Orphan rows in Table 2 are clickable → `onClick={() => setDetailTx(t)}` opens TransactionDetailModal for the parent transaction
- Grand total footer standalone below both tables; color conditional: `grandTotalPaid >= 0 ? "#10b981" : "#ef4444"`

**ReportModal mirrors same structure:**
- `table1Open`/`table2Open` state vars; `orphanPaymentGroups` computed variable (replaces inline IIFE)
- `showOrphanPayments` checkbox removed — collapse toggle replaces it
- No `onClick` on orphan rows (print modal cannot open TransactionDetailModal)
- Removed unused `totalCols`, `optColCount`, renamed `isInline` → `_isInline` to fix `CI=true` build warnings

**Files:** `src/pages/Reports.js`, `src/components/ReportModal.js`

---

### T13 — Multi-item filter math fix (2026-04-22)

**Problem:** When an item filter was active on the Laporan page and a transaction contained multiple items (some matching the filter, some not), `grandTotalPaid`, subtotal rows, `optCells`/`optCellsForRow`, and CSV export all used the raw `t.value - t.outstanding` instead of the filtered item's proportional contribution. The print modal (ReportModal) had the same bug.

**Fix:** `getMultiItemContribution(t, selectedItems)` extracted to `src/utils/reportUtils.js` (shared). Both `Reports.js` and `ReportModal.js` import and use it.

**Locations fixed:**
- `grandTotalPaid` useMemo — uses `contrib.combinedCashValue` for filtered transactions; orphan payments excluded when filter active
- `optCells` / `optCellsForRow` — `contrib` param added; `effectivePaid` / `effectiveOutstanding` used when contrib present
- Multi-item subtotal row — shows "Total: Rp X (dari Rp Y)" label + `contrib.combinedSubtotal` value
- Non-filtered item rows — dimmed (opacity 0.4, grey text) when contrib present
- `mkPaymentRows` — context note "Pembayaran untuk seluruh transaksi" when contrib present
- Orphan payment rows — hidden (both screen and print) when `selectedItems.length > 0`
- CSV export `sudahDibayar` — uses `contrib.combinedCashValue` when contrib present
- `totalIncome` / `totalExpense` in ReportModal — same fix
- "Tampilkan pembayaran di luar periode" checkbox — hidden in ReportModal when filter active

**`selectedItems` passthrough:** `onReport({...selectedItems})` → `reportState.selectedItems` → `<ReportModal selectedItems={...}>`.

---

### T30 — 10-second timeout on all Supabase write operations (2026-04-26)

**Problem:** All Supabase write functions waited indefinitely for a response. On slow or dropped free-tier connections, the app would hang until the browser gave up (minutes).

**Fix (`src/utils/supabaseStorage.js`):**
Added `withTimeout(promise, ms = 10000)` helper — races any promise against a 10-second rejection. Applied to all 10 write operations: `saveTransaction`, `deleteTransaction`, `saveContact`, `deleteContact`, `saveStockAdjustment`, `deleteStockAdjustment`, both `delete` and `insert` calls inside `saveItemCategories`, `saveItemCatalogItem`, `deleteItemCatalogItem`, `saveSettings`. `SaveErrorModal` now reliably appears within 10 seconds.

**Not wrapped:** `isSupabaseReachable` (own 5s timeout), `saveActivityLog` (non-blocking, intentionally fire-and-forget), all read operations (`loadDataFromSupabase`, `loadActivityLog`), `getNextTxnSerial` (App.js already falls back to `generateTxnId()` on any error).

---

### T29 — PaymentHistoryPanel newest-first order (2026-04-26)

**Problem:** `PaymentHistoryPanel` rendered `t.paymentHistory` in natural append order (oldest-first). `TransactionDetailModal` already reversed to newest-first. Three surfaces (TransactionPage, Contacts, Outstanding) were inconsistent with the modal.

**Fix (`src/components/PaymentHistoryPanel.js`):**
1. `history = [...(t.paymentHistory || [])].reverse()` — reversed copy, original not mutated
2. `isFirst = originalIdx === history.length - 1` — creation entry is now last in reversed array
3. `PendingNode` moved to TOP of timeline in both collapsed and non-collapsed `buildNodes` paths
4. Removed `|| hasPending` from `!isLast` connector expressions — PendingNode no longer terminates the chain at the bottom
5. `PendingNode` now includes `<div className="payment-timeline__line" />` after the dot div (T40) — connector line to the first history node below was previously missing
6. `.payment-timeline__pending-node` `padding-top: 4px` removed (T41) — the offset shifted label text down vs regular nodes
7. T43 empty datetime div and T44 `min-height` both reverted (T45). `.payment-timeline__pending-label` has `margin-top: 2px`. `PendingNode` structure: dot → line → pending-node (no datetime div)
8. `PendingNode` `paddingBottom` changed `0` → `24` (T46) — matches standard node CSS; zero padding collapsed node height so `.payment-timeline__line` was too short to reach the next node's dot

**Collapse logic unchanged:** `history.slice(0, SHOW_FIRST)` still shows newest 3; `history.slice(-SHOW_LAST)` still shows the creation entry (oldest = last in reversed array). `origIdx` calculation `history.length - SHOW_LAST + idx` correctly targets the creation entry position.

**CSS fixes in same session (`src/styles.css`):**
- **Fix A:** Removed `padding-left: 16px` from `.payment-timeline__pending-node` — parent `.payment-timeline__node` already provides 16px left padding; duplicate caused PendingNode text to be misaligned (double-indented) relative to regular timeline nodes.
- **Fix B:** Increased `padding-bottom` on `.payment-timeline__node` from `16px` to `24px` — nodes were too close together, reducing readability.

---

### T28 — EDIT_NOTES extraction + audit log accuracy (2026-04-26)

**Problem 1:** `EDIT_NOTES` was declared as three independent local constants in `App.js`, `Reports.js`, and `ReportModal.js`. If a new edit note type was added to App.js (where entries are written), the other two files would silently diverge, causing `grandTotalPaid` and `alreadyPaid` to disagree.

**Fix:** `EDIT_NOTES` exported from `src/utils/reportUtils.js`. All three files import from there. Do not declare locally.

**Problem 2:** In `editTransaction`, the `editPaymentEntry` audit block used `nt.outstanding` (form value) for `outstandingAfter`, `paidAfter`, and `statusAfter` — but after T27 the actual stored outstanding is `out` (corrected value). When T27 differed from the form, the audit history showed misleading numbers.

**Fix:** `editPaymentEntry` now uses `out` for `outstandingAfter` and `paidAfter`, and `deriveStatus(nt.type, out > 0)` for `statusAfter`.

**Problem 3:** `financialChanged` compared `Number(x.outstanding) !== Number(nt.outstanding)` — if T27 silently corrected a legacy inconsistency but the user didn't change outstanding in the form, `financialChanged` was false and no audit entry was created.

**Fix:** `financialChanged` now compares `Number(x.outstanding) !== out`.

---

Key patterns to never reintroduce:
- UTC off-by-1: never use `new Date(dateStr + "T00:00:00")` (no Z) for date arithmetic
- Status strings: never write `"Lunas"` etc. as raw literals — use `deriveStatus()` or `STATUS.*`
- `setData()` outside App.js: never call it directly
- `.push()` on state arrays: never mutate state in place
- `generateTxnId` with expense transactions: filter to income only (function handles this internally)
- `generateTxnId` collision: **FIXED** via atomic DB sequence. `addTransaction` and `editTransaction` (when YY-MM prefix changes) are both now `async` and call `getNextTxnSerial(date)` (Supabase RPC) before `update()` in Supabase mode. Fall back to local `generateTxnId()` on RPC error. Short-term collision detection toast kept as defense-in-depth — **never remove it**.
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
- `applyPayment` / `editTransaction` not incrementing `version`: `saveTransaction()` writes `(tx.version || 0) + 1` to Supabase. Every handler that calls `sbSaveTransaction` must also increment `version` in local state (inside `update()`) to keep local and Supabase versions in sync. Without this, the next `editTransaction` call will see a stale local version and fire a false-positive conflict modal. **FIXED** in both `applyPayment` (`version: (t.version || 0) + 1` using `t` = current tx) and `editTransaction` (`version: (x.version || 0) + 1` using `x` = pre-edit tx). Always use the pre-mutation transaction's version as the base. Pattern must be followed by any future handler that upserts a transaction.
- `checkVersion` called with already-incremented local version: `saveTransaction()` and `saveContact()` were comparing `tx.version` (post-increment in local state) against Supabase's stored version (pre-increment), producing a guaranteed mismatch (e.g. local=2, Supabase=1) and a false-positive conflict modal on every edit. **FIXED** — both calls now use `(tx.version || 1) - 1` / `(contact.version || 1) - 1` to pass the version Supabase currently holds. File: `src/utils/supabaseStorage.js` L175, L223.
- `logActivity` with `nt.txnId` for income: `txnId` is generated inside `update()` state fn — always use `newTx?.txnId` (for create) or `updated?.txnId || nt.txnId` (for edit) so the generated ID is captured correctly
- ActivityLog entity_id for transactions: use `isTxnId()` pattern check before displaying — old entries have internal IDs, new entries have `YY-MM-NNNNN` format
- Cloudflare DDoS/rate limiting: deferred until custom domain is purchased. See Section 14 for setup steps.
- Supabase free tier auto-pause: gracefully handled — `isSupabaseReachable()` is checked on load failure and write failure; shows `DatabasePausedScreen` with restore instructions instead of the generic `SaveErrorModal`. External keep-alive cron (cron-job.org, every 5 days) prevents pauses proactively.
- Rename catalogued items via "Ubah Nama" button: that button is intentionally hidden on catalogued/subtype rows (B10 fix). Catalog renames must go through "Edit Barang" → catalog edit form → `handleUpdateCatalogItem` → `onRenameItem`. The "Ubah Nama" path only touches transactions and stock adjustments and leaves the catalog entry stale. **B12 (2026-04-20):** `handleUpdateCatalogItem`'s rename cascade was previously unreachable dead code — no button opened the catalog edit form with a pre-populated item. Fixed by adding "Edit Barang" action button on catalogued and subtype rows (`isToday && (row.catalogItem || row.isSubtype)`). File: `src/pages/Inventory.js` **SUPERSEDED by B2 (2026-04-20):** Edit Barang button was a stopgap that became unnecessary after B13 fixed `renameInventoryItem` to handle catalog atomically. B2 removed the Edit Barang button and rewired Ubah Nama to serve catalogued rows instead.
- `renameInventoryItem` only cascading base name (not catalog entry or subtype combined names): the function must use the `nameMap` pattern to rename all variants atomically. **B13 (2026-04-20):** `renameInventoryItem` previously only updated `t.itemName`, `t.items[].itemName`, and `stockAdjustments[].itemName` for the exact base name — catalog entry name went stale and `"Base Sub"` combined names on transactions were not renamed. Fixed by rewriting `renameInventoryItem` to build a `nameMap` (base + all `"${oldBase} ${sub}"` variants), apply via `mapName` across all records, update `itemCatalog[].name` in state, and persist the renamed catalog entry via `sbSaveItemCatalogItem` in the Supabase callback. Catalog match captured by ID in closure variable (`catalogMatchId`) using `if (catalogMatch) catalogMatchId = catalogMatch.id` — NOT `catalogMatch?.id || null`. On Supabase retry, `update(fn)` re-runs `fn` on already-renamed state, so `find()` returns `undefined`; the `||null` form would overwrite the captured ID and cause the catalog entry to be skipped in the Supabase callback. Uncatalogued path unchanged. File: `src/App.js`
- Edit Barang button removed and Ubah Nama unhidden on catalogued base rows: after B13, `renameInventoryItem` handles catalog + cascade atomically, so routing through the catalog edit form was no longer correct. **B14 (2026-04-20):** Removed Edit Barang button; changed Ubah Nama condition to `isToday && !row.isSubtype` (was `!row.catalogItem && !row.isSubtype`); deleted dead cascade block inside `handleUpdateCatalogItem` (was `if (original && normItem(original.name) !== normItem(updatedItem.name)) { onRenameItem(...) }`); extended `openRename(itemName, unit, isCatalogued = false)` to store `isCatalogued` in `renameTarget`; added merge-block guard in `handleRenameConfirm` — if `renameTarget.isCatalogued && !isSameKey && newName in activeStockMap`, shows "Nama ini sudah dipakai oleh item lain. Pilih nama yang belum ada." (merging catalog entries is unsafe). Uncatalogued merge-confirm unchanged. Subtype rename deferred to B3 — **RESOLVED by B15.** File: `src/pages/Inventory.js`
- Subtype rename had no UI path (deferred from B14). **B15 (2026-04-20):** Added `renameSubtype(parentCatalogId, oldSub, newSub)` to App.js — atomically replaces `oldSub` with `newSub` in `parent.subtypes[]` and cascades `"${parent.name} ${oldSub}"` → `"${parent.name} ${newSub}"` across `t.itemName`, `t.items[].itemName`, and `stockAdjustments[].itemName`; persists via `Promise.all([...touched transactions, ...touched adjustments, sbSaveItemCatalogItem(parent)])`. No closure-capture needed — `parentCatalogId` is passed directly. Wired as `onRenameSubtype` prop. `openRename` extended with `subtypeContext = null` fourth param; `handleRenameConfirm` subtype branch: (1) `isSameKey` → close modal silently; (2) parent-prefix guard (error "Nama parent tidak bisa diubah..."); (3) strip prefix to get `newSub`; (4) check all parent subtypes including `archivedSubtypes[]` (error "Tipe ini sudah ada..."); (5) call `onRenameSubtype`. Ubah Nama button condition changed from `isToday && !row.isSubtype` to `{isToday && (` — now shows on all rows. Files: `src/App.js`, `src/pages/Inventory.js`
- `renameInventoryItem` (B13) and `renameSubtype` (B15) updated `itemCatalog` but left `itemCategories` stale — renamed items showed as uncategorized phantoms in Inventory UI. **B16 (2026-04-20):** Both handlers now sync `itemCategories` inside the same `update()` state function (following the `updateCatalogItem` pattern at App.js line 1213) and call `sbSaveItemCategories(nd.itemCategories, user.id)` in the Supabase callback. `renameInventoryItem`: matches category by `normItem(cat.groupName) === normItem(oldName)`, sets `groupName: newName`, rebuilds `items[]` with new base key + new combined subtype keys; `sbSaveItemCategories` guarded by `catalogMatchId` (uncatalogued path unchanged). `renameSubtype`: matches category by parent name (groupName unchanged), rebuilds `items[]` using `updatedSubtypes` — post-rename map of `parent.subtypes` (NOT the pre-mutation `parent.subtypes` reference); `sbSaveItemCategories` always called. File: `src/App.js`
- CategoryModal showed all catalog items including archived — inconsistent with main Inventory view. **B17 (2026-04-20):** Phase 1 archive-aware filter. New `itemCatalog` prop added. Two `useMemo` sets (`archivedCatalogKeys`, `activeCatalogKeys`) keyed only on `itemCatalog`; subtypes evaluated independently of base archive status (matches Inventory.js lines 499–506). `showArchived` toggle (default `false`) filters pills: off=active only; on=active+archived. Orphan keys (in neither set — stale references in `itemCategories.items[]`) always hidden; one-shot `console.warn` on mount. Category groups hidden entirely when 0 visible items, except when `editingName === cat.id`. Uncategorized section: archived keys hidden when toggle off; uncataloged-with-txs keys (not in either set) always shown. `handleSave` untouched — archives never removed from `localCats`, category references preserved. CSS: `.cat-modal__item-pill--archived` (opacity 0.55 + strikethrough), `.cat-modal__archive-toggle`, `.cat-modal__archive-hint`. Files: `src/components/CategoryModal.js`, `src/pages/Inventory.js`, `src/styles.css`
- **B18 (2026-04-21):** Phase 2 inline category edit on Inventaris main page. (1) Extracted 3 pure helpers from CategoryModal into `categoryUtils.js`: `isDuplicateCategoryName`, `isDuplicateCategoryCode`, `cascadeCodeUpdate` — all pure functions, no React, no ref side-effects. `normItem` added to categoryUtils import. (2) Refactored `CategoryModal.commitName`/`commitCode` to use helpers; `codeManuallyEdited` ref cleanup stays in CategoryModal's `setLocalCats` callback. Behavior identical. (3) Threaded `id: cat.id` into `tableGroups` groupMap entries; `id: null` for synthetic "Lainnya" group. (4) Inline name+code edit on main page group headers: 4 new state vars (`editingGroupName`, `editingGroupCode`, `groupNameError`, `groupCodeError`); `commitGroupName` + `commitGroupCode` + 2 keydown handlers; pencil icon (`edit`, size 12) shown only when `group.id && isToday && itemCategories.some(c => c.id === group.id)` (guards auto-detected groups not yet in `itemCategories`). Enter/blur commits, Escape cancels. Code edit applies `cascadeCodeUpdate`. Global Escape handler extended with `editingGroupName`/`editingGroupCode` at highest priority. CSS: `.inventory-group-edit-btn` with rgba white-alpha for dark navy header. Files: `src/utils/categoryUtils.js`, `src/components/CategoryModal.js`, `src/pages/Inventory.js`, `src/styles.css`
- **B20 (2026-04-22):** Phase 3 — stripped CategoryModal to commit-immediately semantics (604 → 382 lines). Removed: `localCats` state, `dragItem`/`dragOverTarget`/`dirty`/`showConfirmCancel` state, `newGroupRef`, all 7 drag handlers (`handleItemDragStart`, `handleGroupDragStart`, `handleDragOver`, `handleDragEnter`, `handleDragLeave`, `handleDrop`, `handleDragEnd`), `deleteGroup`, `createNewCategory`, `handleSave`, `handleCancel`, `getGroupClassName`, drag JSX on group divs and item pills, trash button, "Buat Kategori Baru" button, Batal/Simpan footer buttons, `showConfirmCancel` overlay, `generateId` and `Icon` imports. Added: `displayCategories = useMemo(() => autoDetectCategories(stockMap, categories), [stockMap, categories])` — always reflects latest prop. `commitName`/`commitCode` refactored to operate on `displayCategories` directly and call `onSave()` immediately. Footer: single "Tutup" button (`onClick={onClose}`). Inventory.js: `onSave={(cats)=>{onUpdateCategories(cats); setShowCategoryModal(false)}}` → `onSave={onUpdateCategories}` (modal stays open; user closes via Tutup or Escape). styles.css: removed `.cat-modal__group--drag-over`, `.cat-modal__group--merge-target`, `.cat-modal__group-drag` + `:active`, `.cat-modal__group-delete` + `:hover`, `.cat-modal__item-pill--dragging`, `.cat-modal__item-pill:active { cursor: grabbing }`. Files: `src/components/CategoryModal.js`, `src/pages/Inventory.js`, `src/styles.css`, `src/components/CLAUDE.md`, `src/CLAUDE.md`, `DEVELOPER_HANDOFF.md`

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
- **H2:** Resolved — see `txn_counters` table and `next_txn_serial()` RPC. Short-term collision toast remains as defense-in-depth.
- Custom domain is live at `ajspt.com` — Cloudflare rate limiting rules can now be configured as needed.
- Family member account creation is manual (Supabase Dashboard). No self-registration flow exists — intentional for a private family business app.

---

## 14. Deployment

### Production
- **URL:** https://ajspt.com
- **Host:** Cloudflare Pages (free tier — 500 builds/month, no build minute limits)
- **Repo:** github.com/fangCodeZera/buku-kas (also mirrored under PT-CHANG-JAYA org)
- **Branch:** main (auto-deploys on push)
- **Build command:** `npm run build`
- **Publish directory:** `build`
- **Environment variables (Cloudflare Pages):** `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`

### Supabase
- **Project:** PT CHANG JAYA / BukuKas
- **URL:** https://yjqhgmbgbfjmytgtqtmu.supabase.co
- **Region:** Singapore (ap-southeast-1)
- **Plan:** Free tier (auto-pauses after 1 week inactivity)
- **Auth:** Email + Password only
- **Site URL:** https://ajspt.com
- **Realtime:** Enabled on transactions, contacts, stock_adjustments, item_catalog

### Supabase Tables (8 total)
| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | User display name, role (owner/staff), is_active | ✅ |
| `transactions` | All income + expense transactions (full JSON-like row) | ✅ |
| `contacts` | Contact list with archived flag — `UNIQUE INDEX idx_contacts_name_unique_lower ON contacts (lower(name))` enforces case-insensitive uniqueness at DB level (added 2026-05-01) | ✅ |
| `item_catalog` | Catalog items with subtypes + archive state | ✅ |
| `stock_adjustments` | Manual stock correction entries | ✅ |
| `app_settings` | Per-user settings row (one row per user_id) | ✅ |
| `activity_log` | Audit trail — action, entity, user, timestamp, changes | ✅ |
| `txn_counters` | Atomic invoice serial counter per YY-MM prefix | No RLS (function-level) |

**`txn_counters` schema:** `prefix TEXT PRIMARY KEY, last_serial INTEGER NOT NULL DEFAULT 0`

**`next_txn_serial(p_prefix TEXT)` Postgres function:**
```sql
INSERT INTO txn_counters (prefix, last_serial)
VALUES (p_prefix, 1)
ON CONFLICT (prefix) DO UPDATE
  SET last_serial = txn_counters.last_serial + 1
RETURNING last_serial;
```
Called by `getNextTxnSerial(dateStr)` in `supabaseStorage.js`. Returns `"YY-MM-NNNNN"` string. Falls back to local `generateTxnId()` on RPC error.
**Security (2026-05-01):** Function updated with `SECURITY DEFINER` and `SET search_path = public` to prevent search path injection. No behaviour change for callers.

**`sync_txn_counter(p_prefix TEXT, p_serial INTEGER)` Postgres function:**
```sql
INSERT INTO txn_counters (prefix, last_serial)
VALUES (p_prefix, p_serial)
ON CONFLICT (prefix) DO UPDATE
  SET last_serial = GREATEST(txn_counters.last_serial, p_serial);
```
Called by `syncTxnCounter(dateStr, txnId)` in `supabaseStorage.js` after a successful fallback save (when `getNextTxnSerial` failed and local `generateTxnId()` was used instead). `GREATEST()` ensures the counter is only raised — never decremented. Non-blocking; failures are silently swallowed inside `syncTxnCounter` and never trigger `SaveErrorModal`.

**`activity_log` indexes (5 total):** `id` (PK), `created_at DESC` (`idx_activity_log_created`), `user_id` (`idx_activity_log_user`), `action` (`idx_activity_log_action`, added 2026-04-29), `entity_type` (`idx_activity_log_entity_type`, added 2026-04-29). The last two were added to support filter queries in `loadActivityLog` as the log grows.

### Security in Production
- RLS enabled on all 8 tables (role-aware policies; txn_counters is function-level access only)
- Session idle timeout: 15 minutes (auto sign-out via setTimeout + visibilitychange timestamp check — survives device sleep/shutdown)
- HTTP security headers via public/_headers (CSP, X-Frame-Options, etc.) — served by Cloudflare Pages
- Supabase anon key is public by design — RLS enforces all access control
- Service role key exists only in local .claude/claude_mcp_config.json (gitignored)

### Cloudflare Pages (active)
App is hosted on Cloudflare Pages — Cloudflare edge DDoS protection and CDN are active by default.
Custom domain `ajspt.com` is live (2026-05-01). Auto-renewal enabled in Cloudflare Registrar. Fallback URL: `buku-kas.pages.dev`. CSP connect-src already tightened to the specific Supabase project URL. Custom Cloudflare rate limiting rules (WAF rules) can be configured as needed if traffic patterns warrant it.

### Keep-Alive (prevents Supabase free tier pause)
An external cron job pings the Supabase REST API every 5 days to prevent auto-pause:
- **Service:** cron-job.org (free tier)
- **URL:** `https://yjqhgmbgbfjmytgtqtmu.supabase.co/rest/v1/profiles?select=id&limit=1`
- **Headers:** `apikey: <anon key>`, `Authorization: Bearer <anon key>`
- **Schedule:** Every 5 days
- If the cron ever fails and the DB pauses, the app shows a friendly "Database Sedang Istirahat" screen (`DatabasePausedScreen`) with a link to Supabase Dashboard and a "Coba Lagi" button.
- **Important:** cron-job.org free tier requires a login every 6 months to keep the account active. Last checked: 2026-05-01.

### Adding Family Members
Create accounts via Supabase Dashboard → Authentication → Users → Invite User:
1. Enter family member's email address
2. After account is created, go to Table Editor → profiles table
3. Set `role` to `owner` (Pemilik) or `staff` (Karyawan) for each user
4. Set `is_active` to `true`
5. Share the production URL and have them set their password on first login
6. Users can reset their own password at any time via the "Lupa Password?" link on the login page — no admin action required

### Redeploying
Any push to `main` branch auto-deploys to Cloudflare Pages. To manually redeploy:
1. Go to dash.cloudflare.com → Pages → buku-kas → Deployments
2. Click "Retry deployment" on the latest deployment
If environment variables change, redeploy is required for changes to take effect.

---

## 15. What Was Done

### T79 (2026-05-02): Fixed stale Sudah Dibayar in Laporan after value edit

**Bug:** Laporan page payment row showed wrong Sudah Dibayar amount after a Lunas transaction's value was edited. Example: transaction created as Lunas at Rp 730.870.000, edited to Rp 73.087.000 — payment row still showed Rp 730.870.000.

**Root cause:** `mkPaymentRows` in `Reports.js` reads `ph.amount` directly from payment history entries. The initial creation entry (note = `"Lunas saat transaksi dibuat"`) stores the amount at creation time and is never updated when the transaction value is edited later.

**Fix:** For entries where `ph.note === "Lunas saat transaksi dibuat"`, use `Number(t.value) - (Number(t.outstanding) || 0)` instead of `ph.amount` — this always reflects the correct current paid amount based on the last edit. All other payment entries (partial payments via `applyPayment`) are untouched and unaffected.

**Applied in three places in `Reports.js`:**
1. `mkPaymentRows` Sudah Dibayar cell — screen display
2. Orphan payment row (Table 2) Sudah Dibayar cell — screen display
3. `exportCSV` — both inline and orphan payment rows via `effectiveAmount` variable

**Not affected:** `grandTotalPaid` (already uses `t.value - t.outstanding`), transaction row `paid` calculation, partial payment flows, `outstandingBefore`/`outstandingAfter` audit display lines.

**File:** `src/pages/Reports.js`

---

### T78 (2026-05-02): Fixed Lunas → Belum Lunas reversal bug

**Bug:** Editing a transaction from Lunas to Belum Lunas with Sudah Dibayar = Rp 0 had no effect — transaction stayed Lunas after saving.

**Root cause:** T27 in `editTransaction` recomputes outstanding from payment history. When a transaction is created as Lunas, the initial payment entry records the full amount. So `alreadyPaid = full value`, `correctOutstanding = 0`, `out = 0` — Lunas — regardless of what the user entered in the form.

**Fix (two parts):**
1. Added `isFullReversal` detection: `const isFullReversal = Number(nt.outstanding) === newValue && newValue > 0`. When true, bypasses T27 recomputation and sets `out = newValue` directly — honoring the user's explicit intent.
2. On full reversal, all prior positive payment history entries are voided (amount → 0, note → "Pembayaran dikoreksi — diubah ke Belum Lunas") so the payment timeline doesn't show a contradictory "paid in full" entry alongside a Belum Lunas status. EDIT_NOTES entries (amount=0) are left untouched. The `editPaymentEntry` "Detail Perubahan" audit entry is still appended normally.

**Not affected:** partial payment edits, `addTransaction`, `applyPayment`. T27 normal path unchanged for all non-reversal edits.

**File:** `src/App.js`

---

### T77 (2026-05-02): StockReportModal quantity display fix

Quantity column in Laporan Stok showed `.00` suffix on all values (e.g. `347.00 KARUNG`, `1055.00 KARUNG`) because `item.qty.toFixed(2)` was used. Fixed: replaced with `Number.isInteger(item.qty) ? item.qty.toLocaleString("id-ID") : item.qty.toFixed(2)`. Whole numbers now display without decimals using Indonesian locale formatting (e.g. `1.055 KARUNG`). File: `src/components/StockReportModal.js`

---

### T76 (2026-05-02): Fixed txnId fallback counter sync gap

**Problem:** When `getNextTxnSerial()` fails (network blip, RPC timeout), `addTransaction` falls back to local `generateTxnId()` and saves the transaction successfully. But `txn_counters` is never updated with the serial that was used locally. On the next successful RPC call, `next_txn_serial()` returns the same serial — creating a duplicate txnId for a different transaction.

**Fix — three parts:**

1. **`sync_txn_counter(p_prefix, p_serial)` Postgres function** (database) — `INSERT … ON CONFLICT DO UPDATE SET last_serial = GREATEST(last_serial, p_serial)`. Safely raises the counter to at least `p_serial` without risk of decrementing if the fallback serial was lower than the current DB value.

2. **`syncTxnCounter(dateStr, txnId)` export in `supabaseStorage.js`** — parses `YY-MM` prefix from `dateStr` (UTC), extracts the integer serial from `txnId`, calls the RPC. Entire function is wrapped in `try/catch`; failures log a warning and return silently.

3. **`usedFallback` flag + `.then()` in `addTransaction` (App.js)** — plain `let usedFallback = false` (not state, no re-render) set to `true` inside the `getNextTxnSerial` catch block. After the Supabase save `Promise.all` succeeds, a `.then()` checks `usedFallback && newTx?.txnId` and calls `syncTxnCounter(...).catch(() => {})`. This is non-blocking — the `.then()` runs after the user sees their transaction saved. The `.catch(() => {})` swallows any error from `syncTxnCounter` so it can never propagate to `SaveErrorModal`.

**Defense-in-depth layers after this fix:**
- Layer 1: `next_txn_serial()` — atomic DB sequence, no collision possible (primary path)
- Layer 2: Short-term collision detection toast (pre-existing, secondary)
- Layer 3: `sync_txn_counter` — resync after fallback so Layer 1 stays accurate (new, tertiary)

**Files:** `src/utils/supabaseStorage.js`, `src/App.js`

---

### T73-REVERT (2026-05-01): Reverted 2-year date filter from loadDataFromSupabase

T73 added `.gte('date', cutoffDate)` to the `transactions` and `stock_adjustments` queries in `loadDataFromSupabase` to improve load performance at scale. Reverted because `computeStockMap()` runs on whatever transactions are in memory — transactions excluded by the date filter are silently excluded from stock calculations, producing wrong inventory numbers after 2 years with no error or warning to the user.

Wrong stock numbers are worse than slow load times. Full transaction history is now always loaded.

**Accepted trade-off:** At 50 transactions/day, year 3 will have ~54,000 transactions. Estimated load time on mobile: 4-6 seconds. This is annoying but not broken.

**Fix when load time becomes painful (year 3+):** Upgrade to Supabase Pro ($25/month) for better query performance. Alternatively implement a stock snapshot pattern — but only with a developer who understands the edge cases (editing historical transactions after snapshot date requires snapshot regeneration).

**File:** `src/utils/supabaseStorage.js`

---

### T75 (2026-05-01): Database hardening — contacts unique index + RPC security

Two database-level security and integrity improvements. No code changes — database only.

**Fix 1 — contacts unique index:** Added `CREATE UNIQUE INDEX idx_contacts_name_unique_lower ON contacts (user_id, lower(name))`. Enforces case-insensitive contact name uniqueness at the database level. Prevents duplicate contacts from concurrent writes that slip past the app-level `nameError` validation guard (e.g. two users adding the same contact name simultaneously). The existing app-level duplicate check in `Contacts.js` and `createContact` is unchanged — this is a defense-in-depth layer.

**Fix 2 — `next_txn_serial()` search path security:** Re-created the `next_txn_serial()` Postgres function with `SECURITY DEFINER` and `SET search_path = public`. Without `SET search_path`, a malicious schema created by an attacker that shadows `public` could theoretically redirect the function's table references. `SECURITY DEFINER` runs the function as its owner (postgres); `SET search_path = public` pins the schema resolution. No behaviour change for callers — `getNextTxnSerial()` in `supabaseStorage.js` is unchanged.

---

### T74 (2026-05-01): Activity log auto-cleanup via pg_cron

Installed `pg_cron` extension in Supabase (v1.6.4 — available on free tier). Created `cleanup_old_activity_logs()` database function with `SECURITY DEFINER` and `SET search_path = public` that deletes all `activity_log` rows where `created_at < NOW() - INTERVAL '3 months'`. Scheduled as a daily cron job `cleanup-activity-log` at `0 2 * * *` (2AM UTC) via `cron.schedule()`.

**Effect:** `activity_log` now self-maintains. At 50 entries/day maximum, 3 months = ~4,500 rows maximum sustained. In practice the table will stay well under 22,500 rows permanently. No code changes — database only.

**Verification queries run:**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';          -- v1.6.4 ✓
SELECT proname FROM pg_proc WHERE proname = 'cleanup_old_activity_logs'; -- exists ✓
SELECT jobname, schedule FROM cron.job WHERE jobname = 'cleanup-activity-log'; -- 0 2 * * * ✓
```

---

### T73 (2026-05-01): Date-range loading — last 2 years only

`loadDataFromSupabase` in `supabaseStorage.js` previously fetched all transactions and stock_adjustments regardless of age. At year 3+ scale (~55,000 rows × ~2KB = ~110MB payload), this would cause slow cold-start load times and potential memory pressure.

**Change:** Computed `cutoffDate = new Date(); cutoffDate.setFullYear(cutoffDate.getFullYear() - 2); cutoffDate.toISOString().slice(0,10)` before the `Promise.all` call. Added `.gte('date', cutoffDate)` to the `transactions` query and the `stock_adjustments` query. Contacts, `item_catalog`, and `app_settings` are small tables — fetched without date filter as before.

Older records remain in Supabase and are never deleted. The filter uses the existing `idx_transactions_date` index. Build: 188.46 kB (−181 B).

**File:** `src/utils/supabaseStorage.js`

---

### T71 (2026-05-01): Riwayat Stok — sort by date+time, ignore createdAt

Fixed `ledgerEntries` useMemo sort comparator in `Inventory.js`. Previously sorted by `createdAt` (ISO timestamp) when present, falling back to `date + time` — this caused manual stock adjustments (which may lack `createdAt` or have a `createdAt` that doesn't match their `date`/`time`) to float out of chronological position relative to same-day transactions.

**Change:** Replaced the two-branch comparator with a single path: always parse `date + time` as a local datetime string. `createdAt` is now ignored entirely. The running total calculation (`runningQty`) and the `visibleLedgerEntries` newest-first reverse are untouched — they automatically reflect the corrected order.

**File:** `src/pages/Inventory.js`

---

### T70 (2026-05-01): Dot matrix invoice footer — blank line when no bank accounts, remove signature brackets

Two changes to `formatInvoiceFooter()` in `textFormatter.js`:

1. **Blank line when no bank accounts:** Added `else { lines.push(""); }` after the `if (shown.length > 0)` bank account block. Previously, when no bank accounts were configured, nothing was pushed between the TOTAL line and the TANDA TERIMA labels — the signature block appeared immediately after TOTAL with no gap. Now one blank line always appears before TANDA TERIMA regardless of whether bank accounts are shown.

2. **Removed signature brackets:** Deleted the `sigLine` const (`padRight("(" + " ".repeat(26) + ")", 40) + padLeft(...)`) and removed it from `lines.push(...)`. The signature block now ends with just the two blank lines for signature space — no parentheses.

`formatSuratJalanFooter` is untouched (its brackets were already removed in T67). No other functions touched.

**File:** `src/utils/textFormatter.js`

---

### T69 rev2 (2026-05-01): Dot matrix modal — center pre with inline-block shrink-to-fit

Revised T69 again. `modal-box` `maxWidth` stays at `1000`. Change to the preview block:

Wrapped `<pre className="dot-matrix-preview">` in `<div style={{ textAlign: "center" }}>`. Added `display: "inline-block", textAlign: "left"` to the `<pre>` inline style. The `inline-block` causes the pre to shrink to its content width (the 80-column text) rather than stretching to fill the full modal — eliminating the right-side whitespace gap. The centering div visually centres the now-narrower block. `textAlign: "left"` on the pre keeps text left-aligned inside the centred container. Applies to both invoice and surat jalan modes. Print unaffected.

**File:** `src/components/DotMatrixPrintModal.js`

---

### T68 (2026-05-01): Dot matrix Surat Jalan — fix catatan gap logic, fix screen preview width

Two targeted fixes to the Surat Jalan dot matrix output and preview.

**Change 1 — `textFormatter.js` `formatSuratJalanItems`:** Removed the trailing `""` blank line that was added in T67 (`return [header, divider, ...items, SEP_MAJOR]` — no trailing blank). The gap between items and footer is now owned by `formatSuratJalanFooter` instead.

**Change 2 — `textFormatter.js` `formatSuratJalanFooter`:** Fixed gap logic so both cases are symmetric:
- **With catatan:** no blank line before catatan; one blank line after catatan; then labels + two blank lines.
- **Without catatan:** one blank line before labels; then labels + two blank lines. (Previously: no blank line before labels when catatan was absent, creating a gap only in the catatan case.)
Implementation: added `else { lines.push(blankLine); }` branch to the existing `if (catatanPengiriman.trim())` block.

**Change 3 — `DotMatrixPrintModal.js` JSX `<pre>`:** Added `maxWidth: "80ch"` and `overflowX: "auto"` to the screen preview `<pre>`'s inline style. Previously the `<pre>` stretched to the full modal width on wide desktop screens, making 80-column content appear wider than intended. The constraint is cosmetic only — `printWithPortal()` renders the print HTML independently, so print output is completely unaffected.

**Files:** `src/utils/textFormatter.js`, `src/components/DotMatrixPrintModal.js`

---

### T67 (2026-05-01): Dot matrix Surat Jalan — revert to plain ASCII block, remove signature brackets, add footer gap

Reverted the Surat Jalan dot matrix preview and print to render as a single `<pre>` block, matching the invoice path. Removed the bracketed signature lines from the footer. Added a blank line between the items table and the signature block.

**Change 1 — `DotMatrixPrintModal.js` `handlePrint`:** The surat jalan branch previously split `formattedText` on `"\n"`, extracted `lines[0]` as a bold 20pt title, and rendered the rest as a body `<pre>` inside a `display:inline-block` wrapper div. Replaced with the same pattern as the invoice branch: escape `&`/`<`/`>` and wrap the full `formattedText` in a single `<pre style="...">` string.

**Change 2 — `DotMatrixPrintModal.js` JSX:** Replaced the mode-conditional IIFE (which rendered a bold title `<div>` + body `<pre>` for surat jalan, and a plain `<pre>` for invoice) with a single unconditional `<pre className="dot-matrix-preview" style={{ lineHeight: 1.2 }}>`. No leftover unused variables. Bundle shrank by 278 B.

**Change 3 — `textFormatter.js` `formatSuratJalanItems`:** Added `""` (blank line) after `SEP_MAJOR` at the end of the returned array — creates a visible gap between the items table and the TANDA TERIMA / HORMAT KAMI footer labels.

**Change 4 — `textFormatter.js` `formatSuratJalanFooter`:** Removed the `sigLine` const declaration (`padRight("(" + " ".repeat(26) + ")", 40) + padLeft(...)`) and its usage. The final `lines.push` now ends with `blankLine, blankLine` — two lines of signature space, no parentheses. The `catatanPengiriman` block at the top of the function is untouched. `formatInvoiceFooter` (which has its own `sigLine`) is untouched.

**Files:** `src/components/DotMatrixPrintModal.js`, `src/utils/textFormatter.js`

### T66 (2026-05-01): Four fixes — updateContact version, Icon contacts, Inventory ToggleSwitch, CSP tighten

Four independent fixes:

- **updateContact version sync:** `contacts` map in `updateContact`'s `update()` state function now increments `version: (c.version || 0) + 1`. Previously Supabase wrote version N+1 but local state stayed at N, causing a false-positive conflict modal on the next edit of a cascade-renamed transaction. Same root cause and fix pattern as `applyPayment`/`editTransaction`. Uses `c.version` (pre-update from state), not `contact.version` (from form). File: `src/App.js`
- **Icon.js contacts path:** Replaced clipped multi-person group silhouette with a clean single-person icon (full circle head + body arc). Icon name `contacts` unchanged. File: `src/components/Icon.js`
- **Inventory ToggleSwitch:** "Tampilkan item tanpa transaksi" plain `<input type="checkbox">` replaced with `ToggleSwitch` component to match all other toggles in the app. State variable `showEmptyItems` and logic unchanged. File: `src/pages/Inventory.js`
- **CSP tightened + custom domain live:** `public/_headers` `connect-src` changed from wildcard `*.supabase.co` to specific project URL `yjqhgmbgbfjmytgtqtmu.supabase.co`. App now live at `https://ajspt.com`. Supabase Site URL and Redirect URLs updated to custom domain. File: `public/_headers`

### T65 (2026-04-30): ActivityLog.js load-more error handling

Fixed A1: when "Muat Lebih Banyak" failed, the `catch` block unconditionally called `setError(...)`, causing the `!loading && !error && allLogs.length > 0` table guard to evaluate false and hide the already-loaded first-page data. The user was left with a blank screen and no retry path.

**Root cause:** `loadLogs` used a single `error` state for both the initial page-0 load (where no data exists to fall back on) and subsequent page loads (where first-page data should remain visible).

**Fix (four steps):**
1. Added `loadMoreError` / `setLoadMoreError` state variable alongside `error`.
2. Updated `catch` to branch on `pageNum`: `pageNum === 0` → `setError(...)` (full-page failure, nothing to show); `pageNum > 0` → `setLoadMoreError("Gagal memuat entri lebih lama. Silakan coba lagi.")` (first-page data stays visible).
3. Added `setLoadMoreError(null)` at the start of `loadLogs` alongside the existing `setError(null)` — clears the banner when any load attempt begins.
4. Added inline `alert-banner--danger` banner above the "Muat Lebih Banyak" button that appears when `loadMoreError` is set — gives the user explicit feedback and the button remains enabled for retry.

After the fix: a load-more failure shows the error banner below the table, the table and retry button remain visible, and `page` stays at its current value so the retry correctly requests the same next page.

### T64 (2026-04-30): Four Settings.js bug fixes

Four bugs fixed across `src/pages/Settings.js` and `src/styles.css`.

- **S1 — `handleSave` sends stale numeric values when user hasn't blurred:** Three numeric fields (`defaultDueDateDays`, `lowStockThreshold`, `maxBankAccountsOnInvoice`) use separate string state (`dueDaysStr`, `lowStockStr`, `maxBankStr`) that only writes back to `form` on `onBlur`. `handleSave` called `onSave(form)` directly — if the user typed a new value and clicked Simpan without first blurring the field (e.g. Tab), the field's previous blurred value was saved, silently discarding the typed change. Fix: parse all three string states inline inside `handleSave` using the same validation rules as their `onBlur` handlers, build `finalForm`, call `onSave(finalForm)` instead of `onSave(form)`.
- **S2 — form not re-synchronized after successful import:** `form` is initialized once from `settings` on mount and never re-synced. After a successful import, App.js replaces `settings` (via `onImport` → `setData` → `data.settings` prop changes), but `form` stayed stale. A subsequent Simpan click would overwrite imported settings with the pre-import values. Fix: in both full-success branches (`result.failed === 0` and localStorage `else`), after `setImportMsg(...)`, sync `form`, `dueDaysStr`, `lowStockStr`, `maxBankStr` from `parsed.settings`. Partial-failure branch intentionally excluded (data may be incomplete).
- **S3 — import message uses error style for pending and partial-success:** The `importMsg` className ternary only distinguished `✅` (success) from everything else (error). "Mengimpor data..." (pending) and "⚠️ Impor sebagian berhasil" (warning) both received the red `import-msg--error` class. Fix: four-branch ternary — `✅` → `--success`, `⚠️` → `--warning`, `❌` → `--error`, otherwise → `--pending`. Added two CSS rules: `.import-msg--warning` (amber `#fef3c7` / `#92400e`) and `.import-msg--pending` (neutral `#f1f5f9` / `#475569`).
- **S4 — `_normVersion: 18` hardcoded in `exportJSON`:** The Supabase-mode backup export stamped the current schema version as the literal `18`. Any future `NORM_VERSION` bump would require a manual find-and-replace in Settings.js. Fix: import `NORM_VERSION` from `../utils/storage` alongside the existing `STORAGE_KEY` import; replace `18` with `NORM_VERSION`.

### T63 (2026-04-30): Three Reports.js bug fixes

Three bugs fixed in `src/pages/Reports.js`. No other files touched.

- **R1 — `inventoryFilterItem` / `selectedItems` out of sync:** Two dismissal paths were broken. (A) Chip ✕ dismiss called only `setInventoryFilterItem(null)`, clearing the chip but leaving `selectedItems` populated — the MultiSelect still showed the item selected and `filtered` continued applying the item filter silently. (B) Reset Filter button called only `setSelectedClients([]); setSelectedItems([])`, clearing the filter but leaving `inventoryFilterItem` set — the chip persisted after the filter was cleared. Fix: chip dismiss now also calls `setSelectedItems([])`; Reset Filter now also calls `setInventoryFilterItem(null)`.
- **R2 — `orphanPayments` ignores `typeFilter`:** The `orphanPayments` useMemo iterated all transactions and only skipped those in `filteredIds`. When `typeFilter === "income"`, expense payments still appeared in the "Pembayaran dari transaksi di luar periode ini" section. Fix: added `if (typeFilter !== "all" && t.type !== typeFilter) return;` guard before the `paymentHistory` check; added `typeFilter` to dep array.
- **R3 — `paymentCount` ignores `typeFilter`:** The `paymentCount` useMemo counted payment history entries from all `transactions` regardless of `typeFilter`. The "N pembayaran" footer badge overcounted relative to what was visible. Fix: added same `typeFilter !== "all" && t.type !== typeFilter` guard; added `typeFilter` to dep array.

### T62 (2026-04-30): Contacts.js colSpan fix

Payment history expansion row `colSpan` corrected from `8` to `9` in `src/pages/Contacts.js`. The table has 9 columns (Tanggal, No. Invoice, Jenis, Item, Stok, Status, Jatuh Tempo, Nilai, Aksi); the old value left an empty gap at the right edge of the panel. No other files touched.

### T61 (2026-04-30): Three Contacts.js bug fixes

Three bugs fixed in `src/pages/Contacts.js`. No other files touched.

- **C2 — handleSave edit routing via filtered `sel`:** `handleSave` previously used `sel` (derived from `withBalance`, which is filtered by `search` and `alphaFilter`) to decide whether to call `onUpdateContact` or `onAddContact`. If the user typed in the search box while the edit form was open, the selected contact was filtered out of `withBalance`, making `sel` null, and save silently created a new contact instead of editing the existing one. Fix: introduced `editingContact = editMode ? contacts.find(c => c.id === selected) : null` — looks up by ID from the unfiltered `contacts` array, immune to search/alpha filtering.
- **C3 — Archive/delete confirm missing `setEditMode(false)`:** Both the archive and delete confirm `onClick` handlers called `setSelected(null)` but not `setEditMode(false)`. If the user was in edit mode when the dialog fired, the form remained visible after the contact was removed. A subsequent Simpan click would take the add path (since `editingContact` would resolve to null for an archived/deleted contact) and create an unintended new contact. Fix: added `setEditMode(false)` to both handlers.
- **C5 — Progress bar 0% renders text instead of null:** The payment progress bar IIFE had `if (pct <= 0) return <div>0%</div>` — a text label instead of hiding. Changed to `return null` to match the TransactionPage/Outstanding fix from 2026-04-17.

### T60 (2026-04-29): Four Inventory.js bug fixes

Four data-integrity and UX bugs fixed in `src/pages/Inventory.js`. No other files touched.

- **I1 — `handleAddSubtype` archivedSubtypes check:** The inline "+ Tambah Tipe" handler only checked `catalogItem.subtypes` for duplicates. Adding a subtype with the same name as an archived subtype of the same parent caused the new active subtype to be silently skipped by `tableGroups` (the `archivedSubs.has()` guard at line 508 matched and filtered it out — invisible in inventory, visible only in TransactionForm autocomplete). Fix: check `[...subtypes, ...archivedSubtypes]` for the collision; error message updated to "Tipe ini sudah ada (termasuk yang diarsipkan)".

- **I2 — `handleRenameConfirm` catalog collision guard:** The catalogued-item rename guard used `normItem(normalizedNew) in activeStockMap`. Catalog entries with zero transactions (active or archived) are absent from `activeStockMap`, so renaming a base item to match one of them was not blocked — creating two catalog entries with identical normalized names. Fix: added `itemCatalog.some()` check for name collisions across all catalog entries, combined with the existing `activeStockMap` check via `||`.

- **I3 — `hasTx` missing `archivedSubtypes`:** Two locations computed `hasTx` for a base catalog item using only `row.catalogItem?.subtypes` (active subtypes). If the only transactions for a base item's family were from an archived subtype, `hasTx` evaluated to `false` — showing a Delete button instead of Archive. The delete call would silently do nothing (App.js safety guard blocks it), but the user saw the modal close with no feedback. Fix: spread both `subtypes` and `archivedSubtypes` before the `.some()` check in `handleDeleteRow` and in the JSX IIFE.

- **I4 — `deleteTarget` modal "hapus" gate:** The uncatalogued-item delete modal permanently deletes all transactions referencing the item, but had no confirmation input gate — a single click could destroy N transactions irreversibly. By contrast, `deleteConfirm.type === "catalog"` (deletes a zero-transaction catalog entry — less destructive) already required typing "hapus". Fix: added `deleteTargetInput` / `setDeleteTargetInput` state; input rendered in the modal; Ya Hapus button `disabled` until input equals "hapus" (case-insensitive); state cleared on open, Batal, Escape, and after confirm.

---

### T59 (2026-04-29): activity_log indexes
Added two missing indexes to the `activity_log` Supabase table via MCP: `idx_activity_log_action` (on `action` column) and `idx_activity_log_entity_type` (on `entity_type` column). No code changes — database only. Prevents slow filter queries as the log grows into thousands of entries.

---

## 16. What Is NOT Yet Done

### Penjualan/Pembelian audit (partial)
Code audit complete — no bugs found worth fixing. Runtime test checklist not yet executed. Edge cases to manually verify: multi-item stock delta display, search persistence across date navigation, overdue banner showing correct type (hutang vs piutang), payment partial→full flow, edit on past date, concurrent edit conflict detection.
