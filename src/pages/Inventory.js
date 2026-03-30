/**
 * pages/Inventory.js
 * Stock inventory dashboard — unified catalog item card view.
 *
 * Shows:
 *  - Date navigation bar with full Indonesian date format
 *  - Alert banners for negative / low-stock items
 *  - Summary dashboard cards
 *  - Search/sort bar above unified item cards
 *  - Unified catalog item cards (replaces old Katalog Barang section + stock table)
 *  - Expandable per-item stock ledger rendered inside each card
 *  - Uncataloged items section at the bottom
 */
import React, { useState, useMemo, useEffect, useRef } from "react";
import Icon               from "../components/Icon";
import StockChip          from "../components/StockChip";
import Toast              from "../components/Toast";
import CategoryModal      from "../components/CategoryModal";
import { fmtDate, generateId, today, addDays, normalizeTitleCase, normItem, nowTime } from "../utils/idGenerators";
import { computeStockMapForDate } from "../utils/stockUtils";
import { autoDetectCategories, getCategoryForItem } from "../utils/categoryUtils";

/** Full Indonesian date format: "Sabtu, 15 Maret 2026" */
const fmtDateLong = (d) => {
  if (!d) return "-";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

/**
 * @param {{
 *   stockMap: Object,
 *   threshold: number,
 *   onViewItem: (itemName: string) => void,
 *   onAddAdjustment: (adj: Object) => void,
 *   onRenameItem?: (oldName: string, newName: string) => void,
 *   onDeleteItem?: (itemName: string) => void,
 *   onDeleteAdjustment?: (adjustmentId: string) => void,
 *   itemCategories?: Array,
 *   onUpdateCategories?: (categories: Array) => void,
 *   transactions?: Array,
 *   stockAdjustments?: Array,
 *   onStockReport?: () => void,
 *   itemCatalog?: Array,
 *   onAddCatalogItem?: (item: Object) => void,
 *   onUpdateCatalogItem?: (item: Object) => void,
 *   onDeleteCatalogItem?: (id: string) => void,
 * }} props
 */
const Inventory = ({
  stockMap,
  threshold,
  onViewItem,
  onAddAdjustment,
  onRenameItem          = () => {},
  onDeleteItem          = () => {},
  onDeleteAdjustment    = () => {},
  itemCategories        = [],
  onUpdateCategories    = () => {},
  transactions          = [],
  stockAdjustments      = [],
  onStockReport         = () => {},
  itemCatalog           = [],
  onAddCatalogItem      = () => {},
  onUpdateCatalogItem   = () => {},
  onDeleteCatalogItem   = () => {},
}) => {
  // Search / sort state
  const [search,  setSearch]  = useState("");
  const [sortBy,  setSortBy]  = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Date navigation
  const [inventoryDate, setInventoryDate] = useState(today);
  const isToday = inventoryDate === today();
  const dateInputRef = useRef(null);

  // Historical stock map — only computed when viewing a past date
  const stockMapForDate = useMemo(
    () => isToday ? null : computeStockMapForDate(transactions, inventoryDate, stockAdjustments),
    [isToday, transactions, inventoryDate, stockAdjustments]
  );
  const activeStockMap = isToday ? stockMap : stockMapForDate;

  // Adjustment modal state
  const [adjTarget,     setAdjTarget]     = useState(null);
  const [adjDir,        setAdjDir]        = useState("add");
  const [adjQtyStr,     setAdjQtyStr]     = useState("");
  const [adjReason,     setAdjReason]     = useState("");
  const [adjError,      setAdjError]      = useState("");
  const [adjQtyError,   setAdjQtyError]   = useState("");
  const [adjReasonError,setAdjReasonError]= useState("");
  const [adjNewName,    setAdjNewName]    = useState("");
  const [toast,         setToast]         = useState(null);

  // Refs for auto-focus
  const adjQtyRef         = useRef(null);
  const catalogNameRef    = useRef(null);
  const addSubtypeInputRef = useRef(null);

  // Rename modal state
  const [renameTarget,       setRenameTarget]       = useState(null);
  const [renameNewName,      setRenameNewName]      = useState("");
  const [renameError,        setRenameError]        = useState("");
  const [renameMergeConfirm, setRenameMergeConfirm] = useState(false);

  // Delete item confirm state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Submit debounce guard — prevents double-submit across all forms
  const [submitting, setSubmitting] = useState(false);

  // Catalog UI state
  const [catalogForm,          setCatalogForm]          = useState(null);
  const [catalogFormError,     setCatalogFormError]     = useState("");   // name-field error
  const [catalogSubtypeError,  setCatalogSubtypeError]  = useState("");   // subtype duplicate error
  const [addSubtypeTarget,     setAddSubtypeTarget]     = useState(null);  // catalog item id
  const [addSubtypeInput,      setAddSubtypeInput]      = useState("");
  const [addSubtypeError,      setAddSubtypeError]      = useState("");
  const [deleteCatalogConfirm, setDeleteCatalogConfirm] = useState(null);
  const [removeSubtypeConfirm, setRemoveSubtypeConfirm] = useState(null); // { cat, sub }

  // Stock ledger state
  const [expandedStockItem, setExpandedStockItem] = useState(null);
  const [ledgerTypeFilter,  setLedgerTypeFilter]  = useState("all");
  const [ledgerDateFrom,    setLedgerDateFrom]    = useState(null);
  const [ledgerDateTo,      setLedgerDateTo]      = useState(null);
  const [adjDeleteConfirm,  setAdjDeleteConfirm]  = useState(null);

  // Sync ledger date range when inventoryDate changes while a ledger is open
  useEffect(() => {
    if (expandedStockItem) {
      setLedgerDateFrom(inventoryDate);
      setLedgerDateTo(inventoryDate);
    }
  }, [inventoryDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus qty input when adjustment modal opens
  useEffect(() => {
    if (adjTarget && adjQtyRef.current) {
      setTimeout(() => adjQtyRef.current?.focus(), 50);
    }
  }, [adjTarget]);

  // Auto-focus subtype input when inline "+ Tambah Tipe" row opens
  useEffect(() => {
    if (addSubtypeTarget && addSubtypeInputRef.current) {
      setTimeout(() => addSubtypeInputRef.current?.focus(), 50);
    }
  }, [addSubtypeTarget]);

  // Global Escape key handler — closes modals/forms in foreground-first priority order
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (catalogForm)          { setCatalogForm(null); setCatalogFormError(""); setCatalogSubtypeError(""); return; }
      if (deleteCatalogConfirm) { setDeleteCatalogConfirm(null); return; }
      if (removeSubtypeConfirm) { setRemoveSubtypeConfirm(null); return; }
      if (adjTarget)            { setAdjTarget(null); return; }
      if (renameTarget)         { setRenameTarget(null); setRenameMergeConfirm(false); return; }
      if (deleteTarget)         { setDeleteTarget(null); return; }
      if (adjDeleteConfirm)     { setAdjDeleteConfirm(null); return; }
      if (addSubtypeTarget)     { setAddSubtypeTarget(null); setAddSubtypeInput(""); setAddSubtypeError(""); return; }
      if (expandedStockItem)    { setExpandedStockItem(null); return; }
      if (showCategoryModal)    { setShowCategoryModal(false); return; }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [catalogForm, deleteCatalogConfirm, removeSubtypeConfirm, adjTarget, renameTarget, deleteTarget, adjDeleteConfirm, addSubtypeTarget, expandedStockItem, showCategoryModal]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const openRename = (itemName, unit) => {
    setRenameTarget({ itemName, unit });
    setRenameNewName(itemName);
    setRenameError("");
    setRenameMergeConfirm(false);
  };

  const handleRenameConfirm = () => {
    if (submitting) return;
    const trimmed = renameNewName.trim();
    if (!trimmed) { setRenameError("Nama baru tidak boleh kosong."); return; }
    const normalizedNew = normalizeTitleCase(trimmed);
    const normalizedOld = renameTarget.itemName;
    const isSameKey = normItem(normalizedNew) === normItem(normalizedOld);
    if (!isSameKey && !renameMergeConfirm && normItem(normalizedNew) in activeStockMap) {
      setRenameMergeConfirm(true);
      return;
    }
    setSubmitting(true);
    onRenameItem(normalizedOld, normalizedNew);
    setToast(`Item berhasil diubah dari "${normalizedOld}" ke "${normalizedNew}"`);
    setRenameTarget(null);
    setRenameMergeConfirm(false);
    setSubmitting(false);
  };

  const handleDeleteConfirm = () => {
    if (submitting) return;
    setSubmitting(true);
    const { itemName, txCount } = deleteTarget;
    onDeleteItem(itemName);
    setToast(`${txCount} transaksi untuk "${itemName}" telah dihapus`);
    setDeleteTarget(null);
    setSubmitting(false);
  };

  const openAdj = (itemName, unit) => {
    setAdjTarget({ itemName, unit: unit || "karung", isNew: false });
    setAdjDir("add"); setAdjQtyStr(""); setAdjReason(""); setAdjError("");
    setAdjQtyError(""); setAdjReasonError("");
  };

  const handleAdjConfirm = () => {
    if (submitting) return;
    const finalName = adjTarget.isNew ? adjNewName.trim() : adjTarget.itemName;
    if (!finalName) { setAdjError("Nama item diperlukan."); return; }
    const qty = parseFloat(adjQtyStr);
    let hasError = false;
    if (!adjQtyStr || isNaN(qty) || qty <= 0) {
      setAdjQtyError("Jumlah harus lebih dari 0");
      hasError = true;
    } else {
      setAdjQtyError("");
    }
    if (!adjReason.trim()) {
      setAdjReasonError("Alasan wajib diisi");
      hasError = true;
    } else {
      setAdjReasonError("");
    }
    if (hasError) return;
    setSubmitting(true);
    const adjustmentQty = adjDir === "add" ? qty : -qty;
    const itemName = normalizeTitleCase(finalName);
    onAddAdjustment({
      id:            generateId(),
      createdAt:     new Date().toISOString(),
      date:          today(),
      time:          nowTime(),
      itemName,
      adjustmentQty,
      unit:          adjTarget.unit || "karung",
      reason:        adjReason.trim(),
      adjustedBy:    null,
    });
    setToast(`Penyesuaian stok berhasil disimpan`);
    setAdjTarget(null);
    setSubmitting(false);
  };

  // Toggle stock ledger; reset filters to current inventoryDate on open
  const toggleLedger = (itemKey) => {
    if (expandedStockItem === itemKey) {
      setExpandedStockItem(null);
    } else {
      setExpandedStockItem(itemKey);
      setLedgerDateFrom(inventoryDate);
      setLedgerDateTo(inventoryDate);
      setLedgerTypeFilter("all");
      setAdjDeleteConfirm(null);
    }
  };

  // ── useMemos ──────────────────────────────────────────────────────────────────

  // Build chronological ledger entries for the expanded item
  const ledgerEntries = useMemo(() => {
    if (!expandedStockItem) return [];
    const entries = [];

    for (const t of transactions) {
      const itemList = Array.isArray(t.items) && t.items.length > 0
        ? t.items
        : [{ itemName: t.itemName, sackQty: t.sackQty != null ? t.sackQty : (t.stockQty || 0) }];

      let matched = false;
      for (const it of itemList) {
        if (normItem(it.itemName) !== expandedStockItem || matched) continue;
        matched = true;
        const qty   = it.sackQty != null ? it.sackQty : (it.stockQty != null ? it.stockQty : 0);
        const delta = t.type === "expense" ? qty : -qty;
        entries.push({
          id:           t.id,
          type:         "transaction",
          date:         t.date || "",
          time:         t.time || "00:00",
          delta,
          counterparty: t.counterparty,
          txType:       t.type,
          txnId:        t.txnId,
          createdAt:    t.createdAt || "",
          unit:         t.stockUnit || "karung",
        });
      }
    }

    for (const a of stockAdjustments) {
      if (normItem(a.itemName) !== expandedStockItem) continue;
      entries.push({
        id:        a.id,
        type:      "adjustment",
        date:      a.date || "",
        time:      a.time || "00:00",
        delta:     a.adjustmentQty || 0,
        reason:    a.reason || "",
        createdAt: a.createdAt || "",
        unit:      a.unit || "karung",
      });
    }

    // Oldest first for running total computation
    entries.sort((a, b) => {
      const da = (a.date || "1970-01-01") + "T" + (a.time || "00:00");
      const db = (b.date || "1970-01-01") + "T" + (b.time || "00:00");
      if (da !== db) return da.localeCompare(db);
      return (a.createdAt || "").localeCompare(b.createdAt || "");
    });

    let running = 0;
    for (const e of entries) {
      running += e.delta;
      e.runningQty = running;
    }

    return entries;
  }, [expandedStockItem, transactions, stockAdjustments]);

  // Summary stats for the ledger (all-time, not filtered)
  const ledgerSummary = useMemo(() => {
    const totalIn  = ledgerEntries.filter((e) => e.delta > 0 && e.type === "transaction").reduce((s, e) => s + e.delta, 0);
    const totalOut = ledgerEntries.filter((e) => e.delta < 0 && e.type === "transaction").reduce((s, e) => s + Math.abs(e.delta), 0);
    const adjDelta = ledgerEntries.filter((e) => e.type === "adjustment").reduce((s, e) => s + e.delta, 0);
    const adjCount = ledgerEntries.filter((e) => e.type === "adjustment").length;
    const currentQty = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].runningQty : 0;
    return { totalIn, totalOut, adjDelta, adjCount, currentQty };
  }, [ledgerEntries]);

  // Filtered + reversed (most recent first) for display
  const visibleLedgerEntries = useMemo(() => {
    const filtered = ledgerEntries.filter((entry) => {
      if (ledgerTypeFilter === "transaction" && entry.type !== "transaction") return false;
      if (ledgerTypeFilter === "adjustment"  && entry.type !== "adjustment")  return false;
      if (ledgerDateFrom && entry.date < ledgerDateFrom) return false;
      if (ledgerDateTo   && entry.date > ledgerDateTo)   return false;
      return true;
    });
    return [...filtered].reverse();
  }, [ledgerEntries, ledgerTypeFilter, ledgerDateFrom, ledgerDateTo]);

  // Count of manual adjustments per item key (for badge on ledger button)
  const adjCountMap = useMemo(() => {
    const map = {};
    for (const a of stockAdjustments) {
      const k = normItem(a.itemName);
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }, [stockAdjustments]);

  // Flat item list from activeStockMap — used for summary cards + bar chart
  const items = useMemo(() => {
    const entries = Object.entries(activeStockMap).map(([key, s]) => ({ key, ...s }));
    return isToday ? entries : entries.filter((it) => it.qty !== 0);
  }, [activeStockMap, isToday]);

  const negItems = useMemo(() => items.filter((it) => it.qty < 0), [items]);
  const lowItems = useMemo(() => items.filter((it) => it.qty >= 0 && it.qty <= threshold), [items, threshold]);
  // Expanded item display info — used by the ledger panel
  const expandedItemInfo = useMemo(() => {
    if (!expandedStockItem) return null;
    const stock = activeStockMap[expandedStockItem];
    return {
      key:         expandedStockItem,
      displayName: stock?.displayName || expandedStockItem,
      unit:        stock?.unit || "karung",
      qty:         stock?.qty ?? 0,
    };
  }, [expandedStockItem, activeStockMap]);

  // Flat item rows grouped by category — replaces catalogWithStock + uncatalogedItems
  const tableGroups = useMemo(() => {
    // 1. Auto-detect categories (merges user-configured itemCategories with any
    //    uncategorized items currently in activeStockMap)
    const detectedCategories = autoDetectCategories(activeStockMap, itemCategories);

    // 2. Build flat item rows from catalog (base + each subtype)
    const coveredKeys = new Set();
    const flatRows = [];

    for (const cat of itemCatalog) {
      const baseKey   = normItem(cat.name);
      coveredKeys.add(baseKey);
      const baseStock = activeStockMap[baseKey];
      // Always show base item row — represents the item "without a type"
      flatRows.push({
        key:         baseKey,
        displayName: cat.name,
        qty:         baseStock?.qty      ?? 0,
        unit:        baseStock?.unit     || cat.defaultUnit || "karung",
        lastDate:    baseStock?.lastDate || null,
        lastTime:    baseStock?.lastTime || null,
        txCount:     baseStock?.txCount  || 0,
        catalogItem: cat,   // full catalog item — used for "+ Tambah Tipe" button and delete
      });

      for (const sub of (cat.subtypes || [])) {
        const fullName = `${cat.name} ${sub}`;
        const key      = normItem(fullName);
        coveredKeys.add(key);
        const stock = activeStockMap[key];
        flatRows.push({
          key,
          displayName:  fullName,
          qty:          stock?.qty      ?? 0,
          unit:         stock?.unit     || cat.defaultUnit || "karung",
          lastDate:     stock?.lastDate || null,
          lastTime:     stock?.lastTime || null,
          txCount:      stock?.txCount  || 0,
          catalogItem:  null,
        });
      }
    }

    // 3. Add uncataloged items (in activeStockMap but not covered by any catalog entry)
    for (const [key, stock] of Object.entries(activeStockMap)) {
      if (!coveredKeys.has(key)) {
        flatRows.push({
          key,
          displayName: stock.displayName || key,
          qty:         stock.qty      ?? 0,
          unit:        stock.unit     || "karung",
          lastDate:    stock.lastDate || null,
          lastTime:    stock.lastTime || null,
          txCount:     stock.txCount  || 0,
          catalogItem: null,
        });
      }
    }

    // 4. Apply search filter
    const q = search.trim().toLowerCase();
    const filtered = q
      ? flatRows.filter((r) => r.displayName.toLowerCase().includes(q))
      : flatRows;

    // 5. Group items by category
    const groupMap = {}; // key → { groupName, code, items[] }

    for (const row of filtered) {
      let cat = getCategoryForItem(row.key, detectedCategories);

      // Fallback: catalog base items with 0 stock are never added to category items[]
      // by auto-detect (not in stockMap), so try matching by groupName prefix.
      // Longest match wins to avoid "Bawang" matching before "Bawang Tunggal".
      if (!cat) {
        const normDisplay = normItem(row.displayName);
        let bestMatch = null;
        let bestLen = -1;
        for (const c of detectedCategories) {
          const normGroup = normItem(c.groupName);
          if (
            (normDisplay === normGroup || normDisplay.startsWith(normGroup + " ")) &&
            normGroup.length > bestLen
          ) {
            bestMatch = c;
            bestLen = normGroup.length;
          }
        }
        cat = bestMatch;
      }

      if (cat) {
        if (!groupMap[cat.groupName]) {
          groupMap[cat.groupName] = { groupName: cat.groupName, code: cat.code || "", items: [] };
        }
        groupMap[cat.groupName].items.push(row);
      } else {
        if (!groupMap["__unc__"]) {
          groupMap["__unc__"] = { groupName: "Lainnya", code: "UNC", items: [] };
        }
        groupMap["__unc__"].items.push(row);
      }
    }

    // 6. Sort items within each group per sortBy/sortDir
    const dir = sortDir === "asc" ? 1 : -1;
    const sortFn = (a, b) => {
      if (sortBy === "qty") return dir * (a.qty - b.qty);
      return dir * a.displayName.localeCompare(b.displayName, "id");
    };

    // 7. Sort groups alphabetically; keep "Lainnya" (UNC) at the end
    const sortedGroups = Object.entries(groupMap)
      .filter(([k]) => k !== "__unc__")
      .map(([, g]) => g)
      .sort((a, b) => a.groupName.localeCompare(b.groupName, "id"));

    for (const g of sortedGroups) g.items.sort(sortFn);

    if (groupMap["__unc__"]) {
      groupMap["__unc__"].items.sort(sortFn);
      sortedGroups.push(groupMap["__unc__"]);
    }

    return sortedGroups;
  }, [itemCatalog, activeStockMap, itemCategories, search, sortBy, sortDir]);

  // ── Catalog helpers ───────────────────────────────────────────────────────────

  const handleAddCatalogItem = () => {
    if (submitting) return;
    const name = (catalogForm.name || "").trim();
    if (!name) { setCatalogFormError("Nama barang wajib diisi."); return; }
    if (itemCatalog.some((c) => normItem(c.name) === normItem(name))) {
      setCatalogFormError(`Barang "${name}" sudah ada di katalog.`); return;
    }
    const subtypes = (catalogForm.subtypes || []).map((s) => s.trim()).filter(Boolean);
    const seen = new Set();
    for (const s of subtypes) {
      if (seen.has(normItem(s))) { setCatalogSubtypeError("Tipe tidak boleh duplikat dalam satu barang."); return; }
      seen.add(normItem(s));
    }
    setSubmitting(true);
    onAddCatalogItem({
      name,
      defaultUnit: (catalogForm.defaultUnit || "karung").trim() || "karung",
      subtypes: subtypes.map(normalizeTitleCase),
    });
    setCatalogForm(null); setCatalogFormError(""); setCatalogSubtypeError("");
    setToast(`Barang berhasil ditambahkan ke katalog`);
    setSubmitting(false);
  };

  const handleUpdateCatalogItem = () => {
    if (submitting) return;
    const subtypes = (catalogForm.subtypes || []).map((s) => s.trim()).filter(Boolean);
    const seen = new Set();
    for (const s of subtypes) {
      if (seen.has(normItem(s))) { setCatalogSubtypeError("Tipe tidak boleh duplikat dalam satu barang."); return; }
      seen.add(normItem(s));
    }
    // Block save if another catalog entry already uses this name
    const duplicate = itemCatalog.find(
      (c) => c.id !== catalogForm.id && normItem(c.name) === normItem(catalogForm.name || "")
    );
    if (duplicate) { setCatalogFormError("Barang dengan nama ini sudah ada di katalog."); return; }

    setSubmitting(true);
    const updatedItem = {
      ...catalogForm,
      subtypes:    subtypes.map(normalizeTitleCase),
      defaultUnit: (catalogForm.defaultUnit || "karung").trim() || "karung",
    };

    // If name changed, cascade rename to all matching transactions and adjustments
    const original = itemCatalog.find((c) => c.id === catalogForm.id);
    if (original && normItem(original.name) !== normItem(updatedItem.name)) {
      // Rename the base item (covers transactions without subtypes or with base-level stock)
      onRenameItem(original.name, updatedItem.name);
      // Rename each subtype's combined name (e.g. "Bawang Putih Cina" → "Bawang Putih Lokal Cina")
      for (const sub of (original.subtypes || [])) {
        onRenameItem(`${original.name} ${sub}`, `${updatedItem.name} ${sub}`);
      }
    }

    onUpdateCatalogItem(updatedItem);
    setCatalogForm(null); setCatalogFormError(""); setCatalogSubtypeError("");
    setToast("Barang berhasil diperbarui");
    setSubmitting(false);
  };

  const handleAddSubtype = (catalogItem) => {
    if (submitting) return;
    const sub = addSubtypeInput.trim();
    if (!sub) { setAddSubtypeError("Nama tipe wajib diisi"); return; }
    if ((catalogItem.subtypes || []).some((s) => normItem(s) === normItem(sub))) {
      setAddSubtypeError("Tipe ini sudah ada"); return;
    }
    setSubmitting(true);
    onUpdateCatalogItem({ ...catalogItem, subtypes: [...(catalogItem.subtypes || []), normalizeTitleCase(sub)] });
    setAddSubtypeTarget(null); setAddSubtypeInput(""); setAddSubtypeError("");
    setToast(`Tipe berhasil ditambahkan`);
    setSubmitting(false);
  };

  const handleRemoveSubtype = (catalogItem, sub) => {
    if (submitting) return;
    setSubmitting(true);
    onUpdateCatalogItem({
      ...catalogItem,
      subtypes: (catalogItem.subtypes || []).filter((s) => normItem(s) !== normItem(sub)),
    });
    setRemoveSubtypeConfirm(null);
    setToast(`Tipe berhasil dihapus`);
    setSubmitting(false);
  };

  const handleDeleteCatalog = (catalogItem) => {
    if (submitting) return;
    setSubmitting(true);
    onDeleteCatalogItem(catalogItem.id);
    onUpdateCategories(itemCategories.filter((c) => normItem(c.groupName) !== normItem(catalogItem.name)));
    setDeleteCatalogConfirm(null);
    setToast(`Barang berhasil dihapus dari katalog`);
    setSubmitting(false);
  };

  // ── Display helpers ───────────────────────────────────────────────────────────

  // Quick-select helpers for ledger date filter
  const setLedgerToday  = () => { setLedgerDateFrom(today()); setLedgerDateTo(today()); };
  const setLedgerWeek   = () => { setLedgerDateFrom(addDays(today(), -((new Date().getDay() + 6) % 7)) || today()); setLedgerDateTo(today()); };
  const setLedgerMonth  = () => { setLedgerDateFrom(today().slice(0, 7) + "-01"); setLedgerDateTo(today()); };
  const setLedgerAll    = () => { setLedgerDateFrom(null); setLedgerDateTo(null); };

  // ── Ledger panel (shared render helper) ──────────────────────────────────────

  const renderLedgerPanel = () => {
    if (!expandedItemInfo) return null;
    const { displayName, unit } = expandedItemInfo;
    const currentQtyColor =
      ledgerSummary.currentQty < 0      ? "#ef4444" :
      ledgerSummary.currentQty <= threshold ? "#f59e0b" : "#007bff";
    const itemUnit = activeStockMap[expandedStockItem]?.unit || unit || "karung";

    return (
      <div className="stock-ledger-wrap">
        {/* Header */}
        <div className="stock-ledger-header">
          <div>
            <div className="stock-ledger-title">
              <Icon name="clock" size={13} color="#007BFF" />
              Riwayat Stok — {displayName}
            </div>
            <div className="stock-ledger-subtitle">{ledgerEntries.length} pergerakan total</div>
          </div>
          <button
            onClick={() => setExpandedStockItem(null)}
            className="payment-timeline__close"
            aria-label="Tutup riwayat stok"
          >
            ✕ Tutup
          </button>
        </div>

        {/* Summary box */}
        <div className="stock-ledger-summary-box">
          <div className="stock-ledger-summary-box__title">Ringkasan — {displayName}</div>
          <div className="stock-ledger-summary-box__row">
            <div className="stock-ledger-summary-box__item">
              <div className="stock-ledger-summary-box__item-label">Masuk (Pembelian)</div>
              <div className="stock-ledger-summary-box__item-value" style={{ color: "#10b981" }}>
                +{Number(ledgerSummary.totalIn).toLocaleString("id-ID")}
              </div>
            </div>
            <div className="stock-ledger-summary-box__item">
              <div className="stock-ledger-summary-box__item-label">Keluar (Penjualan)</div>
              <div className="stock-ledger-summary-box__item-value" style={{ color: "#ef4444" }}>
                -{Number(ledgerSummary.totalOut).toLocaleString("id-ID")}
              </div>
            </div>
            <div className="stock-ledger-summary-box__item">
              <div className="stock-ledger-summary-box__item-label">Sesuaian ({ledgerSummary.adjCount}×)</div>
              <div className="stock-ledger-summary-box__item-value" style={{ color: "#f59e0b" }}>
                {ledgerSummary.adjDelta >= 0 ? "+" : ""}{Number(ledgerSummary.adjDelta).toLocaleString("id-ID")}
              </div>
            </div>
          </div>
          <hr className="stock-ledger-summary-box__divider" />
          <div className="stock-ledger-summary-box__total">
            <span className="stock-ledger-summary-box__total-label">Stok Saat Ini</span>
            <span className="stock-ledger-summary-box__total-value" style={{ color: currentQtyColor }}>
              {Number(ledgerSummary.currentQty).toLocaleString("id-ID")} {itemUnit}
            </span>
          </div>
        </div>

        {/* Mismatch warning (today's view only) */}
        {isToday && Math.abs((activeStockMap[expandedStockItem]?.qty ?? 0) - ledgerSummary.currentQty) > 0.001 && (
          <div className="alert-banner alert-banner--warning" style={{ margin: "0 0 10px", fontSize: 12 }}>
            <Icon name="warning" size={13} color="#d97706" />
            Stok di ledger ({ledgerSummary.currentQty}) berbeda dari stok terhitung ({activeStockMap[expandedStockItem]?.qty ?? 0}). Hubungi dukungan.
          </div>
        )}

        {/* Filter: type */}
        <div style={{ marginBottom: 10 }}>
          <div className="stock-ledger-filter-label">Tampilkan</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[["all", "Semua"], ["transaction", "Transaksi"], ["adjustment", "Penyesuaian Manual"]].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setLedgerTypeFilter(v)}
                className={`btn btn-sm ${ledgerTypeFilter === v ? "btn-primary" : "btn-outline"}`}
                style={{ fontSize: 11 }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Filter: date range */}
        <div style={{ marginBottom: 12 }}>
          <div className="stock-ledger-filter-label">Periode</div>
          <div className="stock-ledger-date-range">
            <span className="stock-ledger-date-label">Dari:</span>
            <input
              type="date"
              value={ledgerDateFrom || ""}
              onChange={(e) => setLedgerDateFrom(e.target.value || null)}
              className="stock-ledger-date-input"
              aria-label="Tanggal awal filter riwayat stok"
            />
            <span className="stock-ledger-date-label">Sampai:</span>
            <input
              type="date"
              value={ledgerDateTo || ""}
              onChange={(e) => setLedgerDateTo(e.target.value || null)}
              className="stock-ledger-date-input"
              aria-label="Tanggal akhir filter riwayat stok"
            />
            {(() => {
              const t          = today();
              const weekStart  = addDays(t, -((new Date().getDay() + 6) % 7)) || t;
              const monthStart = t.slice(0, 7) + "-01";
              let activePeriod = null;
              if (ledgerDateFrom === null && ledgerDateTo === null)             activePeriod = "all";
              else if (ledgerDateFrom === t          && ledgerDateTo === t)     activePeriod = "today";
              else if (ledgerDateFrom === weekStart  && ledgerDateTo === t)     activePeriod = "week";
              else if (ledgerDateFrom === monthStart && ledgerDateTo === t)     activePeriod = "month";
              const cls = (p) => `btn btn-sm ${activePeriod === p ? "btn-primary" : "btn-outline"}`;
              return (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <button onClick={setLedgerToday} className={cls("today")} style={{ fontSize: 10 }}>Hari Ini</button>
                  <button onClick={setLedgerWeek}  className={cls("week")}  style={{ fontSize: 10 }}>Minggu Ini</button>
                  <button onClick={setLedgerMonth} className={cls("month")} style={{ fontSize: 10 }}>Bulan Ini</button>
                  <button onClick={setLedgerAll}   className={cls("all")}   style={{ fontSize: 10 }}>Semua</button>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Count indicator */}
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
          Menampilkan {visibleLedgerEntries.length} dari {ledgerEntries.length} total gerakan stok
        </div>

        {/* Timeline */}
        {visibleLedgerEntries.length === 0 ? (
          <div style={{ padding: "12px 0", color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
            Tidak ada gerakan stok pada periode ini.
          </div>
        ) : (
          <div className="stock-ledger-timeline">
            {visibleLedgerEntries.map((entry, idx) => {
              const isAdj           = entry.type === "adjustment";
              const isPos           = entry.delta > 0;
              const dotColor        = isAdj ? "#f59e0b" : isPos ? "#10b981" : "#ef4444";
              const isDeletePending = adjDeleteConfirm === entry.id;

              return (
                <div
                  key={entry.id + idx}
                  className={`stock-ledger-entry${isAdj ? " stock-ledger-entry--adj" : " stock-ledger-entry--tx"}`}
                >
                  <div className="stock-ledger-entry__track">
                    <div
                      className={`stock-ledger-entry__dot${isAdj ? " stock-ledger-entry__dot--diamond" : ""}`}
                      style={{ background: dotColor, boxShadow: `0 0 0 2px ${dotColor}` }}
                    />
                    {idx < visibleLedgerEntries.length - 1 && (
                      <div className="stock-ledger-entry__line" />
                    )}
                  </div>

                  <div className="stock-ledger-entry__body">
                    <div className="stock-ledger-entry__datetime">
                      {fmtDate(entry.date)}{entry.time ? ` · ${entry.time}` : ""}
                    </div>
                    <div className="stock-ledger-entry__label">
                      {isAdj ? (
                        <span style={{ color: "#f59e0b", fontWeight: 700 }}>◆ Penyesuaian Manual</span>
                      ) : (
                        <span style={{ color: entry.txType === "expense" ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                          {entry.txType === "expense" ? "▲ Pembelian" : "▼ Penjualan"}
                        </span>
                      )}
                      {!isAdj && entry.counterparty && (
                        <span style={{ color: "#6b7280", fontWeight: 400, marginLeft: 4 }}>
                          — {entry.counterparty}
                          {entry.txnId && <span style={{ color: "#6366f1", marginLeft: 6, fontFamily: "monospace", fontSize: 10 }}>{entry.txnId}</span>}
                        </span>
                      )}
                    </div>
                    {isAdj && entry.reason && (
                      <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic", marginTop: 1 }}>
                        {entry.reason}
                      </div>
                    )}
                    <div className="stock-ledger-entry__delta" style={{ color: dotColor }}>
                      {isPos ? "+" : ""}{Number(entry.delta).toLocaleString("id-ID")} {entry.unit || unit}
                      <span className="stock-ledger-entry__running">
                        → stok: {Number(entry.runningQty).toLocaleString("id-ID")} {entry.unit || unit}
                      </span>
                    </div>

                    {/* Delete adjustment inline confirm */}
                    {isAdj && (
                      <div style={{ marginTop: 4 }}>
                        {isDeletePending ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                            <span style={{ color: "#ef4444" }}>Hapus penyesuaian ini?</span>
                            <button
                              onClick={() => {
                                onDeleteAdjustment(entry.id);
                                setAdjDeleteConfirm(null);
                                setToast("Penyesuaian stok berhasil dihapus");
                              }}
                              className="btn btn-sm btn-danger"
                              style={{ fontSize: 10, padding: "2px 8px" }}
                            >
                              Ya, Hapus
                            </button>
                            <button
                              onClick={() => setAdjDeleteConfirm(null)}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: 10, padding: "2px 8px" }}
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAdjDeleteConfirm(entry.id)}
                            className="btn btn-sm btn-outline"
                            style={{ fontSize: 10, padding: "2px 6px", borderColor: "#ef4444", color: "#ef4444" }}
                            aria-label="Hapus penyesuaian ini"
                          >
                            🗑 Hapus
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── Catalog add / edit modal ── */}
      {catalogForm && (
        <div className="modal-overlay" onClick={() => { setCatalogForm(null); setCatalogFormError(""); setCatalogSubtypeError(""); }}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 className="modal-title">{catalogForm.id ? "Edit Barang" : "Tambah Barang Baru"}</h3>
            <div className="modal-body">
              <div style={{ marginBottom: 12 }}>
                <label className="field-label">Nama Barang <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  ref={catalogNameRef}
                  value={catalogForm.name || ""}
                  onChange={(e) => { setCatalogForm((f) => ({ ...f, name: e.target.value })); setCatalogFormError(""); }}
                  placeholder="cth. Bawang Merah"
                  className={catalogFormError ? "form-input--error" : ""}
                  style={{ width: "100%", padding: "8px 11px", border: `1.5px solid ${catalogFormError ? "#ef4444" : "#c7ddf7"}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                  aria-label="Nama barang katalog"
                  aria-invalid={!!catalogFormError}
                />
                {catalogFormError && <span className="field-error">{catalogFormError}</span>}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="field-label">Satuan Default</label>
                <input
                  value={catalogForm.defaultUnit || ""}
                  onChange={(e) => setCatalogForm((f) => ({ ...f, defaultUnit: e.target.value }))}
                  placeholder="cth. karung"
                  style={{ width: "100%", padding: "8px 11px", border: "1.5px solid #c7ddf7", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                  aria-label="Satuan default"
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label className="field-label">
                  Tipe Barang <span style={{ color: "#9ca3af", fontWeight: 400 }}>(opsional)</span>
                </label>
                {(catalogForm.subtypes || []).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                    {(catalogForm.subtypes || []).map((sub, i) => (
                      <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          value={sub}
                          onChange={(e) => {
                            const updated = [...(catalogForm.subtypes || [])];
                            updated[i] = e.target.value;
                            setCatalogForm((f) => ({ ...f, subtypes: updated }));
                            setCatalogSubtypeError("");
                          }}
                          placeholder={`Tipe ${i + 1}`}
                          style={{ flex: 1, padding: "6px 10px", border: "1.5px solid #c7ddf7", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }}
                          aria-label={`Tipe ${i + 1}`}
                        />
                        <button
                          className="action-btn action-btn--delete"
                          onClick={() => setCatalogForm((f) => ({ ...f, subtypes: (f.subtypes || []).filter((_, j) => j !== i) }))}
                          aria-label={`Hapus tipe ${sub}`}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setCatalogForm((f) => ({ ...f, subtypes: [...(f.subtypes || []), ""] }))}
                >
                  ＋ Tambah Tipe
                </button>
              </div>
              {catalogSubtypeError && <span className="field-error">{catalogSubtypeError}</span>}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setCatalogForm(null); setCatalogFormError(""); setCatalogSubtypeError(""); }} disabled={submitting}>Batal</button>
              <button
                className="btn btn-primary"
                onClick={catalogForm.id ? handleUpdateCatalogItem : handleAddCatalogItem}
                disabled={submitting}
              >
                {submitting ? "Menyimpan..." : catalogForm.id ? "Simpan" : "Tambah"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Catalog delete confirm ── */}
      {deleteCatalogConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteCatalogConfirm(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h3 className="modal-title">Hapus dari Katalog?</h3>
            <div className="modal-body">
              <p>Hapus <strong>{deleteCatalogConfirm.name}</strong> dari katalog barang?</p>
              <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                Data transaksi yang sudah ada tidak akan terpengaruh.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteCatalogConfirm(null)}>Batal</button>
              <button className="btn btn-danger" onClick={() => handleDeleteCatalog(deleteCatalogConfirm)}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove subtype confirm ── */}
      {removeSubtypeConfirm && (
        <div className="modal-overlay" onClick={() => setRemoveSubtypeConfirm(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h3 className="modal-title">Hapus Tipe?</h3>
            <div className="modal-body">
              <p>Hapus tipe <strong>{removeSubtypeConfirm.sub}</strong> dari katalog barang <strong>{removeSubtypeConfirm.cat.name}</strong>?</p>
              {removeSubtypeConfirm.affectedCount > 0 ? (
                <p style={{ fontSize: 13, color: "#f59e0b", marginTop: 4 }}>
                  ⚠ {removeSubtypeConfirm.affectedCount} transaksi dengan tipe ini akan muncul di bagian "Tidak Terkatalog".
                </p>
              ) : (
                <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  Tidak ada transaksi yang terpengaruh.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setRemoveSubtypeConfirm(null)}>Batal</button>
              <button className="btn btn-danger" onClick={() => handleRemoveSubtype(removeSubtypeConfirm.cat, removeSubtypeConfirm.sub)}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Adjustment Modal ── */}
      {adjTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="adj-modal-title">
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <h3 className="modal-title" id="adj-modal-title">
              {adjTarget.isNew ? "Tambah Item Baru" : `Sesuaikan Stok: ${adjTarget.itemName}`}
            </h3>

            {adjTarget.isNew && (
              <div style={{ marginBottom: 12 }}>
                <label className="field-label">Nama Item</label>
                <input
                  value={adjNewName}
                  onChange={(e) => { setAdjNewName(e.target.value); setAdjError(""); }}
                  placeholder="cth. Bawang Putih"
                  style={{ width: "100%", padding: "8px 11px", border: "1.5px solid #c7ddf7", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                  aria-label="Nama item baru"
                  autoFocus
                />
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Jenis Penyesuaian</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["add", "➕ Tambah Stok"], ["remove", "➖ Kurangi Stok"]].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setAdjDir(val)}
                    className={`btn btn-sm ${adjDir === val ? "btn-primary" : "btn-outline"}`}
                    style={{ flex: 1 }}
                    aria-pressed={adjDir === val}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Jumlah ({adjTarget.unit})</label>
              <input
                ref={adjQtyRef}
                type="text"
                inputMode="decimal"
                value={adjQtyStr}
                onChange={(e) => {
                  setAdjQtyStr(e.target.value.replace(/[^0-9.]/g, "").replace(/^(\d*\.?\d*).*/, "$1"));
                  setAdjQtyError("");
                  setAdjError("");
                }}
                onBlur={() => {
                  const n = parseFloat(adjQtyStr);
                  if (!isNaN(n) && n > 0) setAdjQtyStr(String(n));
                }}
                placeholder="0"
                className={adjQtyError ? "form-input--error" : ""}
                style={{ width: "100%", padding: "8px 11px", border: `1.5px solid ${adjQtyError ? "#ef4444" : "#c7ddf7"}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                aria-label="Jumlah penyesuaian"
                aria-invalid={!!adjQtyError}
              />
              {adjQtyError && <span className="field-error">{adjQtyError}</span>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="field-label">Alasan Penyesuaian <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                type="text"
                value={adjReason}
                onChange={(e) => { setAdjReason(e.target.value); setAdjReasonError(""); setAdjError(""); }}
                placeholder="cth. Koreksi hasil hitung fisik"
                className={adjReasonError ? "form-input--error" : ""}
                style={{ width: "100%", padding: "8px 11px", border: `1.5px solid ${adjReasonError ? "#ef4444" : "#c7ddf7"}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                aria-label="Alasan penyesuaian"
                aria-invalid={!!adjReasonError}
              />
              {adjReasonError && <span className="field-error">{adjReasonError}</span>}
            </div>

            {adjError && (
              <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }} role="alert">{adjError}</div>
            )}

            <div className="modal-actions">
              <button onClick={() => setAdjTarget(null)} className="btn btn-secondary" disabled={submitting}>Batal</button>
              <button onClick={handleAdjConfirm} className="btn btn-primary" disabled={submitting}>
                {submitting ? "Menyimpan..." : "✓ Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rename Modal ── */}
      {renameTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="rename-modal-title">
          <div className="modal-box" style={{ maxWidth: 420 }}>
            <h3 className="modal-title" id="rename-modal-title">Ubah Nama Item</h3>
            <div style={{ marginBottom: 8, fontSize: 13, color: "#6b7280" }}>
              Nama saat ini: <strong>{renameTarget.itemName}</strong>
            </div>
            {renameMergeConfirm ? (
              <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
                ⚠ Item <strong>{normalizeTitleCase(renameNewName.trim())}</strong> sudah ada.
                Menggabungkan <strong>{renameTarget.itemName}</strong> ke dalamnya. Lanjutkan?
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Nama Baru</label>
                <input
                  value={renameNewName}
                  onChange={(e) => { setRenameNewName(e.target.value); setRenameError(""); }}
                  placeholder="Nama baru item"
                  style={{ width: "100%", padding: "8px 11px", border: `1.5px solid ${renameError ? "#ef4444" : "#c7ddf7"}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                  aria-label="Nama baru item"
                  autoFocus
                />
                {renameError && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }} role="alert">{renameError}</div>}
              </div>
            )}
            <div className="modal-actions">
              <button onClick={() => { setRenameTarget(null); setRenameMergeConfirm(false); }} className="btn btn-secondary" disabled={submitting}>Batal</button>
              <button onClick={handleRenameConfirm} className="btn btn-primary" disabled={submitting}>
                {submitting ? "Menyimpan..." : renameMergeConfirm ? "Ya, Gabungkan" : "✓ Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Item Confirm Modal ── */}
      {deleteTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="del-item-title">
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div className="delete-icon-circle">
                <Icon name="trash" size={24} color="#ef4444" />
              </div>
              <h3 id="del-item-title" className="modal-title">Hapus Item?</h3>
              <p className="modal-body" style={{ lineHeight: 1.6 }}>
                Ini akan <strong>menghapus permanen {deleteTarget.txCount} transaksi</strong> yang
                mengandung item ini. Stok, laporan, dan piutang/hutang terkait akan ikut terhapus.
                <br />
                <strong style={{ color: "#ef4444" }}>Tidak dapat dibatalkan.</strong>
              </p>
            </div>
            <div className="delete-tx-summary">
              <div className="delete-tx-name">{deleteTarget.itemName}</div>
              <div className="delete-tx-meta">{deleteTarget.txCount} transaksi akan dihapus</div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary">Batal</button>
              <button onClick={handleDeleteConfirm} className="btn btn-danger">🗑 Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="page-header">
        <h2 className="page-title">Inventaris Stok</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {isToday && (
            <button
              onClick={() => { setCatalogForm({ name: "", defaultUnit: "karung", subtypes: [] }); setCatalogFormError(""); setTimeout(() => catalogNameRef.current?.focus(), 50); }}
              className="btn btn-primary"
              aria-label="Tambah item baru ke katalog"
            >
              ＋ Tambah Item Baru
            </button>
          )}
          <button onClick={() => setShowCategoryModal(true)} className="btn btn-outline" aria-label="Kelola kategori barang">
            <Icon name="adjust" size={14} color="#007bff" /> Kelola Kategori
          </button>
          <button onClick={onStockReport} className="btn btn-outline" aria-label="Cetak laporan stok">
            <Icon name="reports" size={14} color="#007bff" /> Laporan Stok
          </button>
        </div>
      </div>

      {/* ── Date navigation bar ── */}
      <div className="inventory-date-nav">
        <span className="inventory-date-nav__label">📅 Melihat stok per tanggal:</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setInventoryDate((d) => addDays(d, -1) || d)}
            className="inventory-date-nav__btn"
            aria-label="Hari sebelumnya"
          >
            ← Sebelumnya
          </button>
          <div style={{ position: "relative" }}>
            <span
              className="inventory-date-nav__date"
              onClick={() => dateInputRef.current?.showPicker?.()}
              title="Klik untuk memilih tanggal"
              style={{ cursor: "pointer" }}
            >
              {fmtDateLong(inventoryDate)}
            </span>
            <input
              ref={dateInputRef}
              type="date"
              value={inventoryDate}
              max={today()}
              onChange={(e) => e.target.value && setInventoryDate(e.target.value)}
              style={{ position: "absolute", opacity: 0, width: 1, height: 1, top: 0, left: 0, pointerEvents: "none" }}
              aria-label="Pilih tanggal inventaris"
              tabIndex={-1}
            />
          </div>
          <button
            onClick={() => setInventoryDate((d) => addDays(d, 1) || d)}
            className="inventory-date-nav__btn"
            disabled={isToday}
            aria-label="Hari berikutnya"
          >
            Berikutnya →
          </button>
        </div>
        <button
          onClick={() => setInventoryDate(today())}
          disabled={isToday}
          className="inventory-date-nav__btn inventory-date-nav__btn--today"
          aria-label="Kembali ke hari ini"
        >
          Hari Ini
        </button>
      </div>

      {/* ── Historical date banner ── */}
      {!isToday && (
        <div className="inventory-historical-banner">
          <Icon name="warning" size={14} color="#d97706" />
          Menampilkan stok historis per <strong style={{ margin: "0 4px" }}>{fmtDate(inventoryDate)}</strong> — bukan stok terkini
        </div>
      )}

      {/* ── Alert banners ── */}
      {negItems.length > 0 && (
        <div className="alert-banner alert-banner--danger" role="alert">
          <Icon name="warning" size={16} color="#ef4444" />
          <span>
            <strong>{negItems.length} item stok negatif:</strong>{" "}
            {negItems.map((it) => it.displayName).join(", ")}
          </span>
        </div>
      )}
      {lowItems.length > 0 && (
        <div className="alert-banner alert-banner--warning" role="alert">
          <Icon name="warning" size={16} color="#d97706" />
          <span>
            <strong>{lowItems.length} item hampir habis (≤{threshold}):</strong>{" "}
            {lowItems.map((it) => it.displayName).join(", ")}
          </span>
        </div>
      )}

      {/* ── Summary Dashboard Cards ── */}
      <div className="summary-grid summary-grid--3" style={{ marginBottom: 18 }}>
        {[
          {
            l: "Total Jenis Barang",
            sub: "Item unik di inventaris",
            v: items.length,
            fmt: (v) => `${v} item`,
            c: "#007bff",
          },
          {
            l: "Total Karung di Gudang",
            sub: "Jumlah seluruh stok",
            v: items.reduce((sum, it) => sum + (it.qty > 0 ? it.qty : 0), 0),
            fmt: (v) => `${Number(v).toLocaleString("id-ID")} karung`,
            c: "#10b981",
          },
          {
            l: "Stok Menipis",
            sub: `Stok ≤ ${threshold} karung`,
            v: lowItems.length + negItems.length,
            fmt: (v) => `${v} item`,
            c: lowItems.length + negItems.length > 0 ? "#f59e0b" : "#10b981",
          },
        ].map((x) => (
          <div key={x.l} className="summary-card" style={{ borderBottom: `4px solid ${x.c}`, textAlign: "center" }}>
            <div className="summary-card__label">{x.l}</div>
            <div className="summary-card__value" style={{ color: x.c }}>{x.fmt(x.v)}</div>
            <div className="summary-card__sub">
              {x.sub}
              {!isToday && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>per {fmtDate(inventoryDate)}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Search / Sort bar ── */}
      <div className="inventory-search-sort">
        <div className="search-wrap" style={{ flex: 1, marginBottom: 0 }}>
          <div className="search-icon"><Icon name="search" size={14} color="#9ca3af" /></div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari barang atau tipe..."
            className="search-input"
            aria-label="Cari item inventaris"
          />
        </div>
        <select
          value={sortBy + ":" + sortDir}
          onChange={(e) => {
            const [by, dir] = e.target.value.split(":");
            setSortBy(by); setSortDir(dir);
          }}
          className="sort-select"
          aria-label="Urutan tampilan"
        >
          <option value="name:asc">Nama A–Z</option>
          <option value="name:desc">Nama Z–A</option>
          <option value="qty:desc">Stok Terbanyak</option>
          <option value="qty:asc">Stok Tersedikit</option>
        </select>
      </div>

      {/* ── Inventory Table ── */}
      {tableGroups.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
          <div>{search ? "Tidak ada barang yang cocok dengan pencarian." : "Belum ada barang di katalog."}</div>
          {!search && isToday && (
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => { setCatalogForm({ name: "", defaultUnit: "karung", subtypes: [] }); setCatalogFormError(""); setTimeout(() => catalogNameRef.current?.focus(), 50); }}
            >
              ＋ Tambah Barang Pertama
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="th-center">Stok</th>
                <th className="th-center">Terakhir</th>
                <th className="th-center">Transaksi</th>
                <th className="th-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tableGroups.map((group) => {
                // Find catalog item matching this group — used for "+ Tambah Tipe" on the header.
                // Only shown when viewing today (not historical dates).
                const groupCatalogItem = isToday
                  ? itemCatalog.find((c) => normItem(c.name) === normItem(group.groupName)) || null
                  : null;
                return (
                  <React.Fragment key={group.groupName}>
                    {/* Group header row */}
                    <tr className="inventory-group-header">
                      <td colSpan={5}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>{group.groupName} — {group.code}</span>
                          {groupCatalogItem && (
                            <button
                              className="category-add-subtype-btn"
                              onClick={() => {
                                setAddSubtypeTarget(
                                  addSubtypeTarget === groupCatalogItem.id ? null : groupCatalogItem.id
                                );
                                setAddSubtypeInput("");
                                setAddSubtypeError("");
                              }}
                              aria-label={`Tambah tipe untuk ${groupCatalogItem.name}`}
                            >
                              + Tambah Tipe
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Inline add-subtype form — appears below the header, above item rows */}
                    {groupCatalogItem && addSubtypeTarget === groupCatalogItem.id && (
                      <tr className="payment-history-row">
                        <td colSpan={5} className="payment-history-cell">
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px" }}>
                            <input
                              ref={addSubtypeInputRef}
                              value={addSubtypeInput}
                              onChange={(e) => { setAddSubtypeInput(e.target.value); setAddSubtypeError(""); }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); handleAddSubtype(groupCatalogItem); }
                                if (e.key === "Escape") { setAddSubtypeTarget(null); setAddSubtypeInput(""); setAddSubtypeError(""); }
                              }}
                              placeholder="Nama tipe baru..."
                              style={{ padding: "5px 10px", border: `1.5px solid ${addSubtypeError ? "#ef4444" : "#c7ddf7"}`, borderRadius: 8, fontSize: 13, minWidth: 160 }}
                              aria-label="Nama tipe baru"
                            />
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleAddSubtype(groupCatalogItem)}
                              disabled={submitting}
                            >
                              Simpan
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => { setAddSubtypeTarget(null); setAddSubtypeInput(""); setAddSubtypeError(""); }}
                            >
                              Batal
                            </button>
                            {addSubtypeError && (
                              <span className="field-error" style={{ margin: 0 }}>{addSubtypeError}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Item rows */}
                    {group.items.map((row) => (
                      <React.Fragment key={row.key}>
                        <tr className={expandedStockItem === row.key ? "row-alt" : undefined}>
                          <td>{row.displayName}</td>
                          <td className="td-center">
                            <StockChip qty={row.qty} unit={row.unit} threshold={threshold} />
                          </td>
                          <td className="td-center whitespace-nowrap" style={{ fontSize: 11, color: "#6b7280" }}>
                            {row.lastDate
                              ? `${fmtDate(row.lastDate)}${row.lastTime ? ` · ${row.lastTime}` : ""}`
                              : "—"}
                          </td>
                          <td className="td-center" style={{ fontSize: 12, color: "#6b7280" }}>
                            {row.txCount > 0 ? `${row.txCount} tx` : "—"}
                          </td>
                          <td className="td-center">
                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                              {/* 1. Riwayat Stok */}
                              <button
                                onClick={() => toggleLedger(row.key)}
                                className={`action-btn${expandedStockItem === row.key ? " action-btn--history-active" : " action-btn--history"}`}
                                title="Riwayat Stok"
                                aria-label={`Riwayat stok ${row.displayName}`}
                                aria-expanded={expandedStockItem === row.key}
                              >
                                <Icon name="clock" size={13} color={expandedStockItem === row.key ? "#fff" : "#007BFF"} />
                                {(adjCountMap[row.key] || 0) > 0 && (
                                  <span className="action-btn--history-badge">{adjCountMap[row.key]}</span>
                                )}
                              </button>
                              {/* 2. Sesuaikan */}
                              {isToday && (
                                <button
                                  onClick={() => openAdj(row.displayName, row.unit)}
                                  className="action-btn action-btn--adjust"
                                  title="Sesuaikan Stok"
                                  aria-label={`Sesuaikan stok ${row.displayName}`}
                                >
                                  <Icon name="adjust" size={13} color="#10b981" />
                                </button>
                              )}
                              {/* 3. Lihat Laporan */}
                              <button
                                onClick={() => onViewItem(row.displayName)}
                                className="action-btn"
                                title="Lihat Laporan"
                                aria-label={`Lihat laporan ${row.displayName}`}
                              >
                                <Icon name="reports" size={13} color="#6366f1" />
                              </button>
                              {/* 4. Ubah Nama */}
                              {isToday && (
                                <button
                                  onClick={() => openRename(row.displayName, row.unit)}
                                  className="action-btn action-btn--edit"
                                  title="Ubah Nama"
                                  aria-label={`Ubah nama ${row.displayName}`}
                                >
                                  <Icon name="edit" size={13} color="#007BFF" />
                                </button>
                              )}
                              {/* 5. Hapus — only for catalogued base items; uncatalogued rows have no delete */}
                              {isToday && row.catalogItem && (
                                <button
                                  onClick={() => setDeleteCatalogConfirm(row.catalogItem)}
                                  className="action-btn action-btn--delete"
                                  title="Hapus dari Katalog"
                                  aria-label={`Hapus ${row.displayName} dari katalog`}
                                >
                                  <Icon name="trash" size={13} color="#ef4444" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Ledger expansion row */}
                        {expandedStockItem === row.key && (
                          <tr className="payment-history-row">
                            <td colSpan={5} className="payment-history-cell">
                              {renderLedgerPanel()}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* ── Category Modal ── */}
      {showCategoryModal && (
        <CategoryModal
          categories={itemCategories}
          stockMap={stockMap}
          onSave={(cats) => { onUpdateCategories(cats); setShowCategoryModal(false); }}
          onClose={() => setShowCategoryModal(false)}
        />
      )}
    </div>
  );
};

export default Inventory;
