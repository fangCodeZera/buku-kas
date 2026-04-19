// Phase 6: Activity Log page (Pemilik-only).
// Reads from the activity_log Supabase table via onLoadLog prop.
// Never writes — display only. All text in Indonesian.

import React, { useState, useEffect } from "react";
import { fmtDate, fmtIDR } from "../utils/idGenerators";

const ACTION_LABELS = {
  create:           "Dibuat",
  edit:             "Diubah",
  delete:           "Dihapus",
  payment:          "Pembayaran",
  stock_adjustment: "Penyesuaian Stok",
  login:            "Masuk",
  export:           "Ekspor",
  import:           "Impor",
};

const ACTION_COLORS = {
  create:           { bg: "#10b981", text: "#fff" },
  edit:             { bg: "#f59e0b", text: "#fff" },
  delete:           { bg: "#ef4444", text: "#fff" },
  payment:          { bg: "#007bff", text: "#fff" },
  stock_adjustment: { bg: "#6366f1", text: "#fff" },
  login:            { bg: "#6b7280", text: "#fff" },
  export:           { bg: "#6b7280", text: "#fff" },
  import:           { bg: "#6b7280", text: "#fff" },
};

const ENTITY_LABELS = {
  transaction:      "Transaksi",
  contact:          "Kontak",
  catalog_item:     "Katalog Barang",
  stock_adjustment: "Penyesuaian",
  settings:         "Pengaturan",
  auth:             "Autentikasi",
};

const ACTION_OPTIONS  = Object.entries(ACTION_LABELS).map(([v, l]) => ({ value: v, label: l }));
const ENTITY_OPTIONS  = Object.entries(ENTITY_LABELS).map(([v, l]) => ({ value: v, label: l }));

// Returns true for txnId format like "26-04-00023" (new entries).
// Old entries have internal IDs like "1775933722773-90vxehs" — those get truncated.
const isTxnId = (id) => /^\d{2}-\d{2}-\d{4,5}$/.test(id);

// Returns an array of { label, val } lines or null if nothing to show.
function formatChanges(changes, entityType) {
  if (!changes || typeof changes !== "object" || Object.keys(changes).length === 0) return null;
  if (entityType === "settings" || entityType === "auth") return null;

  const lines = [];
  const add = (label, val) => {
    if (val !== undefined && val !== null && val !== "") lines.push({ label, val: String(val) });
  };

  if (changes.type !== undefined)
    add("Jenis", changes.type === "income" ? "Penjualan" : "Pembelian");
  if (changes.items !== undefined)
    add("Barang", Array.isArray(changes.items) ? changes.items.join(", ") : changes.items);
  if (changes.value !== undefined)
    add("Nilai", fmtIDR(changes.value));
  if (changes.counterparty !== undefined)
    add("Kontak", changes.counterparty);
  if (changes.amount !== undefined)
    add("Jumlah", fmtIDR(changes.amount));
  if (changes.note !== undefined)
    add("Catatan", changes.note);
  if (changes.name !== undefined)
    add("Nama", changes.name);
  if (changes.itemName !== undefined)
    add("Barang", changes.itemName);
  if (changes.qty !== undefined)
    add("Jumlah", changes.qty > 0 ? `+${changes.qty}` : String(changes.qty));

  return lines.length > 0 ? lines : null;
}

function fmtTimestamp(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    const localDate = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
    const date = fmtDate(localDate);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${date} ${hh}:${mm}`;
  } catch {
    return ts;
  }
}

/**
 * @param {{ currentUser: object, profile: object, onLoadLog: function, onBack: function, onViewTransaction?: function }} props
 */
export default function ActivityLog({ currentUser, profile, onLoadLog, onBack, onViewTransaction }) {
  const [allLogs,      setAllLogs]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [error,        setError]        = useState(null);
  const [page,         setPage]         = useState(0);
  const [hasMore,      setHasMore]      = useState(false);
  const [filterAction,   setFilterAction]   = useState("");
  const [filterEntity,   setFilterEntity]   = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");

  const loadLogs = async (pageNum) => {
    if (pageNum === 0) {
      setLoading(true);
      setAllLogs([]);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const filters = { page: pageNum };
      if (filterAction)   filters.action     = filterAction;
      if (filterEntity)   filters.entityType = filterEntity;
      if (filterDateFrom) filters.dateFrom   = filterDateFrom;
      if (filterDateTo)   filters.dateTo     = filterDateTo;
      const { rows, hasMore: more } = await onLoadLog(filters);
      setAllLogs((prev) => pageNum === 0 ? rows : [...prev, ...rows]);
      setHasMore(more);
      setPage(pageNum);
    } catch (err) {
      setError(err.message || "Gagal memuat log aktivitas.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Reset to page 0 whenever any filter changes
  useEffect(() => {
    loadLogs(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAction, filterEntity, filterDateFrom, filterDateTo]);

  // Guard: only Pemilik may see this page
  if (profile?.role !== "owner") {
    return (
      <div className="page-content" style={{ padding: 32, color: "#ef4444" }}>
        Akses ditolak. Halaman ini hanya untuk Pemilik.
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={onBack} style={{ whiteSpace: "nowrap" }}>
          ← Kembali
        </button>
        <h2 style={{ margin: 0, color: "#1e3a5f", fontSize: "1.25rem", fontWeight: 700 }}>
          Log Aktivitas
        </h2>
      </div>

      {/* Filter bar */}
      <div className="filter-bar" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <select
          className="sort-select"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          style={{ minWidth: 160 }}
        >
          <option value="">Semua Aksi</option>
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          className="sort-select"
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
          style={{ minWidth: 180 }}
        >
          <option value="">Semua Entitas</option>
          {ENTITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <input
          type="date"
          className="date-input"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          title="Dari tanggal"
          style={{ minWidth: 140 }}
        />
        <input
          type="date"
          className="date-input"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          title="Sampai tanggal"
          style={{ minWidth: 140 }}
        />

        <button
          className="btn btn-outline btn-sm"
          onClick={() => { setFilterAction(""); setFilterEntity(""); setFilterDateFrom(""); setFilterDateTo(""); }}
        >
          Reset Filter
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>Memuat log...</div>
      )}

      {error && (
        <div className="alert-banner alert-banner--danger" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && !error && allLogs.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>
          Tidak ada log aktivitas yang cocok dengan filter ini.
        </div>
      )}

      {!loading && !error && allLogs.length > 0 && (
        <div className="table-card" style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", tableLayout: "auto" }}>
            <thead>
              <tr>
                <th style={{ minWidth: 150 }}>Waktu</th>
                <th style={{ minWidth: 120 }}>Pengguna</th>
                <th style={{ minWidth: 130 }}>Aksi</th>
                <th style={{ minWidth: 160 }}>Entitas</th>
                <th>Detail</th>
                <th style={{ minWidth: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {allLogs.map((log, i) => {
                const ac = ACTION_COLORS[log.action] || { bg: "#6b7280", text: "#fff" };
                const lines = formatChanges(log.changes, log.entity_type);
                const showLihat = log.entity_type === "transaction"
                  && log.action !== "delete"
                  && onViewTransaction;

                return (
                  <tr key={log.id || i} className={i % 2 === 1 ? "row-alt" : ""}>
                    {/* Waktu */}
                    <td className="td-date whitespace-nowrap">{fmtTimestamp(log.created_at)}</td>

                    {/* Pengguna */}
                    <td style={{ color: "#1e3a5f" }}>{log.user_name || "—"}</td>

                    {/* Aksi badge */}
                    <td>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: ac.bg,
                        color: ac.text,
                        whiteSpace: "nowrap",
                      }}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>

                    {/* Entitas */}
                    <td style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                      {ENTITY_LABELS[log.entity_type] || log.entity_type}
                      {log.entity_id && log.entity_id !== "null" && log.entity_id !== "undefined"
                        ? log.entity_type === "transaction"
                          ? <span style={{ fontSize: "0.78rem", color: "#6366f1", marginLeft: 4, fontWeight: 600 }}>
                              {isTxnId(log.entity_id)
                                ? `#${log.entity_id}`
                                : `#${String(log.entity_id).slice(-6)}`}
                            </span>
                          : <span style={{ fontSize: "0.72rem", color: "#9ca3af", marginLeft: 4 }}>
                              #{String(log.entity_id).slice(-6)}
                            </span>
                        : null}
                    </td>

                    {/* Detail */}
                    <td style={{ maxWidth: 280 }}>
                      {lines
                        ? lines.map((l, j) => (
                            <div key={j} style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>
                              <span style={{ color: "#9ca3af", marginRight: 4 }}>{l.label}:</span>
                              <span style={{ color: "#374151" }}>{l.val}</span>
                            </div>
                          ))
                        : <span style={{ color: "#9ca3af" }}>—</span>
                      }
                    </td>

                    {/* Lihat button */}
                    <td>
                      {showLihat && (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => onViewTransaction(log.entity_id)}
                          title="Lihat transaksi"
                          style={{ fontSize: 11, padding: "2px 8px", whiteSpace: "nowrap" }}
                        >
                          Lihat
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "8px 12px", color: "#9ca3af", fontSize: "0.8rem", borderTop: "1px solid #e5e7eb" }}>
            Menampilkan {allLogs.length} entri{hasMore && " — masih ada entri lebih lama"}
          </div>
        </div>
      )}

      {/* Load more button */}
      {!loading && !error && hasMore && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => loadLogs(page + 1)}
            disabled={loadingMore}
          >
            {loadingMore ? "Memuat..." : "Muat Lebih Banyak"}
          </button>
        </div>
      )}
    </div>
  );
}
