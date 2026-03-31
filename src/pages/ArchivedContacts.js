/**
 * pages/ArchivedContacts.js
 * Shows all archived contacts. Users can restore a contact or permanently
 * delete contacts that have no transactions.
 */
import React, { useState, useMemo, useEffect } from "react";
import Toast from "../components/Toast";

/**
 * @param {{
 *   contacts: Array,
 *   transactions: Array,
 *   onUnarchiveContact: (id: string) => void,
 *   onDeleteContact: (id: string) => void,
 *   onBack: () => void,
 * }} props
 */
const ArchivedContacts = ({
  contacts         = [],
  transactions     = [],
  onUnarchiveContact = () => {},
  onDeleteContact    = () => {},
  onBack             = () => {},
}) => {
  const [search,        setSearch]        = useState("");
  const [toast,         setToast]         = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // contact object
  const [submitting,    setSubmitting]    = useState(false);

  // Escape closes confirm dialog
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && deleteConfirm) setDeleteConfirm(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deleteConfirm]);

  // Transaction count per contact name
  const txCountMap = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (!t.counterparty) continue;
      const key = t.counterparty.toLowerCase().trim();
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [transactions]);

  const archivedContacts = useMemo(
    () => contacts.filter((c) => c.archived),
    [contacts]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? archivedContacts.filter((c) => c.name.toLowerCase().includes(q))
      : archivedContacts;
  }, [archivedContacts, search]);

  const handleRestore = (contact) => {
    onUnarchiveContact(contact.id);
    setToast(`${contact.name} berhasil dikembalikan ke daftar aktif`);
  };

  const handleConfirmDelete = () => {
    if (submitting || !deleteConfirm) return;
    setSubmitting(true);
    const { name } = deleteConfirm;
    onDeleteContact(deleteConfirm.id);
    setToast(`${name} berhasil dihapus permanen`);
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
            aria-label="Kembali ke Kontak"
          >
            ← Kembali ke Kontak
          </button>
          <h2 className="page-title">📦 Arsip Kontak</h2>
          <p className="section-subtitle" style={{ marginTop: 4 }}>
            Kontak yang diarsipkan tidak muncul di daftar kontak aktif atau pilihan klien.
          </p>
        </div>
      </div>

      {/* ── Search ── */}
      {archivedContacts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kontak diarsipkan..."
            className="search-input"
            style={{ maxWidth: 360 }}
            aria-label="Cari kontak diarsipkan"
          />
        </div>
      )}

      {/* ── Empty state ── */}
      {archivedContacts.length === 0 && (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <p>Belum ada kontak yang diarsipkan.</p>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            Kontak dengan riwayat transaksi akan masuk arsip saat dihapus dari daftar aktif.
          </p>
        </div>
      )}

      {/* ── No search results ── */}
      {archivedContacts.length > 0 && filtered.length === 0 && (
        <div className="empty-state">
          Tidak ada hasil untuk "<strong>{search}</strong>"
        </div>
      )}

      {/* ── Archived contact list ── */}
      {filtered.length > 0 && (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Kontak</th>
                <th className="th-center">Jumlah Transaksi</th>
                <th className="th-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const txCount = txCountMap[c.name.toLowerCase().trim()] || 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      {(c.email || c.phone) && (
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                          {c.email && <span style={{ marginRight: 8 }}>📧 {c.email}</span>}
                          {c.phone && <span>📞 {c.phone}</span>}
                        </div>
                      )}
                    </td>
                    <td className="td-center">
                      <span style={{ fontSize: 13, color: txCount > 0 ? "#007bff" : "#9ca3af" }}>
                        {txCount > 0 ? `${txCount} transaksi` : "Belum ada"}
                      </span>
                    </td>
                    <td className="td-center">
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button
                          onClick={() => handleRestore(c)}
                          className="btn btn-sm btn-paid"
                          aria-label={`Kembalikan ${c.name} ke daftar aktif`}
                        >
                          ↩ Kembalikan
                        </button>
                        {txCount === 0 && (
                          <button
                            onClick={() => setDeleteConfirm(c)}
                            className="btn btn-sm btn-danger"
                            aria-label={`Hapus permanen ${c.name}`}
                          >
                            Hapus Permanen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
                Hapus <strong>{deleteConfirm.name}</strong> secara permanen?
              </p>
              <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
                Kontak ini tidak memiliki transaksi sehingga aman untuk dihapus.
                Tindakan ini tidak dapat dibatalkan.
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

export default ArchivedContacts;
