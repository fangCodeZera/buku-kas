/**
 * components/ReportModal.js
 * Printable transaction report modal — landscape A4, column-aware.
 *
 * Fixed columns: NO | NO. INVOICE | TANGGAL | KLIEN | BARANG | BERAT KG @ HARGA | KRG | SUBTOTAL
 * Optional columns (from parent toggle state): SUDAH DIBAYAR | TOTAL NILAI | SISA TAGIHAN |
 *   PIUTANG/HUTANG | JENIS
 * Per-item rows for multi-item transactions + subtotal row.
 * Payment rows: inline (attached to transaction) + orphan (from outside date range).
 * Summary: Total Pemasukan, Total Pengeluaran, Laba Bersih (cash-basis).
 * Grand Total IDR below table.
 * Company name toggle (UI-only, does not persist).
 */
import React, { useRef, useEffect, useState } from "react";
import { fmtIDR, fmtDate, fmtQty, today } from "../utils/idGenerators";
import { printWithPortal } from "../utils/printUtils";
import { getMultiItemContribution, EDIT_NOTES } from "../utils/reportUtils";
import ToggleSwitch from "./ToggleSwitch";

const ReportModal = ({
  transactions,
  allTransactions = [],
  settings,
  dateFrom,
  dateTo,
  selectedItems = [],
  colSudahDibayar = true,
  colTotalNilai = false,
  colSisaTagihan = false,
  colPiutang = false,
  colJenis = false,
  onClose,
}) => {
  const [showCompanyName, setShowCompanyName] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [table1Open, setTable1Open] = useState(true);
  const [table2Open, setTable2Open] = useState(true);
  const [printTable1, setPrintTable1] = useState(true);
  const [printTable2, setPrintTable2] = useState(false);
  const docRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Cash-basis summary (value - outstanding = money actually received/paid)
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((a, t) => {
    const contrib = getMultiItemContribution(t, selectedItems);
    return a + (contrib ? contrib.combinedCashValue : (t.value || 0) - (t.outstanding || 0));
  }, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((a, t) => {
    const contrib = getMultiItemContribution(t, selectedItems);
    return a + (contrib ? contrib.combinedCashValue : (t.value || 0) - (t.outstanding || 0));
  }, 0);
  const netProfit    = totalIncome - totalExpense;

  // Payment filter: amount > 0, not an edit note, date within range
  const visiblePmtFilter = (ph) =>
    Number(ph.amount) > 0 &&
    !EDIT_NOTES.has(ph.note) &&
    (!dateFrom || (ph.date || "") >= dateFrom) &&
    (!dateTo   || (ph.date || "") <= dateTo);

  // Grand total: income paid amounts added, expense paid amounts subtracted (net cash basis)
  const filteredTxIds = new Set(transactions.map((t) => t.id));

  // Table 1 contribution — only when printTable1 is on
  const table1Total = printTable1
    ? transactions.reduce((sum, t) => {
        const contrib = getMultiItemContribution(t, selectedItems);
        const cash = contrib
          ? contrib.combinedCashValue
          : Number(t.value) - (Number(t.outstanding) || 0);
        return t.type === "income" ? sum + cash : sum - cash;
      }, 0)
    : 0;

  // Table 2 contribution — only when printTable2 is on and no item filter active
  const table2Total = (printTable2 && selectedItems.length === 0)
    ? allTransactions.reduce((sum, t) => {
        if (filteredTxIds.has(t.id)) return sum;
        if (!Array.isArray(t.paymentHistory)) return sum;
        const pmtSum = t.paymentHistory
          .filter(visiblePmtFilter)
          .reduce((s, ph) => s + Number(ph.amount), 0);
        return t.type === "income" ? sum + pmtSum : sum - pmtSum;
      }, 0)
    : 0;

  const grandTotalPaid = table1Total + table2Total;

  const grandTotalNilai = (printTable1 ? transactions.reduce((sum, t) => {
    const contrib = getMultiItemContribution(t, selectedItems);
    const nilai = contrib ? contrib.combinedSubtotal : Number(t.value) || 0;
    return t.type === "income" ? sum + nilai : sum - nilai;
  }, 0) : 0);

  const filteredIds = new Set(transactions.map((t) => t.id));

  const orphanPaymentGroups = allTransactions.flatMap((t) => {
    if (filteredIds.has(t.id)) return [];
    const pmts = Array.isArray(t.paymentHistory) ? t.paymentHistory.filter(visiblePmtFilter) : [];
    if (pmts.length === 0) return [];
    return [{ t, pmts }];
  });

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
    bizName: { fontSize: 13, fontWeight: 700, color: "#1e3a5f", margin: 0 },
    bizDetail: { fontSize: 11, color: "#64748b", margin: "2px 0" },
    centerBlock: { textAlign: "center", flex: 1, padding: "0 16px" },
    metaBlock: { textAlign: "right" },
    metaTitle: { fontSize: 18, fontWeight: 700, color: "#1e3a5f", letterSpacing: 1, margin: 0 },
    metaRow: { fontSize: 11, color: "#64748b", marginTop: 3 },
    metaValue: { fontWeight: 700, color: "#1e293b" },
    section: { padding: "0 32px" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 11, margin: "12px 0", tableLayout: "fixed" },
    th: {
      background: "#1e3a5f", color: "#fff", padding: "6px 8px",
      textAlign: "left", fontSize: 10, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap",
    },
    thR: { textAlign: "right" },
    thC: { textAlign: "center" },
    td: { padding: "5px 8px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" },
    tdR: { textAlign: "right" },
    tdC: { textAlign: "center" },
    rowAlt: { background: "#f8fafc" },
    summaryWrap: { padding: "0 32px 20px", marginTop: 16 },
    summaryRow: {
      display: "flex", justifyContent: "space-between",
      padding: "10px 0", fontSize: 11, borderBottom: "1px solid #f1f5f9",
    },
    grandRow: {
      display: "flex", justifyContent: "space-between",
      padding: "14px 0", fontSize: 13, fontWeight: 700,
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

  // Optional column cells for subtotal/single-item rows
  // isSubtotal=true: Sudah Dibayar green+bold, value navy
  const optCellsForRow = (t, isSubtotal = false, contrib = null) => {
    const effectivePaid        = contrib ? contrib.combinedCashValue : Number(t.value) - (Number(t.outstanding) || 0);
    const effectiveOutstanding = contrib ? contrib.combinedProportionalOutstanding : Number(t.outstanding) || 0;
    return (
      <>
        {colSudahDibayar && <td style={{ ...s.td, ...s.tdR, fontWeight: isSubtotal ? 700 : 600, color: isSubtotal ? "#10b981" : undefined }}>{fmtIDR(effectivePaid)}</td>}
        {colTotalNilai   && <td style={{ ...s.td, ...s.tdR, fontWeight: 600 }}>{fmtIDR(contrib ? contrib.combinedSubtotal : t.value)}</td>}
        {colSisaTagihan  && <td style={{ ...s.td, ...s.tdR }}>{effectiveOutstanding > 0 ? fmtIDR(effectiveOutstanding) : "Lunas"}</td>}
        {colPiutang      && <td style={{ ...s.td, ...s.tdC }}>
          {/* Piutang/Hutang badge uses raw outstanding — transaction-level status */}
          {Number(t.outstanding) > 0
            ? (t.type === "income" ? "Piutang" : "Hutang")
            : "Lunas"}
        </td>}
        {colJenis && <td style={{ ...s.td, ...s.tdC }}>{t.type === "income" ? "Penjualan" : "Pembelian"}</td>}
      </>
    );
  };

  // Blank optional column cells for item rows in multi-item transactions
  const optCellsBlank = () => (
    <>
      {colSudahDibayar && <td style={s.td} />}
      {colTotalNilai   && <td style={s.td} />}
      {colSisaTagihan  && <td style={s.td} />}
      {colPiutang      && <td style={s.td} />}
      {colJenis        && <td style={s.td} />}
    </>
  );

  // Render payment rows — print-friendly (no background colors)
  // isInline: adds border-top on first row to visually separate from parent transaction
  const mkPaymentRows = (t, payments, keyPrefix, _isInline, contrib = null) => {
    const isIncome = t.type === "income";
    return payments.map((ph, phIdx) => (
      <tr key={`${keyPrefix}-${t.id}-${phIdx}`}
          style={{ borderLeft: "2px solid #94a3b8", background: "#fff" }}>
        <td style={s.td} />
        <td style={{ ...s.td, fontFamily: "monospace", fontSize: 10, color: "#475569" }}>{t.txnId || "—"}</td>
        <td style={{ ...s.td, fontSize: 10, color: "#475569" }}>{fmtDate(ph.date)}</td>
        <td style={{ ...s.td, fontSize: 10, color: "#475569" }}>{t.counterparty}</td>
        <td style={{ ...s.td, paddingLeft: 12, whiteSpace: "normal" }}>
          <div style={{ fontSize: 10, color: "#475569" }}>
            <span style={{ color: isIncome ? "#10b981" : "#ef4444", fontWeight: 600 }}>
              {isIncome ? "+" : "−"}
            </span>{" "}
            {ph.note || "Pembayaran"}
          </div>
          {(ph.outstandingBefore != null || ph.outstandingAfter != null) && (
            <div style={{ fontSize: 9, color: "#94a3b8", fontStyle: "italic", marginTop: 2 }}>
              Sisa: {fmtIDR(ph.outstandingBefore ?? 0)} → {fmtIDR(ph.outstandingAfter ?? 0)}
              {Number(ph.outstandingAfter) === 0 ? " ✓ Lunas" : ""}
            </div>
          )}
          {contrib && (
            <div style={{ fontSize: 9, color: "#9ca3af", fontStyle: "italic", marginTop: 2 }}>
              Pembayaran untuk seluruh transaksi ({fmtIDR(t.value)})
            </div>
          )}
        </td>
        <td style={s.td} /><td style={s.td} /><td style={s.td} />
        {colSudahDibayar && (
          <td style={{ ...s.td, ...s.tdR, fontWeight: 600, fontSize: 10,
                       color: isIncome ? "#10b981" : "#ef4444" }}>
            {isIncome ? "+" : "−"}{fmtIDR(ph.amount)}
          </td>
        )}
        {colTotalNilai  && <td style={s.td} />}
        {colSisaTagihan && (
          <td style={{ ...s.td, ...s.tdR, fontSize: 10, color: "#475569" }}>
            {Number(ph.outstandingAfter) > 0 ? fmtIDR(ph.outstandingAfter) : "Lunas ✓"}
          </td>
        )}
        {colPiutang && <td style={s.td} />}
        {colJenis   && <td style={s.td} />}
      </tr>
    ));
  };

  return (
    <div style={s.overlay} role="dialog" aria-modal="true" aria-labelledby="report-title" className="modal-overlay">
      <div style={{ ...s.modal, position: "relative" }} className="report-modal">
        <button onClick={onClose} style={s.closeBtn} aria-label="Tutup laporan">✕</button>

        {/* ── Print options (not captured in print) ── */}
        <div style={{
          padding: "12px 32px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}>
          {/* Group 1: Tampilan */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Tampilan
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ToggleSwitch
                checked={showCompanyName}
                onChange={setShowCompanyName}
                label="Nama perusahaan"
              />
              <ToggleSwitch
                checked={showSummary}
                onChange={setShowSummary}
                label="Ringkasan laba/rugi"
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: "#e2e8f0", alignSelf: "stretch", margin: "0 4px" }} />

          {/* Group 2: Cetak */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Sertakan saat cetak
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ToggleSwitch
                checked={printTable1}
                onChange={setPrintTable1}
                label="Transaksi periode ini"
              />
              {orphanPaymentGroups.length > 0 && (
                <ToggleSwitch
                  checked={printTable2}
                  onChange={setPrintTable2}
                  label="Pembayaran luar periode"
                />
              )}
            </div>
          </div>
        </div>

        <div ref={docRef}>
        {/* ── Header ── */}
        <div style={s.header}>
          {/* LEFT: business name + address */}
          <div style={{ minWidth: 140 }}>
            {showCompanyName && (
              <>
                <div style={s.bizName}>{settings.businessName}</div>
                {settings.address && <div style={s.bizDetail}>{settings.address}</div>}
              </>
            )}
          </div>
          {/* CENTER: report title */}
          <div style={s.centerBlock}>
            <h3 id="report-title" style={s.metaTitle}>LAPORAN TRANSAKSI</h3>
          </div>
          {/* RIGHT: print date, period, count */}
          <div style={s.metaBlock}>
            <div style={s.metaRow}>Tanggal Cetak: <span style={s.metaValue}>{fmtDate(today())}</span></div>
            <div style={s.metaRow}>
              Periode:{" "}
              <span style={s.metaValue}>
                {dateFrom && dateTo
                  ? `${fmtDate(dateFrom)} — ${fmtDate(dateTo)}`
                  : dateFrom
                    ? `${fmtDate(dateFrom)} — sekarang`
                    : "Semua tanggal"}
              </span>
            </div>
            <div style={s.metaRow}>Jumlah Transaksi: <span style={s.metaValue}>{transactions.length}</span></div>
          </div>
        </div>

        {/* ── Transaction Table — Table 1 ── */}
        {printTable1 && <div style={s.section}>
          {/* Table 1 collapse header */}
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: "pointer", userSelect: "none", borderBottom: table1Open ? "1px solid #e2e8f0" : "none", marginBottom: 4 }}
            onClick={() => setTable1Open((v) => !v)}
            aria-expanded={table1Open}
          >
            <strong style={{ fontSize: 12, color: "#1e3a5f" }}>
              {table1Open ? "▾" : "▸"} Transaksi Periode Ini
            </strong>
            <span style={{ fontSize: 11, color: "#6b7280" }}>{transactions.length} transaksi</span>
          </div>
          {!table1Open ? null : <table style={s.table}>
            <colgroup>
              <col style={{ width: "4%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "11%" }} />
              <col />
              <col style={{ width: "14%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "9%" }} />
              {colSudahDibayar && <col style={{ width: "9%" }} />}
              {colTotalNilai   && <col style={{ width: "9%" }} />}
              {colSisaTagihan  && <col style={{ width: "9%" }} />}
              {colPiutang      && <col style={{ width: "8%" }} />}
              {colJenis        && <col style={{ width: "7%" }} />}
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...s.th, ...s.thC }}>No</th>
                <th style={s.th}>No. Invoice</th>
                <th style={s.th}>Tanggal</th>
                <th style={s.th}>Klien</th>
                <th style={s.th}>Barang</th>
                <th style={s.th}>Berat Kg @ Harga</th>
                <th style={{ ...s.th, ...s.thR }}>Krg</th>
                <th style={{ ...s.th, ...s.thR }}>Subtotal</th>
                {colSudahDibayar && <th style={{ ...s.th, ...s.thR }}>Sudah Dibayar</th>}
                {colTotalNilai   && <th style={{ ...s.th, ...s.thR }}>Total Nilai</th>}
                {colSisaTagihan  && <th style={{ ...s.th, ...s.thR }}>Sisa Tagihan</th>}
                {colPiutang      && <th style={{ ...s.th, ...s.thR }}>Piutang/Hutang</th>}
                {colJenis        && <th style={{ ...s.th, ...s.thC }}>Jenis</th>}
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, txIdx) => {
                const items = Array.isArray(t.items) && t.items.length > 0
                  ? t.items
                  : [{ itemName: t.itemName || "—", sackQty: t.stockQty ?? 0, weightKg: t.weightKg || 0, pricePerKg: t.pricePerKg || 0, subtotal: t.value || 0 }];
                const isMulti = items.length > 1;
                const txNo = txIdx + 1;
                const firstRowStyle = {
                  background: "#f8fafc",
                  ...(txIdx > 0 ? { borderTop: "2px solid #cbd5e1" } : {}),
                };
                const inlinePayments = Array.isArray(t.paymentHistory)
                  ? t.paymentHistory.filter(visiblePmtFilter)
                  : [];

                if (!isMulti) {
                  const it = items[0];
                  const beratHarga = `${it.weightKg ? `${fmtQty(it.weightKg)} Kg` : "—"} @ ${it.pricePerKg ? fmtQty(it.pricePerKg) : "—"}`;
                  return [
                    <tr key={t.id} style={firstRowStyle}>
                      <td style={{ ...s.td, ...s.tdC }}>{txNo}</td>
                      <td style={{ ...s.td, fontFamily: "monospace", fontSize: 11, color: "#6366f1", fontWeight: 600 }}>{t.txnId || "—"}</td>
                      <td style={s.td}>{fmtDate(t.date)}</td>
                      <td style={s.td}>{t.counterparty}</td>
                      <td style={s.td}>{it.itemName}</td>
                      <td style={{ ...s.td, fontSize: 10 }}>{beratHarga}</td>
                      <td style={{ ...s.td, ...s.tdR }}>{it.sackQty != null ? fmtQty(it.sackQty) : "—"}</td>
                      <td style={{ ...s.td, ...s.tdR, fontWeight: 700 }}>{fmtIDR(it.subtotal)}</td>
                      {optCellsForRow(t)}
                    </tr>,
                    ...mkPaymentRows(t, inlinePayments, "iph", true),
                  ];
                }

                // Multi-item: one row per item + subtotal row
                const contrib = getMultiItemContribution(t, selectedItems);
                const rows = items.map((it, itIdx) => {
                  const isFirst = itIdx === 0;
                  const isFiltered = selectedItems.length === 0 || selectedItems.includes(it.itemName);
                  const beratHarga = `${it.weightKg ? `${fmtQty(it.weightKg)} Kg` : "—"} @ ${it.pricePerKg ? fmtQty(it.pricePerKg) : "—"}`;
                  return (
                    <tr key={`${t.id}-${itIdx}`} style={{
                      ...(isFirst ? firstRowStyle : { background: "#fff" }),
                      ...(!isFiltered && contrib ? { opacity: 0.4, color: "#9ca3af" } : {}),
                    }}>
                      <td style={{ ...s.td, ...s.tdC }}>{isFirst ? txNo : ""}</td>
                      <td style={{ ...s.td, fontFamily: "monospace", fontSize: 11, color: "#6366f1", fontWeight: 600 }}>
                        {isFirst ? (t.txnId || "—") : ""}
                      </td>
                      <td style={s.td}>{isFirst ? fmtDate(t.date) : ""}</td>
                      <td style={s.td}>{isFirst ? t.counterparty : ""}</td>
                      <td style={{ ...s.td, paddingLeft: isFirst ? undefined : 16 }}>{it.itemName}</td>
                      <td style={{ ...s.td, fontSize: 10 }}>{beratHarga}</td>
                      <td style={{ ...s.td, ...s.tdR }}>{it.sackQty != null ? fmtQty(it.sackQty) : "—"}</td>
                      <td style={{ ...s.td, ...s.tdR }}>{fmtIDR(it.subtotal)}</td>
                      {optCellsBlank()}
                    </tr>
                  );
                });

                const subtotalRow = (
                  <tr key={`${t.id}-sub`} style={{ background: "#f1f5f9", borderTop: "1px solid #e2e8f0" }}>
                    <td colSpan={7} style={{ ...s.td, textAlign: "right", fontStyle: "italic", color: "#64748b", fontSize: 10, paddingRight: 8 }}>
                      {contrib
                        ? <>Total: {fmtIDR(contrib.combinedSubtotal)}{" "}
                            <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 9 }}>
                              (dari {fmtIDR(contrib.totalTransactionValue)})
                            </span>
                          </>
                        : "Total:"}
                    </td>
                    <td style={{ ...s.td, ...s.tdR, fontWeight: 700, color: "#1e3a5f" }}>
                      {contrib ? fmtIDR(contrib.combinedSubtotal) : fmtIDR(t.value)}
                    </td>
                    {optCellsForRow(t, true, contrib)}
                  </tr>
                );

                return [...rows, subtotalRow, ...mkPaymentRows(t, inlinePayments, "iph", true, contrib)];
              })}

            </tbody>
          </table>}

        </div>}

        {/* ── Orphan payments — Table 2 ── */}
        {orphanPaymentGroups.length > 0 && printTable2 && (
          <div style={s.section}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: "pointer", userSelect: "none", borderBottom: table2Open ? "1px solid #e2e8f0" : "none", marginBottom: 4 }}
              onClick={() => setTable2Open((v) => !v)}
              aria-expanded={table2Open}
            >
              <strong style={{ fontSize: 12, color: "#1e3a5f" }}>
                {table2Open ? "▾" : "▸"} Pembayaran dari Transaksi Luar Periode
              </strong>
              <span style={{ fontSize: 11, color: "#6b7280" }}>
                {orphanPaymentGroups.reduce((n, { pmts }) => n + pmts.length, 0)} pembayaran
              </span>
            </div>
            {table2Open && (
              <table style={s.table}>
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "11%" }} />
                  <col />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "9%" }} />
                  {colSudahDibayar && <col style={{ width: "9%" }} />}
                  {colTotalNilai   && <col style={{ width: "9%" }} />}
                  {colSisaTagihan  && <col style={{ width: "9%" }} />}
                  {colPiutang      && <col style={{ width: "8%" }} />}
                  {colJenis        && <col style={{ width: "7%" }} />}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ ...s.th, ...s.thC }}>No</th>
                    <th style={s.th}>No. Invoice</th>
                    <th style={s.th}>Tanggal Bayar</th>
                    <th style={s.th}>Klien</th>
                    <th style={s.th}>Catatan</th>
                    <th style={s.th}>Berat Kg @ Harga</th>
                    <th style={{ ...s.th, ...s.thR }}>Krg</th>
                    <th style={{ ...s.th, ...s.thR }}>Subtotal</th>
                    {colSudahDibayar && <th style={{ ...s.th, ...s.thR }}>Sudah Dibayar</th>}
                    {colTotalNilai   && <th style={{ ...s.th, ...s.thR }}>Total Nilai</th>}
                    {colSisaTagihan  && <th style={{ ...s.th, ...s.thR }}>Sisa Tagihan</th>}
                    {colPiutang      && <th style={{ ...s.th, ...s.thR }}>Piutang/Hutang</th>}
                    {colJenis        && <th style={{ ...s.th, ...s.thC }}>Jenis</th>}
                  </tr>
                </thead>
                <tbody>
                  {orphanPaymentGroups.map(({ t, pmts }) =>
                    mkPaymentRows(t, pmts, "oph", false)
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Grand total */}
        <div style={s.section}>
          <div style={{ textAlign: "right", fontWeight: 600, fontSize: 12, padding: "8px 8px 4px", color: "#1e3a5f", borderTop: "2px solid #1e3a5f" }}>
            Grand Total Nilai{" "}
            <span style={{ color: grandTotalNilai >= 0 ? "#10b981" : "#ef4444", fontWeight: 700 }}>
              {fmtIDR(grandTotalNilai)}
            </span>
          </div>
          <div style={{ textAlign: "right", fontWeight: 600, fontSize: 12, padding: "4px 8px 8px", color: "#1e3a5f" }}>
            Total Sudah Dibayar{" "}
            <span style={{ color: grandTotalPaid >= 0 ? "#10b981" : "#ef4444", fontWeight: 700 }}>
              {fmtIDR(grandTotalPaid)}
            </span>
          </div>
        </div>

        {/* ── Summary ── */}
        {showSummary && <div style={s.summaryWrap}>
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
        </div>}

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
                  @media print {
                    thead { display: table-header-group; }
                    tr { page-break-inside: avoid; }
                  }
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
