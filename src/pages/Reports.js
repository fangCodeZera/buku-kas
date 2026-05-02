/**
 * pages/Reports.js
 * Filtered financial report with date/contact/item/period controls,
 * summary cards, a CSS bar chart, transaction table, CSV export,
 * and direct "Generate Invoice/Report" for the filtered set.
 *
 * Client and item filters are now multi-select (zero-dep custom component).
 */
import React, { useState, useMemo, useEffect } from "react";
import { TypeBadge } from "../components/Badge";
import Icon        from "../components/Icon";
import Toast       from "../components/Toast";
import MultiSelect from "../components/MultiSelect";
import { fmtIDR, fmtDate, fmtQty, today, addDays } from "../utils/idGenerators";
import TransactionDetailModal from "../components/TransactionDetailModal";
import { getMultiItemContribution, EDIT_NOTES } from "../utils/reportUtils";

const Reports = ({ transactions, contacts, settings, onReport, initItemFilter = null, onClearItemFilter = () => {}, profile }) => {
  const isOwner = profile?.role === "owner";
  const [dateFrom,        setDateFrom]        = useState(() => {
    if (initItemFilter) return "";
    return today(); // "daily" default — from = today
  });
  const [dateTo,          setDateTo]          = useState(() => initItemFilter ? "" : today());
  const [selectedClients, setSelectedClients] = useState([]);
  const [selectedItems,   setSelectedItems]   = useState(() => initItemFilter ? [initItemFilter] : []);
  const [period,          setPeriod]          = useState(() => initItemFilter ? "all-time" : "daily");
  const [inventoryFilterItem, setInventoryFilterItem] = useState(initItemFilter || null);

  // Clear App.js reportItemFilter once consumed so re-navigating to Reports starts fresh
  useEffect(() => {
    if (initItemFilter) onClearItemFilter();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [typeFilter,      setTypeFilter]      = useState("all"); // "all" | "income" | "expense"
  const [toast,           setToast]           = useState(null);
  const [confirmCount,    setConfirmCount]    = useState(null);
  const [exportFormat,    setExportFormat]    = useState("csv");
  const [detailTx,        setDetailTx]        = useState(null);

  // Column visibility toggles — reset to default on every page load (no persistence)
  // Sudah Dibayar is visible by default; others hidden. Role-sensitive cols gated by isOwner.
  const [colSudahDibayar, setColSudahDibayar] = useState(true);
  const [colTotalNilai,   setColTotalNilai]   = useState(false);
  const [colSisaTagihan,  setColSisaTagihan]  = useState(false);
  const [colPiutang,      setColPiutang]      = useState(false);
  const [colJenis,        setColJenis]        = useState(false);
  const [table1Open,      setTable1Open]      = useState(true);
  const [table2Open,      setTable2Open]      = useState(true);

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
        .filter((t) => typeFilter === "all" || t.type === typeFilter)
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
    [transactions, dateFrom, dateTo, selectedClients, selectedItems, typeFilter]
  );

  const income  = useMemo(() => filtered.filter((t) => t.type === "income").reduce((a, t) => {
    const contrib = getMultiItemContribution(t, selectedItems);
    return a + (contrib ? contrib.combinedCashValue : Number(t.value) - (Number(t.outstanding) || 0));
  }, 0), [filtered, selectedItems]);
  const expense = useMemo(() => filtered.filter((t) => t.type === "expense").reduce((a, t) => {
    const contrib = getMultiItemContribution(t, selectedItems);
    return a + (contrib ? contrib.combinedCashValue : Number(t.value) - (Number(t.outstanding) || 0));
  }, 0), [filtered, selectedItems]);

  const paymentCount = useMemo(() => {
    const filteredTxIds = new Set(filtered.map((t) => t.id));
    return transactions.reduce((total, t) => {
      // When item filter active, only count payments from transactions in the filtered set
      if (selectedItems.length > 0 && !filteredTxIds.has(t.id)) return total;
      if (typeFilter !== "all" && t.type !== typeFilter) return total;
      if (!Array.isArray(t.paymentHistory)) return total;
      return total + t.paymentHistory.filter((ph) =>
        Number(ph.amount) > 0 &&
        !EDIT_NOTES.has(ph.note) &&
        (!dateFrom || (ph.date || "") >= dateFrom) &&
        (!dateTo   || (ph.date || "") <= dateTo)
      ).length;
    }, 0);
  }, [transactions, filtered, dateFrom, dateTo, selectedItems, typeFilter]);

  const grandTotalPaid = useMemo(() => {
    const filteredNet = filtered.reduce((sum, t) => {
      const contrib = getMultiItemContribution(t, selectedItems);
      const cash = contrib
        ? contrib.combinedCashValue
        : Number(t.value) - (Number(t.outstanding) || 0);
      return t.type === "income" ? sum + cash : sum - cash;
    }, 0);
    const filteredIds = new Set(filtered.map((t) => t.id));
    const allPaymentsNet = selectedItems.length > 0 ? 0 : transactions.reduce((sum, t) => {
      if (filteredIds.has(t.id)) return sum; // already in filteredNet
      if (!Array.isArray(t.paymentHistory)) return sum;
      const pmtSum = t.paymentHistory
        .filter((ph) =>
          Number(ph.amount) > 0 &&
          !EDIT_NOTES.has(ph.note) &&
          (!dateFrom || (ph.date || "") >= dateFrom) &&
          (!dateTo   || (ph.date || "") <= dateTo)
        )
        .reduce((s, ph) => s + Number(ph.amount), 0);
      return t.type === "income" ? sum + pmtSum : sum - pmtSum;
    }, 0);
    return filteredNet + allPaymentsNet;
  }, [filtered, transactions, dateFrom, dateTo, selectedItems]);

  const grandTotalNilai = useMemo(() => {
    return filtered.reduce((sum, t) => {
      const contrib = getMultiItemContribution(t, selectedItems);
      const nilai = contrib ? contrib.combinedSubtotal : Number(t.value) || 0;
      return t.type === "income" ? sum + nilai : sum - nilai;
    }, 0);
  }, [filtered, selectedItems]);

  const exportCSV = () => {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const pmtFilter = (ph) =>
      Number(ph.amount) > 0 &&
      !EDIT_NOTES.has(ph.note) &&
      (!dateFrom || (ph.date || "") >= dateFrom) &&
      (!dateTo   || (ph.date || "") <= dateTo);

    const rows = [[
      "No", "No. Invoice", "Tanggal", "Klien", "Barang",
      "Berat Kg @ Harga", "Krg", "Subtotal",
      "Sudah Dibayar", "Total Nilai", "Sisa Tagihan",
      "Jenis", "Status", "Jatuh Tempo", "Tipe Baris",
    ]];

    // Transaction rows — one row per item
    filtered.forEach((t, txIdx) => {
      const items = Array.isArray(t.items) && t.items.length > 0
        ? t.items
        : [{ itemName: t.itemName || "", sackQty: t.stockQty ?? "", weightKg: t.weightKg || 0, pricePerKg: t.pricePerKg || 0, subtotal: t.value || 0 }];
      const jenisLabel = t.type === "income" ? "Penjualan" : "Pembelian";
      const contrib = getMultiItemContribution(t, selectedItems);
      const sudahDibayar = contrib
        ? contrib.combinedCashValue
        : Number(t.value) - (Number(t.outstanding) || 0);
      const txNo = txIdx + 1;
      items.forEach((it, itIdx) => {
        const isFirst = itIdx === 0;
        const berat = it.weightKg ? it.weightKg : "";
        const harga = it.pricePerKg ? it.pricePerKg : "";
        const beratHarga = (berat !== "" || harga !== "") ? `${berat} Kg @ ${harga}` : "";
        rows.push([
          isFirst ? txNo          : "",
          isFirst ? (t.txnId || "") : "",
          isFirst ? t.date        : "",
          isFirst ? t.counterparty : "",
          it.itemName || "",
          beratHarga,
          it.sackQty != null ? it.sackQty : "",
          it.subtotal != null ? it.subtotal : "",
          isFirst ? sudahDibayar          : "",
          isFirst ? (Number(t.value) || 0) : "",
          isFirst ? (Number(t.outstanding) || 0) : "",
          isFirst ? jenisLabel    : "",
          isFirst ? (t.status || "") : "",
          isFirst ? (t.dueDate || "") : "",
          "Transaksi",
        ]);
      });
    });

    // Payment rows — inline (from filtered transactions)
    const filteredPaymentIds = new Set(filtered.map((t) => t.id));
    filtered.forEach((t) => {
      if (!Array.isArray(t.paymentHistory)) return;
      const jenisLabel = t.type === "income" ? "Penjualan" : "Pembelian";
      t.paymentHistory.filter(pmtFilter).forEach((ph) => {
        const effectiveAmount = ph.note === "Lunas saat transaksi dibuat"
          ? Number(t.value) - (Number(t.outstanding) || 0)
          : Number(ph.amount);
        const signedAmount = t.type === "income" ? effectiveAmount : -effectiveAmount;
        rows.push([
          "", t.txnId || "", ph.date, t.counterparty,
          ph.note || "", "", "", "",
          signedAmount, "", ph.outstandingAfter ?? "",
          jenisLabel, "", "", "Pembayaran",
        ]);
      });
    });

    // Payment rows — orphan (from transactions outside filtered, payment date in range)
    transactions.forEach((t) => {
      if (filteredPaymentIds.has(t.id)) return;
      if (!Array.isArray(t.paymentHistory)) return;
      const jenisLabel = t.type === "income" ? "Penjualan" : "Pembelian";
      t.paymentHistory.filter(pmtFilter).forEach((ph) => {
        const effectiveAmount = ph.note === "Lunas saat transaksi dibuat"
          ? Number(t.value) - (Number(t.outstanding) || 0)
          : Number(ph.amount);
        const signedAmount = t.type === "income" ? effectiveAmount : -effectiveAmount;
        rows.push([
          "", t.txnId || "", ph.date, t.counterparty,
          ph.note || "", "", "", "",
          signedAmount, "", ph.outstandingAfter ?? "",
          jenisLabel, "", "", "Pembayaran",
        ]);
      });
    });

    // Grand total row
    rows.push([
      "", "", "", "", "", "", "", "",
      grandTotalPaid, "", "", "", "", "", "Grand Total",
    ]);

    const BOM = "\uFEFF";
    const csvContent = BOM + rows.map((r) => r.map(q).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filename = !dateFrom && !dateTo
      ? "Laporan_semua"
      : dateFrom && !dateTo
      ? `Laporan_mulai_${dateFrom}`
      : `Laporan_${dateFrom}_sd_${dateTo}`;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    if (filtered.length === 0 && paymentCount === 0) { setToast("Tidak ada transaksi yang cocok dengan filter saat ini."); return; }
    if (filtered.length + paymentCount > 50) { setConfirmCount(filtered.length); return; }
    onReport({ transactions: filtered, allTransactions: transactions, dateFrom, dateTo, selectedItems, colSudahDibayar, colTotalNilai, colSisaTagihan, colPiutang, colJenis });
  };

  const hasActiveFilters = selectedClients.length > 0 || selectedItems.length > 0;

  const activeFiltersLabel = useMemo(() => {
    const parts = [];
    if (typeFilter !== "all") parts.push(typeFilter === "income" ? "Penjualan" : "Pembelian");
    if (selectedClients.length > 0) parts.push(selectedClients.length === 1 ? `Klien: ${selectedClients[0]}` : `${selectedClients.length} klien dipilih`);
    if (selectedItems.length > 0)   parts.push(selectedItems.length === 1   ? `Item: ${selectedItems[0]}`   : `${selectedItems.length} item dipilih`);
    if (dateFrom) parts.push(`${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`);
    return parts.length ? parts.join(" · ") : "Semua transaksi";
  }, [typeFilter, selectedClients, selectedItems, dateFrom, dateTo]);

  // Helper: filter predicate for visible payment entries
  const visiblePmtFilter = (ph) =>
    Number(ph.amount) > 0 &&
    !EDIT_NOTES.has(ph.note) &&
    (!dateFrom || (ph.date || "") >= dateFrom) &&
    (!dateTo   || (ph.date || "") <= dateTo);

  // Orphan payments: payments made in the date window for transactions OUTSIDE the window
  const orphanPayments = useMemo(() => {
    if (selectedItems.length > 0) return [];
    const filteredIds = new Set(filtered.map((t) => t.id));
    const result = [];
    transactions.forEach((t) => {
      if (filteredIds.has(t.id)) return;
      if (typeFilter !== "all" && t.type !== typeFilter) return;
      if (!Array.isArray(t.paymentHistory)) return;
      const pmts = t.paymentHistory.filter(visiblePmtFilter);
      if (pmts.length > 0) result.push({ t, pmts });
    });
    return result;
  }, [transactions, filtered, selectedItems, dateFrom, dateTo, typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper: render payment <tr> elements for a transaction
  const mkPaymentRows = (t, payments, keyPrefix, contrib = null) => {
    const isIncome = t.type === "income";
    const phBorderColor = isIncome ? "#10b981" : "#ef4444";
    const phBg          = isIncome ? "#f0fdf4" : "#fff1f2";
    const phBadgeBg     = isIncome ? "#dcfce7" : "#fee2e2";
    const phBadgeFg     = isIncome ? "#065f46" : "#991b1b";
    const phBadgeLabel  = isIncome ? "Pembayaran Diterima" : "Pembayaran Dilakukan";
    const phAmountColor = isIncome ? "#10b981" : "#ef4444";
    return payments.map((ph, phIdx) => (
      <tr key={`${keyPrefix}-${t.id}-${phIdx}`} style={{ background: phBg, borderLeft: `3px solid ${phBorderColor}` }}>
        <td />
        <td style={{ fontSize: 11, fontWeight: 600, color: isIncome ? "#6366f1" : "#374151", fontFamily: "monospace", whiteSpace: "nowrap" }}>
          {t.txnId || <span style={{ color: "#d1d5db" }}>—</span>}
        </td>
        <td className="td-date" style={{ fontSize: 11, color: "#6b7280" }}>{fmtDate(ph.date)}</td>
        <td className="td-name" style={{ fontSize: 11, color: "#6b7280" }}>{t.counterparty}</td>
        <td style={{ fontSize: 11 }}>
          <div>
            <span style={{ background: phBadgeBg, color: phBadgeFg, borderRadius: 6, padding: "1px 7px", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
              {phBadgeLabel}
            </span>
            {ph.note ? <span style={{ marginLeft: 4, color: "#374151" }}>{ph.note}</span> : null}
          </div>
          {contrib && (
            <div style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic", marginTop: 2 }}>
              Pembayaran untuk seluruh transaksi ({fmtIDR(t.value)})
            </div>
          )}
          {(ph.outstandingBefore != null || ph.outstandingAfter != null) && (
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
              Sisa: {fmtIDR(ph.outstandingBefore ?? 0)} → {fmtIDR(ph.outstandingAfter ?? 0)}
              {Number(ph.outstandingAfter) === 0 && <span style={{ color: "#10b981", fontWeight: 600 }}> ✓ Lunas</span>}
            </div>
          )}
        </td>
        <td /><td /><td /><td />
        {colSudahDibayar && (
          <td className="td-right" style={{ color: phAmountColor, fontWeight: 700, fontSize: 12 }}>
            {isIncome ? "+" : "-"}{fmtIDR(
              ph.note === "Lunas saat transaksi dibuat"
                ? Number(t.value) - (Number(t.outstanding) || 0)
                : ph.amount
            )}
          </td>
        )}
        {colTotalNilai  && <td />}
        {colSisaTagihan && (
          <td className="td-right" style={{ fontSize: 11 }}>
            {Number(ph.outstandingAfter) > 0
              ? <span style={{ color: "#f59e0b" }}>{fmtIDR(ph.outstandingAfter)}</span>
              : <span style={{ color: "#10b981", fontWeight: 600 }}>Lunas ✓</span>}
          </td>
        )}
        {colPiutang && <td />}
        {colJenis   && <td />}
      </tr>
    ));
  };

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
              onClick={() => { setInventoryFilterItem(null); setSelectedItems([]); }}
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
          <div>
            <label className="field-label">Jenis Transaksi</label>
            <div style={{ display:"flex", gap:6 }}>
              <button
                onClick={() => setTypeFilter("all")}
                className={`type-filter-btn${typeFilter === "all" ? " active-all" : ""}`}
                aria-pressed={typeFilter === "all"}
              >Semua</button>
              <button
                onClick={() => setTypeFilter("income")}
                className={`type-filter-btn${typeFilter === "income" ? " active-income" : ""}`}
                aria-pressed={typeFilter === "income"}
              >Penjualan</button>
              <button
                onClick={() => setTypeFilter("expense")}
                className={`type-filter-btn${typeFilter === "expense" ? " active-expense" : ""}`}
                aria-pressed={typeFilter === "expense"}
              >Pembelian</button>
            </div>
          </div>
          {hasActiveFilters && (
            <div style={{ display:"flex", alignItems:"flex-end" }}>
              <button onClick={() => { setSelectedClients([]); setSelectedItems([]); setInventoryFilterItem(null); }} className="btn btn-secondary btn-sm" aria-label="Reset filter">
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
            <button onClick={() => { setConfirmCount(null); onReport({ transactions: filtered, allTransactions: transactions, dateFrom, dateTo, selectedItems, colSudahDibayar, colTotalNilai, colSisaTagihan, colPiutang, colJenis }); }} className="btn btn-primary btn-sm">Ya, Cetak Laporan</button>
            <button onClick={() => setConfirmCount(null)} className="btn btn-secondary btn-sm">Batal</button>
          </div>
        </div>
      )}

      {/* Summary cards — Pemilik only */}
      {isOwner && (
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
      )}

      {/* Transaction table — Table 1: Transactions in period */}
      <div className="table-card" style={{ marginBottom: 16 }}>
        {/* Column toggle bar */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: "8px 12px 4px", borderBottom: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginRight: 2 }}>Tampilkan kolom:</span>
          {[
            ["Sudah Dibayar", colSudahDibayar, setColSudahDibayar],
            ["Total Nilai",   colTotalNilai,   setColTotalNilai],
            ["Sisa Tagihan",  colSisaTagihan,  setColSisaTagihan],
            ["Piutang/Hutang",colPiutang,      setColPiutang],
            ["Jenis",         colJenis,        setColJenis],
          ].map(([label, on, setter]) => (
            <button
              key={label}
              onClick={() => setter((v) => !v)}
              className={`filter-btn${on ? " filter-btn--active" : ""}`}
              style={{ fontSize: 11, padding: "2px 10px" }}
              aria-pressed={on}
            >{label}</button>
          ))}
        </div>

        {/* Table 1 collapse header */}
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", cursor: "pointer", userSelect: "none", borderBottom: table1Open ? "1px solid #e2e8f0" : "none" }}
          onClick={() => setTable1Open((v) => !v)}
          aria-expanded={table1Open}
        >
          <strong style={{ fontSize: 13 }}>
            {table1Open ? "▾" : "▸"} Transaksi Periode Ini
            <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: 8, fontSize: 12 }}>
              {filtered.length} transaksi · {paymentCount} pembayaran
            </span>
          </strong>
        </div>

        {!table1Open ? null : filtered.length === 0 ? (
          <div className="empty-state">Tidak ada transaksi untuk filter ini.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 120 }} />
                <col />
                <col style={{ width: 70 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 100 }} />
                {colSudahDibayar && <col style={{ width: 110 }} />}
                {colTotalNilai   && <col style={{ width: 110 }} />}
                {colSisaTagihan  && <col style={{ width: 110 }} />}
                {colPiutang      && <col style={{ width: 110 }} />}
                {colJenis                   && <col style={{ width: 90 }} />}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ textAlign: "center" }}>No</th>
                  <th>No. Invoice</th>
                  <th>Tanggal</th>
                  <th>Klien</th>
                  <th>Barang</th>
                  <th className="th-right">Krg</th>
                  <th className="th-right">Berat (Kg)</th>
                  <th className="th-right">Harga/Kg</th>
                  <th className="th-right">Subtotal</th>
                  {colSudahDibayar && <th className="th-right">Sudah Dibayar</th>}
                  {colTotalNilai   && <th className="th-right">Total Nilai</th>}
                  {colSisaTagihan  && <th className="th-right">Sisa Tagihan</th>}
                  {colPiutang      && <th className="th-right">Piutang/Hutang</th>}
                  {colJenis                   && <th className="th-center">Jenis</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, txIdx) => {
                  const items = Array.isArray(t.items) && t.items.length > 0
                    ? t.items
                    : [{ itemName: t.itemName || "—", sackQty: t.stockQty ?? 0, weightKg: t.weightKg || 0, pricePerKg: t.pricePerKg || 0, subtotal: t.value || 0 }];
                  const isMulti = items.length > 1;
                  const txNo = txIdx + 1;
                  const paid = Number(t.value) - (Number(t.outstanding) || 0);
                  const outstanding = Number(t.outstanding) || 0;
                  const rowBg = { background: "#f8fafc" }; // first/subtotal rows — slight shade
                  const itemBg = { background: "#ffffff" }; // continuation item rows
                  const optCells = (show, contrib = null) => {
                    const effectivePaid = contrib ? contrib.combinedCashValue : paid;
                    const effectiveOutstanding = contrib
                      ? contrib.combinedProportionalOutstanding
                      : outstanding;
                    const paidColor = effectivePaid > 0 ? "#10b981" : "#9ca3af";
                    const outstandingColor = effectiveOutstanding > 0 ? "#f59e0b" : "#9ca3af";
                    return show ? (
                      <>
                        {colSudahDibayar && <td className="td-right" style={{ color: paidColor, fontWeight: 600 }}>{fmtIDR(effectivePaid)}</td>}
                        {colTotalNilai   && <td className="td-right" style={{ fontWeight: 600 }}>{fmtIDR(contrib ? contrib.combinedSubtotal : Number(t.value))}</td>}
                        {colSisaTagihan  && <td className="td-right" style={{ color: outstandingColor }}>{effectiveOutstanding > 0 ? fmtIDR(effectiveOutstanding) : "—"}</td>}
                        {colPiutang      && <td className="td-center">{(() => {
                          const [bg, fg, label] = outstanding > 0
                            ? t.type === "income"
                              ? ["#d1fae5", "#065f46", "Piutang"]
                              : ["#fee2e2", "#991b1b", "Hutang"]
                            : ["#d1fae5", "#065f46", "Lunas"];
                          return <span style={{ background: bg, color: fg, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>;
                        })()}</td>}
                        {colJenis        && <td className="td-center"><TypeBadge type={t.type} /></td>}
                      </>
                    ) : (
                      <>
                        {colSudahDibayar && <td />}
                        {colTotalNilai   && <td />}
                        {colSisaTagihan  && <td />}
                        {colPiutang      && <td />}
                        {colJenis        && <td />}
                      </>
                    );
                  };

                  const groupBorder = txIdx > 0 ? { borderTop: "1.5px solid #cbd5e1" } : {};

                  if (!isMulti) {
                    // Single-item transaction — one row, optional cols shown here
                    const it = items[0];
                    const inlinePayments = Array.isArray(t.paymentHistory)
                      ? t.paymentHistory.filter(visiblePmtFilter)
                      : [];
                    return [
                      <tr
                        key={t.id}
                        style={{ ...rowBg, ...groupBorder, cursor: "pointer" }}
                        onClick={(e) => { if (!e.target.closest("button,a,input,select,textarea")) setDetailTx(t); }}
                      >
                        <td style={{ textAlign: "center", color: "#6b7280", fontSize: 12 }}>{txNo}</td>
                        <td style={{ fontSize: 11, fontWeight: 600, color: t.type === "income" ? "#6366f1" : "#374151", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                          {t.txnId || <span style={{ color: "#d1d5db" }}>—</span>}
                        </td>
                        <td className="text-muted td-date">{fmtDate(t.date)}</td>
                        <td className="td-name">{t.counterparty}</td>
                        <td>{it.itemName}</td>
                        <td className="td-right">{it.sackQty != null ? fmtQty(it.sackQty) : "—"}</td>
                        <td className="td-right">{it.weightKg ? fmtQty(it.weightKg) : "—"}</td>
                        <td className="td-right">{it.pricePerKg ? fmtIDR(it.pricePerKg) : "—"}</td>
                        <td className="td-right" style={{ fontWeight: 700 }}>{fmtIDR(it.subtotal)}</td>
                        {optCells(true)}
                      </tr>,
                      ...mkPaymentRows(t, inlinePayments, "iph"),
                    ];
                  }

                  // Multi-item transaction — item rows + subtotal row
                  const contrib = getMultiItemContribution(t, selectedItems);
                  const rows = items.map((it, itIdx) => {
                    const isFirst = itIdx === 0;
                    const isFiltered = selectedItems.length === 0 || selectedItems.includes(it.itemName);
                    return (
                      <tr
                        key={`${t.id}-${itIdx}`}
                        style={{
                          ...(isFirst ? rowBg : itemBg),
                          ...(isFirst ? groupBorder : {}),
                          ...(!isFiltered && contrib ? { opacity: 0.4, color: "#9ca3af" } : {}),
                          cursor: isFirst ? "pointer" : "default",
                        }}
                        onClick={isFirst ? (e) => { if (!e.target.closest("button,a,input,select,textarea")) setDetailTx(t); } : undefined}
                      >
                        <td style={{ textAlign: "center", color: "#6b7280", fontSize: 12 }}>{isFirst ? txNo : ""}</td>
                        <td style={{ fontSize: 11, fontWeight: 600, color: t.type === "income" ? "#6366f1" : "#374151", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                          {isFirst ? (t.txnId || <span style={{ color: "#d1d5db" }}>—</span>) : ""}
                        </td>
                        <td className="text-muted td-date">{isFirst ? fmtDate(t.date) : ""}</td>
                        <td className="td-name">{isFirst ? t.counterparty : ""}</td>
                        <td style={{ paddingLeft: isFirst ? undefined : 20 }}>{it.itemName}</td>
                        <td className="td-right">{it.sackQty != null ? fmtQty(it.sackQty) : "—"}</td>
                        <td className="td-right">{it.weightKg ? fmtQty(it.weightKg) : "—"}</td>
                        <td className="td-right">{it.pricePerKg ? fmtIDR(it.pricePerKg) : "—"}</td>
                        <td className="td-right">{fmtIDR(it.subtotal)}</td>
                        {optCells(false)}
                      </tr>
                    );
                  });

                  // Subtotal row — spans label cols, shows total value + optional cols
                  const subtotalRow = (
                    <tr key={`${t.id}-sub`} style={{ ...rowBg, borderTop: "1px solid #e2e8f0" }}>
                      <td colSpan={8} style={{ textAlign: "right", fontSize: 11, color: "#6b7280", paddingRight: 8, fontStyle: "italic" }}>
                        {contrib ? (
                          <>
                            Total: {fmtIDR(contrib.combinedSubtotal)}{" "}
                            <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 10 }}>
                              (dari {fmtIDR(contrib.totalTransactionValue)})
                            </span>
                          </>
                        ) : "Total:"}
                      </td>
                      <td className="td-right" style={{ fontWeight: 700 }}>
                        {contrib ? fmtIDR(contrib.combinedSubtotal) : fmtIDR(t.value)}
                      </td>
                      {optCells(true, contrib)}
                    </tr>
                  );

                  const inlinePayments = Array.isArray(t.paymentHistory)
                    ? t.paymentHistory.filter(visiblePmtFilter)
                    : [];
                  return [...rows, subtotalRow, ...mkPaymentRows(t, inlinePayments, "iph", contrib)];
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Transaction table — Table 2: Orphan payments (outside date range) */}
      {orphanPayments.length > 0 && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", cursor: "pointer", userSelect: "none", borderBottom: table2Open ? "1px solid #e2e8f0" : "none" }}
            onClick={() => setTable2Open((v) => !v)}
            aria-expanded={table2Open}
          >
            <strong style={{ fontSize: 13 }}>
              {table2Open ? "▾" : "▸"} Pembayaran dari Transaksi Luar Periode
              <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: 8, fontSize: 12 }}>
                {orphanPayments.reduce((n, { pmts }) => n + pmts.length, 0)} pembayaran
              </span>
            </strong>
          </div>

          {table2Open && (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <colgroup>
                  <col style={{ width: 36 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 120 }} />
                  <col />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 100 }} />
                  {colSudahDibayar && <col style={{ width: 110 }} />}
                  {colTotalNilai   && <col style={{ width: 110 }} />}
                  {colSisaTagihan  && <col style={{ width: 110 }} />}
                  {colPiutang      && <col style={{ width: 110 }} />}
                  {colJenis        && <col style={{ width: 90 }} />}
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: "center" }}>No</th>
                    <th>No. Invoice</th>
                    <th>Tanggal Bayar</th>
                    <th>Klien</th>
                    <th>Catatan</th>
                    <th className="th-right">Krg</th>
                    <th className="th-right">Berat (Kg)</th>
                    <th className="th-right">Harga/Kg</th>
                    <th className="th-right">Subtotal</th>
                    {colSudahDibayar && <th className="th-right">Sudah Dibayar</th>}
                    {colTotalNilai   && <th className="th-right">Total Nilai</th>}
                    {colSisaTagihan  && <th className="th-right">Sisa Tagihan</th>}
                    {colPiutang      && <th className="th-right">Piutang/Hutang</th>}
                    {colJenis        && <th className="th-center">Jenis</th>}
                  </tr>
                </thead>
                <tbody>
                  {orphanPayments.map(({ t, pmts }, groupIdx) =>
                    pmts.map((ph, phIdx) => {
                      const isIncome = t.type === "income";
                      const phBorderColor = isIncome ? "#10b981" : "#ef4444";
                      const phBg          = isIncome ? "#f0fdf4" : "#fff1f2";
                      const phBadgeBg     = isIncome ? "#dcfce7" : "#fee2e2";
                      const phBadgeFg     = isIncome ? "#065f46" : "#991b1b";
                      const phBadgeLabel  = isIncome ? "Pembayaran Diterima" : "Pembayaran Dilakukan";
                      const phAmountColor = isIncome ? "#10b981" : "#ef4444";
                      return (
                        <tr
                          key={`oph-${t.id}-${phIdx}`}
                          style={{ background: phBg, borderLeft: `3px solid ${phBorderColor}`, cursor: "pointer" }}
                          onClick={() => setDetailTx(t)}
                        >
                          <td style={{ textAlign: "center", color: "#6b7280", fontSize: 12 }}>{groupIdx + 1}</td>
                          <td style={{ fontSize: 11, fontWeight: 600, color: isIncome ? "#6366f1" : "#374151", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                            {t.txnId || <span style={{ color: "#d1d5db" }}>—</span>}
                          </td>
                          <td className="td-date" style={{ fontSize: 11, color: "#6b7280" }}>{fmtDate(ph.date)}</td>
                          <td className="td-name" style={{ fontSize: 11, color: "#6b7280" }}>{t.counterparty}</td>
                          <td style={{ fontSize: 11 }}>
                            <div>
                              <span style={{ background: phBadgeBg, color: phBadgeFg, borderRadius: 6, padding: "1px 7px", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
                                {phBadgeLabel}
                              </span>
                              {ph.note ? <span style={{ marginLeft: 4, color: "#374151" }}>{ph.note}</span> : null}
                            </div>
                            {(ph.outstandingBefore != null || ph.outstandingAfter != null) && (
                              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                                Sisa: {fmtIDR(ph.outstandingBefore ?? 0)} → {fmtIDR(ph.outstandingAfter ?? 0)}
                                {Number(ph.outstandingAfter) === 0 && <span style={{ color: "#10b981", fontWeight: 600 }}> ✓ Lunas</span>}
                              </div>
                            )}
                          </td>
                          <td /><td /><td /><td />
                          {colSudahDibayar && (
                            <td className="td-right" style={{ color: phAmountColor, fontWeight: 700, fontSize: 12 }}>
                              {isIncome ? "+" : "-"}{fmtIDR(
                                ph.note === "Lunas saat transaksi dibuat"
                                  ? Number(t.value) - (Number(t.outstanding) || 0)
                                  : ph.amount
                              )}
                            </td>
                          )}
                          {colTotalNilai  && <td />}
                          {colSisaTagihan && (
                            <td className="td-right" style={{ fontSize: 11 }}>
                              {Number(ph.outstandingAfter) > 0
                                ? <span style={{ color: "#f59e0b" }}>{fmtIDR(ph.outstandingAfter)}</span>
                                : <span style={{ color: "#10b981", fontWeight: 600 }}>Lunas ✓</span>}
                            </td>
                          )}
                          {colPiutang && <td />}
                          {colJenis   && <td />}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Grand total — standalone below both tables */}
      {(filtered.length > 0 || paymentCount > 0 || orphanPayments.length > 0) && (
        <div style={{ padding: "10px 16px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#374151", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>{filtered.length} transaksi</span>
          {paymentCount > 0 && (
            <>
              <span style={{ color: "#6b7280" }}>·</span>
              <span style={{ color: "#6b7280" }}>{paymentCount} pembayaran</span>
            </>
          )}
          {orphanPayments.length > 0 && (
            <>
              <span style={{ color: "#6b7280" }}>·</span>
              <span style={{ color: "#6b7280" }}>
                {orphanPayments.reduce((n, { pmts }) => n + pmts.length, 0)} pembayaran luar periode
              </span>
            </>
          )}
          <span style={{ color: "#6b7280" }}>|</span>
          <span>
            Grand Total Nilai:{" "}
            <span style={{ fontWeight: 700, color: grandTotalNilai >= 0 ? "#10b981" : "#ef4444" }}>
              {fmtIDR(grandTotalNilai)}
            </span>
          </span>
        </div>
      )}

      {detailTx && <TransactionDetailModal transaction={detailTx} onClose={() => setDetailTx(null)} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
};

export default Reports;