/**
 * components/TransactionForm.js
 * Full transaction input form with multi-item support and enhanced client/counterparty selector.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import RupiahInput from "./RupiahInput";
import Icon        from "./Icon";
import { generateId, today, nowTime, normItem, normalizeTitleCase, fmtIDR, fmtDate, addDays } from "../utils/idGenerators";
import { STATUS, deriveStatus } from "../utils/statusUtils";

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

  const blank = {
    date: today(), time: nowTime(),
    counterparty: "",
    stockUnit: "karung", customUnit: "", value: 0,
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
    return {
      ...blank,
      ...initial,
      outstanding: Number(initial.outstanding) || 0,
      value: items.reduce((s, it) => s + (it.subtotal || 0), 0),
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

  // Autocomplete visibility: track which item row's name/type suggestions are open
  const [showItemSugg, setShowItemSugg] = useState(null);
  const [showTypeSugg, setShowTypeSugg] = useState(null);
  // New-item confirmation dialog state
  const [newItemConfirm, setNewItemConfirm] = useState(null); // { items: [...], unit: string } | null
  // Duplicate item confirmation dialog state
  const [duplicateItemConfirm, setDuplicateItemConfirm] = useState(null); // { rowIndex, itemName } | null

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /** Derive the stored status string from simple UI choice + transaction type */
  const deriveFullStatus = (simple, type) =>
    deriveStatus(type, simple !== STATUS.LUNAS);

  /** Handle the simplified status dropdown change */
  const handleSimpleStatusChange = (simple) => {
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
      // Re-derive full status so Piutang/Utang stays correct for the new type
      status: deriveFullStatus(f.status === STATUS.LUNAS ? STATUS.LUNAS : "Belum Lunas", newType),
    }));
    if (newType === "income") { setTxnIdInput(""); setTxnIdError(null); } // clear supplier invoice field when switching to income
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
      return { ...f, items, value: items.reduce((s, it) => s + (it.subtotal || 0), 0) };
    });

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
      return { ...f, items, value: items.reduce((s, it) => s + (it.subtotal || 0), 0) };
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
      if (Number(it.pricePerKg) > 0 && (!it.weightKg || Number(it.weightKg) <= 0))
        ie.weightKg = "Isi berat untuk menghitung total otomatis";
      if (!it.subtotal || Number(it.subtotal) <= 0)
        ie.subtotal = "Total harus positif";
      return ie;
    });
    if (itemErrors.some((ie) => Object.keys(ie).length > 0)) e.items = itemErrors;

    const totalVal = form.items.reduce((s, it) => s + (it.subtotal || 0), 0);
    if (!totalVal || totalVal <= 0) e.value = "Masukkan angka positif";

    // Belum Lunas: paidAmount must be >= 0 and < value (outstanding > 0 means not yet fully paid)
    if (form.status !== STATUS.LUNAS) {
      if (Number(form.outstanding) <= 0) {
        e.paidAmount = "Jumlah yang sudah dibayar harus kurang dari nilai total";
      }
      if (Number(form.outstanding) > totalVal) {
        e.paidAmount = "Tidak boleh melebihi nilai total";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Stock check + save flow ───────────────────────────────────────────────────

  /** Stock warning check then save — extracted so it can be called from both
   *  handleSubmit (no new items) and handleConfirmNewItems (after catalog updates). */
  const doStockCheckAndSave = (unit) => {
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
          onConfirm: () => doSave(unit),
          onCancel: () => setSubmitting(false),
        });
        return;
      }
    }
    doSave(unit);
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
    if (!validate()) { setSubmitting(false); return; }

    // Derive unit from the first item — use fresh catalog lookup to avoid stale matchedCatalog
    const firstItem = form.items[0];
    const freshFirstCat = firstItem?.catalogItemId
      ? itemCatalog.find((c) => c.id === firstItem.catalogItemId)
      : null;
    const unit = freshFirstCat?.defaultUnit || firstItem?.matchedCatalog?.defaultUnit || "karung";

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
      setNewItemConfirm({ items: deduped, unit });
      return;
    }

    doStockCheckAndSave(unit);
  };

  /** Called when user confirms new items in the confirmation dialog */
  const handleConfirmNewItems = () => {
    const { items: newItems, unit } = newItemConfirm;
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
    doStockCheckAndSave(unit);
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

  const doSave = (unit) => {
    const firstItem    = form.items[0] || {};
    const totalSackQty = form.items.reduce((s, it) => s + (parseFloat(it.sackQty) || 0), 0);
    const totalVal     = form.items.reduce((s, it) => s + (it.subtotal || 0), 0);
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
        value:        totalVal,
        outstanding:  Number(form.outstanding) || 0,
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
                                <span className="autocomplete-stock-hint">
                                  {sq
                                    ? `${Number(sq.qty).toFixed(2)} ${sq.unit || cat.defaultUnit}`
                                    : `0 ${cat.defaultUnit}`}
                                </span>
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
                        Tipe{" "}
                        <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10, color: "#9ca3af" }}>(opsional)</span>
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
                        placeholder="Tipe (opsional)"
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
                                      ? `${Number(sq.qty).toFixed(2)} ${sq.unit || "karung"}`
                                      : `0 ${freshCatalog.defaultUnit || "karung"}`}
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
                              Stok: {aq.toFixed(2)} {curStock.unit || "karung"}
                            </span>
                          );
                        })()
                      : <span style={{ color: "#9ca3af" }}>Stok: 0 karung</span>
                    }
                  </div>
                )}

                {/* Karung | Harga/Kg | Berat (Kg) | Subtotal */}
                <div className="item-fields-row">
                  <div>
                    <label className="item-field-label">Jumlah Karung</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.sackQty}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, "").replace(/^(\d*\.?\d*).*/, "$1");
                        setItem(idx, "sackQty", v);
                      }}
                      onBlur={() => {
                        const n = parseFloat(item.sackQty);
                        setItem(idx, "sackQty", isNaN(n) || n < 0 ? "" : String(n));
                      }}
                      placeholder="0"
                      style={iStyle("", !!ie.sackQty)}
                      aria-label={`Jumlah karung item ${idx + 1}`}
                    />
                    {ie.sackQty && <span className="field-error">{ie.sackQty}</span>}
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>satuan: karung</div>
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
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.weightKg}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, "").replace(/^(\d*\.?\d*).*/, "$1");
                        setItem(idx, "weightKg", v);
                      }}
                      onBlur={() => {
                        const n = parseFloat(item.weightKg);
                        setItem(idx, "weightKg", isNaN(n) || n < 0 ? "" : String(n));
                      }}
                      placeholder="0"
                      style={iStyle("", !!ie.weightKg)}
                      aria-label={`Berat item ${idx + 1}`}
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
                            {aqd.toFixed(2)}
                          </strong>
                          {" → "}
                          <strong style={{ color: "#007bff" }}>
                            {projected.toFixed(2)} karung
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
        {/* Nilai Total — read-only, always the sum of all item subtotals */}
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
        {!isLunas && (
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
              value={Math.max(0, Number(form.value) - Number(form.outstanding))}
              onChange={(paid) => {
                const clamped = Math.min(Math.max(0, paid), Number(form.value));
                setForm((f) => ({ ...f, outstanding: Number(f.value) - clamped }));
              }}
              hasError={!!errors.paidAmount}
            />
            {errors.paidAmount && <span className="field-error">{errors.paidAmount}</span>}
            {/* Live outstanding preview */}
            {Number(form.value) > 0 && (
              <div className="stock-preview" style={{ color: form.outstanding > 0 ? "#f59e0b" : "#10b981" }}>
                Sisa tagihan:{" "}
                <strong>{fmtIDR(Math.max(0, Number(form.outstanding)))}</strong>
                {form.outstanding <= 0 && " — ✅ Lunas penuh"}
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
                Jatuh tempo: {fmtDate(form.outstanding > 0 ? addDays(form.date, parseInt(customDueDays, 10) || 0) : null)}
              </div>
            </div>
          </div>
        )}

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
    </div>
  );
};

export default TransactionForm;
