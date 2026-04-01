/**
 * pages/Reports.js
 * Filtered financial report with date/contact/item/period controls,
 * summary cards, a CSS bar chart, transaction table, CSV export,
 * and direct "Generate Invoice/Report" for the filtered set.
 *
 * Client and item filters are now multi-select (zero-dep custom component).
 */
import React, { useState, useMemo, useEffect } from "react";
import { StatusBadge, TypeBadge } from "../components/Badge";
import DueBadge      from "../components/DueBadge";
import Icon        from "../components/Icon";
import Toast       from "../components/Toast";
import MultiSelect from "../components/MultiSelect";
import { fmtIDR, fmtDate, today, addDays } from "../utils/idGenerators";

/**
 * For a multi-item transaction, compute the combined contribution of ALL selected items.
 * Works for any number of active item filters (1, 2, or more).
 *
 * Returns null when:
 *   - No item filter is active (selItems is empty)
 *   - The transaction has 0 or 1 items (single-item tx needs no special breakdown)
 *   - ALL items in the transaction are selected (no grey "other" items to show)
 *   - NONE of the items in the transaction are selected (shouldn't happen after filtering)
 *
 * @param {Object}   t        - transaction
 * @param {string[]} selItems - active item filter names (array, any length)
 * @returns {{ filteredItems, otherItems, combinedSubtotal, combinedProportionalOutstanding,
 *             combinedCashValue, totalTransactionValue, totalOutstanding } | null}
 */
function getMultiItemContribution(t, selItems) {
  if (!selItems || selItems.length === 0) return null;
  if (!Array.isArray(t.items) || t.items.length <= 1) return null;

  const filteredItems = t.items.filter((it) => selItems.includes(it.itemName));
  const otherItems    = t.items.filter((it) => !selItems.includes(it.itemName));

  // Only apply breakdown rendering when there's a mix (some match, some don't)
  if (filteredItems.length === 0 || otherItems.length === 0) return null;

  const combinedSubtotal = filteredItems.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  const totalTransactionValue = Number(t.value) || 0;
  const totalOutstanding      = Number(t.outstanding) || 0;
  const combinedProportionalOutstanding = totalTransactionValue > 0
    ? Math.round((combinedSubtotal / totalTransactionValue) * totalOutstanding)
    : 0;
  const combinedCashValue = combinedSubtotal - combinedProportionalOutstanding;

  return {
    filteredItems,
    otherItems,
    combinedSubtotal,
    combinedProportionalOutstanding,
    combinedCashValue,
    totalTransactionValue,
    totalOutstanding,
  };
}

const Reports = ({ transactions, contacts, settings, onReport, initItemFilter = null, onClearItemFilter = () => {} }) => {
  const [dateFrom,        setDateFrom]        = useState(() => {
    if (initItemFilter) return "";
    const [y, m] = today().split("-");
    return `${y}-${m}-01`;
  });
  const [dateTo,          setDateTo]          = useState(() => initItemFilter ? "" : today());
  const [selectedClients, setSelectedClients] = useState([]);
  const [selectedItems,   setSelectedItems]   = useState(() => initItemFilter ? [initItemFilter] : []);
  const [period,          setPeriod]          = useState(() => initItemFilter ? "all-time" : "monthly");
  const [inventoryFilterItem, setInventoryFilterItem] = useState(initItemFilter || null);

  // Clear App.js reportItemFilter once consumed so re-navigating to Reports starts fresh
  useEffect(() => {
    if (initItemFilter) onClearItemFilter();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [toast,           setToast]           = useState(null);
  const [confirmCount,    setConfirmCount]    = useState(null);
  const [exportFormat,    setExportFormat]    = useState("csv");

  const applyPeriod = (p) => {
    // "all-time" period option: clears date filters to show all transactions
    if (p === "all-time") {
      setDateFrom(""); setDateTo(""); setPeriod(p);
      return;
    }

    const to = today();
    let from;
    if      (p === "daily")     from = to;
    else if (p === "weekly")    from = addDays(to, -7);
    else if (p === "fortnight") from = addDays(to, -14);
    else if (p === "monthly")   { const [y, m] = to.split("-"); from = `${y}-${m}-01`; }
    else return;
    setDateFrom(from); setDateTo(to); setPeriod(p);
  };

  const clientOptions = useMemo(
    () => [...contacts].sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.name),
    [contacts]
  );
  const itemOptions = useMemo(() => {
    const names = new Set();
    transactions.forEach((t) => {
      if (Array.isArray(t.items) && t.items.length > 0) {
        t.items.forEach((it) => { if (it.itemName) names.add(it.itemName); });
      } else if (t.itemName) {
        names.add(t.itemName);
      }
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const filtered = useMemo(
    () =>
      [...transactions]
        .filter((t) => (!dateFrom || t.date >= dateFrom) && (!dateTo || t.date <= dateTo))
        .filter((t) => selectedClients.length === 0 || selectedClients.includes(t.counterparty))
        .filter((t) => selectedItems.length === 0 ||
          selectedItems.includes(t.itemName) ||
          (Array.isArray(t.items) && t.items.some((it) => selectedItems.includes(it.itemName)))
        )
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : new Date((a.date||"1970-01-01")+"T"+(a.time||"00:00")+":00Z").getTime();
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : new Date((b.date||"1970-01-01")+"T"+(b.time||"00:00")+":00Z").getTime();
          return tb - ta;
        }),
    [transactions, dateFrom, dateTo, selectedClients, selectedItems]
  );

  const income  = useMemo(() => filtered.filter((t) => t.type === "income").reduce((a, t) => {
    const contrib = getMultiItemContribution(t, selectedItems);
    return a + (contrib ? contrib.combinedCashValue : Number(t.value) - (Number(t.outstanding) || 0));
  }, 0), [filtered, selectedItems]);
  const expense = useMemo(() => filtered.filter((t) => t.type === "expense").reduce((a, t) => {
    const contrib = getMultiItemContribution(t, selectedItems);
    return a + (contrib ? contrib.combinedCashValue : Number(t.value) - (Number(t.outstanding) || 0));
  }, 0), [filtered, selectedItems]);

  const exportCSV = () => {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Tanggal","Waktu","No. Invoice","Klien","Barang","Stok","Karung","Berat (Kg)","Harga/Kg","Jenis","Status","Jatuh Tempo","Nilai Total","Sisa Tagihan","Nilai (Rp)"]];
    filtered.forEach((t) => {
      const contrib = getMultiItemContribution(t, selectedItems);
      const jenisLabel = t.type === "income" ? "Penjualan" : "Pembelian";
      const sign = t.type === "income" ? "-" : "+";
      const txUnit = t.stockUnit || "karung";
      if (contrib) {
        // Item filter active and this row has mixed items: export only matching items
        const totalValue = Number(t.value) || 0;
        contrib.filteredItems.forEach((it) => {
          const itSubtotal = Number(it.subtotal) || 0;
          const itOutstanding = totalValue > 0
            ? Math.round((itSubtotal / totalValue) * (Number(t.outstanding) || 0))
            : 0;
          const qty = it.sackQty != null ? it.sackQty : (it.stockQty != null ? it.stockQty : null);
          const stok = qty != null ? `${sign}${qty} ${txUnit}` : "—";
          rows.push([
            t.date, t.time, t.txnId || "", t.counterparty,
            it.itemName, stok, it.sackQty, it.weightKg || "", it.pricePerKg || "",
            jenisLabel, t.status, t.dueDate || "",
            itSubtotal, itOutstanding, itSubtotal - itOutstanding,
          ]);
        });
      } else {
        const items = Array.isArray(t.items) && t.items.length > 0
          ? t.items
          : [{ itemName: t.itemName, sackQty: t.stockQty, weightKg: t.weightKg || 0, pricePerKg: t.pricePerKg || 0 }];
        items.forEach((it) => {
          const qty = it.sackQty != null ? it.sackQty : (it.stockQty != null ? it.stockQty : null);
          const stok = qty != null ? `${sign}${qty} ${txUnit}` : "—";
          rows.push([
            t.date, t.time, t.txnId || "", t.counterparty,
            it.itemName, stok, it.sackQty, it.weightKg || "", it.pricePerKg || "",
            jenisLabel, t.status, t.dueDate || "",
            t.value, t.outstanding || 0, Number(t.value) - (Number(t.outstanding) || 0),
          ]);
        });
      }
    });
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(rows.map((r) => r.map(q).join(",")).join("\n"));
    a.download = `Laporan_${dateFrom}_sd_${dateTo}.csv`;
    a.click();
  };

  const exportJSON = () => {
    const payload = {
      exportDate: today(),
      dateFrom,
      dateTo,
      filters: { clients: selectedClients, items: selectedItems },
      transactions: filtered,
      summary: { totalIncome: income, totalExpense: expense, netProfit: income - expense },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laporan_${dateFrom || "semua"}_sd_${dateTo || "semua"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (exportFormat === "csv") exportCSV();
    else exportJSON();
  };

  const handleGenerateReport = () => {
    if (filtered.length === 0) { setToast("Tidak ada transaksi yang cocok dengan filter saat ini."); return; }
    if (filtered.length > 50)  { setConfirmCount(filtered.length); return; }
    onReport({ transactions: filtered, dateFrom, dateTo });
  };

  const hasActiveFilters = selectedClients.length > 0 || selectedItems.length > 0;

  const activeFiltersLabel = useMemo(() => {
    const parts = [];
    if (selectedClients.length > 0) parts.push(selectedClients.length === 1 ? `Klien: ${selectedClients[0]}` : `${selectedClients.length} klien dipilih`);
    if (selectedItems.length > 0)   parts.push(selectedItems.length === 1   ? `Item: ${selectedItems[0]}`   : `${selectedItems.length} item dipilih`);
    if (dateFrom) parts.push(`${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`);
    return parts.length ? parts.join(" · ") : "Semua transaksi";
  }, [selectedClients, selectedItems, dateFrom, dateTo]);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Laporan</h2>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="sort-select"
              style={{ width: 90 }}
              aria-label="Format ekspor"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <button onClick={handleExport} className="btn btn-outline" aria-label="Ekspor laporan">
              <Icon name="download" size={14} color="#007bff" /> Ekspor
            </button>
          </div>
          <button onClick={handleGenerateReport} className="btn btn-primary" aria-label="Cetak laporan">
            🧾 Cetak Laporan Sales
          </button>
        </div>
      </div>

      <div className="filter-card">
        {/* Inventory item filter chip */}
        {inventoryFilterItem && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, padding:"6px 12px", background:"#eff6ff", border:"1.5px solid #93c5fd", borderRadius:8 }}>
            <Icon name="search" size={13} color="#2563eb" />
            <span style={{ fontSize:13, color:"#1d4ed8" }}>
              Menampilkan semua transaksi: <strong>{inventoryFilterItem}</strong>
            </span>
            <button
              onClick={() => setInventoryFilterItem(null)}
              style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:"#6b7280", fontSize:14, lineHeight:1 }}
              aria-label="Hapus filter item"
            >
              ✕
            </button>
          </div>
        )}

        {/* Period buttons */}
        <div style={{ display:"flex", gap:7, marginBottom:10, flexWrap:"wrap" }}>
          {[["daily","Hari Ini"],["weekly","7 Hari"],["fortnight","2 Minggu"],["monthly","Bulan Ini"],["all-time","Semua Waktu"],["custom","Kustom"]].map(([p,label]) => (
            <button key={p} onClick={() => applyPeriod(p)} className={`filter-btn ${period===p?"filter-btn--active":""}`} aria-pressed={period===p}>{label}</button>
          ))}
        </div>

        {/* Date pickers */}
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end", marginBottom:12 }}>
          <div>
            <label className="field-label">Dari</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPeriod("custom"); }} className="date-input" aria-label="Tanggal mulai" />
          </div>
          <div>
            <label className="field-label">Sampai</label>
            <input type="date" value={dateTo}   onChange={(e) => { setDateTo(e.target.value);   setPeriod("custom"); }} className="date-input" aria-label="Tanggal akhir" />
          </div>
        </div>

        {/* Multi-select row */}
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end" }}>
          <div style={{ minWidth:200, flex:"1 1 200px" }}>
            <label className="field-label">
              Klien {selectedClients.length > 0 && <span className="ms-filter-badge">{selectedClients.length}</span>}
            </label>
            <MultiSelect options={clientOptions} selected={selectedClients} onChange={setSelectedClients} placeholder="Semua Klien" allLabel="Semua Klien" />
          </div>
          <div style={{ minWidth:200, flex:"1 1 200px" }}>
            <label className="field-label">
              Item / Barang {selectedItems.length > 0 && <span className="ms-filter-badge">{selectedItems.length}</span>}
            </label>
            <MultiSelect options={itemOptions} selected={selectedItems} onChange={setSelectedItems} placeholder="Semua Item" allLabel="Semua Item" />
          </div>
          {hasActiveFilters && (
            <div style={{ display:"flex", alignItems:"flex-end" }}>
              <button onClick={() => { setSelectedClients([]); setSelectedItems([]); }} className="btn btn-secondary btn-sm" aria-label="Reset filter">
                ✕ Reset Filter
              </button>
            </div>
          )}
        </div>

        {/* Filter summary strip */}
        <div className="reports-filter-summary" aria-live="polite">
          <span className="reports-filter-summary__icon">🔍</span>
          <span>{activeFiltersLabel}</span>
          <span className="reports-filter-summary__count">{filtered.length} transaksi ditemukan</span>
        </div>
      </div>

      {/* Large-batch confirm */}
      {confirmCount !== null && (
        <div className="reports-confirm-banner" role="alert">
          <span>Cetak laporan untuk <strong>{confirmCount} transaksi</strong>?</span>
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={() => { setConfirmCount(null); onReport({ transactions: filtered, dateFrom, dateTo }); }} className="btn btn-primary btn-sm">Ya, Cetak Laporan</button>
            <button onClick={() => setConfirmCount(null)} className="btn btn-secondary btn-sm">Batal</button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="summary-grid summary-grid--3" style={{ marginBottom:18 }}>
        {[
          { l:"Total Pemasukan",   sub:"Kas diterima",      v:income,          c:"#10b981" },
          { l:"Total Pengeluaran", sub:"Kas dikeluarkan",   v:expense,         c:"#ef4444" },
          { l:"Laba / Rugi",       sub:"Posisi kas bersih", v:income-expense,  c:(income-expense)>=0?"#007bff":"#ef4444" },
        ].map((x) => (
          <div key={x.l} className="summary-card" style={{ borderBottom:`4px solid ${x.c}`, textAlign:"center" }}>
            <div className="summary-card__label">{x.l}</div>
            <div className="summary-card__value" style={{ color:x.c }}>{fmtIDR(x.v)}</div>
            <div className="summary-card__sub">{x.sub}</div>
            {selectedItems.length >= 1 && (
              <div className="item-filter-note">Nilai dihitung berdasarkan item: {selectedItems.join(", ")}</div>
            )}
          </div>
        ))}
      </div>

      {/* Transaction table */}
      <div className="table-card">
        <div className="table-header-bar"><strong>{filtered.length} transaksi</strong></div>
        {filtered.length === 0 ? (
          <div className="empty-state">Tidak ada data untuk filter ini.</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table className="data-table">
              <thead>
                <tr>{["Tanggal","No. Invoice","Klien","Barang","Stok","Jenis","Status","Jatuh Tempo","Nilai (Rp)","Piutang/Hutang"].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const contrib = getMultiItemContribution(t, selectedItems);
                  const cashVal = contrib
                    ? contrib.combinedCashValue
                    : Number(t.value) - (Number(t.outstanding) || 0);
                  const displayOutstanding = contrib
                    ? contrib.combinedProportionalOutstanding
                    : (t.outstanding || 0);
                  const isMulti = Array.isArray(t.items) && t.items.length > 1;
                  const stockColor = t.type === "income" ? "#ef4444" : "#10b981";
                  return (
                    <tr key={t.id} className={i%2===0?"":"row-alt"}>
                      <td className="text-muted td-date">{fmtDate(t.date)}</td>
                      <td style={{ fontSize: 11, fontWeight: 600, color: t.type === "income" ? "#6366f1" : "#374151", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                        {t.txnId || <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      <td className="td-name">{t.counterparty}</td>

                      {/* Item / Barang column */}
                      <td style={isMulti ? { verticalAlign: "top" } : {}}>
                        {contrib ? (
                          <div className="item-list">
                            {contrib.filteredItems.map((item, idx) => (
                              <div key={`m-${idx}`} className="item-list__row item-filter-primary">
                                <span className="item-list__bullet">•</span>
                                <span>{item.itemName}</span>
                              </div>
                            ))}
                            {contrib.otherItems.map((item, idx) => (
                              <div key={`o-${idx}`} className="item-list__row item-filter-secondary">
                                <span className="item-list__bullet" style={{ color: "#d1d5db" }}>•</span>
                                <span>{item.itemName}</span>
                              </div>
                            ))}
                          </div>
                        ) : isMulti ? (
                          <div className="item-list">
                            {t.items.map((item, idx) => (
                              <div key={idx} className="item-list__row">
                                <span className="item-list__bullet">•</span>
                                <span>{item.itemName}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          t.itemName
                        )}
                      </td>

                      {/* Stok column */}
                      <td style={{ color: stockColor, fontWeight: 600, ...(isMulti ? { verticalAlign: "top" } : {}) }}>
                        {contrib ? (
                          <div className="item-list" style={{ alignItems: "center" }}>
                            {contrib.filteredItems.map((item, idx) => (
                              <div key={`m-${idx}`} className="item-list__row item-filter-primary" style={{ justifyContent: "center" }}>
                                <span style={{ color: stockColor }}>{t.type === "income" ? "-" : "+"}{parseFloat(item.sackQty) || 0} karung</span>
                              </div>
                            ))}
                            {contrib.otherItems.map((item, idx) => (
                              <div key={`o-${idx}`} className="item-list__row item-filter-secondary" style={{ justifyContent: "center" }}>
                                <span>{t.type === "income" ? "-" : "+"}{parseFloat(item.sackQty) || 0} karung</span>
                              </div>
                            ))}
                          </div>
                        ) : isMulti ? (
                          <div className="item-list" style={{ alignItems: "center" }}>
                            {t.items.map((item, idx) => (
                              <div key={idx} className="item-list__row" style={{ justifyContent: "center" }}>
                                <span style={{ color: stockColor }}>{t.type === "income" ? "-" : "+"}{parseFloat(item.sackQty) || 0} karung</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>{t.type === "income" ? "-" : "+"}{parseFloat(t.stockQty) || 0} {t.stockUnit}</>
                        )}
                      </td>

                      <td><TypeBadge type={t.type} /></td>
                      <td><StatusBadge status={t.status} /></td>
                      <td style={{ textAlign:"center" }}><DueBadge dueDate={t.dueDate} outstanding={t.outstanding} /></td>

                      {/* Nilai Kas column */}
                      <td style={{ fontWeight: 700, color: t.type === "income" ? "#10b981" : "#ef4444" }}>
                        {contrib ? (
                          <div>
                            <div className="item-filter-value-primary" style={{ color: t.type === "income" ? "#10b981" : "#ef4444" }}>{fmtIDR(contrib.combinedCashValue)}</div>
                            <div className="item-filter-value-secondary">Total transaksi: {fmtIDR(Number(t.value) - (Number(t.outstanding) || 0))}</div>
                          </div>
                        ) : fmtIDR(cashVal)}
                      </td>

                      {/* Piutang/Hutang column */}
                      <td style={{ fontSize: 11, color: displayOutstanding > 0 ? "#f59e0b" : "#9ca3af" }}>
                        {displayOutstanding > 0 ? (
                          <div>
                            <div>{fmtIDR(displayOutstanding)}</div>
                            {contrib && (t.outstanding || 0) > 0 && (
                              <div className="item-filter-value-secondary">Total: {fmtIDR(t.outstanding)}</div>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
};

export default Reports;