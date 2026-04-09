# src/pages/ — Page Inventory & Patterns

## Page Inventory

---

### File: `Penjualan.js`
**Nav key:** `penjualan`
**Purpose:** Income (sales) transaction page — thin wrapper around `TransactionPage` base component.
**Props received:** All props that `TransactionPage` accepts. Passes `type="income"`, `title="Penjualan"`, `accentColor="#10b981"`.
- `onSuratJalan: (tx) => void` — triggers SuratJalanModal in App.js (income only, not passed to Pembelian)
- `onNavigateOutstanding: (txIds) => void` — navigate to Outstanding page with highlighted rows
**Key local state:** none (delegates entirely to TransactionPage)

---

### File: `Pembelian.js`
**Nav key:** `pembelian`
**Purpose:** Expense (purchase) transaction page — thin wrapper around `TransactionPage` base component.
**Props received:** All props that `TransactionPage` accepts. Passes `type="expense"`, `title="Pembelian"`, `accentColor="#ef4444"`.
**Note:** Pembelian does NOT receive `onSuratJalan` — surat jalan is income-only.
**Key local state:** none (delegates entirely to TransactionPage)

---

### File: `Inventory.js`
**Nav key:** `inventory`
**Purpose:** Stock inventory with catalog table grouped by category. Catalog management, expandable per-item stock ledger, inline adjustment form.

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
- `itemCatalog?: Array` — `{ id, name, defaultUnit, subtypes[], archived, archivedSubtypes[] }`
- `onAddCatalogItem?: (item: Object) => void`
- `onUpdateCatalogItem?: (item: Object) => void`
- `onDeleteCatalogItem?: (id: string) => void`
- `onArchiveCatalogItem?: (id: string) => void`
- `onUnarchiveCatalogItem?: (id: string) => void`
- `onArchiveSubtype?: (id: string, name: string) => void`
- `onUnarchiveSubtype?: (id: string, name: string) => void`
- `onNavigateToArchive?: () => void` — navigates to ArchivedItems page

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
- `activeStockMap` — returns `stockMap` (today) or `computeStockMapForDate(...)` for historical dates
- `tableGroups` — builds flat rows from `itemCatalog` (base + subtypes) + uncataloged items from `activeStockMap`, groups using `getCategoryForItem()` with groupName-prefix fallback for zero-stock base items (longest match). Returns `[{ groupName, code, items[] }]` with "Lainnya" last.
- `ledgerEntries` / `visibleLedgerEntries` — stock history for expanded item, filtered by type/date, newest-first

**Table layout:** Group header rows (dark navy `.inventory-group-header`) → base item row → indented subtype rows. "LAINNYA — UNC" group catches items not matched to any category.

**Ledger:** Expandable per-item panel (`expandedStockItem`) showing all transactions and adjustments, running totals, date filter, type filter, PERIODE quick-select (Hari Ini / Minggu Ini / Bulan Ini / Semua) with active state. Ledger accumulates ALL matching item rows in multi-item transactions (does not break on first match). Sort order matches `computeStockMap` comparator (date+time string first, then `createdAt` as tiebreak).

**eslint-disable note:** The `useEffect` syncing `ledgerDateFrom`/`ledgerDateTo` to `inventoryDate` intentionally excludes `expandedStockItem` from its deps array — the effect should only fire on date changes, not when the expanded item changes. Comment in source explains this.

---

### File: `Contacts.js`
**Nav key:** `contacts`
**Purpose:** Contact list (left panel) + detail panel (right) with AR/AP balances and transaction history.

**Props received:**
- `contacts: Array`
- `transactions: Array`
- `balanceMap: Object` — pre-computed in App.js, keyed by lowercase contact name
- `onAddContact: (c) => void`
- `onUpdateContact: (c) => void`
- `onDeleteContact: (id) => void`
- `onArchiveContact?: (id) => void`
- `onUnarchiveContact?: (id) => void` — unused in active list (kept for consistency)
- `onNavigateToArchive?: () => void`
- `onDeleteTransaction?: (id) => void`
- `onEditTransaction?: (tx) => void`
- `onMarkPaid?: (id, amount, note) => void`

**Key local state:**
- `search`, `alphaFilter`, `sortBy`
- `selected` — contact id or `"new"` or null
- `editMode` — boolean
- `form` — `{ name, email, phone, address }`
- `deleteTx`, `paidTx`, `toast`
- `submitting` — debounce guard
- `contactAction` — `{ type: "archive"|"delete", contact }` for confirm dialog
- `expandedTxId`
- `nameError` — inline duplicate-name error string
- `nameInputRef` — ref for auto-focus when form opens

**Key useMemos:**
- `activeContacts` — contacts where `archived !== true`
- `archivedCount` — count of archived contacts
- `txCountMap` — per-name transaction count (for archive vs delete eligibility)
- `withBalance` — active contacts enriched from balanceMap

---

### File: `Reports.js`
**Nav key:** `reports`
**Purpose:** Date-range financial report with multi-select client/item filters, summary cards, bar chart, transaction table, JSON/CSV export.

**Props received:**
- `transactions: Array`
- `contacts: Array`
- `settings: Object`
- `onReport?: (state) => void` — opens ReportModal via App.js (deprecated: onInvoice not used)
- `initItemFilter?: string | null` — pre-fills item filter from Inventory "Lihat" button
- `onClearItemFilter?: () => void`

**Key local state:** `dateFrom`, `dateTo`, `selectedClients`, `selectedItems`, `period`, `inventoryFilterItem`, `toast`, `confirmCount`, `exportFormat`

**Behaviors:**
- `initItemFilter` sets `selectedItems=[initItemFilter]`, `period="all-time"`, `dateFrom=""`, `dateTo=""` on mount
- `onClearItemFilter()` called on mount (via useEffect) to reset App.js state
- Export JSON: raw localStorage. Export CSV: 14-column format with BOM. Both track `lastExportDate`.

**Internal:** `getMultiItemContribution(t, selItems)` — returns item-level breakdown for multi-item transactions when item filter is active. Returns null when: no filter, single-item tx, all items selected, or none selected.

---

### File: `Outstanding.js`
**Nav key:** `outstanding`
**Purpose:** Two-section view (Piutang / Hutang) of all transactions with `outstanding > 0`. Sortable, paginated 50/page.

**Props received:**
- `transactions: Array`
- `onEdit: (tx) => void`
- `onMarkPaid: (id, amount, note) => void`
- `onDelete: (id) => void`
- `onInvoice: (txs) => void`
- `highlightTxIds: Array | null` — transaction IDs to highlight on mount
- `onClearHighlight: () => void` — called after highlight rows are scrolled to

**Key local state:** `sortBy` (at Outstanding level); `deleteTx`, `paidTx`, `toast`, `page`, `expandedTxId` (inside `OutstandingTable` sub-component)

**Highlight behavior:** Each row computes a permanent class from `dueDate`: `.outstanding-row--overdue` (past due) or `.outstanding-row--near-due` (≤3 days). `OutstandingTable` additionally receives `flashIds` (Set). Flash rows get `.outstanding-row--flash` (blue). Flash is cleared on first user interaction (click/keydown/scroll) after a 500ms debounce. First flash row scrolled into view via `document.querySelector("tr.outstanding-row--flash")` in a 50ms setTimeout.

**Sort options:** `nearestDue`, `furthestDue`, `smallestOut`, `largestOut`. Null/undefined dueDates always sort to end.

**Sub-components:** `OutstandingTable` (internal), `SectionCard` (internal) — neither exported.

---

### File: `Settings.js`
**Nav key:** `settings`
**Purpose:** Business info form, bank account CRUD, due-date defaults, low-stock threshold, JSON/CSV backup export, JSON import.

**Props received:**
- `settings: Object`
- `transactions: Array`
- `onSave: (settings) => void`
- `onImport: (data) => void`

**Key local state:**
- `form` — mirrors `settings` prop
- `flash` — brief save-success indicator
- `submitting` — debounce guard
- `importMsg` — feedback string for file import result
- `exportFormat` — `"json"` | `"csv"`
- `bizErrors` — `{ businessName? }` validation errors
- `dueDaysStr`, `lowStockStr`, `maxBankStr` — string state for free-typing numeric fields, validated on blur

**CSV export columns:** Tanggal, Waktu, No. Invoice, Klien, Jenis, Barang, Karung, Berat (Kg), Harga/Kg, Subtotal, Nilai Total, Status, Sisa Tagihan, Jatuh Tempo. Expands multi-item transactions into separate rows. Includes BOM for Excel.

---

### File: `ArchivedItems.js`
**Nav key:** `archivedItems` (no sidebar link — accessed via Inventory "Arsip" button)
**Purpose:** Shows archived catalog items (fully archived base items and individually archived subtypes). Restore or permanently delete.

**Props received:**
- `itemCatalog: Array`
- `stockMap: Object`
- `transactions: Array`
- `onUnarchiveCatalogItem: (id: string) => void`
- `onUnarchiveSubtype: (id: string, subtypeName: string) => void`
- `onDeleteCatalogItem: (id: string) => void`
- `onViewItem: (itemName: string) => void`
- `onBack: () => void`

**Key local state:** `search`, `toast`, `deleteConfirm` (`{ type, id, subtypeId, subtypeName, parentName, displayName }`), `submitting`

**Delete eligibility:** `txCountMap[normItem(name)] === 0` — permanent delete only for zero-transaction items.

---

### File: `ArchivedContacts.js`
**Nav key:** `archivedContacts` (no sidebar link — accessed via Contacts "Arsip" button)
**Purpose:** Shows archived contacts. Restore or permanently delete.

**Props received:**
- `contacts: Array`
- `transactions: Array`
- `onUnarchiveContact: (id: string) => void`
- `onDeleteContact: (id: string) => void`
- `onBack: () => void`

**Key local state:** `search`, `toast`, `deleteConfirm` (contact object), `submitting`

**Delete eligibility:** `txCountMap[name.toLowerCase()] === 0` — permanent delete only for zero-transaction contacts.

**Delete flow:** Uses its own inline confirm dialog (not `DeleteConfirmModal`). "Hapus Permanen" button only rendered when `txCount === 0` — so the confirm dialog can never be triggered for a contact that has transactions. Comment in source documents this.

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
- `onNavigateOutstanding?: (txIds) => void` — optional
- `saved: boolean`
- `itemCatalog: Array`
- `onAddCatalogItem?: () => void`
- `onUpdateCatalogItem?: () => void`
- `onUnarchiveCatalogItem?: () => void`
- `onUnarchiveSubtype?: () => void`
- `onUnarchiveContact?: () => void`

**How Penjualan and Pembelian differ:**
- `type="income"` → green accent, auto-generates txnId, labels say "Penjualan/Piutang", shows surat jalan button
- `type="expense"` → red accent, manual txnId (supplier invoice no), labels say "Pembelian/Hutang", no surat jalan

**Key local state:**
```
showForm, search, searchCategory ("invoiceNo"|"itemName"|"klien"), sortBy,
stockWarn, deleteTx, paidTx, toast, viewDate, overdueDismissed, dueSoonDismissed, expandedTxId
```

**Key behaviors:**
- Day-view: `viewDate` state filters to one day at a time (default: today)
- 3-part search bar: category dropdown + text input + sort dropdown (`.search-bar-wrapper`)
- Payment progress bar in Nilai cell for all payment states
- `[🕐]` history button with red corner badge when `paymentHistory.length > 1` (class: `action-btn--history`)
- `expandedTxId` — only one PaymentHistoryPanel open at a time
- Overdue and near-due banners (each dismissible per session via `overdueDismissed`/`dueSoonDismissed`)

**Rule: Any change to TransactionPage affects BOTH Penjualan AND Pembelian. Always test both after editing.**

---

## Shared Page Patterns

### Toast Usage Pattern
```jsx
const [toast, setToast] = useState(null);
// Show:
setToast("Transaksi dihapus.");
// Render (always at bottom of component return):
{toast && <Toast message={toast} onDone={() => setToast(null)} />}
```

### Modal Pattern
```jsx
const [deleteTx, setDeleteTx] = useState(null);
<DeleteConfirmModal
  transaction={deleteTx}
  onConfirm={confirmDelete}
  onCancel={() => setDeleteTx(null)}
/>
```

### Submit Debounce Pattern
```jsx
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
const [fieldErrors, setFieldErrors] = useState({});
// <input className={`form-input${fieldErrors.name ? " form-input--error" : ""}`} />
// {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
```

---

## New Page Checklist

- [ ] Create `src/pages/NewPage.js` with default export
- [ ] Add JSDoc `@param` block at top
- [ ] Add to `navItems` array in `App.js` (if it needs a sidebar link)
- [ ] Add import in `App.js`
- [ ] Add conditional render in `App.js` main content section
- [ ] Add to Page Inventory section in this file
- [ ] Update Navigation Map in `/CLAUDE.md`
- [ ] Run `npm run build` — confirm zero errors
