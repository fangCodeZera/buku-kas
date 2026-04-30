# src/components/ — Component Inventory & Contracts

## Component Inventory

---

### Component: `TransactionPage`
**File:** `TransactionPage.js` (652 lines)
**Purpose:** Shared base component for Penjualan and Pembelian — day-view transaction table with search, sort, payment history timeline, and all action buttons.
**Props:** See `src/pages/CLAUDE.md` → TransactionPage Base Component section.
**Used by:** `Penjualan.js`, `Pembelian.js` (both via spread `{...props}`)
**Special behaviour:**
- Payment history timeline toggled by `expandedTxId` state — only one row open at a time
- **External navigation highlight:** `initViewDate` prop → syncs `viewDate` via `useEffect`. `highlightTxIds` prop → populates `flashIds` (Set) via `useEffect`. Highlighted rows get `.tx-row--flash` CSS class (3s fade-out animation `#bfdbfe` → transparent). First highlighted row scrolled into view (50ms setTimeout). Flash cleared on first user interaction (click/keydown/scroll) after 500ms debounce — same pattern as `Outstanding.js`. `onClearHighlight` called on clear to reset `txPageHighlight` in App.js.
- History button renders as icon-only `[🕐]` with red corner badge when `paymentHistory.length > 1` (class: `action-btn action-btn--history`)
- Nilai (Rp) cell shows payment progress bar for all payment states
- `confirmPaid(amount, note)` passes note through to `onMarkPaid`
- Overdue/near-due alert banners, each dismissible per session

---

### Component: `TransactionForm`
**File:** `TransactionForm.js` (1430 lines)
**Purpose:** Full transaction input form — supports multi-item rows, enhanced counterparty selector, auto/manual txnId, stock warning integration, custom due days, and catalog-based item selection via smart text inputs.
**Props:**
- `onSave: (tx) => void` — required
- `onCancel?: () => void` — optional
- `initial?: Object` — pre-fills form for edit mode
- `contacts: Array` — required
- `transactions?: Array` — optional (for contact balance preview)
- `stockMap: Object` — required
- `onStockWarning?: (warning) => void` — optional
- `onCreateContact?: (name) => void` — optional
- `defaultDueDateDays?: number` — optional, defaults to 14
- `initType?: "income" | "expense"` — optional, defaults to `"income"`
- `itemCatalog: Array` — required
- `onAddCatalogItem?: (item) => void`
- `onUpdateCatalogItem?: (item) => void`
- `onUnarchiveCatalogItem?: (id) => void`
- `onUnarchiveSubtype?: (id, name) => void`
- `onUnarchiveContact?: (id) => void`

**Used by:** `TransactionPage.js` (inline add form), `App.js` (inside `EditModal` wrapper)

**Special behaviour:**
- **`activeCatalog`**: Filters `itemCatalog` to non-archived items (or archived items with at least one active subtype).
- **Smart text-input item system**: Each item row has two text inputs with live autocomplete dropdowns, NOT `<select>` elements:
  1. **Nama Barang**: free text; dropdown shows matching `activeCatalog[].name` values. Match stored in `catalogItemId` + `matchedCatalog` per row.
  2. **Tipe** (shown after Nama Barang filled): free text; dropdown shows active `matchedCatalog.subtypes[]`. User can type unknown subtype.
  3. Full item name = `itemNameInput + " " + itemTypeInput` (or just `itemNameInput` if no type).
  4. Unit auto-fills from `catalogItem.defaultUnit` when catalog match found.
- **`mapItemFromCatalog(itemName)`**: Used in edit mode. Walks catalog for matching `name` or `name + " " + subtype`. Falls back to free text with empty `catalogItemId` — no `__legacy__` sentinel.
- **New-item confirmation dialog** (`newItemConfirm` state): Fires before save when user typed unknown item or subtype. On confirm, calls `onAddCatalogItem()` or `onUpdateCatalogItem()`, then proceeds to save.
- **`missingTypeItems` state** (`string[] | null`): Set in `handleSubmit` when any item row has a non-empty `itemNameInput` but empty `itemTypeInput`. Check runs after the expense txnId guard and BEFORE `validate()`. Shows a blocking modal listing all offending item names; single "Isi Tipe Barang" button dismisses. No inline field errors — modal is the only feedback. Form data is preserved on dismiss.
- **`submitting` state**: `setSubmitting(true)` called as the very first line of `handleSubmit` (before validation) to block rapid double-clicks. Each early-return validation path calls `setSubmitting(false)`. `doSave` wrapped in `try/finally { setSubmitting(false) }`.
- **`errors` object**: Per-field inline validation. Error border via `iStyle()` helper. Error text via `.field-error` class.
- **Auto-focus on mount**: Counterparty input (`cpInputRef`) receives focus. `skipNextFocusOpen` ref prevents programmatic focus from opening counterparty dropdown.
- **Duplicate item detection**: `checkDuplicate()` scans `items[]` for rows with same `normItem(name)` + `pricePerKg`. If duplicate found and neither row has `duplicateConfirmed: true`, shows `duplicateItemConfirm` dialog. User confirms (merge) or cancels (fix manually).
- **Merge-on-save (`mergeItems`)**: Called in `doSave()` after duplicate confirmation. Groups rows by `normItem(name) + pricePerKg`, sums `sackQty`/`weightKg`/`subtotal`.
- **Sequential stock deduction**: Each row computes `committedQty` (sum of same item's qty from prior rows) to show accurate per-row stock feedback.
- **`customDueDays` minimum**: Enforced via `Math.max(1, Number(customDueDays) || 14)` in `doSave`.
- **Multi-item stock warning**: Collects ALL items that would push stock negative into `negItems[]`, calls `onStockWarning({ items: negItems, item: negItems[0].item, current: ..., selling: ..., onConfirm, onCancel: () => setSubmitting(false) })`.
- Income transactions: txnId field is read-only (auto-generated on save).
- Expense transactions: txnId field is editable — `txnIdInput` state (supplier invoice number).

---

### Component: `PaymentHistoryPanel`
**File:** `PaymentHistoryPanel.js` (290 lines)
**Purpose:** Expandable payment history timeline rendered in a colSpan row below a transaction row.
**Props:**
- `transaction: Object` — required (the full transaction object)
- `onClose: () => void` — required

**Used by:** `TransactionPage.js`, `Contacts.js`, `Outstanding.js`
**Special behaviour:**
- Renders as a vertical timeline, not a table
- Shows progress bar in header (160px, gradient green)
- System notes ("Pelunasan", "Pembayaran sebagian", etc.) shown as display labels only — NOT shown as "Catatan:"
- User notes (non-system) shown as "Catatan: [text]" in italic grey
- Data lama entries show ⚠ icon with tooltip, NOT the raw "(data lama)" text
- 10+ entries: shows first 3 + expand toggle + last 1
- Pending node (dashed amber dot) when `outstanding > 0`

---

### Component: `PaymentUpdateModal`
**File:** `PaymentUpdateModal.js` (183 lines)
**Purpose:** Modal for recording a payment (full or partial) against a transaction's outstanding balance.
**Props:**
- `transaction: Object | null` — null = modal hidden (always-mounted)
- `onConfirm: (paidAmount: number, paymentNote: string) => void`
- `onCancel: () => void`

**Used by:** `TransactionPage.js`, `Contacts.js`, `Outstanding.js`
**Special behaviour:**
- Pre-fills paidAmount with the full outstanding amount
- Shows live preview of result (Lunas vs remaining)
- Optional "Catatan Pembayaran" note field (max 100 chars, single line)
- Note resets when transaction changes
- **`submitting` state**: `handleConfirm` guards with `if (submitting) return`, then `setSubmitting(true)` before `try/finally { setSubmitting(false) }`. Button shows "Memproses..." and is `disabled` when submitting.
- **Auto-focus**: Uses `amountFieldRef` with `querySelector("input")` inside a ref-div (RupiahInput does not forward refs). Auto-focus fires when `transaction` changes (50ms setTimeout).
- **Always-mounted**: Escape key handler guards with `if (!transaction) return`.

---

### Component: `DeleteConfirmModal`
**File:** `DeleteConfirmModal.js` (105 lines)
**Purpose:** Dual-mode confirmation dialog for deleting a transaction OR a contact.
**Props:**
- `transaction?: Object | null` — for transaction delete mode
- `isContact?: boolean` — switch to contact delete mode
- `contact?: Object | null` — for contact delete mode
- `onConfirm: () => void`
- `onCancel: () => void`

**Used by:** `TransactionPage.js`, `Contacts.js`, `Outstanding.js`
**Special behaviour:**
- Shows different title/body text based on `isContact` flag
- Transaction delete warns about stock/balance side effects
- Contact delete clarifies transactions are NOT deleted
- **Always-mounted**: Escape key handler guards with `(isContact ? !!contact : !!transaction)`.

---

### Component: `StockWarningModal`
**File:** `StockWarningModal.js` (77 lines)
**Purpose:** Warning dialog when a sale would push one or more items' stock into negative territory.
**Props:**
- `data: { items: Array<{ item, current, selling }>, item?, current?, selling?, onConfirm: () => void, onCancel?: () => void } | null`
- `onClose: () => void`

**Used by:** `TransactionPage.js`, `App.js` (inside EditModal)
**Special behaviour:**
- TransactionForm passes both `items` array AND flat fields: `{ items: negItems, item: negItems[0].item, current: negItems[0].current, selling: negItems[0].selling, onConfirm, onCancel }`.
- When `data.items.length > 1`: renders bullet list of all affected items.
- When `data.items.length === 1`: falls back to flat `data.item / data.current / data.selling` — renders single-item prose.
- **Always-mounted**: Escape key handler guards with `if (!data) return`.

---

### Component: `InvoiceModal`
**File:** `InvoiceModal.js` (337 lines)
**Purpose:** Printable invoice display. Renders one or more transactions with business header, line items, totals, and bank details.
**Props:**
- `transactions: Array` — one or more transactions
- `settings: Object` — business name, bank accounts, etc.
- `onClose: () => void`

**Used by:** `App.js` (global `invoiceTxs` state)
**Special behaviour:**
- Print button triggers `printWithPortal()`. Uses 100% inline styles on printable area for portal compatibility — do NOT migrate to CSS classes.
- Shows bank accounts filtered by `showOnInvoice === true`, limited by `maxBankAccountsOnInvoice`.
- **Invoice date**: Uses `fmtDate(transactions[0]?.date)` — shows the transaction's date, NOT today's date.
- **Long item names**: `table-layout: fixed` + `maxWidth: 200px` + `word-break: break-word` on item cells prevents layout overflow.
- **Invoice notes**: `invoiceNote` text area entered at print time — NOT saved to transaction data (local modal state only). Deliberate product decision.
- **Conditionally-mounted**: Escape key no guard needed.

---

### Component: `DotMatrixPrintModal`
**File:** `DotMatrixPrintModal.js` (122 lines)
**Purpose:** Preview and print modal for dot matrix printers (invoice and surat jalan). Generates 80-column ASCII output via `textFormatter.js`.
**Props:**
- `transaction: Array | Object` — array when `mode="invoice"`, single object when `mode="suratJalan"`
- `mode: "invoice" | "suratJalan"`
- `settings: Object`
- `onClose: () => void`

**Used by:** `App.js` (global `dotMatrixData` state `{ transaction, mode }`)
**Special behaviour:**
- Input fields (`invoiceNote`, `platNomor`, `catatanPengiriman`) shown above preview, conditional on `mode`.
- Preview in `.dot-matrix-preview` `<pre>` updates live as user types. No inline style on preview — font set by `.dot-matrix-preview` CSS class.
- "Konfirmasi Cetak" manually escapes `&`, `<`, `>` via `.replace()` chain before calling `printWithPortal()`. Print output uses `'Courier New', Courier, monospace` `12pt`, no bold (T22: Arial and bold Courier New both tried and reverted — original format preserved).
- **Conditionally-mounted**: Escape key no guard needed.

---

### Component: `ReportModal`
**File:** `ReportModal.js` (312 lines)
**Purpose:** Printable transaction report in landscape layout. 11-column table (NO, TANGGAL, NO. INVOICE, KLIEN, BARANG, STOK, JENIS, STATUS, JATUH TEMPO, NILAI (RP), PIUTANG/HUTANG) with cash-basis summary.
**Props:**
- `transactions: Array`
- `settings: Object`
- `dateFrom: string`
- `dateTo: string`
- `onClose: () => void`

**Used by:** `App.js` (global `reportState` state)
**Special behaviour:**
- **Conditionally-mounted**: Escape key no guard needed.

---

### Component: `SuratJalanModal`
**File:** `SuratJalanModal.js` (289 lines)
**Purpose:** Printable delivery note (surat jalan) for a single transaction.
**Props:**
- `transaction: Object | null` — null = modal hidden
- `onClose: () => void`

**Used by:** `App.js` (global `suratJalanTx` state; button is in `TransactionPage.js`)
**Special behaviour:**
- Uses `t.stockUnit` (transaction-level) — NOT `it.stockUnit` (item-level, does not exist).
- **Long item names**: `table-layout: fixed` + `maxWidth: 250px` + `word-break: break-word` on item cells.
- `settings` prop is passed by App.js but NOT destructured/used by the component internally.
- Uses 100% inline styles for print portal compatibility. Known quirk: some older sections use CSS class names (`modal-overlay`, `modal-box`) while the printable area uses inline styles — comment in source documents this inconsistency.
- **Conditionally-mounted**: Escape key no guard needed.

---

### Component: `CategoryModal`
**File:** `CategoryModal.js` (~390 lines)
**Purpose:** Category view + inline rename + archive toggle. Read-only item pills; commit-immediately semantics: every rename persists via `onSave()` instantly. No local staging.
**Props:**
- `categories: Array` — existing category objects
- `stockMap: Object` — keyed by normalized item name
- `onSave: (categories: Array) => void`
- `onClose: () => void`
- `itemCatalog?: Array` — for archive-aware filtering

**Used by:** `Inventory.js`
**Special behaviour:**
- `displayCategories` useMemo (`autoDetectCategories(stockMap, categories)`) — always reflects latest prop, no local staging
- Click category name → inline input, Enter/blur commits immediately via `onSave(regenerateAllCodes(updated))`
- Click category code → inline input, Enter/blur commits immediately via `onSave(cascadeCodeUpdate(...))`
- `commitName`/`commitCode` both use duplicate validation from `categoryUtils.js`; stay in edit mode with inline error on duplicate
- `codeManuallyEdited` ref cleanup for child categories remains in CategoryModal (side-effect, not a pure helper concern)
- Archive toggle (`showArchived`) hides archived item pills when off; orphan keys always hidden
- Footer is a single "Tutup" button — no Batal/Simpan/Buat Kategori Baru
- Inventory.js passes `onSave={onUpdateCategories}` — modal stays open after save; user closes via Tutup
- **Conditionally-mounted**: Escape key no guard needed.

---

### Component: `StockReportModal`
**File:** `StockReportModal.js` (330 lines)
**Purpose:** Printable stock report modal — groups items by category, shows quantities (no prices).
**Props:**
- `stockMap: Object`
- `categories: Array`
- `settings: Object`
- `transactions: Array`
- `stockAdjustments: Array`
- `onClose: () => void`

**Used by:** `Inventory.js`
**Special behaviour:**
- Date picker for historical stock snapshots (uses `computeStockMapForDate`)
- Toggle to show/hide zero-stock items
- Prints via `printWithPortal()` with injected `<style>` block
- Guard: renders `null` if `stockMap` is falsy
- **Conditionally-mounted**: Escape key no guard needed.

---

### Component: `StatusBadge` / `TypeBadge`
**File:** `Badge.js` (113 lines)
**Exports:** `StatusBadge` (named), `TypeBadge` (named), default = `StatusBadge`

**StatusBadge props:** `status: string`
- `STATUS.LUNAS` → green "✅ Lunas"
- `STATUS.PARTIAL_INCOME` → amber "⏳ Piutang"
- `STATUS.PARTIAL_EXPENSE` → red "⏳ Utang"
- Legacy v1/v2 strings also handled

**TypeBadge props:** `type: "income" | "expense"`
- `income` → green "🛒 Penjualan"
- `expense` → red "📦 Pembelian"

**Rule: Always pass a value from `STATUS` constants or `deriveStatus()` — never raw strings in new code.**

---

### Component: `DueBadge`
**File:** `DueBadge.js` (32 lines)
**Props:** `dueDate?: string | null`, `outstanding?: number`
Renders `—` when `outstanding <= 0`. Shows days remaining, "Hari Ini", or overdue in red.
**Used by:** `TransactionPage.js`, `Contacts.js`, `Outstanding.js`

---

### Component: `MultiSelect`
**File:** `MultiSelect.js` (151 lines)
**Props:** `options: string[]`, `selected: string[]`, `onChange: (selected) => void`, `placeholder?: string`
Zero-dependency multi-select dropdown with search and select-all.
**Used by:** `Reports.js` (client filter, item filter)

---

### Component: `RupiahInput`
**File:** `RupiahInput.js` (107 lines)
**Props:** `value: number`, `onChange: (numericValue: number) => void`, `hasError?: boolean`, `placeholder?: string`
Displays comma-formatted Rupiah, returns integer. Does NOT forward refs — use a wrapping div ref.
**Used by:** `TransactionForm.js`, `PaymentUpdateModal.js`

---

### Component: `StockChip`
**File:** `StockChip.js` (25 lines)
**Props:** `qty: number`, `unit: string`, `threshold?: number` (defaults 10)
Green (>threshold), amber (0..threshold), red (<0).
**Used by:** `Inventory.js`

---

### Component: `Toast`
**File:** `Toast.js` (50 lines)
**Props:** `message: string`, `type?: "success" | "error"`, `onDone?: () => void`
Auto-dismisses after 3 seconds. Slide-in animation. `onDone` called after dismiss.
**Used by:** Every page with mutation actions.

---

### Component: `SaveIndicator`
**File:** `SaveIndicator.js` (41 lines)
**Props:** `saved: boolean`
Tracks `false → true` transition via `prevSaved` ref. Records `nowTime()` into `lastSavedTime` state ONLY on actual save event. Renders "Tersimpan ✓ · HH:MM" when saved, "Menyimpan..." when unsaved.
**Used by:** `TransactionPage.js` (rendered in page header)

---

### Component: `Icon`
**File:** `Icon.js` (72 lines)
**Props:** `name: string`, `size?: number` (defaults 16), `color?: string` (defaults "currentColor")
Inline SVG icons by name.
**Valid names:** `income, expense, inventory, contacts, reports, warning, settings, menu, plus, edit, trash, invoice, check, clock, search, download, link, upload, eye, adjust, truck, dashboard`
**`contacts` icon:** Single-person silhouette (full circle head + body arc) — replaced clipped multi-person group icon in T66.
**Used by:** App.js sidebar, all pages and some components.

---

## Modal Contract

ALL modals in this app follow this pattern:

```jsx
// 1. Parent holds visibility state
const [deleteTx, setDeleteTx] = useState(null);  // null = hidden

// 2. Modal rendered by parent — never controls own visibility
<DeleteConfirmModal
  transaction={deleteTx}        // null = renders nothing (if !data return null)
  onConfirm={confirmDelete}
  onCancel={() => setDeleteTx(null)}
/>
```

**Rules:**
- Modal renders `null` when its data prop is `null` — always guard with `if (!data) return null`
- Modal never holds its own `isOpen` boolean state
- `onCancel`/`onClose` always sets parent state back to `null`

**Escape key on ALL modals.** Standard pattern:
```js
useEffect(() => {
  const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [onClose]);
```

**Mount style distinction:**

- **Always-mounted** (rendered unconditionally, visibility from data prop being null):
  `DeleteConfirmModal`, `PaymentUpdateModal`, `StockWarningModal`
  → Escape effect **must** guard with `if (!data) return` before registering.

- **Conditionally-mounted** (parent only renders when open):
  `InvoiceModal`, `SuratJalanModal`, `DotMatrixPrintModal`, `ReportModal`, `CategoryModal`, `StockReportModal`
  → Escape effect runs **without guard** — component only exists when visible.

---

## Badge Usage

**Never write raw status strings. Always use:**
```js
import { STATUS, deriveStatus } from "../utils/statusUtils";

// To set status:
status: deriveStatus(type, outstanding > 0)

// To render:
<StatusBadge status={t.status} />

// Valid STATUS constants:
STATUS.LUNAS           // "Lunas"
STATUS.PARTIAL_INCOME  // "Belum Lunas (Piutang)"
STATUS.PARTIAL_EXPENSE // "Belum Lunas (Utang)"
```

---

## New Component Checklist

- [ ] Create `src/components/NewComponent.js`
- [ ] Default export (named exports for Badge variants only)
- [ ] JSDoc comment at top with `@param` types
- [ ] Import from `utils/` only — never from `pages/`
- [ ] Guard against null/undefined props at top of component body
- [ ] If modal: follow Modal Contract above (null-data guard, Escape key, correct mount style)
- [ ] Add to Component Inventory section in this file
- [ ] Run `npm run build` — zero errors
