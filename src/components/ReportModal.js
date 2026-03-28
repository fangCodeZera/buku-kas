/**
 * components/ReportModal.js
 * Printable transaction report modal — visual style matches InvoiceModal.
 *
 * Title: "LAPORAN TRANSAKSI"
 * Table: No | Tanggal | No. Invoice | Klien | Barang | Stok | Jenis | Status | Jatuh Tempo | Nilai (Rp) | Piutang/Hutang
 * Summary: Total Pemasukan, Total Pengeluaran, Laba Bersih (all cash-basis: value - outstanding)
 */
import React, { useRef, useEffect } from "react";
import DueBadge from "../components/DueBadge";
import { fmtIDR, fmtDate, today } from "../utils/idGenerators";
import { printWithPortal } from "../utils/printUtils";
import { STATUS } from "../utils/statusUtils";

const ReportModal = ({ transactions, settings, dateFrom, dateTo, onClose }) => {
  const docRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Cash-basis: only count money actually exchanged (value - outstanding)
  const totalIncome  = transactions.filter((t) => t.type === "income").reduce((a, t) => a + ((t.value || 0) - (t.outstanding || 0)), 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((a, t) => a + ((t.value || 0) - (t.outstanding || 0)), 0);
  const netProfit    = totalIncome - totalExpense;

  /** Render the ITEM cell — stacked list for multi-item, plain text for single */
  const renderItemCell = (t) => {
    const isMulti = Array.isArray(t.items) && t.items.length > 1;
    if (isMulti) {
      return (
        <td style={{ ...s.td, whiteSpace: "normal", verticalAlign: "top" }}>
          {t.items.map((item, idx) => (
            <span key={idx} className="report-stok-item" style={{ fontSize: 11 }}>• {item.itemName}</span>
          ))}
        </td>
      );
    }
    return <td style={s.td}>{t.itemName}</td>;
  };

  /** Render the STOK cell — stacked for multi-item, single line for single-item */
  const renderStokCell = (t) => {
    const sign = t.type === "income" ? "-" : "+";
    const cls  = t.type === "income" ? "report-stok-out" : "report-stok-in";
    const isMulti = Array.isArray(t.items) && t.items.length > 1;

    if (isMulti) {
      return (
        <td style={{ ...s.td, whiteSpace: "normal", verticalAlign: "top" }} className="report-stok-cell">
          {t.items.map((item, idx) => {
            const qty  = item.sackQty != null ? item.sackQty : (item.stockQty != null ? item.stockQty : 0);
            const unit = t.stockUnit || "karung";
            return (
              <span key={idx} className={`report-stok-item ${cls}`}>
                {sign}{qty} {unit}
              </span>
            );
          })}
        </td>
      );
    }

    // Single-item — legacy fallback: sackQty → stockQty → null (show "—")
    const qty  = t.sackQty  != null ? t.sackQty  :
                 t.stockQty != null ? t.stockQty : null;
    const unit = t.stockUnit || "karung";
    if (qty === null) {
      return <td style={s.td} className="report-stok-cell">—</td>;
    }
    return (
      <td style={s.td} className={`report-stok-cell ${cls}`}>
        {sign}{qty} {unit}
      </td>
    );
  };

  const s = {
    overlay: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: "30px 16px", overflowY: "auto", zIndex: 9999,
    },
    modal: {
      background: "#fff", maxWidth: "95vw", width: "100%",
      borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
      fontFamily: "'Segoe UI', 'Inter', sans-serif", color: "#1e293b",
    },
    header: {
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "28px 32px 20px", borderBottom: "2px solid #e2e8f0",
    },
    bizName: { fontSize: 20, fontWeight: 800, color: "#1e3a5f", margin: 0 },
    bizDetail: { fontSize: 12, color: "#64748b", margin: "2px 0" },
    metaBlock: { textAlign: "right" },
    metaTitle: { fontSize: 20, fontWeight: 900, color: "#1e3a5f", letterSpacing: 2, margin: 0 },
    metaRow: { fontSize: 12, color: "#64748b", marginTop: 4 },
    metaValue: { fontWeight: 700, color: "#1e293b" },
    section: { padding: "0 32px" },
    periodBlock: {
      margin: "16px 0", padding: "12px 16px",
      background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0",
    },
    periodLabel: { fontSize: 10, textTransform: "uppercase", color: "#94a3b8", fontWeight: 700, letterSpacing: 1 },
    periodText: { fontSize: 14, fontWeight: 700, color: "#1e293b", marginTop: 2 },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 11, margin: "12px 0", tableLayout: "fixed" },
    th: {
      background: "#1e3a5f", color: "#fff", padding: "7px 6px",
      textAlign: "left", fontSize: 10, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap",
    },
    thR: { textAlign: "right" },
    thC: { textAlign: "center" },
    td: { padding: "6px 6px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" },
    tdR: { textAlign: "right", fontWeight: 600 },
    tdC: { textAlign: "center" },
    rowAlt: { background: "#f8fafc" },
    summaryWrap: { padding: "0 32px 20px" },
    summaryRow: {
      display: "flex", justifyContent: "space-between",
      padding: "10px 0", fontSize: 14, borderBottom: "1px solid #f1f5f9",
    },
    grandRow: {
      display: "flex", justifyContent: "space-between",
      padding: "14px 0", fontSize: 17, fontWeight: 900,
      borderTop: "3px solid #1e3a5f",
    },
    footer: {
      textAlign: "center", fontSize: 11, color: "#94a3b8",
      padding: "12px 32px", borderTop: "1px solid #e2e8f0",
    },
    actions: {
      display: "flex", gap: 10, padding: "16px 32px",
      borderTop: "1px solid #e2e8f0",
    },
    closeBtn: {
      position: "absolute", top: 16, right: 16,
      background: "none", border: "none", fontSize: 22, cursor: "pointer",
      color: "#94a3b8", lineHeight: 1,
    },
  };

  return (
    <div style={s.overlay} role="dialog" aria-modal="true" aria-labelledby="report-title" className="modal-overlay">
      <div style={{ ...s.modal, position: "relative" }} className="report-modal">
        <button onClick={onClose} style={s.closeBtn} aria-label="Tutup laporan">✕</button>

        <div ref={docRef}>
        {/* ── Header ── */}
        <div style={s.header}>
          <div>
            <h2 style={s.bizName}>{settings.businessName}</h2>
            {settings.address && <div style={s.bizDetail}>{settings.address}</div>}
            {settings.phone && <div style={s.bizDetail}>Tel: {settings.phone}</div>}
          </div>
          <div style={s.metaBlock}>
            <h3 id="report-title" style={s.metaTitle}>LAPORAN TRANSAKSI</h3>
            <div style={s.metaRow}>Tanggal Cetak: <span style={s.metaValue}>{fmtDate(today())}</span></div>
            <div style={s.metaRow}>Jumlah Transaksi: <span style={s.metaValue}>{transactions.length}</span></div>
          </div>
        </div>

        {/* ── Period ── */}
        <div style={s.section}>
          <div style={s.periodBlock}>
            <div style={s.periodLabel}>Periode Laporan</div>
            <div style={s.periodText}>
              {dateFrom && dateTo
                ? `${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`
                : "Semua tanggal"}
            </div>
          </div>
        </div>

        {/* ── Transaction Table ── */}
        <div style={s.section}>
          <table style={s.table}>
            {/* Column widths for landscape A4 (~257mm usable) */}
            <colgroup>
              <col style={{ width: "4%" }} />    {/* NO */}
              <col style={{ width: "8%" }} />    {/* TANGGAL */}
              <col style={{ width: "10%" }} />   {/* NO. INVOICE */}
              <col style={{ width: "10%" }} />   {/* KLIEN */}
              <col style={{ width: "13%" }} />   {/* ITEM */}
              <col style={{ width: "9%" }} />    {/* STOK */}
              <col style={{ width: "8%" }} />    {/* JENIS */}
              <col style={{ width: "8%" }} />    {/* STATUS */}
              <col style={{ width: "9%" }} />    {/* JATUH TEMPO */}
              <col style={{ width: "11%" }} />   {/* NILAI KAS */}
              <col style={{ width: "10%" }} />   {/* PIUTANG/HUTANG */}
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...s.th, ...s.thC }}>No</th>
                <th style={s.th}>Tanggal</th>
                <th style={s.th}>No. Invoice</th>
                <th style={s.th}>Klien</th>
                <th style={s.th}>Barang</th>
                <th style={s.th}>Stok</th>
                <th style={{ ...s.th, ...s.thC }}>Jenis</th>
                <th style={{ ...s.th, ...s.thC }}>Status</th>
                <th style={{ ...s.th, ...s.thC }}>Jatuh Tempo</th>
                <th style={{ ...s.th, ...s.thR }}>Nilai (Rp)</th>
                <th style={{ ...s.th, ...s.thR }}>Piutang/Hutang</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => {
                const cashVal = (t.value || 0) - (t.outstanding || 0);
                return (
                  <tr key={t.id} style={i % 2 !== 0 ? s.rowAlt : {}}>
                    <td style={{ ...s.td, ...s.tdC }}>{i + 1}</td>
                    <td style={s.td}>{fmtDate(t.date)}</td>
                    <td style={{ ...s.td, fontFamily: "monospace", fontSize: 11, color: "#6366f1", fontWeight: 600 }}>
                      {t.txnId || "—"}
                    </td>
                    <td style={s.td}>{t.counterparty}</td>
                    {renderItemCell(t)}
                    {renderStokCell(t)}
                    <td style={{ ...s.td, ...s.tdC }}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: t.type === "income" ? "#d1fae5" : "#fee2e2",
                        color: t.type === "income" ? "#065f46" : "#991b1b",
                      }}>
                        {t.type === "income" ? "Penjualan" : "Pembelian"}
                      </span>
                    </td>
                    <td style={{ ...s.td, ...s.tdC }}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                        background: t.status === STATUS.LUNAS ? "#d1fae5" : "#fef3c7",
                        color: t.status === STATUS.LUNAS ? "#065f46" : "#92400e",
                      }}>
                        {t.status === STATUS.LUNAS ? "Lunas" : "Belum Lunas"}
                      </span>
                    </td>
                    <td style={{ ...s.td, ...s.tdC }}><DueBadge dueDate={t.dueDate} outstanding={t.outstanding} /></td>
                    <td style={{ ...s.td, ...s.tdR, color: t.type === "income" ? "#10b981" : "#ef4444" }}>
                      {t.type === "income" ? "+" : "-"}{fmtIDR(cashVal)}
                    </td>
                    <td style={{ ...s.td, ...s.tdR, color: (t.outstanding || 0) > 0 ? "#f59e0b" : "#9ca3af" }}>
                      {(t.outstanding || 0) > 0 ? fmtIDR(t.outstanding) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Summary ── */}
        <div style={s.summaryWrap}>
          <div style={s.summaryRow}>
            <span>Total Pemasukan</span>
            <span style={{ fontWeight: 700, color: "#10b981" }}>+{fmtIDR(totalIncome)}</span>
          </div>
          <div style={s.summaryRow}>
            <span>Total Pengeluaran</span>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>-{fmtIDR(totalExpense)}</span>
          </div>
          <div style={{
            ...s.grandRow,
            color: netProfit >= 0 ? "#10b981" : "#ef4444",
            borderTopColor: netProfit >= 0 ? "#10b981" : "#ef4444",
          }}>
            <span>Laba Bersih</span>
            <span>{netProfit >= 0 ? "+" : ""}{fmtIDR(netProfit)}</span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={s.footer}>
          Dicetak: {new Date().toLocaleString("id-ID")} · {settings.businessName}
        </div>
        </div>{/* end docRef */}

        {/* ── Actions ── */}
        <div style={s.actions} className="report-actions">
          <button
            onClick={() => {
              if (!docRef.current) return;
              printWithPortal(
                `<style>
                  body { margin: 0; background: #fff; font-family: 'Segoe UI', 'Inter', sans-serif; color: #1e293b;
                         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  * { box-sizing: border-box; }
                  @page { size: landscape; margin: 10mm; }
                  .report-stok-out { color: #ef4444 !important; }
                  .report-stok-in  { color: #10b981 !important; }
                  .report-stok-item { display: block; }
                </style>${docRef.current.outerHTML}`
              );
            }}
            className="btn btn-primary btn-lg"
            style={{ flex: 1 }}
            aria-label="Cetak laporan"
          >
            🖨️ Cetak Laporan
          </button>
          <button onClick={onClose} className="btn btn-secondary btn-lg">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
