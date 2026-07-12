/**
 * components/TransactionForm.js
 * Full transaction input form with multi-item support and enhanced client/counterparty selector.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import RupiahInput from "./RupiahInput";
import QtyInput    from "./QtyInput";
import Icon        from "./Icon";
import { generateId, today, nowTime, normItem, normalizeTitleCase, fmtIDR, fmtDate, addDays } from "../utils/idGenerators";
import { STATUS, deriveStatus } from "../utils/statusUtils";
import { EDIT_NOTES } from "../utils/reportUtils";

function contactBalance(name, transactions) {
  let ar = 0, ap = 0;
  for (const t of transactions) {
    if (t.counterparty.toLowerCase() !== name.toLowerCase()) continue;
    const out = Number(t.outstanding) || 0;
    if (out <= 0) continue;
    if (t.type === "income") ar += out;
    else                     ap += out;
  }
  return { ar, ap, netOut: ar - ap };
}

/** Create a fresh blank item row */
const blankItem = () => ({
  itemNameInput: "",    // raw text from NAMA BARANG input
  itemTypeInput: "",    // raw text from TIPE input
  catalogItemId: "",    // matched catalog item id (empty = no match / new item)
  matchedCatalog: null, // matched catalog item object for quick subtype access
  sackQty: "", weightKg: "", pricePerKg: 0, subtotal: 0,
  duplicateConfirmed: false, // user confirmed this row is a duplicate and will be merged on save
});

/**
 * @typedef {object} TransactionFormProps
 * @property {(tx: Object) => void} onSave
 * @property {() => void} [onCancel]
 * @property {Object} [initial]
 * @property {Array<Object>} contacts
 * @property {Array<Object>} [transactions]
 * @property {Object} stockMap
 * @property {(warning: Object) => void} [onStockWarning]
 * @property {(name: string) => void} [onCreateContact]
 * @property {number} [defaultDueDateDays=14]
 * @property {(item: Object) => void} [onAddCatalogItem]
 * @property {(item: Object) => void} [onUpdateCatalogItem]
 */

/**
 * @param {TransactionFormProps} props
 */
const TransactionForm = ({
  onSave, onCancel, initial,
  contacts, transactions = [],
  stockMap, onStockWarning,
  onCreateContact,
  defaultDueDateDays = 14,
  initType = "income",
  itemCatalog = [],
  onAddCatalogItem = () => {},
  onUpdateCatalogItem = () => {},
  onUnarchiveCatalogItem = () => {},
  onUnarchiveSubtype = () => {},
  onUnarchiveContact = () => {},
}) => {
  // Active catalog items for autocomplete: include if base is not archived, OR if the item
  // has at least one non-archived subtype (so "Bawang Putih China" still appears when
  // "Bawang Putih" base is archived but "China" subtype is still active).
  const activeCatalog = useMemo(() =>
    (itemCatalog || []).filter((c) => {
      if (!c.archived) return true;
      const activeSubtypes = (c.subtypes || []).filter(
        (s) => !(c.archivedSubtypes || []).some((as) => normItem(as) === normItem(s))
      );
      return activeSubtypes.length > 0;
    }),
  [itemCatalog]);

  /** Format a quantity: integer → no decimals, float → 2 decimals */
  const fmtQtyDisplay = (n) =>
    Number.isInteger(n) ? n.toLocaleString("id-ID") : Number(n).toFixed(2);

  const displayUnit = (unit) => (!unit || unit === "karung") ? "SACK" : unit;

  /**
   * Map an existing itemName string back to its catalog entry for edit-mode pre-fill.
   * Returns { itemNameInput, itemTypeInput, catalogItemId, matchedCatalog }.
   * Falls back to free-text with empty catalogItemId if not found — no __legacy__ sentinel.
   */
  const mapItemFromCatalog = (itemName) => {
    if (!itemName) return { itemNameInput: "", itemTypeInput: "", catalogItemId: "", matchedCatalog: null };
    for (const cat of itemCatalog) {
      if (normItem(cat.name) === normItem(itemName))
        return { itemNameInput: cat.name, itemTypeInput: "", catalogItemId: cat.id, matchedCatalog: cat };
      for (const sub of (cat.subtypes || [])) {
        if (normItem(cat.name + " " + sub) === normItem(itemName))
          return { itemNameInput: cat.name, itemTypeInput: sub, catalogItemId: cat.id, matchedCatalog: cat };
      }
    }
    // Not found in catalog — free text (legacy or deleted item)
    return { itemNameInput: itemName, itemTypeInput: "", catalogItemId: "", matchedCatalog: null };
  };

  /**
   * Compute the transaction's net value from its items, discount, and type.
   * Discount only applies to income (Penjualan) transactions — expense
   * (Pembelian) transactions always use the gross sum, discount is ignored.
   */
  const computeNetValue = (items, discount, type) => {
    const gross = items.reduce((s, it) => s + (it.subtotal || 0), 0);
    return type === "income" ? Math.max(0, gross - (Number(discount) || 0)) : gross;
  };

  const blank = {
    date: today(), time: nowTime(),
    counterparty: "",
    stockUnit: "SACK", customUnit: "", value: 0, discount: 0,
    type: initType, status: STATUS.LUNAS, outstanding: 0, notes: "",
    items: [blankItem()],
  };

  const [form, setForm] = useState(() => {
    if (!initial) return { ...blank };
    // Load items: prefer items[] array; fall back to top-level single-item fields.
    // Map each existing itemName back to catalog selection (itemNameInput + itemTypeInput).
    const items = Array.isArray(initial.items) && initial.items.length > 0
      ? initial.items.map((it) => ({
          ...mapItemFromCatalog(it.itemName || ""),
          sackQty:    it.sackQty    ?? "",
          weightKg:   it.weightKg   ?? "",
          pricePerKg: Number(it.pricePerKg) || 0,
          subtotal:   Number(it.subtotal)   || (Number(it.pricePerKg) * parseFloat(it.weightKg)) || 0,
        }))
      : [{
          ...mapItemFromCatalog(initial.itemName || ""),
          sackQty:    initial.sackQty    ?? "",
          weightKg:   initial.weightKg   ?? "",
          pricePerKg: Number(initial.pricePerKg) || 0,
          subtotal:   Number(initial.value)      || 0,
        }];
    const loadedDiscount = Number(initial.discount) || 0;
    const loadedType     = initial.type || initType;
    return {
      ...blank,
      ...initial,
      discount: loadedDiscount,
      outstanding: Number(initial.outstanding) || 0,
      value: computeNetValue(items, loadedDiscount, loadedType),
      items,
    };
  });

  // User can override the default payment terms per-transaction.
  // Stored as a string to allow free typing; converted to number on save and on blur.
  const [customDueDays, setCustomDueDays] = useState(String(initial?.customDueDays ?? defaultDueDateDays));

  // Supplier invoice number — only used for expense (Pembelian) transactions.
  // Income transactions get an auto-generated txnId from App.js.
  const [txnIdInput, setTxnIdInput] = useState(
    initial?.type === "expense" ? (initial?.txnId || "") : ""
  );
  const [txnIdError, setTxnIdError] = useState(null);
  const txnIdInputRef = useRef(null);

  // ── Simplified status for the dropdown UI ──────────────────────────────────
  // "Lunas" or "Belum Lunas" — the full stored status is derived automatically
  const isLunas = form.status === STATUS.LUNAS;
  const simpleStatus = isLunas ? "Lunas" : "Belum Lunas";
  const [submitting,    setSubmitting]    = useState(false);
  const [errors,        setErrors]        = useState({});
  const [cpOpen,        setCpOpen]        = useState(false);
  const [cpQuery,       setCpQuery]       = useState(initial?.counterparty || "");
  const [cpHighlight,   setCpHighlight]   = useState(-1);
  const [cpToast,       setCpToast]       = useState(null);
  const cpInputRef       = useRef(null);
  const cpDropRef        = useRef(null);
  const cpToastTimer     = useRef(null);
  const skipNextFocusOpen = useRef(true);

  // Tracks whether the user actively touched a payment-status control (the
  // Lunas/Belum Lunas dropdown, or the Sudah Dibayar amount) during THIS
  // edit session — distinct from whatever outstanding value happens to
  // already be sitting in form state. App.js uses this to decide whether
  // an explicit outstanding value should override its own recalculation,
  // or whether it's just a stale, untouched carryover from before this edit.
  const [paymentManuallyEdited, setPaymentManuallyEdited] = useState(false);
  // The REAL amount genuinely already paid, captured once when this edit
  // session began and never recalculated afterward — used to keep the live
  // Sudah Dibayar/Sisa Tagihan preview honest even as discount/price/qty
  // edits change form.value, instead of letting it drift via a stale
  // form.outstanding that never updates on its own. 0 for brand-new
  // transactions (no prior payment to anchor to).
  const initialAlreadyPaid = useRef(
    initial ? Math.max(0, (Number(initial.value) || 0) - (Number(initial.outstanding) || 0)) : 0
  );

  // Phase 2 — payment-integrity confirmation. Set when editing an income
  // transaction changes its total in a way that creates genuine ambiguity
  // only a human can resolve (see getPaymentIntegrityCase below).
  //   Case 1: currently Lunas, new total > what's genuinely been paid.
  //   Case 2: what's genuinely been paid now exceeds the new total
  //           (Lunas or Belum Lunas) — the app can't store a negative
  //           balance, so this always requires a human to say which real
  //           story occurred. Fires regardless of paymentManuallyEdited —
  //           it's a process control (did a real refund happen?), not
  //           just a numeric one, so it can't be silently superseded by
  //           an unrelated payment-field edit earlier in the session.
  const [paymentIntegrityConfirm, setPaymentIntegrityConfirm] = useState(null);
  const [integrityChoice,    setIntegrityChoice]    = useState(null);
  const [refundAcknowledged, setRefundAcknowledged] = useState(false);

  // Autocomplete visibility: track which item row's name/type suggestions are open
  const [showItemSugg, setShowItemSugg] = useState(null);
  const [showTypeSugg, setShowTypeSugg] = useState(null);
  // New-item confirmation dialog state
  const [newItemConfirm, setNewItemConfirm] = useState(null); // { items: [...], unit: string } | null
  // Duplicate item confirmation dialog state
  const [duplicateItemConfirm, setDuplicateItemConfirm] = useState(null); // { rowIndex, itemName } | null
  const [missingTypeItems, setMissingTypeItems] = useState(null); // string[] of item names missing type | null

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /** Derive the stored status string from simple UI choice + transaction type */
  const deriveFullStatus = (simple, type) =>
    deriveStatus(type, simple !== STATUS.LUNAS);

  /** Handle the simplified status dropdown change */
  const handleSimpleStatusChange = (simple) => {
    setPaymentManuallyEdited(true);
    if (simple === STATUS.LUNAS) {
      setForm((f) => ({ ...f, status: STATUS.LUNAS, outstanding: 0 }));
    } else {
      setForm((f) => ({
        ...f,
        status: deriveFullStatus("Belum Lunas", f.type),
        // Keep existing outstanding if already set, else default to full value
        outstanding: f.outstanding > 0 ? f.outstanding : f.value,
      }));
    }
  };

  /** Handle the type (income/expense) toggle — also re-derives status label */
  const handleTypeChange = (newType) => {
    setForm((f) => ({
      ...f,
      type: newType,
      value: computeNetValue(f.items, f.discount, newType),
      // Re-derive full status so Piutang/Utang stays correct for the new type
      status: deriveFullStatus(f.status === STATUS.LUNAS ? STATUS.LUNAS : "Belum Lunas", newType),
    }));
    if (newType === "income") {
      setTxnIdInput(""); setTxnIdError(null); // clear supplier invoice field when switching to income
    } else {
      // Switching to expense — discount no longer applies or displays;
      // clear any lingering discount validation error.
      setErrors((prev) => ({ ...prev, discount: undefined }));
    }
  };

  // ── Item management ──────────────────────────────────────────────────────────
  const addItem = () => {
    setForm((f) => ({ ...f, items: [...f.items, blankItem()] }));
    setTimeout(() => {
      const inputs = document.querySelectorAll(".item-name-input");
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 50);
  };

  const removeItem = (idx) =>
    setForm((f) => {
      const items = f.items.filter((_, i) => i !== idx);
      return { ...f, items, value: computeNetValue(items, f.discount, f.type) };
    });

  /** Update the transaction-level discount and recompute net value.
   *  Only meaningful when form.type === "income" — the input that calls
   *  this is only rendered in that case (see Step 9). */
  const setDiscount = (val) => {
    setForm((f) => {
      const discount = Number(val) || 0;
      return { ...f, discount, value: computeNetValue(f.items, discount, f.type) };
    });
  };

  const setItem = (idx, key, val) =>
    setForm((f) => {
      const items = f.items.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [key]: val };
        // Reset duplicate confirmation when the merge key fields change
        if (key === "pricePerKg") updated.duplicateConfirmed = false;
        const p = key === "pricePerKg" ? Number(val) || 0 : Number(it.pricePerKg) || 0;
        const w = key === "weightKg"   ? parseFloat(val) || 0 : parseFloat(it.weightKg) || 0;
        updated.subtotal = p * w;
        return updated;
      });
      return { ...f, items, value: computeNetValue(items, f.discount, f.type) };
    });

  // ── Item name/type change handlers ──────────────────────────────────────────

  /** When user types in NAMA BARANG input — try to match catalog, update matchedCatalog */
  const handleItemNameChange = (idx, value) => {
    const cat = activeCatalog.find((c) => normItem(c.name) === normItem(value.trim()));
    setForm((f) => {
      const items = f.items.map((it, i) => {
        if (i !== idx) return it;
        return {
          ...it,
          itemNameInput: value,
          itemTypeInput: "",          // clear type when base name changes
          catalogItemId: cat ? cat.id : "",
          matchedCatalog: cat || null,
          duplicateConfirmed: false,
        };
      });
      return { ...f, items };
    });
    // Clear item errors for this row when user types
    if (errors.items?.[idx]?.itemName) {
      setErrors((prev) => {
        const items = (prev.items || []).map((ie, i) =>
          i === idx ? { ...ie, itemName: undefined } : ie
        );
        return { ...prev, items };
      });
    }
  };

  /** When user types in TIPE input */
  const handleItemTypeChange = (idx, value) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => i !== idx ? it : { ...it, itemTypeInput: value, duplicateConfirmed: false }),
    }));
  };

  /** When user clicks a catalog suggestion for NAMA BARANG */
  const handleSelectSuggestion = (idx, cat) => {
    setShowItemSugg(null);
    setForm((f) => {
      const items = f.items.map((it, i) =>
        i !== idx ? it : {
          ...it,
          itemNameInput: cat.name,
          itemTypeInput: "",
          catalogItemId: cat.id,
          matchedCatalog: cat,
          duplicateConfirmed: false,
        }
      );
      return { ...f, items };
    });
  };

  /** When user clicks a subtype suggestion for TIPE */
  const handleSelectTypeSuggestion = (idx, sub) => {
    setShowTypeSugg(null);
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => i !== idx ? it : { ...it, itemTypeInput: sub, duplicateConfirmed: false }),
    }));
  };

  /** Check if the item at idx is a duplicate of another row (same normalized name + same price).
   *  If so, open the duplicate confirmation dialog. Skip if already confirmed. */
  const checkDuplicate = (idx, nameInput, typeInput, price) => {
    if (!nameInput.trim() || !price) return;
    if (form.items[idx]?.duplicateConfirmed) return;
    const fullNorm = normItem(
      typeInput.trim() ? nameInput.trim() + " " + typeInput.trim() : nameInput.trim()
    );
    const hasDup = form.items.some((it, j) => {
      if (j === idx) return false;
      const otherNorm = normItem(
        it.itemTypeInput.trim()
          ? it.itemNameInput.trim() + " " + it.itemTypeInput.trim()
          : it.itemNameInput.trim()
      );
      // Safe: pricePerKg is always an integer from RupiahInput.
      // If this ever accepts decimal input, switch to Math.abs(a - b) < 1.
      return otherNorm === fullNorm && Number(it.pricePerKg) === Number(price);
    });
    if (hasDup) {
      const displayName = typeInput.trim()
        ? nameInput.trim() + " " + typeInput.trim()
        : nameInput.trim();
      setDuplicateItemConfirm({ rowIndex: idx, itemName: displayName });
    }
  };

  // ── Counterparty (client) selector ──────────────────────────────────────────

  // Only active (non-archived) contacts shown in the dropdown
  const activeContacts = useMemo(() => contacts.filter((c) => !c.archived), [contacts]);

  const filteredContacts = useMemo(() => {
    const q = cpQuery.trim().toLowerCase();
    const list = q ? activeContacts.filter((c) => c.name.toLowerCase().includes(q)) : [...activeContacts];
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [activeContacts, cpQuery]);

  const isExactMatch = useMemo(
    () => activeContacts.some((c) => c.name.toLowerCase() === cpQuery.trim().toLowerCase()),
    [activeContacts, cpQuery]
  );

  const totalItems = filteredContacts.length + 1;

  // Auto-focus the counterparty input when the form first mounts
  useEffect(() => {
    if (cpInputRef.current) cpInputRef.current.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e) => {
      if (
        cpInputRef.current && !cpInputRef.current.contains(e.target) &&
        cpDropRef.current  && !cpDropRef.current.contains(e.target)
      ) {
        setCpOpen(false);
        setCpHighlight(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showCpToast = useCallback((msg) => {
    setCpToast(msg);
    clearTimeout(cpToastTimer.current);
    cpToastTimer.current = setTimeout(() => setCpToast(null), 2500);
  }, []);

  const selectContact = (name) => {
    const norm = normalizeTitleCase(name);
    set("counterparty", norm);
    setCpQuery(norm);
    setCpOpen(false);
    setCpHighlight(-1);
  };

  const createContact = (name) => {
    const trimmed = normalizeTitleCase(name);
    if (!trimmed) return;
    // Check if name matches an archived contact — unarchive instead of creating a duplicate
    const archivedMatch = contacts.find(
      (c) => c.archived && c.name.toLowerCase().trim() === trimmed.toLowerCase().trim()
    );
    if (archivedMatch) {
      onUnarchiveContact(archivedMatch.id);
      selectContact(archivedMatch.name);
      showCpToast(`Klien '${archivedMatch.name}' dikembalikan dari arsip`);
      return;
    }
    set("counterparty", trimmed);
    setCpQuery(trimmed);
    setCpOpen(false);
    setCpHighlight(-1);
    if (onCreateContact) onCreateContact(trimmed);
    showCpToast(`Klien baru '${trimmed}' ditambahkan`);
  };

  const handleCpKeyDown = (e) => {
    if (!cpOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setCpOpen(true);
        setCpHighlight(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "Escape") { setCpOpen(false); setCpHighlight(-1); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCpHighlight((h) => Math.min(h + 1, totalItems - 1)); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCpHighlight((h) => Math.max(h - 1, 0)); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (cpHighlight === 0 || cpHighlight === -1) {
        if (cpQuery.trim() && !isExactMatch) createContact(cpQuery);
        else if (cpHighlight === 0 && cpQuery.trim()) createContact(cpQuery);
        else if (filteredContacts[0]) selectContact(filteredContacts[0].name);
      } else {
        const contact = filteredContacts[cpHighlight - 1];
        if (contact) selectContact(contact.name);
      }
    }
  };

  useEffect(() => {
    if (cpHighlight >= 0 && cpDropRef.current) {
      const item = cpDropRef.current.querySelector(`[data-idx="${cpHighlight}"]`);
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [cpHighlight]);

  // ── Item status check for new-catalog-item detection ─────────────────────────
  const getItemStatus = (row) => {
    const baseName = row.itemNameInput.trim();
    const typeName = row.itemTypeInput.trim();
    if (!baseName) return { status: "matched" }; // validation catches empty separately
    // Check active (non-archived) catalog first
    const activeCat = activeCatalog.find((c) => normItem(c.name) === normItem(baseName));
    if (activeCat) {
      if (typeName) {
        // Check if subtype is archived
        if ((activeCat.archivedSubtypes || []).some((s) => normItem(s) === normItem(typeName)))
          return { status: "archived_subtype", baseName, typeName, catalogItem: activeCat };
        // Check if subtype is new
        if (!(activeCat.subtypes || []).some((s) => normItem(s) === normItem(typeName)))
          return { status: "new_subtype", baseName, typeName, catalogItem: activeCat };
      }
      return { status: "matched" };
    }
    // Not in active catalog — check if it's an archived base item
    const archivedCat = itemCatalog.find((c) => c.archived && normItem(c.name) === normItem(baseName));
    if (archivedCat) return { status: "archived_item", baseName, typeName, catalogItem: archivedCat };
    // Check if baseName is "ExistingBase Subtype" typed as one string (e.g. "Bawang Merah Red"
    // when catalog has base "Bawang Merah" with subtype "Red"). Decompose before flagging as new.
    const inputNorm = normItem(baseName);
    for (const c of activeCatalog) {
      const catNorm = normItem(c.name);
      if (inputNorm.startsWith(catNorm + " ")) {
        const possibleSub = baseName.trim().substring(c.name.length + 1).trim();
        if (!possibleSub) continue;
        const normSub = normItem(possibleSub);
        // Subtype already exists on this catalog item → matched, no new entry needed
        if ((c.subtypes || []).some((s) => normItem(s) === normSub))
          return { status: "matched" };
        // Subtype is new but base exists → add subtype to existing base, not a new base item
        return { status: "new_subtype", baseName: c.name, typeName: possibleSub, catalogItem: c };
      }
    }
    // Completely new item
    return { status: "new_item", baseName, typeName };
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.counterparty.trim()) e.counterparty = "Wajib diisi";

    // Validate each item row
    const itemErrors = form.items.map((it) => {
      const ie = {};
      if (!it.itemNameInput.trim()) {
        ie.itemName = "Nama barang wajib diisi";
      }
      if (it.sackQty === "" || it.sackQty == null || isNaN(it.sackQty) || Number(it.sackQty) < 0)
        ie.sackQty = "Masukkan angka valid";
      else if (Number(it.sackQty) === 0)
        ie.sackQty = "Jumlah SACK harus lebih dari 0";
      if (Number(it.pricePerKg) > 0 && (!it.weightKg || Number(it.weightKg) <= 0))
        ie.weightKg = "Isi berat untuk menghitung total otomatis";
      if (!it.subtotal || Number(it.subtotal) <= 0)
        ie.subtotal = "Total harus positif";
      return ie;
    });
    if (itemErrors.some((ie) => Object.keys(ie).length > 0)) e.items = itemErrors;

    const grossTotal = form.items.reduce((s, it) => s + (it.subtotal || 0), 0);
    if (!grossTotal || grossTotal <= 0) e.value = "Masukkan angka positif";

    const isIncome = form.type === "income";
    const netTotal = computeNetValue(form.items, form.discount, form.type);

    // Discount validation — income (Penjualan) only. Expense transactions
    // never carry a discount, so these checks are skipped entirely for them.
    // Note: a "netTotal < alreadyPaid" block used to live here (Stage 1) but
    // was removed — Phase 2's Case 2 payment-integrity modal now owns this
    // scenario with a human-confirmed correction/refund acknowledgment
    // instead of a blunt rejection. Keeping both would make Case 2
    // permanently unreachable, since validate() runs before
    // getPaymentIntegrityCase() in handleSubmit.
    if (isIncome) {
      if (Number(form.discount) > grossTotal) {
        e.discount = "Diskon tidak boleh melebihi total sebelum diskon";
      }
    }

    // Belum Lunas: paidAmount must be >= 0 and < NET value (outstanding is
    // measured against what's actually billed, i.e. post-discount for income)
    if (form.status !== STATUS.LUNAS) {
      if (Number(form.outstanding) <= 0) {
        e.paidAmount = "Jumlah yang sudah dibayar harus kurang dari nilai total";
      }
      if (Number(form.outstanding) > netTotal) {
        e.paidAmount = "Tidak boleh melebihi nilai total";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /**
   * Determine whether saving this edit requires an explicit payment-
   * integrity confirmation first. Edit mode only — brand-new transactions
   * are never ambiguous this way. Applies to BOTH income (Penjualan) and
   * expense (Pembelian) transactions — the ambiguity (did the counterparty
   * actually pay/get paid the new amount, or is there a genuine over/
   * under-payment story?) is identical either way, just pointed in the
   * opposite direction. Returns null when no confirmation is needed.
   */
  const getPaymentIntegrityCase = () => {
    if (!initial) return null;               // brand-new transaction
    // Pembelian (expense) now goes through the SAME ambiguity checks as
    // Penjualan (income) — see the modal JSX below for the type-aware
    // wording (Utang/supplier framing vs. Piutang/klien framing).

    const realPaid = initialAlreadyPaid.current;
    const newTotal  = computeNetValue(form.items, form.discount, form.type);
    const oldTotal  = Number(initial.value) || 0;

    if (newTotal === oldTotal) return null;   // nothing actually changed

    if (realPaid > newTotal) {
      // Case 2 — always fires, regardless of paymentManuallyEdited. This
      // is a human process control (confirming a real refund happened),
      // not just a numeric safety net, so an unrelated earlier touch of
      // the Sudah Dibayar field must not be able to silently bypass it.
      //
      // realPaymentCount: how many REAL (amount>0, non-edit-note) payment
      // entries this transaction has on record. "Koreksi data" can only
      // safely rewrite the underlying payment record when there's exactly
      // one — with more than one, which entry was the actual mistake is
      // genuinely ambiguous and must never be guessed (see the modal
      // below, which disables that option when this is > 1).
      const realPaymentCount = (initial.paymentHistory || [])
        .filter((ph) => Number(ph.amount) > 0 && !EDIT_NOTES.has(ph.note))
        .length;
      return { case: 2, oldTotal, newTotal, realPaid, realPaymentCount };
    }
    if (paymentManuallyEdited) return null;   // user already made an explicit choice this session — only guards Case 1

    if (isLunas && newTotal > realPaid) {
      // Case 1 — currently Lunas, new (bigger) total exceeds what's
      // genuinely been paid.
      return { case: 1, oldTotal, newTotal, realPaid };
    }
    return null; // Belum Lunas, still owes more than paid — no ambiguity,
                 // the visible Sudah Dibayar field already handles this.
  };

  // ── Stock check + save flow ───────────────────────────────────────────────────

  /** Stock warning check then save — extracted so it can be called from both
   *  handleSubmit (no new items) and handleConfirmNewItems (after catalog updates). */
  const doStockCheckAndSave = (unit, overrides = null) => {
    if (form.type === "income") {
      const negItems = [];
      const committedMap = {}; // tracks qty committed by prior items for the same normalized name
      for (const item of form.items) {
        const combinedName = item.itemTypeInput.trim()
          ? `${item.itemNameInput.trim()} ${item.itemTypeInput.trim()}`
          : item.itemNameInput.trim();
        const key       = normItem(combinedName);
        const cur       = stockMap[key]?.qty ?? 0;
        const qty       = parseFloat(item.sackQty) || 0;
        // For edit mode: account for this item's existing contribution
        const prevKey   = initial?.type === "income"
          ? normItem(
              (() => {
                const orig = initial.items?.find((i) => normItem(i.itemName) === key);
                return orig?.itemName || combinedName;
              })()
            )
          : null;
        const prevQty   = prevKey ? parseFloat(
          (initial.items?.find((i) => normItem(i.itemName) === prevKey) ?? initial)?.sackQty || 0
        ) : 0;
        const alreadyCommitted = committedMap[key] || 0;
        const available = cur + prevQty - alreadyCommitted;
        const projected = available - qty;
        if (projected < 0) {
          negItems.push({ item: combinedName, current: available, selling: qty });
        }
        committedMap[key] = alreadyCommitted + qty;
      }
      if (negItems.length > 0 && onStockWarning) {
        onStockWarning({
          items: negItems,
          item: negItems[0].item,
          current: negItems[0].current,
          selling: negItems[0].selling,
          onConfirm: () => doSave(unit, overrides),
          onCancel: () => setSubmitting(false),
        });
        return;
      }
    }
    doSave(unit, overrides);
  };

  /**
   * Shared continuation for both the normal submit path and the path
   * after a user answers the Case 1/Case 2 payment-integrity modal —
   * derives the unit, checks for new/unrecognized catalog items, then
   * hands off to stock-check + save. `overrides` is null for the normal
   * path, or the resolved {outstanding, status, paymentIntegrityNote}
   * object when called from resolvePaymentIntegrity below.
   */
  const proceedToItemAndStockCheck = (overrides) => {
    // Derive unit from the first item — use fresh catalog lookup to avoid stale matchedCatalog
    const firstItem = form.items[0];
    const freshFirstCat = firstItem?.catalogItemId
      ? itemCatalog.find((c) => c.id === firstItem.catalogItemId)
      : null;
    const unit = displayUnit(freshFirstCat?.defaultUnit || firstItem?.matchedCatalog?.defaultUnit);

    // Check for new items/subtypes before saving — build confirmation list
    const toConfirm = form.items.map(getItemStatus).filter((s) => s.status !== "matched");
    // Deduplicate by full item name (baseName + typeName) so e.g. "Kacang Ijo Malay"
    // and "Kacang Ijo Viet" are not incorrectly collapsed to one entry
    const seen = new Set();
    const deduped = toConfirm.filter((s) => {
      const key = normItem(s.baseName) + (s.typeName ? " " + normItem(s.typeName) : "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (deduped.length > 0) {
      setSubmitting(false); // handleConfirmNewItems will re-set to true
      setNewItemConfirm({ items: deduped, unit, overrides });
      return;
    }

    doStockCheckAndSave(unit, overrides);
  };

  const handleSubmit = () => {
    if (submitting) return;
    setSubmitting(true); // H7: set before validation so rapid double-clicks are blocked immediately
    // Validate required txnId for expense before general validation
    if (form.type === "expense" && (!txnIdInput || !txnIdInput.trim())) {
      setTxnIdError("No. Invoice Supplier wajib diisi");
      txnIdInputRef.current?.focus();
      setSubmitting(false);
      return;
    }
    // Check for items missing Tipe — block entirely
    const itemsMissingType = form.items
      .filter((it) => it.itemNameInput.trim() && !it.itemTypeInput.trim())
      .map((it) => it.itemNameInput.trim());

    if (itemsMissingType.length > 0) {
      setMissingTypeItems(itemsMissingType);
      setSubmitting(false);
      return;
    }
    if (!validate()) { setSubmitting(false); return; }

    // Phase 2 — payment integrity: resolve BEFORE any catalog/stock checks,
    // since its answer can change what those downstream steps ultimately
    // save (status/outstanding).
    const integrityCase = getPaymentIntegrityCase();
    if (integrityCase) {
      setPaymentIntegrityConfirm(integrityCase);
      setIntegrityChoice(null);
      setRefundAcknowledged(false);
      setSubmitting(false);
      return;
    }

    proceedToItemAndStockCheck(null);
  };

  /** User answered the Case 1/Case 2 payment-integrity modal — apply the
   *  resolved values explicitly (see doSave's overrides param) and
   *  continue exactly where handleSubmit left off. */
  const resolvePaymentIntegrity = (choice) => {
    if (!paymentIntegrityConfirm || !choice) return;
    const { case: c, newTotal, realPaid } = paymentIntegrityConfirm;
    let overrides;

    if (c === 1) {
      overrides = choice === "paid_full"
        ? {
            outstanding: 0,
            status: STATUS.LUNAS,
            paymentIntegrityNote: `Total bertambah menjadi ${fmtIDR(newTotal)} — dikonfirmasi lunas penuh (tambahan ${fmtIDR(newTotal - realPaid)} diterima)`,
          }
        : {
            outstanding: newTotal - realPaid,
            status: deriveFullStatus("Belum Lunas", form.type),
            paymentIntegrityNote: `Total bertambah menjadi ${fmtIDR(newTotal)} — baru dibayar ${fmtIDR(realPaid)}, sisa ${fmtIDR(newTotal - realPaid)}`,
          };
    } else {
      if (choice === "refund" && !refundAcknowledged) return; // guarded by disabled button too
      if (choice === "correction" && paymentIntegrityConfirm.realPaymentCount > 1) return; // guarded by disabled radio too
      overrides = choice === "correction"
        ? {
            outstanding: 0,
            status: STATUS.LUNAS,
            paymentIntegrityNote: `Koreksi data — jumlah pembayaran awal sebenarnya ${fmtIDR(newTotal)}, bukan ${fmtIDR(realPaid)}`,
            // Fix 2: actually rewrite the real payment record (not just
            // describe the correction in a note) — only ever set when
            // realPaymentCount === 1, since the modal disables this
            // option otherwise. App.js re-verifies this defensively too.
            correctedPaymentAmount: newTotal,
          }
        : {
            outstanding: 0,
            status: STATUS.LUNAS,
            paymentIntegrityNote: `Kelebihan bayar ${fmtIDR(realPaid - newTotal)} — ${
              form.type === "income" ? "sudah dikembalikan ke klien" : "sudah dikembalikan oleh supplier"
            }`,
            // The refund gap as a real number, not parsed from the note
            // text — Laporan needs this to display the amount without
            // relying on fragile string parsing.
            refundAmount: realPaid - newTotal,
          };
    }

    setPaymentIntegrityConfirm(null);
    setIntegrityChoice(null);
    setRefundAcknowledged(false);
    setSubmitting(true);
    proceedToItemAndStockCheck(overrides);
  };

  /** Called when user confirms new items in the confirmation dialog */
  const handleConfirmNewItems = () => {
    const { items: newItems, unit, overrides } = newItemConfirm;
    setNewItemConfirm(null);

    // Handle archived items/subtypes — restore from archive instead of creating new
    for (const item of newItems) {
      if (item.status === "archived_item" && item.catalogItem) {
        onUnarchiveCatalogItem(item.catalogItem.id);
      } else if (item.status === "archived_subtype" && item.catalogItem) {
        onUnarchiveSubtype(item.catalogItem.id, item.typeName);
      }
    }

    // Build a map of catalog changes for truly new items/subtypes only,
    // merging all subtypes per base item BEFORE calling any handlers. This prevents
    // duplicate catalog entries when the same base item appears in multiple rows.
    const changeMap = {}; // normItem(baseName) → { isExisting, normSubtypes: Set, displaySubtypes: [] }

    for (const item of newItems) {
      if (item.status === "archived_item" || item.status === "archived_subtype") continue;
      const key = normItem(item.baseName);
      if (!changeMap[key]) {
        if (item.status === "new_subtype" && item.catalogItem) {
          // Existing catalog item — start with its current subtypes
          changeMap[key] = {
            isExisting:      true,
            existingItem:    item.catalogItem,
            normSubtypes:    new Set((item.catalogItem.subtypes || []).map(normItem)),
            displaySubtypes: [...(item.catalogItem.subtypes || [])],
          };
        } else {
          // Completely new catalog item
          changeMap[key] = {
            isExisting:      false,
            name:            normalizeTitleCase(item.baseName),
            defaultUnit:     unit,
            normSubtypes:    new Set(),
            displaySubtypes: [],
          };
        }
      }
      // Merge subtype (deduplicated by normalized value)
      if (item.typeName && item.typeName.trim()) {
        const normSub = normItem(item.typeName);
        if (!changeMap[key].normSubtypes.has(normSub)) {
          changeMap[key].normSubtypes.add(normSub);
          changeMap[key].displaySubtypes.push(normalizeTitleCase(item.typeName));
        }
      }
    }

    // Apply ONE call per catalog base item — not one per transaction row
    for (const change of Object.values(changeMap)) {
      if (change.isExisting) {
        onUpdateCatalogItem({ ...change.existingItem, subtypes: change.displaySubtypes });
      } else {
        onAddCatalogItem({ name: change.name, defaultUnit: change.defaultUnit, subtypes: change.displaySubtypes });
      }
    }

    setSubmitting(true);
    doStockCheckAndSave(unit, overrides);
  };

  /** Merge duplicate items (same normalized name + same pricePerKg) by summing their quantities. */
  const mergeItems = (rawItems) => {
    const groups = new Map();
    for (const item of rawItems) {
      const key = normItem(item.itemName) + "|" + (item.pricePerKg || 0);
      if (groups.has(key)) {
        const ex = groups.get(key);
        ex.sackQty  += item.sackQty;
        ex.weightKg += item.weightKg;
        ex.subtotal += item.subtotal;
      } else {
        groups.set(key, { ...item });
      }
    }
    return Array.from(groups.values());
  };

  const doSave = (unit, overrides = null) => {
    const firstItem    = form.items[0] || {};
    const totalSackQty = form.items.reduce((s, it) => s + (parseFloat(it.sackQty) || 0), 0);
    // Hard save-time guarantee: discount is forced to 0 for anything that
    // isn't income, regardless of whatever value is sitting in form state.
    // This is the last line of defense against a discount leaking into a
    // Pembelian transaction via any edge case in the type-toggle flow.
    const finalDiscount = form.type === "income" ? (Number(form.discount) || 0) : 0;
    const netTotal       = computeNetValue(form.items, finalDiscount, form.type);
    // Phase 2: when this save follows a payment-integrity confirmation,
    // the resolved values are passed explicitly here rather than read back
    // out of form/paymentManuallyEdited state — avoids a stale-closure bug
    // where React hasn't yet applied a setState from the same click before
    // this function would otherwise read it. Normal saves (overrides null)
    // are completely unaffected — identical to before this change.
    const finalOutstanding = overrides ? overrides.outstanding : (Number(form.outstanding) || 0);
    const finalStatus      = overrides ? overrides.status : form.status;
    // Hardcoding `true` here is load-bearing, not just stale-closure
    // avoidance: App.js's isExplicitLunas/isFullReversal branches require
    // paymentManuallyEdited=true to honor these overrides at all — reading
    // the (accurately `false`) closure value here would silently revert
    // "paid_full"/"correction"/"refund" back to Phase 1's own recompute.
    const finalPME         = overrides ? true : paymentManuallyEdited;
    try {
      onSave({
        ...form,
        items: mergeItems(form.items.map((it) => {
          const fullName = it.itemTypeInput.trim()
            ? normalizeTitleCase(it.itemNameInput.trim() + " " + it.itemTypeInput.trim())
            : normalizeTitleCase(it.itemNameInput.trim());
          return {
            itemName:   fullName,
            sackQty:    parseFloat(it.sackQty)   || 0,
            weightKg:   parseFloat(it.weightKg)  || 0,
            pricePerKg: Number(it.pricePerKg)    || 0,
            subtotal:   it.subtotal              || 0,
          };
        })),
        // Backward compat: top-level fields mirror first item
        itemName: firstItem.itemTypeInput?.trim()
          ? normalizeTitleCase(firstItem.itemNameInput.trim() + " " + firstItem.itemTypeInput.trim())
          : normalizeTitleCase(firstItem.itemNameInput?.trim() || ""),
        counterparty: normalizeTitleCase(form.counterparty),
        value:        netTotal,
        discount:     finalDiscount,
        status:       finalStatus,
        outstanding:  finalOutstanding,
        paymentManuallyEdited: finalPME,
        ...(overrides?.paymentIntegrityNote ? { paymentIntegrityNote: overrides.paymentIntegrityNote } : {}),
        ...(overrides?.correctedPaymentAmount !== undefined ? { correctedPaymentAmount: overrides.correctedPaymentAmount } : {}),
        ...(overrides?.refundAmount !== undefined ? { refundAmount: overrides.refundAmount } : {}),
        stockQty:     totalSackQty,
        stockUnit:    unit,
        sackQty:      totalSackQty,
        pricePerKg:   Number(firstItem.pricePerKg)   || 0,
        weightKg:     parseFloat(firstItem.weightKg) || 0,
        customDueDays: Math.max(1, Number(customDueDays) || 14),
        id:           form.id || generateId(),
        editLog:      form.editLog || [],
        // For expense: pass the supplier invoice no (App.js uses it directly)
        // For income: App.js auto-generates txnId and ignores this field
        ...(form.type === "expense" ? { txnId: txnIdInput.trim() || null } : {}),
      });
    } finally {
      setSubmitting(false); // H1: always unlock, even if onSave throws
    }
  };

  const iStyle = (k, forceError) => ({
    width: "100%", padding: "8px 10px",
    border: `1.5px solid ${(forceError !== undefined ? forceError : !!errors[k]) ? "#ef4444" : "#c7ddf7"}`,
    borderRadius: 8, fontSize: 14, outline: "none",
    boxSizing: "border-box", background: "#f8fbff",
  });
  const lStyle = {
    display: "block", fontSize: 11, fontWeight: 800,
    color: "#1e3a5f", marginBottom: 3,
    textTransform: "uppercase", letterSpacing: 0.5,
  };
  const secLbl = (t) => (
    <div className="form-section-label" style={{ gridColumn: "1/-1" }}>{t}</div>
  );

  return (
    <div className="form-card">
      <h3 className="form-title">
        {initial ? "✏️ Edit Transaksi" : "➕ Tambah Transaksi Baru"}
      </h3>

      {cpToast && (
        <div className="cp-toast" role="status" aria-live="polite">
          <Icon name="check" size={13} color="#10b981" /> {cpToast}
        </div>
      )}

      <div className="form-grid">
        <div style={{ marginBottom: 12 }}>
          <label style={lStyle}>Tanggal</label>
          <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} style={iStyle("date")} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lStyle}>Waktu</label>
          <input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} style={iStyle("time")} />
        </div>

        {/* ── No. Invoice Supplier — expense only, required, shown before Klien ── */}
        {form.type === "expense" && (
          <div style={{ gridColumn: "1/-1", marginBottom: 12 }}>
            <label style={{ ...lStyle, color: "#007bff" }}>
              No. Invoice Supplier{" "}
              <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              ref={txnIdInputRef}
              value={txnIdInput}
              onChange={(e) => { setTxnIdInput(e.target.value); if (txnIdError) setTxnIdError(null); }}
              placeholder="Masukkan no. invoice dari supplier (wajib)"
              style={{ ...iStyle(""), borderColor: txnIdError ? "#ef4444" : "#c7ddf7" }}
              aria-label="Nomor invoice dari supplier"
              aria-required="true"
            />
            {txnIdError ? (
              <span className="field-error">{txnIdError}</span>
            ) : !txnIdInput && initial && !initial.txnId ? (
              <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 3 }}>
                Transaksi lama — harap isi no. invoice supplier untuk melengkapi data.
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>
                No. invoice sesuai dokumen dari supplier
              </div>
            )}
          </div>
        )}

        {/* ── Enhanced Client Selector ── */}
        {secLbl("Klien")}
        <div style={{ gridColumn: "1/-1", marginBottom: 12, position: "relative" }}>
          <label style={lStyle}>Klien / Pihak Transaksi</label>

          <div className="cp-input-wrap" aria-expanded={cpOpen} aria-haspopup="listbox">
            <input
              ref={cpInputRef}
              value={cpQuery}
              onChange={(e) => {
                const val = e.target.value;
                setCpQuery(val);
                set("counterparty", val);
                setCpOpen(true);
                setCpHighlight(-1);
                if (errors.counterparty) setErrors((prev) => { const n = { ...prev }; delete n.counterparty; return n; });
              }}
              onBlur={() => {
                // Normalize to title case when user leaves the field
                const norm = normalizeTitleCase(cpQuery);
                if (norm !== cpQuery) {
                  setCpQuery(norm);
                  set("counterparty", norm);
                }
              }}
              onFocus={() => {
                if (skipNextFocusOpen.current) { skipNextFocusOpen.current = false; return; }
                setCpOpen(true);
                setCpHighlight(-1);
              }}
              onClick={() => { setCpOpen(true); setCpHighlight(-1); }}
              onKeyDown={handleCpKeyDown}
              placeholder="Ketik atau pilih klien…"
              className={`cp-input${errors.counterparty ? " input-error" : ""}`}
              aria-label="Klien atau pihak transaksi"
              aria-autocomplete="list"
              autoComplete="off"
            />
            <span
              className={`cp-chevron${cpOpen ? " cp-chevron--open" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); setCpOpen((o) => !o); setCpHighlight(-1); }}
              aria-hidden="true"
            >
              ▾
            </span>
          </div>

          {errors.counterparty && <span className="field-error">{errors.counterparty}</span>}

          {cpOpen && (
            <div ref={cpDropRef} className="client-dropdown" role="listbox" aria-label="Pilih klien">

              {/* Create-new row */}
              <div
                data-idx={0}
                className={`new-client-option${cpHighlight === 0 ? " new-client-option--highlighted" : ""}`}
                onMouseDown={() => createContact(cpQuery)}
                onMouseEnter={() => setCpHighlight(0)}
                role="option"
                aria-selected={cpHighlight === 0}
              >
                <span className="new-client-option__icon">＋</span>
                <span className="new-client-option__text">
                  {cpQuery.trim()
                    ? <><span>Buat klien baru: </span><strong>"{cpQuery.trim()}"</strong></>
                    : "Tambah klien baru…"}
                </span>
              </div>

              {filteredContacts.length > 0 && (
                <div className="client-dropdown__divider">
                  {cpQuery.trim() ? `${filteredContacts.length} hasil` : `Semua klien (${filteredContacts.length})`}
                </div>
              )}

              {filteredContacts.map((c, idx) => {
                const rowIdx = idx + 1;
                // TODO: Replace with balanceMap prop from App.js to avoid O(n×contacts)
                // recomputation on every render. App.js already computes balanceMap via useMemo.
                const { ar, ap, netOut } = contactBalance(c.name, transactions);
                const secondary = c.phone || c.email || null;
                return (
                  <div
                    key={c.id}
                    data-idx={rowIdx}
                    className={`contact-suggestion-row${cpHighlight === rowIdx ? " contact-suggestion-row--highlighted" : ""}`}
                    onMouseDown={() => selectContact(c.name)}
                    onMouseEnter={() => setCpHighlight(rowIdx)}
                    role="option"
                    aria-selected={cpHighlight === rowIdx}
                  >
                    <div className="contact-suggestion-row__main">
                      <span className="contact-suggestion-row__name">{c.name}</span>
                      {secondary && (
                        <span className="contact-suggestion-row__secondary">
                          {c.phone ? `📞 ${c.phone}` : `✉ ${c.email}`}
                        </span>
                      )}
                    </div>
                    {netOut !== 0 && (
                      <span
                        className={`contact-suggestion-row__badge ${netOut > 0 ? "badge--ar" : "badge--ap"}`}
                        title={netOut > 0 ? `Hutang ke kita: ${fmtIDR(ar)}` : `Kita hutang: ${fmtIDR(ap)}`}
                      >
                        {netOut > 0 ? `💚 ${fmtIDR(ar)}` : `❤️ ${fmtIDR(Math.abs(ap))}`}
                      </span>
                    )}
                  </div>
                );
              })}

              {filteredContacts.length === 0 && cpQuery.trim() && (
                <div className="client-dropdown__empty">
                  Tidak ada klien yang cocok. Gunakan opsi buat baru di atas.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Item rows ── */}
        {secLbl("Barang, Stok & Harga")}
        <div style={{ gridColumn: "1/-1", marginBottom: 8 }}>
          {form.items.map((item, idx) => {
            const ie = errors.items?.[idx] || {};
            // Compute combined item name for stock lookup
            const combinedName = item.itemTypeInput.trim()
              ? `${item.itemNameInput.trim()} ${item.itemTypeInput.trim()}`
              : item.itemNameInput.trim();
            const curStock = combinedName ? stockMap[normItem(combinedName)] : null;
            // For income: subtract qty already committed by prior rows with the same item
            const committedQty = form.type === "income"
              ? form.items.slice(0, idx).reduce((sum, it) => {
                  const otherName = normItem(
                    it.itemTypeInput.trim()
                      ? it.itemNameInput.trim() + " " + it.itemTypeInput.trim()
                      : it.itemNameInput.trim()
                  );
                  return normItem(combinedName) === otherName
                    ? sum + (parseFloat(it.sackQty) || 0)
                    : sum;
                }, 0)
              : 0;

            return (
              <div
                key={idx}
                style={{
                  border: "1.5px solid #c7ddf7", borderRadius: 10,
                  padding: "12px 14px", marginBottom: 10, background: "#f8fbff",
                  position: "relative",
                }}
              >
                {/* Row header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Item #{idx + 1}
                  </span>
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 18, lineHeight: 1, padding: "0 4px" }}
                      aria-label={`Hapus item ${idx + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Duplicate merge indicator */}
                {item.duplicateConfirmed && (
                  <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 6 }}>
                    ⚠ Akan digabung saat simpan
                  </div>
                )}

                {/* NAMA BARANG + TIPE inputs */}
                <div style={{ display: "grid", gridTemplateColumns: item.itemNameInput.trim() ? "3fr 2fr" : "1fr", gap: 10, marginBottom: 10 }}>

                  {/* NAMA BARANG */}
                  <div style={{ position: "relative" }}>
                    <label style={lStyle}>Nama Barang <span style={{ color: "#ef4444" }}>*</span></label>
                    <input
                      type="text"
                      value={item.itemNameInput}
                      onChange={(e) => handleItemNameChange(idx, e.target.value)}
                      onFocus={() => setShowItemSugg(idx)}
                      onBlur={() => {
                        setTimeout(() => setShowItemSugg(null), 200);
                        checkDuplicate(idx, item.itemNameInput, item.itemTypeInput, item.pricePerKg);
                      }}
                      placeholder="Ketik nama barang..."
                      style={iStyle("", !!ie.itemName)}
                      className="item-name-input"
                      autoComplete="off"
                      aria-label={`Nama barang item ${idx + 1}`}
                    />
                    {ie.itemName && <span className="field-error">{ie.itemName}</span>}
                    {/* Autocomplete suggestions for NAMA BARANG */}
                    {showItemSugg === idx && (() => {
                      const q = normItem(item.itemNameInput);
                      const suggs = q
                        ? activeCatalog.filter((c) => normItem(c.name).includes(q)).slice(0, 10)
                        : activeCatalog.slice(0, 10);
                      if (suggs.length === 0) return null;
                      return (
                        <div className="autocomplete-dropdown">
                          {suggs.map((cat) => {
                            const sq = stockMap[normItem(cat.name)];
                            return (
                              <div
                                key={cat.id}
                                className="autocomplete-item autocomplete-item--stock"
                                onMouseDown={() => handleSelectSuggestion(idx, cat)}
                              >
                                <span>{cat.name}</span>
                                {sq && (cat.subtypes || []).length === 0 && (
                                  <span className="autocomplete-stock-hint">
                                    {fmtQtyDisplay(Number(sq.qty))} {sq.unit || cat.defaultUnit}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* TIPE — shown when item name has been entered */}
                  {item.itemNameInput.trim() && (
                    <div style={{ position: "relative" }}>
                      <label style={lStyle}>
                        Tipe <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={item.itemTypeInput}
                        onChange={(e) => handleItemTypeChange(idx, e.target.value)}
                        onFocus={() => setShowTypeSugg(idx)}
                        onBlur={() => {
                          setTimeout(() => setShowTypeSugg(null), 200);
                          checkDuplicate(idx, item.itemNameInput, item.itemTypeInput, item.pricePerKg);
                        }}
                        placeholder="Ketik tipe barang..."
                        style={iStyle("")}
                        autoComplete="off"
                        aria-label={`Tipe barang item ${idx + 1}`}
                      />
                      {/* Autocomplete suggestions for TIPE (from matched catalog subtypes) */}
                      {showTypeSugg === idx && item.catalogItemId && (() => {
                        const freshCatalog = itemCatalog.find((c) => c.id === item.catalogItemId);
                        if (!freshCatalog) return null;
                        const q = normItem(item.itemTypeInput);
                        const suggs = (freshCatalog.subtypes || [])
                          .filter((s) => !q || normItem(s).includes(q))
                          .filter((s) => !(freshCatalog.archivedSubtypes || []).some((a) => normItem(a) === normItem(s)))
                          .slice(0, 10);
                        if (suggs.length === 0) return null;
                        return (
                          <div className="autocomplete-dropdown">
                            {suggs.map((sub) => {
                              const sq = stockMap[normItem(`${item.itemNameInput.trim()} ${sub}`)];
                              return (
                                <div
                                  key={sub}
                                  className="autocomplete-item autocomplete-item--stock"
                                  onMouseDown={() => handleSelectTypeSuggestion(idx, sub)}
                                >
                                  <span>{sub}</span>
                                  <span className="autocomplete-stock-hint">
                                    {sq
                                      ? `${fmtQtyDisplay(Number(sq.qty))} ${displayUnit(sq.unit)}`
                                      : `0 ${displayUnit(freshCatalog.defaultUnit)}`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Stock display for combined item name (adjusted for prior rows in same form) */}
                {item.itemNameInput.trim() && !ie.itemName && (
                  <div style={{ fontSize: 12, marginBottom: 8 }}>
                    {curStock != null
                      ? (() => {
                          const aq = curStock.qty - committedQty;
                          const color = aq > 0 ? "#10b981" : "#ef4444";
                          return (
                            <span style={{ color }}>
                              Stok: {fmtQtyDisplay(aq)} {displayUnit(curStock.unit)}
                            </span>
                          );
                        })()
                      : <span style={{ color: "#9ca3af" }}>Stok: 0 SACK</span>
                    }
                  </div>
                )}

                {/* Karung | Harga/Kg | Berat (Kg) | Subtotal */}
                <div className="item-fields-row">
                  <div>
                    <label className="item-field-label">Jumlah SACK</label>
                    <QtyInput
                      value={Number(item.sackQty) || 0}
                      onChange={(n) => setItem(idx, "sackQty", n)}
                      style={iStyle("", !!ie.sackQty)}
                      placeholder="0"
                    />
                    {ie.sackQty && <span className="field-error">{ie.sackQty}</span>}
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>satuan: SACK</div>
                  </div>

                  <div>
                    <label className="item-field-label">Harga per Kg (IDR)</label>
                    <RupiahInput
                      value={item.pricePerKg}
                      onChange={(v) => {
                        setItem(idx, "pricePerKg", v);
                        checkDuplicate(idx, item.itemNameInput, item.itemTypeInput, v);
                      }}
                      hasError={!!ie.pricePerKg}
                    />
                    {ie.pricePerKg && <span className="field-error">{ie.pricePerKg}</span>}
                  </div>

                  <div>
                    <label className="item-field-label">Berat (Kg)</label>
                    <QtyInput
                      value={Number(item.weightKg) || 0}
                      onChange={(n) => setItem(idx, "weightKg", n)}
                      style={iStyle("", !!ie.weightKg)}
                      placeholder="0"
                    />
                    {ie.weightKg && <span className="field-error">{ie.weightKg}</span>}
                  </div>

                  <div>
                    <label className="item-field-label">
                      Subtotal
                      <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10, marginLeft: 4, color: "#10b981" }}>✓ auto</span>
                    </label>
                    <div
                      style={{
                        width: "100%", padding: "8px 10px",
                        border: `1.5px solid ${ie.subtotal ? "#ef4444" : "#d1d5db"}`,
                        borderRadius: 8, fontSize: 13, boxSizing: "border-box",
                        background: "#f3f4f6", color: "#374151", cursor: "not-allowed",
                      }}
                      aria-label={`Subtotal item ${idx + 1}`}
                    >
                      {fmtIDR(item.subtotal)}
                    </div>
                    {ie.subtotal && <span className="field-error">{ie.subtotal}</span>}
                  </div>
                </div>

                {/* Stock delta preview */}
                {curStock && item.sackQty !== "" && !isNaN(item.sackQty) && (
                  <div className="stock-preview" style={{ marginTop: 8 }}>
                    {(() => {
                      const aqd = curStock.qty - committedQty;
                      const projected = aqd + (form.type === "expense" ? 1 : -1) * parseFloat(item.sackQty);
                      return (
                        <>
                          Stok saat ini:{" "}
                          <strong style={{ color: aqd > 0 ? "#10b981" : "#ef4444" }}>
                            {fmtQtyDisplay(aqd)}
                          </strong>
                          {" → "}
                          <strong style={{ color: "#007bff" }}>
                            {fmtQtyDisplay(projected)} SACK
                          </strong>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={addItem}
            className="btn btn-outline"
            style={{ width: "100%" }}
            aria-label="Tambah item baru"
          >
            ＋ Tambah Item
          </button>
        </div>

        {secLbl("Total & Tipe")}
        {form.type === "income" ? (
          /* ── Penjualan: 3-row discount breakdown ── */
          <div style={{ marginBottom: 12, padding: "10px 12px", background: "#f8fbff", border: "1.5px solid #c7ddf7", borderRadius: 10 }}>
            {/* Total Sebelum Diskon — read-only, gross sum of item subtotals */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>Total Sebelum Diskon</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
                {fmtIDR(form.items.reduce((s, it) => s + (it.subtotal || 0), 0))}
              </span>
            </div>

            {/* Diskon — editable, transaction-level, Penjualan only */}
            <div style={{ marginBottom: 10 }}>
              <label style={lStyle}>Diskon (IDR)</label>
              <RupiahInput
                value={form.discount || 0}
                onChange={(v) => setDiscount(v)}
                hasError={!!errors.discount}
              />
              {errors.discount && <span className="field-error">{errors.discount}</span>}
            </div>

            {/* Total Sesudah Diskon — read-only, = form.value, this is what gets billed */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #e5e7eb" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#1e3a5f" }}>Total Sesudah Diskon</span>
              <span
                style={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}
                aria-label="Total setelah diskon (dihitung otomatis)"
              >
                {fmtIDR(form.value)}
              </span>
            </div>
            {errors.value && <span className="field-error">{errors.value}</span>}
          </div>
        ) : (
          /* ── Pembelian: original plain box, completely unchanged ── */
          <div style={{ marginBottom: 12 }}>
            <label style={lStyle}>
              Total Transaksi (IDR)
              <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10, marginLeft: 6, color: "#10b981" }}>
                ✓ jumlah semua item
              </span>
            </label>
            <div
              style={{
                width: "100%", padding: "8px 10px",
                border: `1.5px solid ${errors.value ? "#ef4444" : "#d1d5db"}`,
                borderRadius: 8, fontSize: 14, boxSizing: "border-box",
                background: "#f3f4f6", color: "#374151", cursor: "not-allowed",
              }}
              aria-label="Total transaksi (dihitung otomatis)"
            >
              {fmtIDR(form.value)}
            </div>
            {errors.value && <span className="field-error">{errors.value}</span>}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={lStyle}>Tipe</label>
          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
            {["income", "expense"].map((t) => (
              <button key={t} type="button" onClick={() => handleTypeChange(t)}
                className={`type-btn ${form.type === t ? (t === "income" ? "type-btn--income" : "type-btn--expense") : ""}`}
                aria-pressed={form.type === t}>
                {t === "income" ? "🛒 Penjualan" : "📦 Pembelian"}
              </button>
            ))}
          </div>
          <div className="type-hint">{form.type === "income" ? "Penjualan ke klien → uang masuk, stok berkurang" : "Pembelian dari supplier → uang keluar, stok bertambah"}</div>
        </div>

        {secLbl("Status Pembayaran")}
        <div style={{ gridColumn: "1/-1", marginBottom: 12 }}>
          <label style={lStyle}>Status</label>
          {/* Simplified two-option dropdown — full status (Piutang/Utang) is derived automatically */}
          <select
            value={simpleStatus}
            onChange={(e) => handleSimpleStatusChange(e.target.value)}
            style={iStyle("status")}
            aria-label="Status pembayaran"
          >
            <option value="Lunas">✅ Lunas — sudah dibayar penuh</option>
            <option value="Belum Lunas">⏳ Belum Lunas — belum dibayar penuh</option>
          </select>

          {/* Show auto-derived full status as a hint */}
          {!isLunas && (
            <div className="type-hint" style={{ marginTop: 4 }}>
              {form.type === "income"
                ? "💚 Piutang — mereka masih hutang ke kita"
                : "❤️ Utang — kita masih hutang ke mereka"}
            </div>
          )}
        </div>

        {/* ── Paid-so-far input — only shown when Belum Lunas ── */}
        {!isLunas && (() => {
          // While the user hasn't touched a payment control this session,
          // anchor this preview to the REAL amount already paid (captured
          // once when the form opened) instead of the raw form.outstanding
          // value, which never updates on its own when discount/price/qty
          // edits change form.value — so it would otherwise silently drift
          // from reality as you edit. The moment the user actually touches
          // Sudah Dibayar or the status dropdown, paymentManuallyEdited
          // flips true and this preview switches to showing exactly what
          // they typed, same as before this fix.
          const livePaid = paymentManuallyEdited
            ? Math.max(0, Number(form.value) - Number(form.outstanding))
            : Math.min(initialAlreadyPaid.current, Number(form.value));
          const liveOutstanding = paymentManuallyEdited
            ? Number(form.outstanding)
            : Math.max(0, Number(form.value) - initialAlreadyPaid.current);
          return (
          <div style={{ gridColumn: "1/-1", marginBottom: 12 }}>
            <label style={lStyle}>
              Sudah Dibayar (Rp)
              <span
                style={{ fontWeight: 400, textTransform: "none", fontSize: 10, marginLeft: 6, color: "#6b7280" }}
                title="Masukkan jumlah yang sudah dibayar sejauh ini. Sisa tagihan akan dihitung otomatis."
              >
                ℹ️ masukkan jumlah yang sudah dibayar
              </span>
            </label>
            <RupiahInput
              value={livePaid}
              onChange={(paid) => {
                setPaymentManuallyEdited(true);
                const clamped = Math.min(Math.max(0, paid), Number(form.value));
                setForm((f) => ({ ...f, outstanding: Number(f.value) - clamped }));
              }}
              hasError={!!errors.paidAmount}
            />
            {errors.paidAmount && <span className="field-error">{errors.paidAmount}</span>}
            {/* Live outstanding preview */}
            {Number(form.value) > 0 && (
              <div className="stock-preview" style={{ color: liveOutstanding > 0 ? "#f59e0b" : "#10b981" }}>
                Sisa tagihan:{" "}
                <strong>{fmtIDR(liveOutstanding)}</strong>
                {liveOutstanding <= 0 && " — ✅ Lunas penuh"}
              </div>
            )}

            {/* Custom Payment Terms (Due Days override) */}
            <div style={{ marginTop: 12 }}>
              <label style={lStyle}>
                Tempo Pembayaran (Hari)
                <span
                  style={{ fontWeight: 400, textTransform: "none", fontSize: 10, marginLeft: 6, color: "#6b7280" }}
                  title="Waktu yang diberikan untuk melunasi sisa tagihan."
                >
                  ℹ️ batas waktu pelunasan
                </span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={customDueDays}
                onChange={(e) => setCustomDueDays(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={() => {
                  const n = parseInt(customDueDays, 10);
                  setCustomDueDays(isNaN(n) || n < 1 ? "1" : String(n)); // H2: minimum 1 day
                }}
                style={{ ...iStyle("customDueDays"), width: 120 }}
                aria-label="Tempo Pembayaran dalam hari"
              />
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
                Jatuh tempo: {fmtDate(liveOutstanding > 0 ? addDays(form.date, parseInt(customDueDays, 10) || 0) : null)}
              </div>
            </div>
          </div>
          );
        })()}

      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleSubmit}
          className="btn btn-primary btn-lg"
          style={{ flex: 1 }}
          disabled={submitting}
        >
          {submitting ? "Menyimpan..." : (initial ? "💾 Simpan Perubahan" : "➕ Tambah Transaksi")}
        </button>
        {onCancel && <button onClick={onCancel} type="button" className="btn btn-secondary btn-lg">Batal</button>}
      </div>

      {/* ── New-item confirmation dialog ── */}
      {newItemConfirm && (() => {
        const hasArchived = newItemConfirm.items.some(
          (itm) => itm.status === "archived_item" || itm.status === "archived_subtype"
        );

        // Detect if any new_item's name starts with an existing catalog base item name.
        // e.g. user typed "Bawang Putih Jawa" but "Bawang Putih" already exists → guide to "+ Tambah Tipe".
        const subtypeGuidanceMatch = !hasArchived
          ? newItemConfirm.items
              .filter((itm) => itm.status === "new_item")
              .map((itm) => ({
                itm,
                base: activeCatalog.find((cat) =>
                  normItem(itm.baseName).startsWith(normItem(cat.name) + " ")
                ),
              }))
              .find((x) => x.base)
          : null;

        if (subtypeGuidanceMatch) {
          const { base } = subtypeGuidanceMatch;
          return (
            <div className="modal-overlay" role="dialog" aria-modal="true">
              <div className="modal-box" style={{ maxWidth: 480 }}>
                <h3 className="modal-title">⚠ Item Serupa Ditemukan</h3>
                <div className="modal-body">
                  <p>
                    <strong>{normalizeTitleCase(base.name)}</strong> sudah ada di katalog.
                    Untuk menambah tipe baru, gunakan tombol{" "}
                    <strong>"+ Tambah Tipe"</strong> pada item{" "}
                    <strong>{normalizeTitleCase(base.name)}</strong> di halaman Inventaris.
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setNewItemConfirm(null);
                      setSubmitting(false);
                      if (typeof onCancel === "function") onCancel();
                    }}
                  >
                    Ke Inventaris
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirmNewItems}
                  >
                    Tetap Tambah Sebagai Item Baru
                  </button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-box" style={{ maxWidth: 480 }}>
              <h3 className="modal-title">
                {hasArchived ? "📦 Barang Diarsipkan" : "⚠ Barang Baru Terdeteksi"}
              </h3>
              <div className="modal-body">
                <p style={{ marginBottom: 8 }}>
                  {hasArchived
                    ? "Barang berikut ada di arsip atau mengandung tipe yang diarsipkan:"
                    : "Barang berikut belum terdaftar di katalog:"}
                </p>
                <ul style={{ margin: "0 0 12px 0", paddingLeft: 20 }}>
                  {newItemConfirm.items.map((itm, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <strong>
                        "{itm.typeName
                          ? normalizeTitleCase(itm.baseName) + " " + normalizeTitleCase(itm.typeName)
                          : normalizeTitleCase(itm.baseName)}"
                      </strong>
                      {" — "}
                      {itm.status === "archived_item"
                        ? "ada di arsip — akan dikembalikan ke katalog aktif"
                        : itm.status === "archived_subtype"
                        ? `tipe diarsipkan — akan dikembalikan ke ${normalizeTitleCase(itm.baseName)}`
                        : itm.status === "new_item"
                        ? "barang baru"
                        : `tipe baru untuk ${normalizeTitleCase(itm.baseName)}`}
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: 13, color: "#6b7280" }}>
                  {hasArchived
                    ? "Barang/tipe yang diarsipkan akan dikembalikan ke katalog aktif."
                    : "Barang/tipe baru akan otomatis ditambahkan ke katalog setelah transaksi disimpan."}
                  {" "}Pastikan penulisan sudah benar untuk menghindari duplikasi.
                </p>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setNewItemConfirm(null); setSubmitting(false); }}
                >
                  Periksa Kembali
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmNewItems}
                >
                  Ya, Lanjutkan
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Duplicate item confirmation dialog ── */}
      {duplicateItemConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <h3 className="modal-title">⚠ Barang Duplikat</h3>
            <div className="modal-body">
              <p>
                <strong>"{duplicateItemConfirm.itemName}"</strong> sudah ada di daftar dengan harga
                yang sama. Item akan digabung otomatis saat disimpan. Lanjutkan?
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    items: f.items.map((it, i) =>
                      i === duplicateItemConfirm.rowIndex ? blankItem() : it
                    ),
                  }));
                  setDuplicateItemConfirm(null);
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setItem(duplicateItemConfirm.rowIndex, "duplicateConfirmed", true);
                  setDuplicateItemConfirm(null);
                }}
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Missing Tipe blocking dialog ── */}
      {missingTypeItems && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <h3 className="modal-title">⚠ Tipe Barang Wajib Diisi</h3>
            <div className="modal-body">
              <p style={{ marginBottom: 8 }}>
                Semua barang harus memiliki tipe. Barang berikut belum memiliki tipe:
              </p>
              <ul style={{ margin: "0 0 12px 0", paddingLeft: 20 }}>
                {missingTypeItems.map((name, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <strong>"{normalizeTitleCase(name)}"</strong>
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 13, color: "#6b7280" }}>
                Isi kolom Tipe untuk setiap barang sebelum menyimpan transaksi.
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setMissingTypeItems(null)}
              >
                Isi Tipe Barang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment integrity: Case 1 — total increased on a Lunas transaction ── */}
      {paymentIntegrityConfirm && paymentIntegrityConfirm.case === 1 && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <h3 className="modal-title">💰 Status Pembayaran Berubah</h3>
            <div className="modal-body">
              <p style={{ marginBottom: 12 }}>
                {form.type === "income" ? (
                  <>Total tagihan berubah dari <strong>{fmtIDR(paymentIntegrityConfirm.oldTotal)}</strong> menjadi{" "}
                  <strong>{fmtIDR(paymentIntegrityConfirm.newTotal)}</strong>. Transaksi ini sebelumnya Lunas —
                  bagaimana status pembayarannya sekarang?</>
                ) : (
                  <>Total tagihan dari supplier berubah dari <strong>{fmtIDR(paymentIntegrityConfirm.oldTotal)}</strong> menjadi{" "}
                  <strong>{fmtIDR(paymentIntegrityConfirm.newTotal)}</strong>. Transaksi ini sebelumnya Lunas —
                  apakah kita sudah membayar penuh jumlah baru ini?</>
                )}
              </p>
              <label
                style={{
                  display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10,
                  padding: 10, borderRadius: 8,
                  border: `1.5px solid ${integrityChoice === "paid_full" ? "#10b981" : "#e2e8f0"}`,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="integrity-case1"
                  checked={integrityChoice === "paid_full"}
                  onChange={() => setIntegrityChoice("paid_full")}
                  style={{ marginTop: 3 }}
                />
                <span>
                  {form.type === "income"
                    ? <>Klien sudah membayar penuh <strong>{fmtIDR(paymentIntegrityConfirm.newTotal)}</strong></>
                    : <>Kita sudah membayar penuh <strong>{fmtIDR(paymentIntegrityConfirm.newTotal)}</strong> kepada supplier</>}
                </span>
              </label>
              <label
                style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: 10, borderRadius: 8,
                  border: `1.5px solid ${integrityChoice === "paid_original" ? "#f59e0b" : "#e2e8f0"}`,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="integrity-case1"
                  checked={integrityChoice === "paid_original"}
                  onChange={() => setIntegrityChoice("paid_original")}
                  style={{ marginTop: 3 }}
                />
                <span>
                  {form.type === "income" ? "Klien baru membayar" : "Kita baru membayar"}{" "}
                  <strong>{fmtIDR(paymentIntegrityConfirm.realPaid)}</strong> —{" "}
                  {form.type === "income" ? "Sisa Tagihan" : "Sisa Utang"}{" "}
                  <strong style={{ color: "#f59e0b" }}>
                    {fmtIDR(paymentIntegrityConfirm.newTotal - paymentIntegrityConfirm.realPaid)}
                  </strong>
                </span>
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPaymentIntegrityConfirm(null);
                  setIntegrityChoice(null);
                  setSubmitting(false);
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!integrityChoice}
                onClick={() => resolvePaymentIntegrity(integrityChoice)}
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment integrity: Case 2 — real amount paid now exceeds the new total ── */}
      {paymentIntegrityConfirm && paymentIntegrityConfirm.case === 2 && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <h3 className="modal-title">⚠ Total Lebih Kecil dari Pembayaran</h3>
            <div className="modal-body">
              <p style={{ marginBottom: 12 }}>
                {form.type === "income" ? (
                  <>Total tagihan berubah dari <strong>{fmtIDR(paymentIntegrityConfirm.oldTotal)}</strong> menjadi{" "}
                  <strong>{fmtIDR(paymentIntegrityConfirm.newTotal)}</strong> — lebih kecil dari jumlah yang sudah
                  dibayar (<strong>{fmtIDR(paymentIntegrityConfirm.realPaid)}</strong>). Bagaimana ini terjadi?</>
                ) : (
                  <>Total tagihan dari supplier turun dari <strong>{fmtIDR(paymentIntegrityConfirm.oldTotal)}</strong> menjadi{" "}
                  <strong>{fmtIDR(paymentIntegrityConfirm.newTotal)}</strong> — lebih kecil dari yang sudah kita
                  bayarkan (<strong>{fmtIDR(paymentIntegrityConfirm.realPaid)}</strong>). Bagaimana ini terjadi?</>
                )}
              </p>
              <label
                style={{
                  display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10,
                  padding: 10, borderRadius: 8,
                  border: `1.5px solid ${integrityChoice === "correction" ? "#10b981" : "#e2e8f0"}`,
                  cursor: paymentIntegrityConfirm.realPaymentCount > 1 ? "not-allowed" : "pointer",
                  opacity: paymentIntegrityConfirm.realPaymentCount > 1 ? 0.55 : 1,
                }}
              >
                <input
                  type="radio"
                  name="integrity-case2"
                  checked={integrityChoice === "correction"}
                  disabled={paymentIntegrityConfirm.realPaymentCount > 1}
                  onChange={() => { setIntegrityChoice("correction"); setRefundAcknowledged(false); }}
                  style={{ marginTop: 3 }}
                />
                <span>
                  {form.type === "income" ? "Klien sebenarnya hanya membayar" : "Sebenarnya kita hanya membayar"}{" "}
                  <strong>{fmtIDR(paymentIntegrityConfirm.newTotal)}</strong>{" "}
                  (koreksi data — bukan pengembalian dana)
                  {paymentIntegrityConfirm.realPaymentCount > 1 && (
                    <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4, fontWeight: 400 }}>
                      Tidak tersedia — transaksi ini memiliki {paymentIntegrityConfirm.realPaymentCount}{" "}
                      pembayaran tercatat. Sistem tidak dapat menentukan pembayaran mana yang perlu
                      dikoreksi. Batalkan, lalu sesuaikan riwayat pembayaran secara manual terlebih dahulu.
                    </div>
                  )}
                </span>
              </label>
              <label
                style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: 10, borderRadius: 8,
                  border: `1.5px solid ${integrityChoice === "refund" ? "#f59e0b" : "#e2e8f0"}`,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="integrity-case2"
                  checked={integrityChoice === "refund"}
                  onChange={() => setIntegrityChoice("refund")}
                  style={{ marginTop: 3 }}
                />
                <span>
                  {form.type === "income" ? "Klien benar-benar membayar" : "Kita benar-benar membayar"}{" "}
                  <strong>{fmtIDR(paymentIntegrityConfirm.realPaid)}</strong>{" "}
                  (kelebihan bayar{" "}
                  <strong style={{ color: "#f59e0b" }}>
                    {fmtIDR(paymentIntegrityConfirm.realPaid - paymentIntegrityConfirm.newTotal)}
                  </strong>)
                </span>
              </label>
              {integrityChoice === "refund" && (
                <div style={{ marginTop: 10, padding: 10, background: "#fff7ed", borderRadius: 8, border: "1px solid #fed7aa" }}>
                  <p style={{ fontSize: 13, marginBottom: 8 }}>
                    Sistem tidak dapat menyimpan saldo kelebihan bayar. Total akan disesuaikan menjadi{" "}
                    <strong>{fmtIDR(paymentIntegrityConfirm.newTotal)}</strong> —{" "}
                    {form.type === "income" ? (
                      <>tolong kembalikan{" "}
                      <strong>{fmtIDR(paymentIntegrityConfirm.realPaid - paymentIntegrityConfirm.newTotal)}</strong>{" "}
                      secara tunai/transfer ke klien sebelum melanjutkan.</>
                    ) : (
                      <>supplier perlu mengembalikan{" "}
                      <strong>{fmtIDR(paymentIntegrityConfirm.realPaid - paymentIntegrityConfirm.newTotal)}</strong>{" "}
                      kepada kita sebelum melanjutkan.</>
                    )}
                  </p>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={refundAcknowledged}
                      onChange={(e) => setRefundAcknowledged(e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      {form.type === "income" ? (
                        <>Saya sudah mengembalikan{" "}
                        {fmtIDR(paymentIntegrityConfirm.realPaid - paymentIntegrityConfirm.newTotal)} ke klien</>
                      ) : (
                        <>Supplier sudah mengembalikan{" "}
                        {fmtIDR(paymentIntegrityConfirm.realPaid - paymentIntegrityConfirm.newTotal)} kepada kita</>
                      )}
                    </span>
                  </label>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPaymentIntegrityConfirm(null);
                  setIntegrityChoice(null);
                  setRefundAcknowledged(false);
                  setSubmitting(false);
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!integrityChoice || (integrityChoice === "refund" && !refundAcknowledged)}
                onClick={() => resolvePaymentIntegrity(integrityChoice)}
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionForm;
