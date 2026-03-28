/**
 * components/Badge.js
 * Two badge helpers:
 *
 *  StatusBadge  — payment status with simplified human-readable labels + tooltips
 *  TypeBadge    — transaction type (Penjualan / Pembelian) replacing Pemasukan/Pengeluaran
 *
 * Default export is StatusBadge (backward-compatible — existing <Badge status={...} /> still works).
 */
import React from "react";
import { STATUS } from "../utils/statusUtils";

// ── Status badge ──────────────────────────────────────────────────────────────
// Maps every known stored status to { label, bg, color, tooltip }
const STATUS_MAP = {
  [STATUS.LUNAS]: {
    label:   "✅ Lunas",
    bg:      "#d1fae5",
    color:   "#065f46",
    tooltip: "Sudah dibayar penuh",
  },
  // v3 strings
  [STATUS.PARTIAL_INCOME]: {
    label:   "⏳ Piutang",
    bg:      "#fef3c7",
    color:   "#92400e",
    tooltip: "Klien belum bayar penuh — mereka berhutang ke kita",
  },
  [STATUS.PARTIAL_EXPENSE]: {
    label:   "⏳ Utang",
    bg:      "#fee2e2",
    color:   "#991b1b",
    tooltip: "Kita belum bayar penuh — kita berhutang ke supplier",
  },
  // Legacy v1/v2 strings (kept until migration runs)
  "Sebagian Dibayar (Piutang)": {
    label:   "⏳ Piutang",
    bg:      "#fef3c7",
    color:   "#92400e",
    tooltip: "Klien belum bayar penuh — mereka berhutang ke kita",
  },
  "Sebagian Dibayar (Utang)": {
    label:   "⏳ Utang",
    bg:      "#fee2e2",
    color:   "#991b1b",
    tooltip: "Kita belum bayar penuh — kita berhutang ke supplier",
  },
  "Belum Dibayar": {
    label:   "⏳ Belum Bayar",
    bg:      "#fef3c7",
    color:   "#92400e",
    tooltip: "Belum ada pembayaran",
  },
};

/**
 * StatusBadge — renders a coloured pill for a payment status string.
 * Shows a simplified, human-readable label; full status in tooltip.
 */
export const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || {
    label:   status || "—",
    bg:      "#f3f4f6",
    color:   "#374151",
    tooltip: status,
  };
  return (
    <span
      className="badge"
      style={{ background: s.bg, color: s.color }}
      title={s.tooltip}
      aria-label={`Status: ${s.tooltip}`}
    >
      {s.label}
    </span>
  );
};

// ── Type badge ────────────────────────────────────────────────────────────────
const TYPE_MAP = {
  income: {
    label:   "🛒 Penjualan",
    bg:      "#d1fae5",
    color:   "#065f46",
    tooltip: "Penjualan ke pelanggan — uang masuk, stok berkurang",
  },
  expense: {
    label:   "📦 Pembelian",
    bg:      "#fee2e2",
    color:   "#991b1b",
    tooltip: "Pembelian dari supplier — uang keluar, stok bertambah",
  },
};

/**
 * TypeBadge — renders Penjualan (green) or Pembelian (red).
 * Replaces the old "Pemasukan / Pengeluaran" labels in table cells.
 */
export const TypeBadge = ({ type }) => {
  const t = TYPE_MAP[type] || { label: type, bg: "#f3f4f6", color: "#374151", tooltip: type };
  return (
    <span
      className="badge"
      style={{ background: t.bg, color: t.color }}
      title={t.tooltip}
      aria-label={t.tooltip}
    >
      {t.label}
    </span>
  );
};

// Default export kept for backward compatibility (existing <Badge status={...} />)
export default StatusBadge;