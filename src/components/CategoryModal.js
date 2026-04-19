/**
 * components/CategoryModal.js
 * Modal for managing item categories/groups.
 * Supports inline editing, HTML5 drag-and-drop (items between groups, group merge),
 * and auto-detection of categories for uncategorized items.
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import { autoDetectCategories, generateCodes } from "../utils/categoryUtils";
import { generateId, normalizeTitleCase, normItem } from "../utils/idGenerators";
import Icon from "./Icon";

/**
 * @param {{
 *   categories: Array,
 *   stockMap: Object,
 *   onSave: (categories: Array) => void,
 *   onClose: () => void
 * }} props
 */
const CategoryModal = ({ categories, stockMap, onSave, onClose }) => {
  // ── Local state ─────────────────────────────────────────────────────────────
  const [localCats, setLocalCats] = useState(() =>
    autoDetectCategories(stockMap, categories)
  );
  const [editingName, setEditingName] = useState(null);   // cat id or null
  const [nameError,   setNameError]   = useState(null);   // duplicate-name error message or null
  const [codeError,   setCodeError]   = useState(null);   // duplicate-code error message or null
  const [editingCode, setEditingCode] = useState(null);   // cat id or null
  const codeManuallyEdited = useRef(new Set());
  const [dragItem, setDragItem] = useState(null);          // { type, itemName?, sourceGroupId?, groupId? }
  const [dragOverTarget, setDragOverTarget] = useState(null); // group id
  const [dirty, setDirty] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const nameInputRef = useRef(null);
  const codeInputRef = useRef(null);
  const newGroupRef  = useRef(null); // id of newly created group to auto-focus

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Auto-focus name input when editing starts or new group created
  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);
  useEffect(() => {
    if (editingCode && codeInputRef.current) codeInputRef.current.focus();
  }, [editingCode]);
  useEffect(() => {
    if (newGroupRef.current) {
      setEditingName(newGroupRef.current);
      newGroupRef.current = null;
    }
  }, [localCats]);

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
    const isDuplicate = localCats.some(
      (c) => c.id !== catId && normItem(c.groupName) === normItem(trimmed)
    );
    if (isDuplicate) {
      setNameError("Nama kategori sudah ada");
      return; // keep editing — don't exit, don't revert
    }
    setNameError(null);
    setEditingName(null);
    setLocalCats((prev) => {
      const updated = prev.map((c) =>
        c.id === catId ? { ...c, groupName: trimmed } : c
      );
      return regenerateAllCodes(updated);
    });
    setDirty(true);
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
    const isDuplicateCode = trimmed && localCats.some(
      (c) => c.id !== catId && c.code === trimmed
    );
    if (isDuplicateCode) {
      setCodeError("Kode ini sudah dipakai oleh kategori lain");
      return; // keep editing — do not close, do not save
    }
    setCodeError(null);
    setEditingCode(null);
    codeManuallyEdited.current.add(catId);
    setLocalCats((prev) => {
      // First apply the edit to the target group
      const withEdit = prev.map((c) => (c.id === catId ? { ...c, code: trimmed } : c));
      // Cascade: find the edited group's name, then update any child group whose
      // name starts with that name + " " (case-insensitive prefix match).
      const editedGroup = withEdit.find((c) => c.id === catId);
      if (!editedGroup) return withEdit;
      const editedName = editedGroup.groupName;
      const editedCode = trimmed;
      const normEdited = normItem(editedName);
      return withEdit.map((c) => {
        if (c.id === catId) return c;
        const normChild = normItem(c.groupName);
        if (!normChild.startsWith(normEdited + " ")) return c;
        // Child found — derive its new code from the parent's new code
        const remainingWords = c.groupName.slice(editedName.length).trim().split(/\s+/);
        const suffix = remainingWords.map((w) => w[0].toUpperCase()).join("");
        // Remove child from manual-edit set so it tracks the parent going forward
        codeManuallyEdited.current.delete(c.id);
        return { ...c, code: editedCode + suffix };
      });
    });
    setDirty(true);
  };

  const handleCodeKeyDown = (e, catId) => {
    if (e.key === "Enter") commitCode(catId, e.target.value);
    if (e.key === "Escape") { setEditingCode(null); setCodeError(null); }
  };

  // ── Drag & Drop: items ──────────────────────────────────────────────────────
  const handleItemDragStart = (e, itemName, sourceGroupId) => {
    setDragItem({ type: "item", itemName, sourceGroupId });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemName);
  };

  // ── Drag & Drop: groups (merge) ────────────────────────────────────────────
  const handleGroupDragStart = (e, groupId) => {
    setDragItem({ type: "group", groupId });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", groupId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e, targetGroupId) => {
    e.preventDefault();
    if (!dragItem) return;
    // Don't highlight self
    if (dragItem.type === "item" && dragItem.sourceGroupId === targetGroupId) return;
    if (dragItem.type === "group" && dragItem.groupId === targetGroupId) return;
    setDragOverTarget(targetGroupId);
  };

  const handleDragLeave = (e, targetGroupId) => {
    // Only clear if actually leaving the group element (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dragOverTarget === targetGroupId) setDragOverTarget(null);
    }
  };

  const handleDrop = (e, targetGroupId) => {
    e.preventDefault();
    setDragOverTarget(null);
    if (!dragItem) return;

    if (dragItem.type === "item") {
      const { itemName, sourceGroupId } = dragItem;
      if (sourceGroupId === targetGroupId) { setDragItem(null); return; }

      setLocalCats((prev) => {
        let updated = prev.map((c) => {
          if (c.id === sourceGroupId) {
            return { ...c, items: c.items.filter((i) => i !== itemName) };
          }
          if (c.id === targetGroupId) {
            return { ...c, items: [...c.items, itemName] };
          }
          return c;
        });
        // Remove source group if it became empty
        updated = updated.filter((c) => c.items.length > 0 || c.id === targetGroupId);
        return updated;
      });
      setDirty(true);
    }

    if (dragItem.type === "group") {
      const { groupId } = dragItem;
      if (groupId === targetGroupId) { setDragItem(null); return; }

      setLocalCats((prev) => {
        const source = prev.find((c) => c.id === groupId);
        if (!source) return prev;
        const updated = prev.map((c) => {
          if (c.id === targetGroupId) {
            return { ...c, items: [...c.items, ...source.items] };
          }
          return c;
        });
        return updated.filter((c) => c.id !== groupId);
      });
      setDirty(true);
    }

    setDragItem(null);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverTarget(null);
  };

  // ── Delete group → items become uncategorized ───────────────────────────────
  // Orphaned items appear in the "Belum Dikategorikan" section at the bottom,
  // so the user sees the delete took effect. They can drag items into other
  // groups or click "Buat Kategori Baru" to re-group them.
  const deleteGroup = (catId) => {
    setLocalCats((prev) => prev.filter((c) => c.id !== catId));
    setDirty(true);
  };

  // ── Create new empty category ──────────────────────────────────────────────
  const createNewCategory = () => {
    const newId = generateId();
    newGroupRef.current = newId;
    setLocalCats((prev) => [
      ...prev,
      { id: newId, groupName: "", code: "", items: [] },
    ]);
    setDirty(true);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = () => {
    // Filter out groups with no items AND no name (abandoned empty groups)
    const cleaned = localCats.filter((c) => c.items.length > 0 || c.groupName.trim());
    onSave(cleaned);
  };

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const handleCancel = () => {
    if (dirty) {
      setShowConfirmCancel(true);
      return;
    }
    onClose();
  };

  // ── Compute uncategorized items (safety net) ────────────────────────────────
  const allCategorizedItems = new Set();
  for (const c of localCats) {
    for (const item of c.items) allCategorizedItems.add(item);
  }
  const uncategorizedItems = Object.keys(stockMap).filter(
    (k) => !allCategorizedItems.has(k)
  );

  // ── Determine drag highlight class per group ────────────────────────────────
  const getGroupClassName = (catId) => {
    const base = "cat-modal__group";
    if (dragOverTarget !== catId) return base;
    if (dragItem && dragItem.type === "group") return `${base} cat-modal__group--merge-target`;
    return `${base} cat-modal__group--drag-over`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cat-modal-title">
      <div className="modal-box" style={{ maxWidth: 700 }}>
        {/* Header */}
        <div className="cat-modal__header">
          <h3 id="cat-modal-title" className="modal-title">Kelola Kategori Barang</h3>
          <p className="modal-body">
            Atur kategori untuk mengelompokkan item di laporan stok.
            Seret item antar grup, atau seret grup ke grup lain untuk menggabungkan.
          </p>
        </div>

        {/* Body */}
        <div className="cat-modal__body">
          {localCats.map((cat) => (
            <div
              key={cat.id}
              className={getGroupClassName(cat.id)}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, cat.id)}
              onDragLeave={(e) => handleDragLeave(e, cat.id)}
              onDrop={(e) => handleDrop(e, cat.id)}
            >
              {/* Group header */}
              <div className="cat-modal__group-header">
                {/* Drag handle for group merge */}
                <span
                  className="cat-modal__group-drag"
                  draggable="true"
                  onDragStart={(e) => handleGroupDragStart(e, cat.id)}
                  onDragEnd={handleDragEnd}
                  title="Seret ke grup lain untuk menggabungkan"
                >
                  ⠿
                </span>

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

                {/* Delete group */}
                <button
                  className="cat-modal__group-delete"
                  draggable="false"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); deleteGroup(cat.id); }}
                  title="Hapus kategori"
                  aria-label={`Hapus kategori ${cat.groupName}`}
                >
                  <Icon name="trash" size={14} color="currentColor" />
                </button>
              </div>

              {/* Items */}
              {cat.items.length > 0 && (
                <div className="cat-modal__group-items">
                  {cat.items.map((normName) => (
                    <span
                      key={normName}
                      className={`cat-modal__item-pill${
                        dragItem && dragItem.type === "item" && dragItem.itemName === normName
                          ? " cat-modal__item-pill--dragging"
                          : ""
                      }`}
                      draggable="true"
                      onDragStart={(e) => handleItemDragStart(e, normName, cat.id)}
                      onDragEnd={handleDragEnd}
                      title="Seret ke grup lain"
                    >
                      {getDisplayName(normName)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Uncategorized safety net */}
          {uncategorizedItems.length > 0 && (
            <div className="cat-modal__group cat-modal__group--uncategorized">
              <div className="cat-modal__group-header">
                <span className="cat-modal__group-name" style={{ fontStyle: "italic" }}>
                  Belum Dikategorikan
                </span>
                <span className="cat-modal__group-count">
                  {uncategorizedItems.length} item
                </span>
              </div>
              <div className="cat-modal__group-items">
                {uncategorizedItems.map((normName) => (
                  <span
                    key={normName}
                    className={`cat-modal__item-pill${
                      dragItem && dragItem.type === "item" && dragItem.itemName === normName
                        ? " cat-modal__item-pill--dragging"
                        : ""
                    }`}
                    draggable="true"
                    onDragStart={(e) => handleItemDragStart(e, normName, "__uncategorized")}
                    onDragEnd={handleDragEnd}
                    title="Seret ke grup lain"
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
          <button onClick={createNewCategory} className="btn btn-outline btn-sm">
            ＋ Buat Kategori Baru
          </button>
          <div className="cat-modal__footer-actions">
            <button onClick={handleCancel} className="btn btn-secondary">
              Batal
            </button>
            <button onClick={handleSave} className="btn btn-primary">
              Simpan
            </button>
          </div>
        </div>

        {/* Confirm cancel overlay */}
        {showConfirmCancel && (
          <div
            className="modal-overlay"
            style={{ zIndex: 1100, position: "absolute", inset: 0, borderRadius: "inherit" }}
            onClick={() => setShowConfirmCancel(false)}
          >
            <div className="modal-box" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <Icon name="warning" size={28} color="#f59e0b" />
                <h3 className="modal-title" style={{ marginTop: 8 }}>Batalkan Perubahan?</h3>
                <p className="modal-body">Perubahan yang belum disimpan akan hilang.</p>
              </div>
              <div className="modal-actions">
                <button onClick={() => setShowConfirmCancel(false)} className="btn btn-outline">
                  Kembali
                </button>
                <button onClick={onClose} className="btn btn-danger">
                  Ya, Batalkan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryModal;
