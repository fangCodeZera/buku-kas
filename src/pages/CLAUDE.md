# src/pages/ — Page Inventory & Patterns

## Page Inventory

---

### File: `Penjualan.js`
**Nav key:** `penjualan`
**Purpose:** Income (sales) transaction page — thin wrapper around `TransactionPage` base component.
**Props received:** All props that `TransactionPage` accepts (see TransactionPage section below). Passes `type="income"`, `title="Penjualan"`, `accentColor="#10b981"`.
- `itemCatalog: Array` — catalog entries passed through to TransactionForm for item selection
- `onSuratJalan: (tx) => void` — triggers SuratJalanModal in App.js (income only)
- `onNavigateOutstanding: (txIds) => void` — navigate to Outstanding page with highlighted rows
**Key local state:** none (delegates entirely to TransactionPage)
**Mutations it calls:** via TransactionPage — `onAdd`, `onEdit`, `onDelete`, `onInvoice`, `onMarkPaid`, `onCreateContact`

---

### File: `Pembelian.js`
**Nav key:** `pembelian`
**Purpose:** Expense (purchase) transaction page — thin wrapper around `TransactionPage` base component.
**Props received:** All props that `TransactionPage` accepts. Passes `type="expense"`, `title="Pembelian"`, `accentColor="#ef4444"`.
- `itemCatalog: Array` — catalog entries passed through to TransactionForm for item selection
- `onNavigateOutstanding: (txIds) => void` — navigate to Outstanding page with highlighted rows
**Note:** Pembelian does NOT receive `onSuratJalan` — surat jalan is income-only.
**Key local state:** none (delegates entirely to TransactionPage)
**Mutations it calls:** via TransactionPage — same as Penjualan

---

### File: `Inventory.js`
**Nav key:** `inventory`
**Purpose:** Table layout grouped by category — rows for catalog entries (base + subtypes) organized under dark navy group-header rows. Catalog management, expandable per-item stock ledger, inline adjustment form. "LAINNYA — UNC" group catches items not matched to any category. Old catalog card layout was replaced by the table layout.
**Props received:**
- `stockMap: Object` — today's stock, pre-computed in App.js
- `threshold: number`
- `onViewItem: (itemName: string) => void`
- `onAddAdjustment: (adj: Object) => void`
- `onRenameItem?: (oldName: string, newName: string) => void` — defaults to no-op
- `onDeleteItem?: (itemName: string) => void` — defaults to no-op
- `onDeleteAdjustment?: (adjustmentId: string) => void` — defaults to no-op
- `transactions?: Array` — for ledger and historical stock computation
- `stockAdjustments?: Array` — for ledger and historical stock computation
- `itemCategories?: Array` — for CategoryModal
- `onUpdateCategories?: (categories: Array) => void`
- `onStockReport?: () => void` — opens StockReportModal in App.js
- `itemCatalog?: Array` — catalog entries `{ id, name, defaultUnit, subtypes[] }`
- `onAddCatalogItem?: (item: Object) => void`
- `onUpdateCatalogItem?: (item: Object) => void`
- `onDeleteCatalogItem?: (id: string) => void`

**Key local state:**
- Search/sort: `search`, `sortBy`, `sortDir`
- Date navigation: `inventoryDate`
- Adjustment modal: `adjTarget`, `adjDir`, `adjQtyStr`, `adjReason`, `adjError`, `adjQtyError`, `adjReasonError`, `adjNewName`
- Rename modal: `renameTarget`, `renameNewName`, `renameError`, `renameMergeConfirm`
- Delete confirm: `deleteTarget`
- Submit debounce: `submitting`
- Catalog UI: `catalogForm`, `catalogFormError`, `catalogSubtypeError`, `deleteCatalogConfirm`, `removeSubtypeConfirm`
- Stock ledger: `expandedStockItem`, `ledgerTypeFilter`, `ledgerDateFrom`, `ledgerDateTo`, `adjDeleteConfirm`
- General: `toast`, `showCategoryModal`

**Key useMemos:**
- `tableGroups` — builds flat item rows from `itemCatalog` (base + subtypes) + uncataloged items from `activeStockMap`, groups them using `getCategoryForItem()` with a groupName-prefix fallback for zero-stock base items (longest-match), applies search/sort. Returns `[{ groupName, code, items[] }]` with "Lainnya" last.
- `activeStockMap` — returns `stockMap` (today) or `computeStockMapForDate(...)` for historical dates.
- `ledgerEntries` / `visibleLedgerEntries` — stock history for expanded item, filtered by type and date range, newest-first.

**Ledger behavior:** Expandable per-item panel (`expandedStockItem`) showing all transactions and adjustments for that item with running totals, date filter (`ledgerDateFrom`/`ledgerDateTo`), type filter (`ledgerTypeFilter`), and quick-select presets (Hari Ini, Minggu Ini, Bulan Ini, Semua — with active state highlighting). Only one item's ledger can be open at a time.

**Mutations it calls:** `onAddAdjustment`, `onRenameItem`, `onDeleteItem`, `onDeleteAdjustment`, `onViewItem`, `onUpdateCategories`, `onAddCatalogItem`, `onUpdateCatalogItem`, `onDeleteCatalogItem`

---

### File: `Contacts.js`
**Nav key:** `contacts`
**Purpose:** Contact list + detail panel. Shows per-contact AR/AP balances and transaction history with payment panel.
**Props received:**
- `contacts: Array`
- `transactions: Array`
- `balanceMap: Object` (pre-computed in App.js — keyed by lowercase name)
- `onAddContact: (c) => void`
- `onUpdateContact: (c) => void`
- `onDeleteContact: (id) => void`
- `onDeleteTransaction?: (id) => void`
- `onEditTransaction?: (tx) => void`
- `onMarkPaid?: (id, amount, note) => void`

**Key local state:** `search`, `alphaFilter`, `sortBy`, `selected` (contact id or `"new"`), `editMode`, `form`, `deleteTx`, `paidTx`, `toast`, `submitting`, `deleteContactId`, `expandedTxId`, `nameError`
- `nameError` — inline error string for duplicate contact name validation (shown below name input)
- `submitting` — debounce guard to prevent double-submit on save
- `nameInputRef` — ref for auto-focus on name input when form opens

**Mutations it calls:** `onAddContact`, `onUpdateContact`, `onDeleteContact`, `onDeleteTransaction`, `onEditTransaction`, `onMarkPaid`

---

### File: `Reports.js`
**Nav key:** `reports`
**Purpose:** Date-range financial report with multi-select client/item filters, summary cards, bar chart, transaction table, CSV export.
**Props received:**
- `transactions: Array`
- `contacts: Array`
- `settings: Object`
- `onInvoice?: (txs) => void`
- `onReport?: (state) => void`
- `initItemFilter?: string | null` (pre-fills item filter from Inventory "Lihat" button)
- `onClearItemFilter?: () => void`

**Key local state:** `dateFrom`, `dateTo`, `selectedClients`, `selectedItems`, `period`, `inventoryFilterItem`, `toast`, `confirmCount`
**Mutations it calls:** `onInvoice`, `onReport`
**Internal function:** `getMultiItemContribution(t, selItems)` — computes item-level financial breakdown for multi-item transactions when item filter is active.

---

### File: `Outstanding.js`
**Nav key:** `outstanding`
**Purpose:** Two-section view (Piutang / Hutang) of all transactions with outstanding > 0. Sortable, paginated (50 per page).
**Props received:**
- `transactions: Array`
- `onEdit: (tx) => void`
- `onMarkPaid: (id, amount, note) => void`
- `onDelete: (id) => void`
- `onInvoice: (txs) => void`
- `highlightTxIds: Array | null` — transaction IDs to highlight on mount (from `navigateToOutstanding`)
- `onClearHighlight: () => void` — called after highlight rows are scrolled to, to reset state in App.js

**Key local state:** `sortBy` (top-level); `deleteTx`, `paidTx`, `toast`, `page`, `expandedTxId` (inside `OutstandingTable` sub-component)
**Highlight behavior:** `OutstandingTable` receives `highlightTxIds` and scrolls the first matching row into view via `firstHighlightRef`. Highlight is visual-only (CSS class on matching rows).
**Mutations it calls:** `onEdit`, `onMarkPaid`, `onDelete`, `onInvoice`
**Sub-components:** `OutstandingTable` (internal, not exported), `SectionCard` (internal, not exported)

---

### File: `Settings.js`
**Nav key:** `settings`
**Purpose:** Business info form, bank account CRUD, due-date defaults, low-stock threshold, JSON backup export/import.
**Props received:**
- `settings: Object`
- `onSave: (settings) => void`
- `onImport: (data) => void`

**Key local state:** `form`, `flash`, `submitting`, `importMsg`, `bizErrors`, `dueDaysStr`, `lowStockStr`, `maxBankStr`, `fileRef`
- `submitting` — debounce guard for save and export actions
- `bizErrors` — object with per-field validation errors (e.g. `{ businessName: "Nama bisnis wajib diisi" }`)

**Mutations it calls:** `onSave`, `onImport`

---

## Shared Page Patterns

### Empty State Pattern
```jsx
{filtered.length === 0 ? (
  <div className="empty-state">
    <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
    Tidak ada transaksi pada tanggal ini.
  </div>
) : (
  /* table */
)}
```

### Toast Usage Pattern
```jsx
// Local state:
const [toast, setToast] = useState(null);

// Show:
setToast("Transaksi dihapus. Stok, saldo, dan laporan telah diperbarui.");

// Render (always at bottom of component return):
{toast && <Toast message={toast} onDone={() => setToast(null)} />}
```

### Modal Pattern
```jsx
// Local state:
const [deleteTx, setDeleteTx] = useState(null);

// Trigger:
const handleDelete = (tx) => setDeleteTx(tx);

// Render:
<DeleteConfirmModal
  transaction={deleteTx}
  onConfirm={confirmDelete}
  onCancel={() => setDeleteTx(null)}
/>
```

### Submit Debounce Pattern
```jsx
// Prevents double-submit on all forms
const [submitting, setSubmitting] = useState(false);
const handleSubmit = () => {
  if (submitting) return;
  setSubmitting(true);
  try { /* save */ } finally { setSubmitting(false); }
};
// <button disabled={submitting}>Simpan</button>
```

### Inline Field Error Pattern
```jsx
// Per-field validation errors shown inline below the input
const [fieldErrors, setFieldErrors] = useState({});
// <input className={`form-input${fieldErrors.name ? " form-input--error" : ""}`} />
// {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
```

---

## TransactionPage Base Component

`src/components/TransactionPage.js` is the shared base for both Penjualan and Pembelian.

**Props it accepts:**
- `type: "income" | "expense"` — determines labels, colors, txnId behavior
- `title: string` — page heading
- `accentColor: string` — hex color for header, primary button, summary cards
- `transactions: Array`
- `contacts: Array`
- `stockMap: Object`
- `threshold: number`
- `defaultDueDateDays: number`
- `onAdd: (tx) => void`
- `onEdit: (tx) => void` — opens global EditModal in App.js
- `onDelete: (id) => void`
- `onInvoice: (txs) => void`
- `onMarkPaid: (id, amount, note) => void`
- `onCreateContact: (name) => void`
- `onSuratJalan?: (tx) => void` — optional, only Penjualan passes this
- `onNavigateOutstanding?: (txIds) => void` — optional, both Penjualan and Pembelian pass this
- `saved: boolean`
- `itemCatalog: Array` — catalog entries passed through to TransactionForm for item dropdown

**How Penjualan and Pembelian differ:**
- `type="income"` → green accent, auto-generates txnId, labels say "Penjualan/Pemasukan/Piutang", shows surat jalan button
- `type="expense"` → red accent, manual txnId (supplier invoice no), labels say "Pembelian/Pengeluaran/Hutang", no surat jalan

**Key behaviors:**
- Day-view: `viewDate` state filters to one day at a time
- 3-part search bar: category dropdown + text input + sort dropdown (`.search-bar-wrapper`)
- Payment progress bar in Nilai cell for all payment states
- `[🕐]` icon-only button (class: `action-btn action-btn--history`) toggles payment history timeline (`PaymentHistoryPanel`); badge shown when `paymentHistory.length > 1`
- `expandedTxId` — only one row can be expanded at a time

**Rule: Any change to TransactionPage affects BOTH Penjualan AND Pembelian. Always test both after editing.**

---

## New Page Checklist

- [ ] Create `src/pages/NewPage.js` with default export
- [ ] Add JSDoc `@param` block at top
- [ ] Add to `navItems` array in `App.js`
- [ ] Add import in `App.js`
- [ ] Add conditional render in `App.js` main content section
- [ ] Add to Page Inventory section in this file
- [ ] Update Navigation Map in `/CLAUDE.md`
- [ ] Run `npm run build` — confirm zero errors
