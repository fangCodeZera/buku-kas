/**
 * components/CategoryModal.js
 * Modal for managing item categories/groups.
 * Supports inline rename of category name/code, archive-aware filtering,
 * and auto-detection of categories for uncategorized items.
 * Commit-immediately semantics: every rename persists via onSave() instantly.
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  autoDetectCategories, generateCodes,
  isDuplicateCategoryName, isDuplicateCategoryCode, cascadeCodeUpdate,
} from "../utils/categoryUtils";
import { normalizeTitleCase, normItem } from "../utils/idGenerators";

/**
 * @param {{
 *   categories: Array,
 *   stockMap: Object,
 *   onSave: (categories: Array) => void,
 *   onClose: () => void,
 *   itemCatalog?: Array
 * }} props
 */
const CategoryModal = ({ categories, stockMap, onSave, onClose, itemCatalog = [] }) => {
  // ── Derived display state — commit-immediately (no local staging) ────────────
  const displayCategories = useMemo(
    () => autoDetectCategories(stockMap, categories),
    [stockMap, categories]
  );
  const [editingName, setEditingName] = useState(null);   // cat id or null
  const [nameError,   setNameError]   = useState(null);   // duplicate-name error message or null
  const [codeError,   setCodeError]   = useState(null);   // duplicate-code error message or null
  const [editingCode, setEditingCode] = useState(null);   // cat id or null
  const codeManuallyEdited = useRef(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const nameInputRef = useRef(null);
  const codeInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Auto-focus name/code input when editing starts
  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);
  useEffect(() => {
    if (editingCode && codeInputRef.current) codeInputRef.current.focus();
  }, [editingCode]);

  // ── Archive-aware key sets ──────────────────────────────────────────────────
  // Both sets depend only on itemCatalog, not displayCategories.
  // Subtypes are evaluated independently of base archive status — matches Inventory.js lines 499–506.

  const archivedCatalogKeys = useMemo(() => {
    const set = new Set();
    for (const cat of itemCatalog) {
      if (cat.archived === true) set.add(normItem(cat.name));
      const archivedSubs = new Set((cat.archivedSubtypes || []).map(normItem));
      for (const sub of (cat.subtypes || [])) {
        if (archivedSubs.has(normItem(sub))) set.add(normItem(`${cat.name} ${sub}`));
      }
    }
    return set;
  }, [itemCatalog]);

  const activeCatalogKeys = useMemo(() => {
    const set = new Set();
    for (const cat of itemCatalog) {
      if (cat.archived === false) set.add(normItem(cat.name));
      const archivedSubs = new Set((cat.archivedSubtypes || []).map(normItem));
      for (const sub of (cat.subtypes || [])) {
        if (!archivedSubs.has(normItem(sub))) set.add(normItem(`${cat.name} ${sub}`));
      }
    }
    return set;
  }, [itemCatalog]);

  // One-shot orphan detection on mount — logs stale itemCategories keys with no catalog entry.
  useEffect(() => {
    const orphans = [];
    for (const cat of displayCategories) {
      for (const key of cat.items) {
        if (!activeCatalogKeys.has(key) && !archivedCatalogKeys.has(key)) {
          orphans.push({ key, groupName: cat.groupName });
        }
      }
    }
    if (orphans.length > 0) {
      console.warn("[CategoryModal] Detected orphan keys in itemCategories:", orphans);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount only

  // ── Helper: regenerate all non-manual codes ─────────────────────────────────
  const regenerateAllCodes = useCallback((cats) => {
    const allNames = cats.map((c) => c.groupName).filter(Boolean);
    const codeMap = generateCodes(allNames);
    return cats.map((c) => {
      if (codeManuallyEdited.current.has(c.id)) return c;
      const newCode = codeMap[c.groupName];
      return newCode != null ? { ...c, code: newCode } : c;
    });
  }, []);

  // ── Helper: get display name for a normalized item name ─────────────────────
  const getDisplayName = (normName) => {
    const entry = stockMap[normName];
    if (entry && entry.displayName) return entry.displayName;
    return normalizeTitleCase(normName);
  };

  // ── Inline editing: group name ──────────────────────────────────────────────
  const commitName = (catId, newName) => {
    const trimmed = newName.trim();
    // Duplicate check: stay in edit mode so the user can fix the name
    const isDuplicate = isDuplicateCategoryName(displayCategories, catId, trimmed);
    if (isDuplicate) {
      setNameError("Nama kategori sudah ada");
      return; // keep editing — don't exit, don't revert
    }
    setNameError(null);
    setEditingName(null);
    const updated = displayCategories.map((c) =>
      c.id === catId ? { ...c, groupName: trimmed } : c
    );
    onSave(regenerateAllCodes(updated));
  };

  const handleNameKeyDown = (e, catId) => {
    if (e.key === "Enter") commitName(catId, e.target.value);
    if (e.key === "Escape") { setEditingName(null); setNameError(null); }
  };

  // ── Inline editing: code ────────────────────────────────────────────────────
  const commitCode = (catId, newCode) => {
    const trimmed = newCode.trim().toUpperCase();
    // Duplicate check: if another group already uses this code, keep the
    // input open so the user can fix it (same pattern as commitName).
    const isDuplicateCode = isDuplicateCategoryCode(displayCategories, catId, trimmed);
    if (isDuplicateCode) {
      setCodeError("Kode ini sudah dipakai oleh kategori lain");
      return; // keep editing — do not close, do not save
    }
    setCodeError(null);
    setEditingCode(null);
    codeManuallyEdited.current.add(catId);
    const updated = cascadeCodeUpdate(displayCategories, catId, trimmed);
    // Clear manual-edit tracking for child categories that now follow parent
    const editedGroup = updated.find((c) => c.id === catId);
    if (editedGroup) {
      const normEdited = normItem(editedGroup.groupName);
      for (const c of updated) {
        if (c.id === catId) continue;
        if (normItem(c.groupName).startsWith(normEdited + " ")) {
          codeManuallyEdited.current.delete(c.id);
        }
      }
    }
    onSave(updated);
  };

  const handleCodeKeyDown = (e, catId) => {
    if (e.key === "Enter") commitCode(catId, e.target.value);
    if (e.key === "Escape") { setEditingCode(null); setCodeError(null); }
  };

  // ── Compute uncategorized items (safety net) ────────────────────────────────
  const allCategorizedItems = new Set();
  for (const c of displayCategories) {
    for (const item of c.items) allCategorizedItems.add(item);
  }
  const uncategorizedItems = Object.keys(stockMap).filter(
    (k) => !allCategorizedItems.has(k)
  );

  // Count archived keys hidden when toggle is off, across categories and uncategorized section.
  const hiddenArchivedCount = useMemo(() => {
    let count = 0;
    for (const cat of displayCategories) {
      for (const key of cat.items) {
        if (archivedCatalogKeys.has(key)) count++;
      }
    }
    for (const key of uncategorizedItems) {
      if (archivedCatalogKeys.has(key)) count++;
    }
    return count;
  }, [displayCategories, archivedCatalogKeys, stockMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered uncategorized items by toggle state.
  // Rule: archived keys are hidden when toggle is off; uncataloged-with-txs keys
  // (in neither set) are always shown — they're real items needing categorization.
  const filteredUncategorized = showArchived
    ? uncategorizedItems
    : uncategorizedItems.filter((k) => !archivedCatalogKeys.has(k));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cat-modal-title">
      <div className="modal-box" style={{ maxWidth: 700 }}>
        {/* Header */}
        <div className="cat-modal__header">
          <h3 id="cat-modal-title" className="modal-title">Kelola Kategori Barang</h3>
          <p className="modal-body">
            Atur kategori untuk mengelompokkan item di laporan stok.
            Klik nama atau kode untuk mengedit — perubahan disimpan otomatis.
          </p>
        </div>

        {/* Body */}
        <div className="cat-modal__body">
          {/* Archive visibility toggle */}
          <div className="cat-modal__archive-toggle">
            <label>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              <span>Tampilkan yang diarsipkan</span>
            </label>
            {!showArchived && hiddenArchivedCount > 0 && (
              <span className="cat-modal__archive-hint">
                ({hiddenArchivedCount} diarsipkan disembunyikan)
              </span>
            )}
          </div>

          {displayCategories.map((cat) => {
            // Filter visible items based on toggle state.
            // Orphan keys (in neither active nor archived sets) are always hidden — stale references.
            const visibleItems = cat.items.filter((key) =>
              showArchived
                ? activeCatalogKeys.has(key) || archivedCatalogKeys.has(key)
                : activeCatalogKeys.has(key)
            );
            // Hide entire group when all items filtered out, UNLESS name is being edited
            // (keep visible so the user can finish typing).
            if (visibleItems.length === 0 && editingName !== cat.id) return null;

            return (
              <div
                key={cat.id}
                className="cat-modal__group"
              >
                {/* Group header */}
                <div className="cat-modal__group-header">
                  {/* Group name */}
                  {editingName === cat.id ? (
                    <span style={{ position: "relative" }}>
                      <input
                        ref={nameInputRef}
                        className="cat-modal__group-name-input"
                        defaultValue={cat.groupName}
                        onBlur={(e) => commitName(cat.id, e.target.value)}
                        onKeyDown={(e) => handleNameKeyDown(e, cat.id)}
                        onChange={() => setNameError(null)}
                        placeholder="Nama kategori..."
                      />
                      {nameError && (
                        <span style={{
                          position: "absolute", top: "100%", left: 0,
                          fontSize: 11, color: "#ef4444", whiteSpace: "nowrap",
                          background: "#fff", padding: "2px 4px", borderRadius: 4,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.12)", zIndex: 10,
                        }}>
                          {nameError}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span
                      className="cat-modal__group-name"
                      onClick={() => { setEditingName(cat.id); setNameError(null); }}
                      title="Klik untuk edit nama"
                    >
                      {cat.groupName || "(tanpa nama)"}
                    </span>
                  )}

                  {/* Group code */}
                  {editingCode === cat.id ? (
                    <span style={{ position: "relative" }}>
                      <input
                        ref={codeInputRef}
                        className="cat-modal__group-code-input"
                        defaultValue={cat.code}
                        onBlur={(e) => commitCode(cat.id, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(e, cat.id)}
                        onChange={() => setCodeError(null)}
                        maxLength={6}
                        placeholder="KODE"
                      />
                      {codeError && (
                        <span style={{
                          position: "absolute", top: "100%", left: 0,
                          fontSize: 11, color: "#ef4444", whiteSpace: "nowrap",
                          background: "#fff", padding: "2px 4px", borderRadius: 4,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.12)", zIndex: 10,
                        }}>
                          {codeError}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span
                      className="cat-modal__group-code"
                      onClick={() => setEditingCode(cat.id)}
                      title="Klik untuk edit kode"
                    >
                      {cat.code || "—"}
                    </span>
                  )}

                  {/* Item count */}
                  <span className="cat-modal__group-count">
                    {cat.items.length} item
                  </span>
                </div>

                {/* Items */}
                {visibleItems.length > 0 && (
                  <div className="cat-modal__group-items">
                    {visibleItems.map((normName) => (
                      <span
                        key={normName}
                        className={`cat-modal__item-pill${archivedCatalogKeys.has(normName) ? " cat-modal__item-pill--archived" : ""}`}
                        title={archivedCatalogKeys.has(normName) ? "Item diarsipkan" : undefined}
                      >
                        {getDisplayName(normName)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Uncategorized safety net */}
          {filteredUncategorized.length > 0 && (
            <div className="cat-modal__group cat-modal__group--uncategorized">
              <div className="cat-modal__group-header">
                <span className="cat-modal__group-name" style={{ fontStyle: "italic" }}>
                  Belum Dikategorikan
                </span>
                <span className="cat-modal__group-count">
                  {filteredUncategorized.length} item
                </span>
              </div>
              <div className="cat-modal__group-items">
                {filteredUncategorized.map((normName) => (
                  <span
                    key={normName}
                    className={`cat-modal__item-pill${archivedCatalogKeys.has(normName) ? " cat-modal__item-pill--archived" : ""}`}
                    title={archivedCatalogKeys.has(normName) ? "Item diarsipkan" : undefined}
                  >
                    {getDisplayName(normName)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cat-modal__footer">
          <div className="cat-modal__footer-actions">
            <button onClick={onClose} className="btn btn-secondary">
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryModal;
