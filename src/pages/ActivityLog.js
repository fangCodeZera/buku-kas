// Phase 6: Activity Log page (Pemilik-only).
// Reads from the activity_log Supabase table via onLoadLog prop.
// Never writes — display only. All text in Indonesian.

import React, { useState, useEffect, useCallback } from "react";
import { fmtDate } from "../utils/idGenerators";

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

const ENTITY_LABELS = {
  transaction:      "Transaksi",
  contact:          "Kontak",
  catalog_item:     "Katalog Barang",
  stock_adjustment: "Penyesuaian",
  settings:         "Pengaturan",
  auth:             "Autentikasi",
};

const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([v, l]) => ({ value: v, label: l }));
const ENTITY_OPTIONS = Object.entries(ENTITY_LABELS).map(([v, l]) => ({ value: v, label: l }));

function fmtChanges(changes) {
  if (!changes || typeof changes !== "object" || Object.keys(changes).length === 0) return "—";
  return Object.entries(changes)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: [${v.join(", ")}]`;
      if (typeof v === "boolean") return `${k}: ${v ? "ya" : "tidak"}`;
      return `${k}: ${v}`;
    })
    .join(", ");
}

function fmtTimestamp(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    const date = fmtDate(d.toISOString().slice(0, 10));
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${date} ${hh}:${mm}`;
  } catch {
    return ts;
  }
}

/**
 * @param {{ currentUser: object, profile: object, onLoadLog: function, onBack: function }} props
 */
export default function ActivityLog({ currentUser, profile, onLoadLog, onBack }) {
  const [logs,            setLogs]           = useState([]);
  const [loading,         setLoading]        = useState(true);
  const [error,           setError]          = useState(null);
  const [filterAction,    setFilterAction]   = useState("");
  const [filterEntity,    setFilterEntity]   = useState("");
  const [filterDateFrom,  setFilterDateFrom] = useState("");
  const [filterDateTo,    setFilterDateTo]   = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {};
      if (filterAction)   filters.action     = filterAction;
      if (filterEntity)   filters.entityType = filterEntity;
      if (filterDateFrom) filters.dateFrom   = filterDateFrom;
      if (filterDateTo)   filters.dateTo     = filterDateTo;
      const rows = await onLoadLog(filters);
      setLogs(rows);
    } catch (err) {
      setError(err.message || "Gagal memuat log aktivitas.");
    } finally {
      setLoading(false);
    }
  }, [onLoadLog, filterAction, filterEntity, filterDateFrom, filterDateTo]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

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

      {!loading && !error && logs.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>
          Tidak ada log aktivitas yang cocok dengan filter ini.
        </div>
      )}

      {!loading && !error && logs.length > 0 && (
        <div className="table-card" style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", tableLayout: "auto" }}>
            <thead>
              <tr>
                <th style={{ minWidth: 150 }}>Waktu</th>
                <th style={{ minWidth: 120 }}>Pengguna</th>
                <th style={{ minWidth: 130 }}>Aksi</th>
                <th style={{ minWidth: 130 }}>Entitas</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id || i} className={i % 2 === 1 ? "row-alt" : ""}>
                  <td className="td-date whitespace-nowrap">{fmtTimestamp(log.created_at)}</td>
                  <td style={{ color: "#1e3a5f" }}>{log.user_name || "—"}</td>
                  <td>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: log.action === "delete" ? "#fee2e2"
                        : log.action === "create"          ? "#d1fae5"
                        : log.action === "login"           ? "#dbeafe"
                        : log.action === "export"          ? "#fef3c7"
                        : "#f3f4f6",
                      color: log.action === "delete" ? "#b91c1c"
                        : log.action === "create"    ? "#065f46"
                        : log.action === "login"     ? "#1e40af"
                        : log.action === "export"    ? "#92400e"
                        : "#374151",
                    }}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                    {ENTITY_LABELS[log.entity_type] || log.entity_type}
                    {log.entity_id && log.entity_id !== "null" && log.entity_id !== "undefined"
                      ? <span style={{ fontSize: "0.72rem", color: "#9ca3af", marginLeft: 4 }}>
                          #{String(log.entity_id).slice(-6)}
                        </span>
                      : null}
                  </td>
                  <td style={{ fontSize: "0.82rem", color: "#374151", maxWidth: 280, wordBreak: "break-word" }}>
                    {fmtChanges(log.changes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "8px 12px", color: "#9ca3af", fontSize: "0.8rem", borderTop: "1px solid #e5e7eb" }}>
            Menampilkan {logs.length} entri terbaru
          </div>
        </div>
      )}
    </div>
  );
}
