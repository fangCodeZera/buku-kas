/**
 * components/PaymentHistoryPanel.js
 * Expandable payment history timeline for a single transaction.
 * Rendered as the content of a colSpan row directly below a transaction row.
 */
import React, { useState } from "react";
import { fmtIDR, fmtDate } from "../utils/idGenerators";

const SYSTEM_NOTES = [
  "Lunas saat transaksi dibuat",
  "Pembayaran awal",
  "Belum ada pembayaran saat transaksi dibuat",
  "Pelunasan",
  "Pembayaran sebagian",
  "Transaksi diedit — nilai diperbarui",
  "Transaksi Diedit",
];

function getEntryLabel(entry) {
  const note = entry.note || "";
  if (note.includes("data lama")) {
    if (note.startsWith("Lunas")) return "Lunas";
    if (note.startsWith("Pembayaran awal")) return "Pembayaran Awal";
    if (note.startsWith("Belum ada")) return "Belum Ada Pembayaran";
    return "Riwayat Historis";
  }
  if (note === "Lunas saat transaksi dibuat") return "Lunas Saat Dibuat";
  if (note === "Pembayaran awal") return "Pembayaran Awal";
  if (note === "Belum ada pembayaran saat transaksi dibuat") return "Belum Ada Pembayaran";
  if (note === "Pelunasan") return "Pelunasan";
  if (note === "Pembayaran sebagian") return "Pembayaran Sebagian";
  if (note === "Transaksi diedit — nilai diperbarui" || note === "Transaksi Diedit") return "Transaksi Diedit";
  // User note — infer label from entry data
  if (entry.outstandingAfter === 0) return "Pelunasan";
  if ((entry.amount || 0) > 0) return "Pembayaran Sebagian";
  return "Pembayaran";
}

function getUserNote(entry) {
  const note = entry.note || "";
  if (!note) return null;
  if (note.includes("data lama")) return null;
  if (SYSTEM_NOTES.includes(note)) return null;
  return note;
}

const SHOW_FIRST = 3;
const SHOW_LAST  = 1;

const PaymentHistoryPanel = ({ transaction: t, onClose }) => {
  const [showAll, setShowAll] = useState(false);

  const history      = t.paymentHistory || [];
  const val          = Number(t.value)       || 0;
  const out          = Number(t.outstanding) || 0;
  const pct          = val > 0 ? Math.round(((val - out) / val) * 100) : 100;
  const hasPending   = out > 0;

  const paymentCount = history.filter(
    (e) => (e.amount || 0) > 0 && e.note !== "Transaksi diedit — nilai diperbarui" && e.note !== "Transaksi Diedit"
  ).length;

  const historyHeader = t.txnId
    ? t.type === "expense"
      ? `💳 Riwayat Pembayaran — No. Invoice Supplier: ${t.txnId}`
      : `💳 Riwayat Pembayaran — No. Invoice: ${t.txnId}`
    : `💳 Riwayat Pembayaran — ${fmtDate(t.date)} — ${t.counterparty}`;

  const allDataLama =
    history.length > 0 && history.every((e) => (e.note || "").includes("data lama"));

  const needsCollapse = history.length >= 10 && !showAll;
  const hiddenCount   = needsCollapse
    ? Math.max(0, history.length - SHOW_FIRST - SHOW_LAST)
    : 0;

  // Render a single timeline node
  const renderNode = (entry, originalIdx, hasLineAfter) => {
    const isDataLama = (entry.note || "").includes("data lama");
    const isLunas    = entry.outstandingAfter === 0;
    const isEdit     = entry.note === "Transaksi diedit — nilai diperbarui" || entry.note === "Transaksi Diedit";
    const isEmpty    = (entry.amount || 0) === 0 && !isEdit;
    const userNote   = getUserNote(entry);
    const label      = getEntryLabel(entry);
    const isFirst    = originalIdx === 0;

    let dotClass = "payment-timeline__dot";
    if (isLunas)      dotClass += " payment-timeline__dot--lunas";
    else if (isEmpty) dotClass += " payment-timeline__dot--empty";

    return (
      <div key={entry.id || originalIdx} className="payment-timeline__node">
        <div className={dotClass} />
        {hasLineAfter && <div className="payment-timeline__line" />}

        <div className="payment-timeline__datetime">
          {fmtDate(entry.date)}{entry.time ? `, ${entry.time}` : ""}
          {isFirst && (
            <span style={{
              marginLeft: 6, background: "#e8f0fe", color: "#1e3a5f",
              borderRadius: 4, padding: "0 5px", fontSize: 9, fontWeight: 700,
            }}>
              PERTAMA
            </span>
          )}
        </div>

        <div className="payment-timeline__label">
          {label}
          {isDataLama && (
            <span
              title="Data historis diperkirakan — pembayaran asli tidak tercatat"
              style={{ marginLeft: 5, cursor: "help", color: "#f59e0b" }}
            >
              ⚠
            </span>
          )}
        </div>

        {(entry.amount || 0) > 0 && (
          <div className="payment-timeline__amount">
            Dibayar: {fmtIDR(entry.amount)}
          </div>
        )}

        {!isEdit && (
          <div className={`payment-timeline__remaining${isLunas ? " payment-timeline__remaining--lunas" : ""}`}>
            {isLunas ? "Rp 0 ✓ Lunas" : `Sisa: ${fmtIDR(entry.outstandingAfter)}`}
          </div>
        )}

        {isEdit && entry.valueAfter != null && (
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1, lineHeight: 1.6 }}>
            <div>Total Nilai: {fmtIDR(entry.valueBefore)} → {fmtIDR(entry.valueAfter)}</div>
            <div>Sudah Dibayar: {fmtIDR(entry.paidBefore ?? 0)} → {fmtIDR(entry.paidAfter ?? 0)}</div>
            <div>Sisa Tagihan: {fmtIDR(entry.outstandingBefore)} → {fmtIDR(entry.outstandingAfter)}</div>
            <div>Status: {entry.statusBefore} → {entry.statusAfter}</div>
          </div>
        )}
        {isEdit && entry.valueAfter == null && (
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
            Sebelum: {fmtIDR(entry.outstandingBefore)} → Setelah: {fmtIDR(entry.outstandingAfter)}
          </div>
        )}

        {isLunas && !isDataLama && (
          <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, marginTop: 2 }}>✅ LUNAS</div>
        )}

        {userNote && (
          <div className="payment-timeline__user-note">Catatan: {userNote}</div>
        )}
      </div>
    );
  };

  const buildNodes = () => {
    if (history.length === 0) return null;

    if (needsCollapse && hiddenCount > 0) {
      const firstEntries = history.slice(0, SHOW_FIRST);
      const lastEntries  = history.slice(-SHOW_LAST);
      return (
        <>
          {firstEntries.map((entry, idx) =>
            renderNode(entry, idx, true)
          )}
          {/* Collapsed expand toggle as a node */}
          <div className="payment-timeline__node" style={{ paddingBottom: 8 }}>
            <div className="payment-timeline__dot payment-timeline__dot--empty" />
            <div className="payment-timeline__line" />
            <button
              onClick={() => setShowAll(true)}
              style={{
                background: "none", border: "1px dashed #c7ddf7",
                borderRadius: 6, padding: "4px 12px", fontSize: 11,
                color: "#007bff", cursor: "pointer",
              }}
            >
              Tampilkan {hiddenCount} pembayaran lainnya
            </button>
          </div>
          {lastEntries.map((entry, idx) => {
            const origIdx  = history.length - SHOW_LAST + idx;
            const isLast   = idx === lastEntries.length - 1;
            return renderNode(entry, origIdx, !isLast || hasPending);
          })}
          {hasPending && <PendingNode out={out} dueDate={t.dueDate} />}
        </>
      );
    }

    return (
      <>
        {history.map((entry, idx) => {
          const isLast = idx === history.length - 1;
          return renderNode(entry, idx, !isLast || hasPending);
        })}
        {hasPending && <PendingNode out={out} dueDate={t.dueDate} />}
      </>
    );
  };

  return (
    <div className="payment-timeline">
      {/* Header */}
      <div className="payment-timeline__header">
        <div>
          <div className="payment-timeline__title">{historyHeader}</div>
          <div className="payment-timeline__total">Total: {fmtIDR(val)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button
            className="payment-timeline__close"
            onClick={onClose}
            title="Tutup riwayat pembayaran"
            aria-label="Tutup riwayat pembayaran"
            style={{ position: "static" }}
          >
            ✕ Tutup
          </button>
          <div className="payment-timeline__progress-wrap">
            <div className="payment-timeline__progress-bar">
              <div className="payment-timeline__progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="payment-timeline__progress-label">
              {fmtIDR(val - out)} / {fmtIDR(val)} ({pct}%)
            </div>
          </div>
        </div>
      </div>

      {/* All data lama banner */}
      {allDataLama && (
        <div style={{
          background: "#f0f6ff", border: "1px solid #c7ddf7", borderRadius: 8,
          padding: "8px 12px", fontSize: 11, color: "#374151", marginBottom: 12,
        }}>
          ℹ Data historis — riwayat lengkap tersedia mulai transaksi baru setelah pembaruan ini
        </div>
      )}

      {/* Timeline nodes */}
      {history.length === 0 ? (
        <div style={{ fontSize: 12, color: "#9ca3af", padding: "16px 0", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📋</div>
          Belum ada riwayat pembayaran tercatat
        </div>
      ) : (
        <div className="payment-timeline__nodes">
          {buildNodes()}
        </div>
      )}

      {/* Footer summary */}
      {history.length > 0 && (
        <div className="payment-timeline__footer">
          <div className="payment-timeline__footer-item">
            <span className="payment-timeline__footer-label">Total Transaksi</span>
            <span className="payment-timeline__footer-value">{fmtIDR(val)}</span>
          </div>
          <div className="payment-timeline__footer-item">
            <span className="payment-timeline__footer-label">Total Terbayar</span>
            <span className={`payment-timeline__footer-value payment-timeline__footer-value--${out === 0 ? "green" : "amber"}`}>
              {fmtIDR(val - out)}
            </span>
          </div>
          <div className="payment-timeline__footer-item">
            <span className="payment-timeline__footer-label">Sisa Hutang</span>
            <span className={`payment-timeline__footer-value payment-timeline__footer-value--${out === 0 ? "green" : "amber"}`}>
              {fmtIDR(out)}
            </span>
          </div>
          <div className="payment-timeline__footer-item">
            <span className="payment-timeline__footer-label">Jumlah Pembayaran</span>
            <span className="payment-timeline__footer-value">{paymentCount} kali</span>
          </div>
        </div>
      )}
    </div>
  );
};

function PendingNode({ out, dueDate }) {
  return (
    <div className="payment-timeline__node" style={{ paddingBottom: 0 }}>
      <div className="payment-timeline__dot payment-timeline__dot--pending" />
      <div className="payment-timeline__pending-node">
        <div className="payment-timeline__pending-label">Menunggu pembayaran berikutnya</div>
        <div className="payment-timeline__pending-info">
          Sisa: {fmtIDR(out)}
          {dueDate ? ` · Jatuh tempo: ${fmtDate(dueDate)}` : " · Jatuh tempo: —"}
        </div>
      </div>
    </div>
  );
}

export default PaymentHistoryPanel;
