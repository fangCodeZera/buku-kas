# src/components/ — Component Inventory & Contracts

## Component Inventory

---

### Component: `TransactionPage`
**File:** `TransactionPage.js`
**Purpose:** Shared base component for Penjualan and Pembelian — day-view transaction table with search, sort, payment history timeline, and all action buttons.
**Props:** See `src/pages/CLAUDE.md` → TransactionPage Base Component section.
**Used by:** `Penjualan.js`, `Pembelian.js` (both via spread `{...props}`)
**Special behaviour:**
- Payment history timeline toggled by `expandedTxId` state — only one row open at a time
- History button renders as icon-only `[🕐]` with red corner badge when `paymentHistory.length > 1` (class: `action-btn action-btn--history`)
- Nilai (Rp) cell shows payment progress bar for all payment states
- `confirmPaid(amount, note)` passes note through to `onMarkPaid`
- No checkbox/multi-select column — per-row invoice button in Aksi column is the only invoice trigger

---

### Component: `TransactionForm`
**File:** `TransactionForm.js`
**Purpose:** Full transaction input form — supports multi-item rows, enhanced counterparty selector, auto/manual txnId, stock warning integration, custom due days, and catalog-based item selection via smart text inputs.
**Props:**
- `onSave: (tx) => void` — required
- `onCancel?: () => void` — optional
- `initial?: Object` — pre-fills form for edit mode (uses `mapItemFromCatalog` for catalog lookup)
- `contacts: Array` — required
- `transactions?: Array` — optional (for contact balance preview)
- `stockMap: Object` — required
- `onStockWarning?: (warning) => void` — optional (receives `{ items: [...], onConfirm }` for multi-item)
- `onCreateContact?: (name) => void` — optional
- `defaultDueDateDays?: number` — optional, defaults to 14
- `initType?: "income" | "expense"` — optional, defaults to `"income"`
- `itemCatalog: Array` — **required** — `{ id, name, defaultUnit, subtypes[] }[]` from App.js data
- `onAddCatalogItem?: (item) => void` — called when user confirms a new item/subtype
- `onUpdateCatalogItem?: (item) => void` — called when user confirms a new subtype on an existing item

**Used by:** `TransactionPage.js` (inline add form), `App.js` (inside `EditModal` wrapper)
**Special behaviour:**
- **Smart text-input item system**: Each item row has two text inputs with live autocomplete dropdowns, NOT `<select>` elements:
  1. **Nama Barang**: free text; dropdown shows matching `itemCatalog[].name` values as user types. Match stored in `catalogItemId` + `matchedCatalog` per row.
  2. **Tipe** (shown after Nama Barang filled): free text; dropdown shows `matchedCatalog.subtypes[]`. User can type an unknown subtype.
  3. Full item name = `itemNameInput + " " + itemTypeInput` (or just `itemNameInput` if no type).
  4. Unit auto-fills from `catalogItem.defaultUnit` when a catalog match is found.
- **`mapItemFromCatalog(itemName)`**: Used in edit mode to pre-populate inputs. Walks catalog for matching `name` or `name + " " + subtype`. Falls back to free text with empty `catalogItemId` when no match — no `__legacy__` sentinel.
- **New-item confirmation dialog** (`newItemConfirm` state): If user types an item or subtype not in the catalog, a dialog fires before save. On confirm, calls `onAddCatalogItem()` or `onUpdateCatalogItem()` then proceeds to save. Catalog grows organically from transaction entry.
- **`submitting` state**: Boolean flag, prevents double-submit. Save button disabled while `submitting === true`.
- **`errors` object**: Per-field inline validation. Error border applied via `iStyle()` helper. Error text via `.field-error` class below the field. Fields validated: `counterparty`, `items[idx]`, `value`, `paidAmount`.
- **Auto-focus on mount**: Counterparty input (`cpInputRef`) receives focus. `skipNextFocusOpen` ref prevents the programmatic focus from opening the counterparty dropdown.
- **Multi-item stock warning**: Before saving, collects ALL items that would push stock negative into `negItems[]` array, then calls `onStockWarning({ items: negItems, onConfirm })`. Single-item warnings still work (array of length 1).
- **Stock display per item row**: Each item row shows current stock qty from `stockMap` inline.
- Income transactions: txnId field is read-only and auto-generated on save
- Expense transactions: txnId field is editable (supplier invoice number, `txnIdInput` state)
- Multi-item support: `items[]` array, Add/Remove item rows, auto-totals

---

### Component: `PaymentHistoryPanel`
**File:** `PaymentHistoryPanel.js`
**Purpose:** Expandable payment history timeline rendered in a colSpan row below a transaction row.
**Props:**
- `transaction: Object` — required (the full transaction object)
- `onClose: () => void` — required (called by ✕ Tutup button)

**Used by:** `TransactionPage.js`, `Contacts.js`, `Outstanding.js`
**Special behaviour:**
- Renders as a vertical timeline, not a table
- Shows progress bar in header (160px, gradient green)
- System notes ("Pelunasan", "Pembayaran sebagian", etc.) shown as display labels only — NOT shown as "Catatan:"
- User notes (non-system) shown as "Catatan: [text]" in italic grey
- Data lama entries show ⚠ icon with tooltip, NOT the raw "(data lama)" text
- 10+ entries: shows first 3 + expand toggle + last 1
- Pending node (dashed amber dot) when `outstanding > 0`
- `onClose` fires when ✕ Tutup clicked — parent sets `expandedTxId(null)`

---

### Component: `PaymentUpdateModal`
**File:** `PaymentUpdateModal.js`
**Purpose:** Modal for recording a payment (full or partial) against a transaction's outstanding balance.
**Props:**
- `transaction: Object | null` — null = modal hidden
- `onConfirm: (paidAmount: number, paymentNote: string) => void`
- `onCancel: () => void`

**Used by:** `TransactionPage.js`, `Contacts.js`, `Outstanding.js`
**Special behaviour:**
- Pre-fills paidAmount with the full outstanding amount
- Shows live preview of result (Lunas vs remaining)
- Optional "Catatan Pembayaran" note field (max 100 chars, single line)
- Note resets when transaction changes
- `onConfirm` signature: `(amount, note)` — all callers pass both arguments
- **Auto-focus**: Uses `amountFieldRef` with `querySelector("input")` inside a ref-div, since `RupiahInput` does not forward refs. Auto-focus fires when `transaction` changes (50ms setTimeout).
- **Escape key**: Calls `onCancel()`. Guards with `if (!transaction) return` before registering listener.

---

### Component: `DeleteConfirmModal`
**File:** `DeleteConfirmModal.js`
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
- **Escape key**: Calls `onCancel()`. Guards with visibility check (`isContact ? !!contact : !!transaction`) before registering listener.

---

### Component: `StockWarningModal`
**File:** `StockWarningModal.js`
**Purpose:** Warning dialog when a sale would push one or more items' stock into negative territory. User can override and proceed, or cancel to fix the quantity.
**Props:**
- `data: { items: Array<{ item: string, current: number, selling: number }>, item?: string, current?: number, selling?: number, onConfirm: () => void, onCancel?: () => void } | null`
- `onClose: () => void`

**Used by:** `TransactionPage.js`, `App.js` (inside EditModal)
**Special behaviour:**
- TransactionForm passes both `items` array AND flat `item/current/selling` fields simultaneously: `{ items: negItems, item: negItems[0].item, current: negItems[0].current, selling: negItems[0].selling, onConfirm, onCancel }`.
- When `data.items.length > 1`: renders a bullet list of all affected items (multi-item path).
- When `data.items.length === 1`: falls back to flat `data.item / data.current / data.selling` — renders the single-item prose format.
- `data.onConfirm()` is called when user chooses to proceed despite negative stock.
- `data.onCancel?.()` is called when user cancels (in addition to `onClose`).
- **Escape key**: Calls both `data.onCancel?.()` and `onClose()`. Guards with `if (!data) return`.

---

### Component: `InvoiceModal`
**File:** `InvoiceModal.js`
**Purpose:** Printable invoice display. Renders one or more transactions with business header, line items, totals, and bank details.
**Props:**
- `transactions: Array` — one or more transactions
- `settings: Object` — business name, bank accounts, etc.
- `onClose: () => void`

**Used by:** `App.js` (global `invoiceTxs` state)
**Special behaviour:**
- Print button triggers `printWithPortal()` (NOT `window.print()` directly). Uses 100% inline styles on the printable area for portal compatibility — do NOT migrate to CSS classes.
- Shows bank accounts filtered by `showOnInvoice === true`, limited by `maxBankAccountsOnInvoice`.
- **`catatan` / invoice notes**: Has an `invoiceNote` text area entered at print time inside the modal. Notes are NOT saved to transaction data — they exist only in local modal state (`useState("")`) while the modal is open. This is a deliberate product decision.
- **Escape key**: Calls `onClose()`. No visibility guard needed — modal is conditionally mounted.

---

### Component: `ReportModal`
**File:** `ReportModal.js`
**Purpose:** Printable transaction report in landscape layout. 11-column table (NO, TANGGAL, NO. INVOICE, KLIEN, BARANG, STOK, JENIS, STATUS, JATUH TEMPO, NILAI (RP), PIUTANG/HUTANG) with cash-basis summary. Columns match the on-screen Laporan table exactly.
**Props:**
- `transactions: Array`
- `settings: Object`
- `dateFrom: string`
- `dateTo: string`
- `onClose: () => void`

**Used by:** `App.js` (global `reportState` state)
**Special behaviour:**
- **Escape key**: Calls `onClose()`. No visibility guard needed — conditionally mounted.

---

### Component: `StatusBadge`
**File:** `Badge.js` (named export)
**Purpose:** Coloured pill badge for payment status.
**Props:** `status: string`
**Valid `status` values:**
- `"Lunas"` → green ✅
- `"Belum Lunas (Piutang)"` → amber ⏳ (income, client owes us)
- `"Belum Lunas (Utang)"` → red ⏳ (expense, we owe supplier)
- Legacy strings also handled (see `STATUS_MAP` in Badge.js)

**Rule: Always pass a value from `STATUS` constants or `deriveStatus()` — never raw strings in new code.**

---

### Component: `TypeBadge`
**File:** `Badge.js` (named export)
**Purpose:** Coloured pill badge for transaction type.
**Props:** `type: "income" | "expense"`
**Used by:** `Contacts.js`, `Outstanding.js`, `Reports.js`

---

### Component: `DueBadge`
**File:** `DueBadge.js`
**Purpose:** Shows jatuh tempo (due date) status — days remaining, overdue, or due today.
**Props:**
- `dueDate: string | null | undefined` — YYYY-MM-DD
- `outstanding?: number` — if `<= 0`, renders `—`

**Used by:** `TransactionPage.js`, `Contacts.js`, `Outstanding.js`

---

### Component: `MultiSelect`
**File:** `MultiSelect.js`
**Purpose:** Zero-dependency multi-select dropdown with search and select-all.
**Props:**
- `options: string[]`
- `selected: string[]`
- `onChange: (selected: string[]) => void`
- `placeholder?: string`

**Used by:** `Reports.js` (client filter, item filter)

---

### Component: `RupiahInput`
**File:** `RupiahInput.js`
**Purpose:** Currency input that displays comma-formatted Rupiah and returns a clean integer.
**Props:**
- `value: number`
- `onChange: (numericValue: number) => void`
- `hasError?: boolean`
- `placeholder?: string`

**Used by:** `TransactionForm.js`, `PaymentUpdateModal.js`

---

### Component: `StockChip`
**File:** `StockChip.js`
**Purpose:** Coloured pill showing stock quantity with status colouring (green/amber/red).
**Props:**
- `qty: number`
- `unit: string`
- `threshold?: number` — defaults to 10

**Used by:** `Inventory.js`

---

### Component: `Toast`
**File:** `Toast.js`
**Purpose:** Auto-dismissing slide-in notification. Disappears after 3 seconds.
**Props:**
- `message: string`
- `type?: "success" | "error"` — defaults to `"success"`
- `onDone?: () => void` — called after dismiss (use to clear parent toast state)

**Used by:** Every page that has mutation actions (TransactionPage, Contacts, Outstanding, Inventory)

---

### Component: `Icon`
**File:** `Icon.js`
**Purpose:** Lightweight SVG icon system. Renders inline SVGs by name.
**Props:**
- `name: string` — see Icon.js for full list of valid names
- `size?: number` — defaults to 16
- `color?: string` — defaults to `"currentColor"`

**Available icon names (from Icon.js):** `income`, `expense`, `inventory`, `contacts`, `reports`, `warning`, `settings`, `menu`, `plus`, `edit`, `trash`, `invoice`, `check`, `clock`, `search`, `download`, `link`, `upload`, `eye`, `adjust`, `truck`, `dashboard`

---

### Component: `SaveIndicator`
**File:** `SaveIndicator.js`
**Purpose:** Small inline "Tersimpan ✓ · HH:MM" / "Menyimpan..." indicator showing autosave status and time of last save.
**Props:**
- `saved: boolean` — whether data is currently saved

**Used by:** `TransactionPage.js` (rendered in page header)
**Special behaviour:**
- Tracks `false → true` transition via `prevSaved` ref (initialized to `true` matching App.js initial state)
- Records `nowTime()` into internal `lastSavedTime` state ONLY when `saved` transitions from `false` to `true` (actual save event) — not on initial mount
- Renders `"Tersimpan ✓ · HH:MM"` when saved and `lastSavedTime` is set; the timestamp is in `<span className="save-indicator__time">` (muted gray, 0.9em)
- Renders `"Menyimpan..."` when `saved === false`
- Note: `lastSavedTime` is internal state derived from the `false → true` transition — it is NOT a prop

---

### Component: `CategoryModal`
**File:** `CategoryModal.js`
**Purpose:** Modal for managing item categories/groups. Supports inline editing of group names and codes, HTML5 drag-and-drop for moving items between groups and merging groups, and auto-detection of categories for uncategorized items.
**Props:**
- `categories: Array` — existing category objects
- `stockMap: Object` — keyed by normalized item name
- `onSave: (categories: Array) => void` — called with cleaned categories on save
- `onClose: () => void` — called on cancel (with unsaved-changes confirmation if dirty)

**Used by:** `Inventory.js`
**Special behaviour:**
- On mount, runs `autoDetectCategories(stockMap, categories)` to pre-populate
- Group drag onto another group = merge (items combined, source deleted)
- Item drag between groups = move
- Uncategorized items shown in a dashed amber "Belum Dikategorikan" section
- Confirm dialog when cancelling with unsaved changes
- Codes auto-regenerated with parent-child awareness when group names change
- **Escape key**: Calls `onClose()`. No visibility guard needed — conditionally mounted.

---

### Component: `StockReportModal`
**File:** `StockReportModal.js`
**Purpose:** Printable stock report modal — groups items by category, shows quantities (no prices). Uses 100% inline styles on the printable area for `printWithPortal()` compatibility.
**Props:**
- `stockMap: Object` — current stock map
- `categories: Array` — category objects for grouping
- `settings: Object` — business name, address
- `transactions: Array` — for historical stock computation
- `stockAdjustments: Array` — for historical stock computation
- `onClose: () => void`

**Used by:** `Inventory.js`
**Special behaviour:**
- Date picker for historical stock snapshots (uses `computeStockMapForDate`)
- Toggle to show/hide zero-stock items
- Prints via `printWithPortal()` with injected `<style>` block
- Guard: renders `null` if `stockMap` is falsy
- **Escape key**: Calls `onClose()`. No visibility guard needed — conditionally mounted.

---

### Component: `SuratJalanModal`
**File:** `SuratJalanModal.js`
**Purpose:** Printable delivery note (surat jalan) for a single transaction.
**Props:**
- `transaction: Object | null` — null = modal hidden
- `onClose: () => void`

**Used by:** `App.js` (global `suratJalanTx` state; button is in `TransactionPage.js`)
**Special behaviour:**
- Uses `t.stockUnit` (transaction-level field) — NOT `it.stockUnit` (item-level, does not exist)
- Note: `settings` is passed by App.js at the call site but the component only destructures `{ transaction, onClose }` — settings are not used internally
- Uses 100% inline styles for `printWithPortal()` compatibility
- **Escape key**: Calls `onClose()`. No visibility guard needed — conditionally mounted.

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

**Escape key is implemented on ALL modals.** Standard pattern:
```js
useEffect(() => {
  const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [onClose]);
```

**Important distinction by mount style:**

- **Always-mounted modals** (rendered unconditionally, visibility controlled by data prop being null):
  `DeleteConfirmModal`, `PaymentUpdateModal`, `StockWarningModal`
  → Escape effect **must** guard with `if (!data) return` before registering, to avoid firing when the modal is invisible.

- **Conditionally-mounted modals** (parent only renders them when open):
  `InvoiceModal`, `SuratJalanModal`, `ReportModal`, `CategoryModal`, `StockReportModal`
  → Escape effect runs **without guard** — the component only exists when visible.

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
- [ ] Default export
- [ ] JSDoc comment at top with `@param` types
- [ ] Import from `utils/` only — never from `pages/`
- [ ] Guard against null/undefined props at top of component body
- [ ] Add to Component Inventory section in this file
- [ ] Run `npm run build` — zero errors
