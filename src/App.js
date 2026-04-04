/**
 * App.js
 * Root application component.
 *
 * Responsibilities:
 *  - Load / persist global data (transactions, contacts, settings)
 *  - Own all global state: page, sidebar, edit modal, invoice modal
 *  - Compute derived data: stockMap, AR/AP, alert counts
 *  - Provide all CRUD handlers to child pages via props
 *  - Render the sidebar navigation and main content area
 */
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";

import "./styles.css";

// ── Pages ─────────────────────────────────────────────────────────────────────
import Penjualan  from "./pages/Penjualan";
import Pembelian  from "./pages/Pembelian";
import Inventory from "./pages/Inventory";
import Contacts  from "./pages/Contacts";
import Reports   from "./pages/Reports";
import Settings  from "./pages/Settings";
import Outstanding from "./pages/Outstanding";
import ArchivedItems    from "./pages/ArchivedItems";
import ArchivedContacts from "./pages/ArchivedContacts";

// ── Components ────────────────────────────────────────────────────────────────
import TransactionForm    from "./components/TransactionForm";
import StockWarningModal  from "./components/StockWarningModal";
import InvoiceModal       from "./components/InvoiceModal";
import SuratJalanModal    from "./components/SuratJalanModal";
import Icon               from "./components/Icon";
import ReportModal        from "./components/ReportModal";
import StockReportModal   from "./components/StockReportModal";
import DotMatrixPrintModal from "./components/DotMatrixPrintModal";

// ── Utils ─────────────────────────────────────────────────────────────────────
import { loadData, saveData, STORAGE_KEY } from "./utils/storage";
import { computeStockMap }         from "./utils/stockUtils";
import { computeARandAP }          from "./utils/balanceUtils";
import { generateId, generateTxnId, fmtIDR, normItem, normalizeTitleCase, addDays, today, nowTime } from "./utils/idGenerators";
import { deriveStatus }            from "./utils/statusUtils";
import { generateCode }           from "./utils/categoryUtils";

// ─── Edit Modal ───────────────────────────────────────────────────────────────
/**
 * Wraps TransactionForm in a modal overlay for editing existing transactions.
 * Adjusts stockMap to remove the current transaction's contribution before
 * validation, preventing false stock-warning triggers on edit.
 */
function EditModal({ transaction, contacts, transactions = [], stockMap, itemCatalog = [], onSave, onClose, onCreateContact, onAddCatalogItem = () => {}, onUpdateCatalogItem = () => {}, onUnarchiveCatalogItem = () => {}, onUnarchiveSubtype = () => {}, onUnarchiveContact = () => {} }) {
  const [stockWarn, setStockWarn] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const adjustedStockMap = useMemo(() => {
    const m = { ...stockMap };
    const itemList = Array.isArray(transaction.items) && transaction.items.length > 0
      ? transaction.items
      : [{ itemName: transaction.itemName, sackQty: transaction.stockQty }];
    for (const item of itemList) {
      const key = normItem(item.itemName);
      if (m[key]) {
        const origDelta =
          transaction.type === "expense"
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
          onUnarchiveCatalogItem={onUnarchiveCatalogItem}
          onUnarchiveSubtype={onUnarchiveSubtype}
          onUnarchiveContact={onUnarchiveContact}
          onSave={(t) => { onSave(t); onClose(); }}
          onCancel={onClose}
        />
        <StockWarningModal data={stockWarn} onClose={() => setStockWarn(null)} />
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Global state ────────────────────────────────────────────────────────────
  const [data,        setData]        = useState(loadData);
  const [page,        setPage]        = useState("penjualan");
  const [saved,       setSaved]       = useState(true);
  const [saveError,   setSaveError]   = useState(false);
  const [editTx,      setEditTx]      = useState(null);
  const [invoiceTxs,  setInvoiceTxs]  = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 1024);
  const [reportItemFilter,   setReportItemFilter]   = useState(null); // item name pre-filter from Inventory "Lihat"
  const [outstandingHighlight, setOutstandingHighlight] = useState(null); // array of tx IDs to highlight on Outstanding page
  const [reportState, setReportState] = useState(null); // { transactions, dateFrom, dateTo }
  const [backupBannerDismissed, setBackupBannerDismissed] = useState(false);
  const [suratJalanTx, setSuratJalanTx] = useState(null);
  const [showStockReport, setShowStockReport] = useState(false);
  const [dotMatrixData, setDotMatrixData] = useState(null); // { transaction, mode } | null
  const saveTimer = useRef();

  // ── Persistence ─────────────────────────────────────────────────────────────
  /** Debounced save: marks "saving" immediately, writes after 500 ms idle */
  const persist = useCallback((nd) => {
    setSaved(false);
    setSaveError(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const ok = saveData(nd);
      if (ok) {
        setSaved(true);
        setSaveError(false);
      } else {
        setSaveError(true);
        // saved stays false — beforeunload guard stays active
      }
    }, 500);
  }, []);

  /** Manual retry: attempt to save current data immediately */
  const retrySave = useCallback(() => {
    const ok = saveData(data);
    if (ok) {
      setSaved(true);
      setSaveError(false);
    }
  }, [data]);

  // Not wrapped in useCallback — uses setData functional updater which is stable,
  // so no stale closure risk. If update is ever passed as a prop to memoized children,
  // consider wrapping in useCallback([persist]).
  /** Immutable state updater that also trigger persistence */
  const update = (fn) =>
    setData((d) => {
      const nd = fn(d);
      persist(nd);
      return nd;
    });

  // ── Derived data ─────────────────────────────────────────────────────────────
  const stockMap  = useMemo(() => computeStockMap(data.transactions, data.stockAdjustments || []), [data.transactions, data.stockAdjustments]);
  const threshold = data.settings.lowStockThreshold ?? 10;
  const { ar: globalAR, ap: globalAP } = useMemo(
    () => computeARandAP(data.transactions),
    [data.transactions]
  );
  const alertCount = useMemo(() => {
    const v = Object.values(stockMap);
    return v.filter((s) => s.qty < 0).length + v.filter((s) => s.qty >= 0 && s.qty <= threshold).length;
  }, [stockMap, threshold]);

  // Badge counts for near-due outstanding transactions (within 3 days, per type)
  const { penjualanBadge, pembelianBadge, outstandingBadge } = useMemo(() => {
    const todayMs = new Date(today() + "T00:00:00Z").getTime();
    let penjualan = 0, pembelian = 0;
    for (const t of data.transactions) {
      if ((t.outstanding || 0) <= 0 || !t.dueDate) continue;
      try {
        const diff = (new Date(t.dueDate + "T00:00:00Z").getTime() - todayMs) / 86400000;
        if (diff <= 3) {
          if (t.type === "income") penjualan++;
          else pembelian++;
        }
      } catch { /* ignore */ }
    }
    return { penjualanBadge: penjualan, pembelianBadge: pembelian, outstandingBadge: penjualan + pembelian };
  }, [data.transactions]);

  // ── beforeunload guard — warns if browser closes during 500ms debounce ───
  useEffect(() => {
    const handler = (e) => {
      if (!saved) {
        e.preventDefault();
        e.returnValue = ""; // triggers browser's native "Leave site?" dialog
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saved]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Note: totalIncome/totalExpense are CASH-BASIS (value - outstanding), not gross values.
  // The Contacts page labels these as "Total Penjualan/Pembelian" which may imply gross.
  // ── Pre-computed per-contact balance map (O(tx) once, not O(contacts×tx)) ─
  // Shape: { [lowerCaseName]: { totalIncome, totalExpense, ar, ap, netOut, txs } }
  const balanceMap = useMemo(() => {
    const map = {};
    for (const t of data.transactions) {
      const key = t.counterparty.toLowerCase();
      if (!map[key]) map[key] = { totalIncome: 0, totalExpense: 0, ar: 0, ap: 0, txs: [] };
      const out  = Number(t.outstanding) || 0;
      const cash = Number(t.value) - out;
      if (t.type === "income") {
        map[key].totalIncome += cash;
        map[key].ar          += out;
      } else {
        map[key].totalExpense += cash;
        map[key].ap           += out;
      }
      map[key] = { ...map[key], txs: [...map[key].txs, t] };
    }
    // Sort each contact's tx list descending by createdAt
    for (const key of Object.keys(map)) {
      map[key].txs.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime()
          : new Date((a.date || "1970-01-01") + "T" + (a.time || "00:00") + ":00Z").getTime();
        const tb = b.createdAt ? new Date(b.createdAt).getTime()
          : new Date((b.date || "1970-01-01") + "T" + (b.time || "00:00") + ":00Z").getTime();
        return tb - ta;
      });
      map[key].netOut = map[key].ar - map[key].ap;
    }
    return map;
  }, [data.transactions]);

  // ── Auto-create contact when a new counterparty appears ───────────────────
  const ensureContact = (cp, contacts) => {
    const normName = normalizeTitleCase(cp);
    if (contacts.some((c) => c.name.toLowerCase() === normName.toLowerCase())) return contacts;
    return [...contacts, { id: generateId(), name: normName, email: "", phone: "", address: "", archived: false }];
  };

  /** Normalize item/counterparty fields before any save */
  const normTx = (t) => ({
    ...t,
    itemName:     normalizeTitleCase(t.itemName),
    counterparty: normalizeTitleCase(t.counterparty),
  });

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const addTransaction = (t) => {
    const out = Number(t.outstanding) || 0;
    const dueDate = out > 0 ? (addDays(t.date, t.customDueDays) ?? null) : null;
    const nt = { ...normTx(t), createdAt: new Date().toISOString(), dueDate };
    const value    = Number(nt.value) || 0;
    const paidNow  = value - out;
    const initialPayment = {
      id:                generateId(),
      paidAt:            new Date().toISOString(),
      date:              today(),
      time:              nowTime(),
      amount:            out === 0 ? value : (paidNow > 0 ? paidNow : 0),
      outstandingBefore: value,
      outstandingAfter:  out,
      note:              out === 0
        ? "Lunas saat transaksi dibuat"
        : paidNow > 0
        ? "Pembayaran awal"
        : "Belum ada pembayaran saat transaksi dibuat",
      method: null,
    };
    return update((d) => {
      const txnId = nt.type === "income"
        ? generateTxnId(d.transactions, nt.date)
        : (nt.txnId || null); // expense: use supplier-entered invoice no, or null
      return {
        ...d,
        transactions: [...d.transactions, { ...nt, txnId, paymentHistory: [initialPayment] }],
        contacts: ensureContact(nt.counterparty, d.contacts),
      };
    });
  };

  const editTransaction = (t) => {
    const nt = normTx(t);
    return update((d) => ({
      ...d,
      transactions: d.transactions.map((x) => {
        if (x.id !== nt.id) return x;
        const out = Number(nt.outstanding) || 0;
        // dueDate rules on edit:
        //  - fully paid → null
        //  - partial/unpaid and date changed → recalculate from new date
        //  - partial/unpaid, date unchanged → keep existing dueDate (don't restart clock)
        //  - partial/unpaid, no existing dueDate → set from new date
        let dueDate;
        if (out === 0) {
          dueDate = null;
        } else if (x.dueDate && nt.date === x.date && nt.customDueDays === x.customDueDays) {
          dueDate = x.dueDate; // keep — date and terms didn't change
        } else {
          dueDate = addDays(nt.date, nt.customDueDays) ?? null; // date changed, terms changed, or no prior dueDate
        }
        // txnId logic on edit:
        //  - income: auto-generated; regenerate only if YY-MM prefix changes (BUG-005)
        //  - expense: use whatever the user entered (allows add/update/clear of supplier invoice no)
        let txnId;
        if (nt.type === "income") {
          const oldPrefix = (x.date || "").slice(2, 7);
          const newPrefix = (nt.date || "").slice(2, 7);
          txnId = (oldPrefix && newPrefix && oldPrefix !== newPrefix)
            ? generateTxnId(d.transactions, nt.date)
            : x.txnId;
        } else {
          txnId = nt.txnId || null;
        }

        const valueChanged = Number(x.value) !== Number(nt.value) ||
          Number(x.outstanding) !== Number(nt.outstanding);
        const editPaymentEntry = valueChanged ? {
          id:                generateId(),
          paidAt:            new Date().toISOString(),
          date:              today(),
          time:              nowTime(),
          amount:            0,
          outstandingBefore: Number(x.outstanding) || 0,
          outstandingAfter:  Number(nt.outstanding) || 0,
          note:              "Transaksi diedit — nilai diperbarui",
          method:            null,
        } : null;
        return {
          ...nt,
          txnId,
          dueDate,
          createdAt:      x.createdAt || nt.createdAt || new Date().toISOString(),
          paymentHistory: editPaymentEntry
            ? [...(x.paymentHistory || []), editPaymentEntry]
            : (x.paymentHistory || []),
          // BUG-008 Fix: Store slim snapshot to prevent localStorage bloat (full copy was 2-3KB each × 20)
          editLog: [...(x.editLog || []), { at: new Date().toISOString(), prev: {
            date:         x.date,
            time:         x.time,
            counterparty: x.counterparty,
            itemName:     x.itemName,
            stockQty:     x.stockQty,
            stockUnit:    x.stockUnit,
            value:        x.value,
            outstanding:  x.outstanding,
            status:       x.status,
            dueDate:      x.dueDate,
            itemNames:    Array.isArray(x.items) ? x.items.map((it) => it.itemName) : [x.itemName],
          }}].slice(-20),
        };
      }),
    }));
  };

  const deleteTransaction = (id) =>
    update((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));

  // ── Apply a payment (full or partial) against a transaction's outstanding ──
  /**
   * @param {string} id          - transaction id
   * @param {number} paidAmount  - amount being paid now (1 ≤ paidAmount ≤ outstanding)
   */
  const applyPayment = (id, paidAmount, paymentNote = "") =>
    update((d) => ({
      ...d,
      transactions: d.transactions.map((t) => {
        if (t.id !== id) return t;
        const outstandingBefore = Number(t.outstanding) || 0;
        const newOutstanding    = Math.max(0, outstandingBefore - paidAmount);
        const isFullyPaid       = newOutstanding === 0;
        const newPaymentEntry   = {
          id:                generateId(),
          paidAt:            new Date().toISOString(),
          date:              today(),
          time:              nowTime(),
          amount:            paidAmount,
          outstandingBefore,
          outstandingAfter:  newOutstanding,
          note:              paymentNote || (isFullyPaid ? "Pelunasan" : "Pembayaran sebagian"),
          method:            null,
        };
        return {
          ...t,
          outstanding:    newOutstanding,
          status:         deriveStatus(t.type, !isFullyPaid),
          // Full pay → clear due date; partial pay → preserve existing due date
          dueDate:        isFullyPaid ? null : (t.dueDate ?? null),
          paymentHistory: [...(t.paymentHistory || []), newPaymentEntry],
          // BUG-008 Fix: Store slim snapshot to prevent localStorage bloat
          editLog:        [...(t.editLog || []), { at: new Date().toISOString(), prev: {
            date:         t.date,
            time:         t.time,
            counterparty: t.counterparty,
            itemName:     t.itemName,
            stockQty:     t.stockQty,
            stockUnit:    t.stockUnit,
            value:        t.value,
            outstanding:  t.outstanding,
            status:       t.status,
            dueDate:      t.dueDate,
            itemNames:    Array.isArray(t.items) ? t.items.map((it) => it.itemName) : [t.itemName],
          }}].slice(-20),
        };
      }),
    }));

  // ── Instantly create a named contact (called from TransactionForm dropdown) ─
  const createContact = (name) => {
    const trimmed = normalizeTitleCase(name);
    if (!trimmed) return;
    update((d) => {
      if (d.contacts.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return d;
      return { ...d, contacts: [...d.contacts, { id: generateId(), name: trimmed, email: "", phone: "", address: "", archived: false }] };
    });
  };

  // ── Archive / unarchive a contact ─────────────────────────────────────────
  const archiveContact = (contactId) =>
    update((d) => ({
      ...d,
      contacts: d.contacts.map((c) =>
        c.id === contactId ? { ...c, archived: true } : c
      ),
    }));

  const unarchiveContact = (contactId) =>
    update((d) => ({
      ...d,
      contacts: d.contacts.map((c) =>
        c.id === contactId ? { ...c, archived: false } : c
      ),
    }));

  // ── Permanently delete a contact (0-transaction contacts only) ────────────
  const deleteContact = (contactId) =>
    update((d) => {
      const contact = d.contacts.find((c) => c.id === contactId);
      if (!contact) return d;
      const hasTx = d.transactions.some(
        (t) => t.counterparty.toLowerCase().trim() === contact.name.toLowerCase().trim()
      );
      if (hasTx) return d; // safety guard: never delete a contact that has transactions
      return { ...d, contacts: d.contacts.filter((c) => c.id !== contactId) };
    });

  // ── Update a contact and cascade name changes to transactions ───────────────
  const updateContact = (contact) => {
    update((d) => {
      const oldContact = d.contacts.find((c) => c.id === contact.id);
      if (!oldContact) return d;

      const newName = normalizeTitleCase(contact.name);
      const isNameChange = oldContact.name.toLowerCase() !== newName.toLowerCase();

      // Block rename if another contact already has the same name (case-insensitive, trimmed)
      if (isNameChange && d.contacts.some((c) =>
        c.id !== contact.id && c.name.toLowerCase().trim() === newName.toLowerCase().trim()
      )) {
        return d; // leave state unchanged — Contacts.js should validate before calling
      }

      return {
        ...d,
        contacts: d.contacts.map((c) => (c.id === contact.id ? { ...contact, name: newName } : c)),
        transactions: isNameChange
          ? d.transactions.map((t) =>
              t.counterparty.toLowerCase() === oldContact.name.toLowerCase()
                ? { ...t, counterparty: newName }
                : t
            )
          : d.transactions,
      };
    });
  };

  // ── Import handler for Settings backup restore ────────────────────────────
  const handleImport = (importedData) => {
    // migrateData is not exported from storage.js, so we write to localStorage
    // first and then re-read via loadData(), which runs migrations internally.
    // This ensures old backups (pre-v9 paymentHistory, pre-v12 itemCatalog, etc.)
    // are fully normalized before hitting React state — not just on the next reload.
    saveData(importedData);
    const migrated = loadData();
    update(() => migrated);
  };

  // ── Add a manual stock adjustment (Inventory page) ────────────────────────
  const addStockAdjustment = (adj) =>
    update((d) => ({ ...d, stockAdjustments: [...(d.stockAdjustments || []), adj] }));

  // ── Delete a single stock adjustment by id ───────────────────────────────
  const deleteStockAdjustment = (adjustmentId) =>
    update((d) => ({
      ...d,
      stockAdjustments: (d.stockAdjustments || []).filter((a) => a.id !== adjustmentId),
    }));

  // ── Replace entire itemCategories array (called from Inventory category UI) ─
  const updateItemCategories = (categories) =>
    update((d) => ({ ...d, itemCategories: categories }));

  // ── Item Catalog CRUD ────────────────────────────────────────────────────────
  const addCatalogItem = (item) =>
    update((d) => {
      const catalog = d.itemCatalog || [];
      const categories = d.itemCategories || [];
      const normalizedName = normalizeTitleCase(item.name);

      let newCatalog;
      let catalogItemName;

      const existing = catalog.find((c) => normItem(c.name) === normItem(item.name));
      if (existing) {
        // Safety guard: merge subtypes instead of creating a duplicate entry
        const existingNorm = new Set((existing.subtypes || []).map(normItem));
        const merged = [
          ...(existing.subtypes || []),
          ...(item.subtypes || []).filter((s) => !existingNorm.has(normItem(s))),
        ];
        newCatalog = catalog.map((c) => c.id === existing.id ? { ...c, subtypes: merged } : c);
        catalogItemName = existing.name;
      } else {
        newCatalog = [...catalog, {
          id:          generateId(),
          name:        normalizedName,
          defaultUnit: item.defaultUnit || "karung",
          subtypes:    item.subtypes    || [],
        }];
        catalogItemName = normalizedName;
      }

      // Auto-create a matching itemCategories entry if none exists for this item
      const hasCat = categories.some((c) => normItem(c.groupName) === normItem(catalogItemName));
      let newCategories = categories;
      if (!hasCat) {
        const existingCodes = new Set(categories.map((c) => c.code));
        let code = generateCode(catalogItemName);
        let suffix = 2;
        while (existingCodes.has(code)) {
          code = generateCode(catalogItemName) + suffix;
          suffix++;
        }
        newCategories = [...categories, {
          id:        generateId(),
          groupName: catalogItemName,
          code,
          items:     [normItem(catalogItemName)],
        }];
      }

      return { ...d, itemCatalog: newCatalog, itemCategories: newCategories };
    });

  const updateCatalogItem = (updatedItem) =>
    update((d) => {
      const newCatalog = (d.itemCatalog || []).map((c) => c.id === updatedItem.id ? updatedItem : c);

      // Sync the matching itemCategories entry's items[] when subtypes change
      const newCategories = (d.itemCategories || []).map((cat) => {
        if (normItem(cat.groupName) !== normItem(updatedItem.name)) return cat;
        const baseKey = normItem(updatedItem.name);
        const subKeys = (updatedItem.subtypes || []).map((sub) => normItem(`${updatedItem.name} ${sub}`));
        return { ...cat, items: [baseKey, ...subKeys] };
      });

      return { ...d, itemCatalog: newCatalog, itemCategories: newCategories };
    });

  const deleteCatalogItem = (itemId) =>
    update((d) => {
      const cat = (d.itemCatalog || []).find((c) => c.id === itemId);
      if (!cat) return d;
      // Safety guard: only permanently delete if no transactions reference this item
      const allNames = [cat.name, ...(cat.subtypes || []).map((s) => `${cat.name} ${s}`)];
      const hasTx = d.transactions.some((t) => {
        const items = Array.isArray(t.items) && t.items.length > 0
          ? t.items : [{ itemName: t.itemName }];
        return items.some((it) => allNames.some((n) => normItem(n) === normItem(it.itemName)));
      });
      if (hasTx) return d; // block — UI should prevent this path for items with transactions
      return {
        ...d,
        itemCatalog:      (d.itemCatalog || []).filter((c) => c.id !== itemId),
        itemCategories:   (d.itemCategories || []).filter((c) => normItem(c.groupName) !== normItem(cat.name)),
        stockAdjustments: (d.stockAdjustments || []).filter(
          (a) => !allNames.some((n) => normItem(n) === normItem(a.itemName))
        ),
      };
    });

  // ── Archive / unarchive catalog items ─────────────────────────────────────
  const archiveCatalogItem = (itemId) =>
    update((d) => ({
      ...d,
      itemCatalog: (d.itemCatalog || []).map((c) =>
        c.id === itemId ? { ...c, archived: true } : c
      ),
    }));

  const unarchiveCatalogItem = (itemId) =>
    update((d) => ({
      ...d,
      itemCatalog: (d.itemCatalog || []).map((c) =>
        // Only unarchive the base item — archivedSubtypes stays unchanged;
        // each subtype is archived/unarchived independently via archiveSubtype/unarchiveSubtype.
        c.id === itemId ? { ...c, archived: false } : c
      ),
    }));

  const archiveSubtype = (itemId, subtypeName) =>
    update((d) => ({
      ...d,
      itemCatalog: (d.itemCatalog || []).map((c) => {
        if (c.id !== itemId) return c;
        const existing = c.archivedSubtypes || [];
        if (existing.some((s) => normItem(s) === normItem(subtypeName))) return c;
        return { ...c, archivedSubtypes: [...existing, subtypeName] };
      }),
    }));

  const unarchiveSubtype = (itemId, subtypeName) =>
    update((d) => ({
      ...d,
      itemCatalog: (d.itemCatalog || []).map((c) => {
        if (c.id !== itemId) return c;
        return {
          ...c,
          archivedSubtypes: (c.archivedSubtypes || []).filter(
            (s) => normItem(s) !== normItem(subtypeName)
          ),
        };
      }),
    }));

  // ── Rename an inventory item across all transactions and adjustments ───────
  const renameInventoryItem = (oldName, newName) =>
    update((d) => ({
      ...d,
      transactions: d.transactions.map((t) => {
        const matchesTop = normItem(t.itemName) === normItem(oldName);
        return {
          ...t,
          itemName: matchesTop ? newName : t.itemName,
          items: Array.isArray(t.items)
            ? t.items.map((it) =>
                normItem(it.itemName) === normItem(oldName)
                  ? { ...it, itemName: newName }
                  : it
              )
            : t.items,
        };
      }),
      stockAdjustments: (d.stockAdjustments || []).map((a) =>
        normItem(a.itemName) === normItem(oldName) ? { ...a, itemName: newName } : a
      ),
    }));

  // ── Delete all transactions and adjustments for an inventory item ──────────
  const deleteInventoryItem = (itemName) =>
    update((d) => ({
      ...d,
      // Check all items[] entries, not just the top-level t.itemName (which is only the first item).
      // This ensures multi-item transactions are caught when the deleted item is a secondary item.
      transactions: d.transactions.filter((t) => {
        const itemList = Array.isArray(t.items) && t.items.length > 0
          ? t.items
          : [{ itemName: t.itemName }];
        return !itemList.some((it) => normItem(it.itemName) === normItem(itemName));
      }),
      stockAdjustments: (d.stockAdjustments || []).filter(
        (a) => normItem(a.itemName) !== normItem(itemName)
      ),
    }));

  // ── Navigation ────────────────────────────────────────────────────────────
  const navItems = [
    { key: "penjualan",   label: "Penjualan",        icon: "income",   badge: penjualanBadge },
    { key: "pembelian",   label: "Pembelian",         icon: "expense",  badge: pembelianBadge },
    { key: "inventory",   label: "Inventaris",        icon: "inventory", badge: alertCount },
    { key: "contacts",    label: "Kontak",            icon: "contacts" },
    { key: "reports",     label: "Laporan",           icon: "reports" },
    { key: "outstanding", label: "Piutang & Hutang",  icon: "warning",  badge: outstandingBadge },
    { key: "settings",    label: "Pengaturan",        icon: "settings" },
  ];

  /**
   * "Lihat" button in Inventory.js — navigates to Reports pre-filtered to all-time for that item.
   * Sets reportItemFilter which Reports reads on mount, then immediately clears via onClearItemFilter.
   */
  const handleViewItem = (itemName) => {
    setReportItemFilter(itemName);
    setPage("reports");
  };

  const navigateToOutstanding = (txIds) => {
    setOutstandingHighlight(txIds);
    setPage("outstanding");
  };

  // Print routing: checks printerType before opening A4 or dot matrix modal
  const handleInvoice = (txOrArray) => {
    if (data.settings.printerType === "Dot Matrix") {
      setDotMatrixData({ transaction: txOrArray, mode: "invoice" });
    } else {
      setInvoiceTxs(txOrArray);
    }
  };

  const handleSuratJalan = (tx) => {
    if (data.settings.printerType === "Dot Matrix") {
      setDotMatrixData({ transaction: tx, mode: "suratJalan" });
    } else {
      setSuratJalanTx(tx);
    }
  };

  // ── Backup Warning Logic ──────────────────────────────────────────────────
  const lastExport = data.settings.lastExportDate;
  const daysSinceExport = lastExport
    ? (new Date().getTime() - new Date(lastExport).getTime()) / (1000 * 3600 * 24)
    : Infinity;
  const showBackupWarning = daysSinceExport > 7;

  /** Quick export from backup banner — same format as Settings.js exportAll */
  const quickExport = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || "{}";
      const dateStr = today().replace(/-/g, "-");
      const a = document.createElement("a");
      a.href = "data:application/json;charset=utf-8," + encodeURIComponent(raw);
      a.download = `bukukas-backup-${dateStr}.json`;
      a.click();
      const now = new Date().toISOString();
      update((d) => ({ ...d, settings: { ...d.settings, lastExportDate: now } }));
    } catch { /* ignore download errors */ }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : "sidebar--closed"}`} aria-label="Navigasi">
        {/* Logo */}
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon" aria-hidden="true">📒</div>
          {sidebarOpen && (
            <div>
              <div className="sidebar__biz-name">BukuKas</div>
              <div className="sidebar__biz-sub">Pembukuan Digital</div>
            </div>
          )}
        </div>

        {/* Business name */}
        {sidebarOpen && (
          <div className="sidebar__meta">
            <div className="sidebar__meta-label">Bisnis</div>
            <div className="sidebar__meta-value">{data.settings.businessName}</div>
          </div>
        )}

        {/* Quick AR / AP snapshot */}
        {sidebarOpen && (globalAR > 0 || globalAP > 0) && (
          <div className="sidebar__ar-ap">
            {globalAR > 0 && (
              <div>
                <div className="sidebar__ar-ap-label" style={{ color: "#6ee7b7" }}>💚 Piutang</div>
                <div className="sidebar__ar-ap-val">{fmtIDR(globalAR)}</div>
              </div>
            )}
            {globalAP > 0 && (
              <div>
                <div className="sidebar__ar-ap-label" style={{ color: "#fca5a5" }}>❤️ Hutang</div>
                <div className="sidebar__ar-ap-val">{fmtIDR(globalAP)}</div>
              </div>
            )}
          </div>
        )}

        {/* Nav links */}
        <nav className="sidebar__nav" aria-label="Menu utama">
          {navItems.map((item) => (
            <div
              key={item.key}
              onClick={() => setPage(item.key)}
              className={`nav-item ${page === item.key ? "nav-item--active" : ""}`}
              role="button"
              tabIndex={0}
              aria-current={page === item.key ? "page" : undefined}
              aria-label={item.label}
              onKeyDown={(e) => e.key === "Enter" && setPage(item.key)}
            >
              <div className="nav-item__icon">
                <Icon
                  name={item.icon}
                  size={18}
                  color={page === item.key ? "#fff" : "#93c5fd"}
                />
              </div>
              {sidebarOpen && <span>{item.label}</span>}
              {item.badge > 0 && (
                <span className="nav-item__badge" aria-label={`${item.badge} peringatan`}>
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="sidebar__foot">
          <div
            onClick={() => setSidebarOpen((o) => !o)}
            className="sidebar__toggle"
            role="button"
            tabIndex={0}
            aria-label={sidebarOpen ? "Ciutkan sidebar" : "Buka sidebar"}
            onKeyDown={(e) => e.key === "Enter" && setSidebarOpen((o) => !o)}
          >
            <Icon name="menu" size={18} color="#93c5fd" />
            {sidebarOpen && <span>Ciutkan</span>}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="main-content" aria-label="Konten utama">
        {/* ── Save Error Banner ── */}
        {saveError && (
          <div role="alert" style={{
            background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8,
            padding: "12px 16px", margin: "0 0 16px", display: "flex",
            alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div>
              <strong style={{ color: "#991b1b" }}>⚠️ Gagal menyimpan data!</strong>
              <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>
                Penyimpanan lokal (localStorage) mungkin penuh. Data Anda belum tersimpan.
                Segera ekspor backup dari halaman Pengaturan untuk menghindari kehilangan data.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={retrySave} className="btn btn-primary btn-sm">Coba Lagi</button>
              <button onClick={() => setPage("settings")} className="btn btn-outline btn-sm">Buka Pengaturan</button>
            </div>
          </div>
        )}

        {/* ── Backup Warning Banner ── */}
        {showBackupWarning && !backupBannerDismissed && (
          <div role="alert" className="backup-banner">
            <span className="backup-banner__text">
              ⚠️ Belum backup lebih dari 7 hari.
              <span
                role="button"
                tabIndex={0}
                onClick={quickExport}
                onKeyDown={(e) => e.key === "Enter" && quickExport()}
                style={{ marginLeft: 4, color: "#007bff", fontWeight: 700, textDecoration: "underline", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Ekspor Sekarang
              </span>
            </span>
            <button
              onClick={() => setBackupBannerDismissed(true)}
              className="backup-banner__dismiss"
              aria-label="Tutup peringatan backup"
            >
              ✕
            </button>
          </div>
        )}

        {page === "penjualan" && (
          <Penjualan
            transactions={data.transactions}
            contacts={data.contacts}
            stockMap={stockMap}
            itemCatalog={data.itemCatalog || []}
            threshold={threshold}
            defaultDueDateDays={data.settings.defaultDueDateDays || 14}
            onAdd={addTransaction}
            onEdit={setEditTx}
            onDelete={deleteTransaction}
            onInvoice={handleInvoice}
            onMarkPaid={applyPayment}
            onCreateContact={createContact}
            onSuratJalan={handleSuratJalan}
            onNavigateOutstanding={navigateToOutstanding}
            onAddCatalogItem={addCatalogItem}
            onUpdateCatalogItem={updateCatalogItem}
            onUnarchiveCatalogItem={unarchiveCatalogItem}
            onUnarchiveSubtype={unarchiveSubtype}
            onUnarchiveContact={unarchiveContact}
            saved={saved}
          />
        )}
        {page === "pembelian" && (
          <Pembelian
            transactions={data.transactions}
            contacts={data.contacts}
            stockMap={stockMap}
            itemCatalog={data.itemCatalog || []}
            threshold={threshold}
            defaultDueDateDays={data.settings.defaultDueDateDays || 14}
            onAdd={addTransaction}
            onEdit={setEditTx}
            onDelete={deleteTransaction}
            onInvoice={handleInvoice}
            onMarkPaid={applyPayment}
            onCreateContact={createContact}
            onNavigateOutstanding={navigateToOutstanding}
            onAddCatalogItem={addCatalogItem}
            onUpdateCatalogItem={updateCatalogItem}
            onUnarchiveCatalogItem={unarchiveCatalogItem}
            onUnarchiveSubtype={unarchiveSubtype}
            onUnarchiveContact={unarchiveContact}
            saved={saved}
          />
        )}
        {page === "inventory" && (
          <Inventory
            stockMap={stockMap}
            threshold={threshold}
            onViewItem={handleViewItem}
            onAddAdjustment={addStockAdjustment}
            onRenameItem={renameInventoryItem}
            onDeleteItem={deleteInventoryItem}
            onDeleteAdjustment={deleteStockAdjustment}
            itemCategories={data.itemCategories || []}
            onUpdateCategories={updateItemCategories}
            transactions={data.transactions}
            stockAdjustments={data.stockAdjustments || []}
            onStockReport={() => setShowStockReport(true)}
            itemCatalog={data.itemCatalog || []}
            onAddCatalogItem={addCatalogItem}
            onUpdateCatalogItem={updateCatalogItem}
            onDeleteCatalogItem={deleteCatalogItem}
            onArchiveCatalogItem={archiveCatalogItem}
            onUnarchiveCatalogItem={unarchiveCatalogItem}
            onArchiveSubtype={archiveSubtype}
            onUnarchiveSubtype={unarchiveSubtype}
            onNavigateToArchive={() => setPage("archivedItems")}
          />
        )}
        {page === "archivedItems" && (
          <ArchivedItems
            itemCatalog={data.itemCatalog || []}
            stockMap={stockMap}
            transactions={data.transactions}
            onUnarchiveCatalogItem={unarchiveCatalogItem}
            onUnarchiveSubtype={unarchiveSubtype}
            onDeleteCatalogItem={deleteCatalogItem}
            onViewItem={handleViewItem}
            onBack={() => setPage("inventory")}
          />
        )}
        {page === "contacts" && (
          <Contacts
            contacts={data.contacts}
            transactions={data.transactions}
            balanceMap={balanceMap}
            onAddContact={(c) => update((d) => ({ ...d, contacts: [...d.contacts, { ...c, archived: false }] }))}
            onUpdateContact={updateContact}
            onDeleteContact={deleteContact}
            onArchiveContact={archiveContact}
            onUnarchiveContact={unarchiveContact}
            onNavigateToArchive={() => setPage("archivedContacts")}
            onDeleteTransaction={deleteTransaction}
            onEditTransaction={setEditTx}
            onMarkPaid={applyPayment}
          />
        )}
        {page === "archivedContacts" && (
          <ArchivedContacts
            contacts={data.contacts}
            transactions={data.transactions}
            onUnarchiveContact={unarchiveContact}
            onDeleteContact={deleteContact}
            onBack={() => setPage("contacts")}
          />
        )}
        {page === "reports" && (
          <Reports
            transactions={data.transactions}
            contacts={data.contacts}
            settings={data.settings}
            onInvoice={handleInvoice}
            onReport={setReportState}
            initItemFilter={reportItemFilter}
            onClearItemFilter={() => setReportItemFilter(null)}
          />
        )}
        {page === "outstanding" && (
          <Outstanding
            transactions={data.transactions}
            onEdit={setEditTx}
            onMarkPaid={applyPayment}
            onDelete={deleteTransaction}
            onInvoice={handleInvoice}
            highlightTxIds={outstandingHighlight}
            onClearHighlight={() => setOutstandingHighlight(null)}
          />
        )}
        {page === "settings" && (
          <Settings
            settings={data.settings}
            transactions={data.transactions}
            onSave={(s) => update((d) => ({ ...d, settings: s }))}
            onImport={handleImport}
          />
        )}
      </main>

      {/* ── Global modals ── */}
      {editTx && (
        <EditModal
          transaction={editTx}
          contacts={data.contacts}
          transactions={data.transactions}
          stockMap={stockMap}
          itemCatalog={data.itemCatalog || []}
          onSave={editTransaction}
          onClose={() => setEditTx(null)}
          onCreateContact={createContact}
          onAddCatalogItem={addCatalogItem}
          onUpdateCatalogItem={updateCatalogItem}
          onUnarchiveCatalogItem={unarchiveCatalogItem}
          onUnarchiveSubtype={unarchiveSubtype}
          onUnarchiveContact={unarchiveContact}
        />
      )}
      {invoiceTxs && (
        <InvoiceModal
          transactions={invoiceTxs}
          settings={data.settings}
          onClose={() => setInvoiceTxs(null)}
        />
      )}
      {suratJalanTx && (
        <SuratJalanModal
          transaction={suratJalanTx}
          settings={data.settings}
          onClose={() => setSuratJalanTx(null)}
        />
      )}
      {reportState && (
        <ReportModal
          transactions={reportState.transactions}
          settings={data.settings}
          dateFrom={reportState.dateFrom}
          dateTo={reportState.dateTo}
          onClose={() => setReportState(null)}
        />
      )}
      {showStockReport && (
        <StockReportModal
          stockMap={stockMap}
          categories={data.itemCategories || []}
          settings={data.settings}
          transactions={data.transactions}
          stockAdjustments={data.stockAdjustments || []}
          onClose={() => setShowStockReport(false)}
        />
      )}
      {dotMatrixData && (
        <DotMatrixPrintModal
          transaction={dotMatrixData.transaction}
          mode={dotMatrixData.mode}
          settings={data.settings}
          onClose={() => setDotMatrixData(null)}
        />
      )}
    </div>
  );
}