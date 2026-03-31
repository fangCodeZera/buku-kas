/**
 * pages/ArchivedItems.js
 * Shows all archived catalog items (fully archived base items and individually
 * archived subtypes). Users can restore items or permanently delete 0-tx items.
 */
import React, { useState, useMemo, useEffect } from "react";
import Toast from "../components/Toast";
import Icon from "../components/Icon";
import { normItem } from "../utils/idGenerators";

/**
 * @param {{
 *   itemCatalog: Array,
 *   stockMap: Object,
 *   transactions: Array,
 *   onUnarchiveCatalogItem: (id: string) => void,
 *   onUnarchiveSubtype: (id: string, subtypeName: string) => void,
 *   onDeleteCatalogItem: (id: string) => void,
 *   onViewItem: (itemName: string) => void,
 *   onBack: () => void,
 * }} props
 */
const ArchivedItems = ({
  itemCatalog        = [],
  stockMap           = {},
  transactions       = [],
  onUnarchiveCatalogItem = () => {},
  onUnarchiveSubtype     = () => {},
  onDeleteCatalogItem    = () => {},
  onViewItem             = () => {},
  onBack                 = () => {},
}) => {
  const [search,        setSearch]        = useState("");
  const [toast,         setToast]         = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type, id, subtypeId, subtypeName, parentName, displayName }
  const [submitting,    setSubmitting]    = useState(false);

  // Escape closes confirm dialog
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && deleteConfirm) setDeleteConfirm(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deleteConfirm]);

  // Transaction count per normalized item name — for permanent-delete eligibility
  const txCountMap = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      const itemList = Array.isArray(t.items) && t.items.length > 0
        ? t.items : [{ itemName: t.itemName }];
      for (const it of itemList) {
        if (!it.itemName) continue;
        const key = normItem(it.itemName);
        map[key] = (map[key] || 0) + 1;
      }
    }
    return map;
  }, [transactions]);

  // Flat list of archived entries — each item (base or subtype) is independent.
  // Archiving a base item does NOT affect its subtypes; both paths run for every catalog entry.
  const archivedRows = useMemo(() => {
    const rows = [];
    for (const cat of itemCatalog) {
      // Archived base item — its own row, independent of subtypes
      if (cat.archived) {
        const key    = normItem(cat.name);
        const cnt    = txCountMap[key] || 0;
        rows.push({
          key:         `base-${cat.id}`,
          displayName: cat.name,
          type:        "base",
          catalogId:   cat.id,
          hasTx:       cnt > 0,
          txCount:     cnt,
        });
      }

      // Archived subtypes — each its own row, regardless of base archived status
      for (const sub of (cat.archivedSubtypes || [])) {
        const fullName = `${cat.name} ${sub}`;
        const key      = normItem(fullName);
        const cnt      = txCountMap[key] || 0;
        rows.push({
          key:         `sub-${cat.id}-${normItem(sub)}`,
          displayName: fullName,
          subtitle:    `(diarsipkan dari ${cat.name})`,
          type:        "subtype",
          catalogId:   cat.id,
          subtypeName: sub,
          parentName:  cat.name,
          hasTx:       cnt > 0,
          txCount:     cnt,
        });
      }
    }
    return rows;
  }, [itemCatalog, txCountMap]);

  // Filtered by search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? archivedRows.filter((r) => r.displayName.toLowerCase().includes(q)) : archivedRows;
  }, [archivedRows, search]);

  const handleRestore = (row) => {
    if (row.type === "base") {
      onUnarchiveCatalogItem(row.catalogId);
      setToast(`${row.displayName} dikembalikan ke katalog aktif`);
    } else {
      onUnarchiveSubtype(row.catalogId, row.subtypeName);
      setToast(`${row.displayName} dikembalikan ke katalog aktif`);
    }
  };

  const handleDeletePermanent = (row) => {
    setDeleteConfirm({
      type:        row.type,
      catalogId:   row.catalogId,
      subtypeName: row.subtypeName || null,
      displayName: row.displayName,
    });
  };

  const handleConfirmDelete = () => {
    if (submitting || deleteConfirm.type !== "base") return;
    setSubmitting(true);
    const { displayName } = deleteConfirm;
    onDeleteCatalogItem(deleteConfirm.catalogId);
    setToast(`${displayName} dihapus permanen dari katalog`);
    setDeleteConfirm(null);
    setSubmitting(false);
  };

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <button
            onClick={onBack}
            className="btn btn-outline btn-sm"
            style={{ marginBottom: 8 }}
            aria-label="Kembali ke Inventaris"
          >
            ← Kembali ke Inventaris
          </button>
          <h2 className="page-title">📦 Arsip Barang</h2>
          <p className="section-subtitle" style={{ marginTop: 4 }}>
            Barang yang diarsipkan tidak muncul di pilihan transaksi. Data transaksi lama tetap tersimpan.
          </p>
        </div>
      </div>

      {/* ── Search ── */}
      {archivedRows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari barang diarsipkan..."
            className="search-input"
            style={{ maxWidth: 360 }}
            aria-label="Cari barang diarsipkan"
          />
        </div>
      )}

      {/* ── Empty state ── */}
      {archivedRows.length === 0 && (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <p>Belum ada barang yang diarsipkan.</p>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            Barang dengan riwayat transaksi akan masuk arsip saat dihapus dari katalog aktif.
          </p>
        </div>
      )}

      {/* ── No search results ── */}
      {archivedRows.length > 0 && filtered.length === 0 && (
        <div className="empty-state">
          Tidak ada hasil untuk "<strong>{search}</strong>"
        </div>
      )}

      {/* ── Archived item list ── */}
      {filtered.length > 0 && (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Barang</th>
                <th className="th-center">Jumlah Transaksi</th>
                <th className="th-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.key}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.displayName}</div>
                    {row.subtitle && (
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                        {row.subtitle}
                      </div>
                    )}
                  </td>
                  <td className="td-center">
                    <span style={{ fontSize: 13, color: row.txCount > 0 ? "#007bff" : "#9ca3af" }}>
                      {row.txCount > 0 ? `${row.txCount} transaksi` : "Belum ada"}
                    </span>
                  </td>
                  <td className="td-center">
                    <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => onViewItem(row.displayName)}
                        className="btn btn-sm btn-outline"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                        title={`Lihat laporan ${row.displayName}`}
                        aria-label={`Lihat laporan ${row.displayName}`}
                      >
                        <Icon name="reports" size={13} /> Laporan
                      </button>
                      <button
                        onClick={() => handleRestore(row)}
                        className="btn btn-sm btn-paid"
                        aria-label={`Kembalikan ${row.displayName} ke katalog aktif`}
                      >
                        ↩ Kembalikan
                      </button>
                      {!row.hasTx && row.type === "base" && (
                        <button
                          onClick={() => handleDeletePermanent(row)}
                          className="btn btn-sm btn-danger"
                          aria-label={`Hapus permanen ${row.displayName}`}
                        >
                          Hapus Permanen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Permanent delete confirm ── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3 className="modal-title">Hapus Permanen?</h3>
            <div className="modal-body">
              <p>
                Hapus <strong>{deleteConfirm.displayName}</strong> secara permanen dari katalog?
              </p>
              <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
                Tindakan ini tidak dapat dibatalkan.
                Barang ini tidak memiliki transaksi sehingga aman untuk dihapus.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Batal</button>
              <button
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={submitting}
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
};

export default ArchivedItems;
