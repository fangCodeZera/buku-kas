/**
 * pages/Outstanding.js
 * Dedicated page for all transactions with outstanding balances.
 *
 * Two sections:
 *  - Piutang (AR): income tx where clients still owe us  (outstanding > 0)
 *  - Hutang  (AP): expense tx where we still owe suppliers (outstanding > 0)
 *
 * Fully synced with App.js data — no local copy, no duplication.
 * All mutations delegate upward (onEdit, onMarkPaid, onDelete, onInvoice).
 */
import React, { useState, useMemo, useEffect, useRef } from "react";
import { StatusBadge, TypeBadge } from "../components/Badge";
import DueBadge            from "../components/DueBadge";
import Icon                from "../components/Icon";
import Toast               from "../components/Toast";
import DeleteConfirmModal  from "../components/DeleteConfirmModal";
import PaymentUpdateModal  from "../components/PaymentUpdateModal";
import PaymentHistoryPanel from "../components/PaymentHistoryPanel";
import { fmtIDR, fmtDate, today, diffDays } from "../utils/idGenerators";
import { computePaymentProgress } from "../utils/paymentUtils";

// ─── Due-date badge imported from shared component ──────────────────────────────

const PAGE_SIZE = 50;

// ─── Sort options ─────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: "nearestDue",   label: "⏰ Jatuh Tempo Terdekat" },
  { value: "furthestDue",  label: "📅 Jatuh Tempo Terjauh" },
  { value: "smallestOut",  label: "⬆ Outstanding Terkecil" },
  { value: "largestOut",   label: "⬇ Outstanding Terbesar" },
];

/**
 * Sort a list of outstanding transactions by the given key.
 * null/undefined dueDates sort to the END (Infinity) for ascending,
 * and to the BEGINNING for descending (so they appear last either way).
 */
function sortTxs(txs, sortBy) {
  return [...txs].sort((a, b) => {
    try {
      if (sortBy === "nearestDue" || sortBy === "furthestDue") {
        const dateA = a.dueDate ? new Date(a.dueDate + "T00:00:00Z").getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate + "T00:00:00Z").getTime() : Infinity;
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return sortBy === "nearestDue" ? dateA - dateB : dateB - dateA;
      }
      if (sortBy === "smallestOut") return (a.outstanding || 0) - (b.outstanding || 0);
      if (sortBy === "largestOut")  return (b.outstanding || 0) - (a.outstanding || 0);
      return 0;
    } catch {
      return 0;
    }
  });
}

// ─── Section table ─────────────────────────────────────────────────────────────
function OutstandingTable({ txs, emptyMsg, onEdit, onMarkPaid, onDelete, onInvoice, highlightTxIds }) {
  const [deleteTx,     setDeleteTx]     = useState(null);
  const [paidTx,       setPaidTx]       = useState(null);
  const [toast,        setToast]        = useState(null);
  const [page,         setPage]         = useState(0);
  const [expandedTxId, setExpandedTxId] = useState(null);

  const firstHighlightRef = useRef(null);

  // Collapse expanded row when the user changes pages
  useEffect(() => { setExpandedTxId(null); }, [page]);

  // Scroll to first highlighted row
  useEffect(() => {
    if (highlightTxIds && highlightTxIds.length > 0 && firstHighlightRef.current) {
      firstHighlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightTxIds]);

  const totalPages = Math.max(1, Math.ceil(txs.length / PAGE_SIZE));
  const paginated  = txs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const confirmDelete = () => {
    onDelete(deleteTx.id);
    setDeleteTx(null);
    setToast("Transaksi berhasil dihapus");
  };

  if (txs.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "28px 0" }}>
        <div style={{ fontSize: 32, marginBottom: 6 }}>✅</div>
        <div style={{ color: "#6b7280", fontSize: 13 }}>{emptyMsg}</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th className="whitespace-nowrap">Tanggal</th>
              <th className="hidden md:table-cell">No. Invoice</th>
              <th>Klien</th>
              <th>Barang</th>
              <th className="th-center whitespace-nowrap">Jenis</th>
              <th className="th-right whitespace-nowrap">Nilai Total</th>
              <th className="th-right whitespace-nowrap">Outstanding</th>
              <th className="th-center whitespace-nowrap">Status</th>
              <th className="th-center hidden md:table-cell">Jatuh Tempo</th>
              <th className="th-center whitespace-nowrap">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((t, i) => {
              const isHighlighted = highlightTxIds && highlightTxIds.includes(t.id);
              return (
              <React.Fragment key={t.id}>
              <tr
                className={`${i % 2 === 0 ? "" : "row-alt"} ${isHighlighted ? "outstanding-row--highlighted" : ""}`}
                ref={isHighlighted ? (el) => { if (el && !firstHighlightRef.current) firstHighlightRef.current = el; } : undefined}
              >
                <td className="td-date whitespace-nowrap">
                  {fmtDate(t.date)}
                  <div className="text-muted" style={{ fontSize: 10 }}>{t.time}</div>
                </td>
                <td className="hidden md:table-cell" style={{ fontSize: 11, fontWeight: 600, color: t.type === "income" ? "#6366f1" : "#374151", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  {t.txnId || <span style={{ color: "#d1d5db" }}>—</span>}
                </td>
                <td className="td-name">{t.counterparty}</td>
                <td style={Array.isArray(t.items) && t.items.length > 1 ? { verticalAlign: "top" } : {}}>
                  {Array.isArray(t.items) && t.items.length > 1 ? (
                    <div className="item-list">
                      {t.items.map((item, idx) => (
                        <div key={idx} className="item-list__row">
                          <span className="item-list__bullet">•</span>
                          <span>{item.itemName}</span>
                        </div>
                      ))}
                      {t.notes && <div className="text-muted" style={{ fontSize: 10, marginTop: 4 }}>{t.notes}</div>}
                    </div>
                  ) : (
                    <>
                      {t.itemName}
                      {t.notes && (
                        <div className="text-muted" style={{ fontSize: 10 }}>{t.notes}</div>
                      )}
                    </>
                  )}
                </td>
                <td className="td-center"><TypeBadge type={t.type} /></td>
                <td className="td-right" style={{ color: t.type === "income" ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                  {fmtIDR(t.value)}
                </td>
                <td className="td-right" style={{ color: "#f59e0b", fontWeight: 700 }}>
                  {fmtIDR(t.outstanding)}
                  {(() => {
                    const prog = computePaymentProgress(t.value, t.outstanding);
                    if (!prog) return null;
                    const { percent: pct } = prog;
                    if (pct <= 0 || pct >= 100) return null;
                    return (
                      <div className="payment-progress-wrap" style={{ justifyContent: "flex-end" }}>
                        <div className="payment-progress-bar">
                          <div className="payment-progress-bar__fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="payment-progress-pct">{pct}% terbayar</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="td-center whitespace-nowrap"><StatusBadge status={t.status} /></td>
                <td className="td-center hidden md:table-cell">
                  <DueBadge dueDate={t.dueDate} outstanding={t.outstanding} />
                </td>
                <td className="td-center whitespace-nowrap">
                  <div className="action-btns" style={{ display: "flex", flexWrap: "nowrap" }}>
                    <button
                      onClick={() => onEdit(t)}
                      className="action-btn action-btn--edit"
                      title="Edit transaksi"
                      aria-label={`Edit ${t.itemName}`}
                    >
                      <Icon name="edit" size={12} color="#007bff" />
                    </button>
                    <button
                      onClick={() => onInvoice([t])}
                      className="action-btn action-btn--invoice"
                      title="Buat invoice"
                      aria-label={`Invoice untuk ${t.itemName}`}
                    >
                      <Icon name="invoice" size={12} color="#10b981" />
                    </button>
                    <button
                      onClick={() => setPaidTx(t)}
                      className="action-btn action-btn--paid"
                      title="Catat pembayaran"
                      aria-label={`Catat pembayaran untuk ${t.itemName}`}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setExpandedTxId((id) => id === t.id ? null : t.id)}
                      className="action-btn action-btn--history"
                      title="Lihat riwayat pembayaran"
                      aria-label={`Riwayat pembayaran ${t.itemName || (t.items?.[0]?.itemName ?? '')}`}
                    >
                      <Icon name="clock" size={12} color="#007BFF" />
                      {(t.paymentHistory || []).length > 1 && (
                        <span className="action-btn--history-badge" aria-label={`${(t.paymentHistory || []).length} riwayat pembayaran`}>{(t.paymentHistory || []).length}</span>
                      )}
                    </button>
                    <button
                      onClick={() => setDeleteTx(t)}
                      className="action-btn action-btn--delete"
                      title="Hapus transaksi"
                      aria-label={`Hapus ${t.itemName}`}
                    >
                      <Icon name="trash" size={12} color="#ef4444" />
                    </button>
                  </div>
                </td>
              </tr>
              {expandedTxId === t.id && (
                <tr className="payment-history-row">
                  <td colSpan={10} className="payment-history-cell">
                    <PaymentHistoryPanel transaction={t} onClose={() => setExpandedTxId(null)} />
                  </td>
                </tr>
              )}
              </React.Fragment>
            )})}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, padding: "12px 16px", borderTop: "1px solid #e2e8f0" }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn btn-secondary btn-sm"
            aria-label="Halaman sebelumnya"
          >
            ← Sebelumnya
          </button>
          <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="btn btn-secondary btn-sm"
            aria-label="Halaman berikutnya"
          >
            Berikutnya →
          </button>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            {txs.length} total
          </span>
        </div>
      )}

      <DeleteConfirmModal
        transaction={deleteTx}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTx(null)}
      />
      <PaymentUpdateModal
        transaction={paidTx}
        onConfirm={(amount, paymentNote) => {
          if (!paidTx) return;
          const tx = paidTx;
          const isFull = amount >= (tx.outstanding || 0);
          onMarkPaid(tx.id, amount, paymentNote);
          setPaidTx(null);
          setToast(isFull
            ? `✅ ${fmtIDR(amount)} diterima. Transaksi Lunas.`
            : `🔄 Pembayaran ${fmtIDR(amount)} dicatat. Sisa: ${fmtIDR(Math.max(0, (tx.outstanding || 0) - amount))}.`
          );
        }}
        onCancel={() => setPaidTx(null)}
      />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

// ─── Section header card ───────────────────────────────────────────────────────
function SectionCard({ title, count, total, accentColor, bgColor, children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,123,255,.06)", marginBottom: 20 }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", cursor: "pointer", borderLeft: `5px solid ${accentColor}`,
          background: bgColor, userSelect: "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1e3a5f" }}>{title}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              {count} transaksi · Total outstanding:{" "}
              <strong style={{ color: accentColor }}>{fmtIDR(total)}</strong>
            </div>
          </div>
        </div>
        <span style={{ fontSize: 18, color: accentColor, fontWeight: 700 }}>
          {collapsed ? "▶" : "▼"}
        </span>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: "0 0 4px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main page component ───────────────────────────────────────────────────────
const Outstanding = ({
  transactions,
  onEdit,
  onMarkPaid,
  onDelete,
  onInvoice,
  highlightTxIds,
  onClearHighlight,
}) => {
  const [sortBy, setSortBy] = useState("nearestDue");

  // ── Filter and sort — no mutation of original array ─────────────────────────
  const piutangTxs = useMemo(() => {
    const filtered = transactions.filter(
      (t) => t.type === "income" && (Number(t.outstanding) || 0) > 0
    );
    return sortTxs(filtered, sortBy);
  }, [transactions, sortBy]);

  const hutangTxs = useMemo(() => {
    const filtered = transactions.filter(
      (t) => t.type === "expense" && (Number(t.outstanding) || 0) > 0
    );
    return sortTxs(filtered, sortBy);
  }, [transactions, sortBy]);

  const totalPiutang = useMemo(
    () => piutangTxs.reduce((s, t) => s + (Number(t.outstanding) || 0), 0),
    [piutangTxs]
  );
  const totalHutang = useMemo(
    () => hutangTxs.reduce((s, t) => s + (Number(t.outstanding) || 0), 0),
    [hutangTxs]
  );

  // Overdue count for top alert
  const todayStr = today();
  const overdueCount = useMemo(() => {
    return [...piutangTxs, ...hutangTxs].filter((t) => {
      if (!t.dueDate) return false;
      try {
        const d = diffDays(todayStr, t.dueDate);
        return d !== null && d < 0;
      } catch { return false; }
    }).length;
  }, [piutangTxs, hutangTxs, todayStr]);

  // Auto-clear highlight after 8 seconds (matches CSS animation duration)
  useEffect(() => {
    if (highlightTxIds && highlightTxIds.length > 0 && onClearHighlight) {
      const timer = setTimeout(() => onClearHighlight(), 8000);
      return () => clearTimeout(timer);
    }
  }, [highlightTxIds, onClearHighlight]);

  const hasAny = piutangTxs.length > 0 || hutangTxs.length > 0;

  return (
    <div className="page-content">
      {/* ── Page header ── */}
      <div className="page-header">
        <h1 className="page-title">💳 Piutang &amp; Hutang</h1>
        <p className="page-subtitle" style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
          Semua transaksi dengan sisa tagihan yang belum dilunasi.
          Perubahan dari Dasbor otomatis tercermin di sini.
        </p>
      </div>

      {/* ── Overdue alert ── */}
      {overdueCount > 0 && (
        <div className="alert-banner alert-banner--danger"
          style={{ marginBottom: 14 }} role="alert">
          <Icon name="warning" size={16} color="#dc2626" />
          <span>
            <strong>{overdueCount} tagihan sudah melewati jatuh tempo.</strong>{" "}
            Segera tindaklanjuti untuk menghindari piutang macet.
          </span>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="summary-grid summary-grid--2" style={{ marginBottom: 16 }}>
        <div className="summary-card" style={{ borderBottom: "4px solid #10b981" }}>
          <div className="summary-card__tag" style={{ color: "#10b981" }}>Piutang (AR)</div>
          <div className="summary-card__value" style={{ color: "#10b981" }}>{fmtIDR(totalPiutang)}</div>
          <div className="summary-card__sub">Klien belum bayar · {piutangTxs.length} transaksi</div>
        </div>
        <div className="summary-card" style={{ borderBottom: "4px solid #ef4444" }}>
          <div className="summary-card__tag" style={{ color: "#ef4444" }}>Hutang (AP)</div>
          <div className="summary-card__value" style={{ color: "#ef4444" }}>{fmtIDR(totalHutang)}</div>
          <div className="summary-card__sub">Kita belum bayar · {hutangTxs.length} transaksi</div>
        </div>
      </div>

      {/* ── Sort control ── */}
      {hasAny && (
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
            Urutkan:
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
            aria-label="Pilih urutan transaksi"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: "#9ca3af", alignSelf: "center" }}>
            Berlaku untuk kedua seksi
          </span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!hasAny && (
        <div className="empty-state" style={{ padding: "48px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            Semua bersih!
          </div>
          <div style={{ color: "#9ca3af", fontSize: 13 }}>
            Tidak ada piutang maupun hutang yang belum dilunasi.
          </div>
        </div>
      )}

      {/* ── Piutang section ── */}
      {piutangTxs.length > 0 && (
        <SectionCard
          title="💚 Piutang — Mereka Hutang ke Kita"
          count={piutangTxs.length}
          total={totalPiutang}
          accentColor="#10b981"
          bgColor="#f0fdf4"
        >
          <OutstandingTable
            key={sortBy}
            txs={piutangTxs}
            emptyMsg="Tidak ada piutang saat ini."
            onEdit={onEdit}
            onMarkPaid={onMarkPaid}
            onDelete={onDelete}
            onInvoice={onInvoice}
            highlightTxIds={highlightTxIds}
          />
        </SectionCard>
      )}

      {/* ── Hutang section ── */}
      {hutangTxs.length > 0 && (
        <SectionCard
          title="❤️ Hutang — Kita Hutang ke Mereka"
          count={hutangTxs.length}
          total={totalHutang}
          accentColor="#ef4444"
          bgColor="#fef2f2"
        >
          <OutstandingTable
            key={sortBy}
            txs={hutangTxs}
            emptyMsg="Tidak ada hutang saat ini."
            onEdit={onEdit}
            onMarkPaid={onMarkPaid}
            onDelete={onDelete}
            onInvoice={onInvoice}
            highlightTxIds={highlightTxIds}
          />
        </SectionCard>
      )}
    </div>
  );
};

export default Outstanding;