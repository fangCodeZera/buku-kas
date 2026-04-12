/**
 * components/TransactionPage.js
 * Shared base component for Penjualan and Pembelian pages.
 * Renders a type-specific (income or expense) day-view transaction page.
 *
 * Props:
 *   type        — "income" | "expense"
 *   title       — "Penjualan" | "Pembelian"
 *   accentColor — accent hex colour for the page
 *   + all standard transaction-page props (transactions, contacts, …)
 */
import React, { useState, useMemo, useRef, useEffect } from "react";
import TransactionForm    from "./TransactionForm";
import StockWarningModal  from "./StockWarningModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import PaymentUpdateModal from "./PaymentUpdateModal";
import PaymentHistoryPanel from "./PaymentHistoryPanel";
import Toast              from "./Toast";
import { StatusBadge }    from "./Badge";
import DueBadge           from "./DueBadge";
import Icon               from "./Icon";
import SaveIndicator      from "./SaveIndicator";
import { fmtIDR, fmtDate, today, addDays, diffDays } from "../utils/idGenerators";
import { computePaymentProgress } from "../utils/paymentUtils";

/** Full Indonesian date string, e.g. "Senin, 15 Maret 2026" */
const fmtDateLong = (d) => {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return d; }
};

const TransactionPage = ({
  type,
  title,
  accentColor,
  transactions,
  contacts,
  stockMap,
  threshold,
  defaultDueDateDays,
  onAdd,
  onEdit,
  onDelete,
  onInvoice,
  onMarkPaid,
  onCreateContact,
  onSuratJalan,
  onNavigateOutstanding,
  saved,
  itemCatalog = [],
  onAddCatalogItem = () => {},
  onUpdateCatalogItem = () => {},
  onUnarchiveCatalogItem = () => {},
  onUnarchiveSubtype = () => {},
  onUnarchiveContact = () => {},
  initViewDate = null,
  highlightTxIds = null,
  onClearHighlight = () => {},
}) => {
  const [showForm,          setShowForm]          = useState(false);
  const [search,            setSearch]            = useState("");
  const [searchCategory,    setSearchCategory]    = useState("invoiceNo");
  const [sortBy,            setSortBy]            = useState("date");
  const [stockWarn,         setStockWarn]         = useState(null);
  const [deleteTx,          setDeleteTx]          = useState(null);
  const [paidTx,            setPaidTx]            = useState(null);
  const [toast,             setToast]             = useState(null);
  const [viewDate,          setViewDate]          = useState(today());
  const [overdueDismissed,  setOverdueDismissed]  = useState(false);
  const [dueSoonDismissed, setDueSoonDismissed] = useState(false);
  const [expandedTxId,      setExpandedTxId]      = useState(null);
  const [flashIds,          setFlashIds]          = useState(new Set());

  const tableRef       = useRef(null);
  const searchInputRef = useRef(null);
  const dateNavRef     = useRef(null);
  const clearFlashRef  = useRef(null);

  const todayStr = today();

  // ── External navigation: sync viewDate + flash when arriving from ActivityLog ─
  useEffect(() => {
    if (initViewDate) setViewDate(initViewDate);
  }, [initViewDate]);

  useEffect(() => {
    if (highlightTxIds && highlightTxIds.length > 0) {
      setFlashIds(new Set(highlightTxIds));
    }
  }, [highlightTxIds]);

  const hasFlash = flashIds.size > 0;

  // Scroll to highlighted row after React commits the new class
  useEffect(() => {
    if (!hasFlash) return;
    const timer = setTimeout(() => {
      const firstRow = document.querySelector("tr.tx-row--flash");
      if (firstRow) firstRow.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(timer);
  }, [hasFlash]);

  // Clear flash on first user interaction (500ms delay skips the scroll-into-view event)
  useEffect(() => {
    if (!hasFlash) return;
    const clearFlash = () => {
      setFlashIds(new Set());
      onClearHighlight();
    };
    const timer = setTimeout(() => {
      clearFlashRef.current = clearFlash;
      document.addEventListener("click",   clearFlash, { once: true, capture: true });
      document.addEventListener("keydown", clearFlash, { once: true, capture: true });
      document.addEventListener("scroll",  clearFlash, { once: true, capture: true, passive: true });
    }, 500);
    return () => {
      clearTimeout(timer);
      if (clearFlashRef.current) {
        document.removeEventListener("click",   clearFlashRef.current, { capture: true });
        document.removeEventListener("keydown", clearFlashRef.current, { capture: true });
        document.removeEventListener("scroll",  clearFlashRef.current, { capture: true });
        clearFlashRef.current = null;
      }
    };
  }, [hasFlash, onClearHighlight]);

  // ── Table: type + date + search + sort ───────────────────────────────────
  const filtered = useMemo(() =>
    transactions
      .filter((t) => t.type === type && t.date === viewDate)
      .filter((t) => {
        if (!search) return true;
        const q = search.toLowerCase();
        if (searchCategory === "invoiceNo") return (t.txnId || "").toLowerCase().includes(q);
        if (searchCategory === "itemName")
          return t.itemName.toLowerCase().includes(q) ||
            (Array.isArray(t.items) && t.items.some((it) => (it.itemName || "").toLowerCase().includes(q)));
        if (searchCategory === "klien") return t.counterparty.toLowerCase().includes(q);
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "date") {
          const ta = a.createdAt
            ? new Date(a.createdAt).getTime()
            : new Date((a.date || "1970-01-01") + "T" + (a.time || "00:00") + ":00Z").getTime();
          const tb = b.createdAt
            ? new Date(b.createdAt).getTime()
            : new Date((b.date || "1970-01-01") + "T" + (b.time || "00:00") + ":00Z").getTime();
          if (ta !== tb) return tb - ta;
          return a.counterparty.localeCompare(b.counterparty);
        }
        if (sortBy === "value") return b.value - a.value;
        return a.counterparty.localeCompare(b.counterparty);
      }),
  [transactions, type, viewDate, search, searchCategory, sortBy]);

  // ── Day totals (from filtered — only this day's transactions of this type) ──
  const dayCash        = useMemo(() => filtered.reduce((s, t) => s + (Number(t.value) - (Number(t.outstanding) || 0)), 0), [filtered]);
  const dayOutstanding = useMemo(() => filtered.reduce((s, t) => s + (Number(t.outstanding) || 0), 0), [filtered]);

  // ── Overdue + due-soon reminders (only this type) ────────────────────────
  const overdueTxs = useMemo(() =>
    transactions.filter((t) => {
      if (t.type !== type || !t.dueDate || (t.outstanding || 0) <= 0) return false;
      const d = diffDays(todayStr, t.dueDate);
      return d !== null && d < 0;
    }),
  [transactions, type, todayStr]);
  const dueSoonTxs = useMemo(() =>
    transactions.filter((t) => {
      if (t.type !== type || !t.dueDate || (t.outstanding || 0) <= 0) return false;
      const d = diffDays(todayStr, t.dueDate);
      return d !== null && d >= 0 && d <= 3;
    }),
  [transactions, type, todayStr]);
  const overdueTotal = useMemo(() => overdueTxs.reduce((s, t) => s + (t.outstanding || 0), 0), [overdueTxs]);
  const dueSoonTotal = useMemo(() => dueSoonTxs.reduce((s, t) => s + (t.outstanding || 0), 0), [dueSoonTxs]);

  // ── Stock alerts ─────────────────────────────────────────────────────────
  const lowCount = useMemo(() => Object.values(stockMap).filter((s) => s.qty > 0 && s.qty <= threshold).length, [stockMap, threshold]);
  const negCount = useMemo(() => Object.values(stockMap).filter((s) => s.qty < 0).length, [stockMap]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDelete  = (tx) => setDeleteTx(tx);
  const confirmDelete = () => {
    onDelete(deleteTx.id);
    setDeleteTx(null);
    setToast("Transaksi dihapus. Stok, saldo, dan laporan telah diperbarui.");
  };
  const confirmPaid = (paidAmount, paymentNote) => {
    const tx        = paidTx;
    const isFull    = paidAmount >= (tx.outstanding || 0);
    const remaining = Math.max(0, (tx.outstanding || 0) - paidAmount);
    const label     = type === "income" ? "diterima" : "dibayar";
    const totLabel  = type === "income" ? "pemasukan" : "pengeluaran";
    onMarkPaid(tx.id, paidAmount, paymentNote);
    setPaidTx(null);
    setToast(
      isFull
        ? `${fmtIDR(paidAmount)} telah ${label}. Transaksi Lunas. Total ${totLabel} bertambah ${fmtIDR(paidAmount)}.`
        : `${fmtIDR(paidAmount)} telah ${label}. Sisa tagihan ${fmtIDR(remaining)}. Total ${totLabel} bertambah ${fmtIDR(paidAmount)}.`
    );
  };
  const handleCategoryChange = (cat) => {
    setSearchCategory(cat);
    setSearch("");
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  // ── Labels ───────────────────────────────────────────────────────────────
  const dayCashLabel     = type === "income" ? "Total Penjualan"  : "Total Pembelian";
  const dayOutstandLabel = type === "income" ? "Piutang Hari Ini" : "Hutang Hari Ini";

  // ── Date nav border color ─────────────────────────────────────────────────
  const isToday  = viewDate === todayStr;
  const isFuture = viewDate > todayStr;
  const navBorderColor = isToday ? accentColor : isFuture ? "#6366f1" : "#f59e0b";

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h2 className="page-title" style={{ color: accentColor }}>{title}</h2>
          <div style={{ marginTop: 4 }}><SaveIndicator saved={saved} /></div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary"
          style={{ background: accentColor, borderColor: accentColor }}
          aria-label={`Tambah transaksi ${title.toLowerCase()} baru`}
        >
          <Icon name="plus" size={16} color="#fff" /> Tambah Transaksi
        </button>
      </div>

      {/* ── Stock alert banner ── */}
      {(lowCount > 0 || negCount > 0) && (
        <div className="alert-banner alert-banner--warning" role="alert">
          <Icon name="warning" size={16} color="#d97706" />
          <span>
            {negCount > 0 && `${negCount} item stok negatif. `}
            {lowCount > 0 && `${lowCount} item hampir habis (≤${threshold}).`}
          </span>
        </div>
      )}

      {/* ── Overdue banner (past due date — red/danger) ── */}
      {overdueTxs.length > 0 && !overdueDismissed && (
        <div role="alert" className="alert-banner alert-banner--danger" style={{ marginBottom: 10 }}>
          <span style={{ flex: 1, fontSize: 13 }}>
            🔔 <strong>
              Ada {overdueTxs.length} tagihan {type === "income" ? "piutang" : "hutang"} sudah lewat jatuh tempo
            </strong>
            {" "}({fmtIDR(overdueTotal)} total).
            {onNavigateOutstanding && (
              <span
                role="button" tabIndex={0}
                onClick={() => onNavigateOutstanding(overdueTxs.map((t) => t.id))}
                onKeyDown={(e) => e.key === "Enter" && onNavigateOutstanding(overdueTxs.map((t) => t.id))}
                style={{ marginLeft: 8, color: "#007bff", textDecoration: "underline", fontWeight: 700, cursor: "pointer" }}
              >Lihat</span>
            )}
          </span>
          <button
            onClick={() => setOverdueDismissed(true)}
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 16, lineHeight: 1, color: "inherit" }}
            aria-label="Tutup pengingat"
            title="Tutup pengingat (muncul kembali saat reload)"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Due-soon banner (within 0-3 days — amber/warning) ── */}
      {dueSoonTxs.length > 0 && !dueSoonDismissed && (
        <div role="alert" className="alert-banner alert-banner--warning" style={{ marginBottom: 10 }}>
          <span style={{ flex: 1, fontSize: 13 }}>
            🔔 <strong>
              Ada {dueSoonTxs.length} tagihan {type === "income" ? "piutang" : "hutang"} akan jatuh tempo segera
            </strong>
            {" "}({fmtIDR(dueSoonTotal)} total).
            {onNavigateOutstanding && (
              <span
                role="button" tabIndex={0}
                onClick={() => onNavigateOutstanding(dueSoonTxs.map((t) => t.id))}
                onKeyDown={(e) => e.key === "Enter" && onNavigateOutstanding(dueSoonTxs.map((t) => t.id))}
                style={{ marginLeft: 8, color: "#007bff", textDecoration: "underline", fontWeight: 700, cursor: "pointer" }}
              >Lihat</span>
            )}
          </span>
          <button
            onClick={() => setDueSoonDismissed(true)}
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 16, lineHeight: 1, color: "inherit" }}
            aria-label="Tutup pengingat"
            title="Tutup pengingat (muncul kembali saat reload)"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Add form ── */}
      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <TransactionForm
            initType={type}
            contacts={contacts}
            transactions={transactions}
            stockMap={stockMap}
            itemCatalog={itemCatalog}
            defaultDueDateDays={defaultDueDateDays}
            onStockWarning={setStockWarn}
            onCreateContact={onCreateContact}
            onAddCatalogItem={onAddCatalogItem}
            onUpdateCatalogItem={onUpdateCatalogItem}
            onUnarchiveCatalogItem={onUnarchiveCatalogItem}
            onUnarchiveSubtype={onUnarchiveSubtype}
            onUnarchiveContact={onUnarchiveContact}
            onSave={(t) => { onAdd(t); setShowForm(false); setToast("✅ Transaksi berhasil ditambahkan!"); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* ── Date navigation bar ── */}
      <div
        className="tx-date-nav"
        style={{ borderLeftColor: navBorderColor }}
        role="navigation"
        aria-label="Navigasi tanggal"
      >
        <button
          onClick={() => setViewDate((d) => addDays(d, -1) || d)}
          className="tx-date-nav__arrow"
          aria-label="Hari sebelumnya"
        >
          ‹
        </button>
        <div className="tx-date-nav__center">
          <span
            className="tx-date-nav__date-text"
            onClick={() => { try { dateNavRef.current?.showPicker(); } catch { dateNavRef.current?.click(); } }}
            title="Klik untuk pilih tanggal"
          >
            📅 {fmtDateLong(viewDate)}
            {isToday && <span className="tx-date-nav__today-pill" style={{ background: accentColor }}>Hari ini</span>}
            {isFuture && <span className="tx-date-nav__today-pill" style={{ background: "#6366f1" }}>Mendatang</span>}
          </span>
          <input
            ref={dateNavRef}
            type="date"
            value={viewDate}
            onChange={(e) => e.target.value && setViewDate(e.target.value)}
            className="tx-date-nav__hidden-input"
            aria-label="Pilih tanggal"
          />
        </div>
        <button
          onClick={() => setViewDate((d) => addDays(d, 1) || d)}
          className="tx-date-nav__arrow"
          aria-label="Hari berikutnya"
        >
          ›
        </button>
        {!isToday && (
          <button
            onClick={() => setViewDate(todayStr)}
            className="tx-date-nav__today-btn"
            style={{ background: accentColor, borderColor: accentColor }}
          >
            Hari Ini
          </button>
        )}
      </div>

      {/* ── Day summary cards ── */}
      <div className="day-summary-row">
        <div className="day-summary-card">
          <div className="day-summary-card__label">Transaksi</div>
          <div className="day-summary-card__value">{filtered.length}</div>
          <div className="day-summary-card__sub">{isToday ? "hari ini" : fmtDate(viewDate)}</div>
        </div>
        <div className="day-summary-card">
          <div className="day-summary-card__label">{dayCashLabel}</div>
          <div className="day-summary-card__value" style={{ color: accentColor }}>{fmtIDR(dayCash)}</div>
          <div className="day-summary-card__sub">kas {type === "income" ? "masuk" : "keluar"}</div>
        </div>
        <div className="day-summary-card">
          <div className="day-summary-card__label">{dayOutstandLabel}</div>
          <div className="day-summary-card__value" style={{ color: dayOutstanding > 0 ? "#f59e0b" : "#9ca3af" }}>
            {fmtIDR(dayOutstanding)}
          </div>
          <div className="day-summary-card__sub">belum lunas</div>
        </div>
      </div>

      {/* ── Transaction table ── */}
      <div className="table-card" ref={tableRef}>

        {/* ── Search bar (inside table card) ── */}
        <div className="filter-bar" style={{ marginBottom: 12 }}>
          <div className="search-bar-wrapper">
            <select
              className="search-bar__category"
              value={searchCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              aria-label="Kategori pencarian"
            >
              <option value="invoiceNo">No. Invoice</option>
              <option value="itemName">Nama Item</option>
              <option value="klien">Klien</option>
            </select>
            <input
              ref={searchInputRef}
              className="search-bar__input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                searchCategory === "invoiceNo" ? "Cari no. invoice..." :
                searchCategory === "itemName"  ? "Cari nama item..."   :
                                                 "Cari nama klien..."
              }
              aria-label="Cari transaksi"
            />
            <select
              className="search-bar__sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Urutkan transaksi"
            >
              <option value="date">Waktu ↓</option>
              <option value="value">Nilai ↓</option>
              <option value="counterparty">Klien A-Z</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              {isToday ? "📝" : isFuture ? "🔮" : "📭"}
            </div>
            <div className="empty-state-title">
              {isToday
                ? "Belum ada transaksi hari ini"
                : isFuture
                ? "Tanggal ini belum tiba"
                : "Tidak ada transaksi pada tanggal ini"}
            </div>
            <div className="empty-state-subtitle">
              {isToday
                ? `Klik "Tambah Transaksi" untuk mencatat ${type === "income" ? "penjualan" : "pembelian"} baru.`
                : isFuture
                ? "Pilih tanggal yang sudah lewat atau hari ini untuk melihat transaksi."
                : `Tidak ada ${type === "income" ? "penjualan" : "pembelian"} yang dicatat pada ${fmtDate(viewDate)}.`}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Tanggal &amp; Waktu</th>
                  <th className="hidden md:table-cell">No. Invoice</th>
                  <th>Klien</th>
                  <th>Barang</th>
                  <th className="th-center hidden md:table-cell">Stok</th>
                  <th className="th-right">Nilai (Rp)</th>
                  <th className="th-center whitespace-nowrap">Status</th>
                  <th className="th-center hidden md:table-cell">Jatuh Tempo</th>
                  <th className="th-center whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  return (
                    <React.Fragment key={t.id}>
                    <tr className={[i % 2 === 0 ? "" : "row-alt", flashIds.has(t.id) ? "tx-row--flash" : ""].filter(Boolean).join(" ")}>
                      <td className="td-date whitespace-nowrap">
                        {fmtDate(t.date)}<br />
                        <span className="text-muted">{t.time}</span>
                      </td>
                      <td
                        className="hidden md:table-cell"
                        style={{ fontSize: 11, fontWeight: 600, color: type === "income" ? "#6366f1" : "#374151", fontFamily: "monospace", whiteSpace: "nowrap" }}
                      >
                        {t.txnId || <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      <td className="td-name">{t.counterparty}</td>
                      <td style={Array.isArray(t.items) && t.items.length > 1 ? { verticalAlign: "top" } : {}}>
                        {Array.isArray(t.items) && t.items.length > 1 ? (
                          <div className="item-list">
                            {t.items.map((item, idx) => (
                              <div key={idx} className="item-list__row" style={{ minHeight: 28, alignItems: "flex-start" }}>
                                <span className="item-list__bullet">•</span>
                                <span>{item.itemName}</span>
                              </div>
                            ))}
                            {t.notes && <div className="text-muted" style={{ fontSize: 10, marginTop: 4 }}>{t.notes}</div>}
                          </div>
                        ) : (
                          <>
                            {t.itemName}
                            {t.notes && <div className="text-muted" style={{ fontSize: 10 }}>{t.notes}</div>}
                          </>
                        )}
                      </td>
                      <td className="td-center hidden md:table-cell" style={Array.isArray(t.items) && t.items.length > 1 ? { verticalAlign: "top" } : {}}>
                        {Array.isArray(t.items) && t.items.length > 1 ? (
                          <div className="item-list" style={{ alignItems: "center" }}>
                            {t.items.map((item, idx) => (
                              <div key={idx} className="item-list__row" style={{ justifyContent: "center", minHeight: 28, alignItems: "flex-start" }}>
                                <span className="stock-delta" style={{ color: type === "income" ? "#ef4444" : "#10b981" }}>
                                  {type === "income" ? "-" : "+"}{parseFloat(item.sackQty) || 0} {t.stockUnit || "karung"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span
                            className="stock-delta"
                            style={{ color: type === "income" ? "#ef4444" : "#10b981" }}
                          >
                            {type === "income" ? "-" : "+"}{parseFloat(t.stockQty) || 0} {t.stockUnit}
                          </span>
                        )}
                      </td>
                      <td className="td-value td-right" style={{ color: accentColor, ...(Array.isArray(t.items) && t.items.length > 1 ? { verticalAlign: "top" } : {}) }}>
                        {type === "income" ? "+" : "-"}{fmtIDR(t.value)}
                        {t.outstanding > 0 && (
                          <div style={{ fontSize: 10, color: "#f59e0b" }}>Sisa: {fmtIDR(t.outstanding)}</div>
                        )}
                        {Array.isArray(t.items) && t.items.length > 1 && (
                          <div className="item-list__subtotal">
                            {t.items.map((item, idx) => (
                              <div key={idx}>{item.itemName}: {fmtIDR(item.subtotal || 0)}</div>
                            ))}
                          </div>
                        )}
                        {(() => {
                          const prog = computePaymentProgress(t.value, t.outstanding);
                          if (!prog) return null;
                          const { percent: pct } = prog;
                          if (pct >= 100) return <div style={{ fontSize: 10, color: "#10b981", marginTop: 2 }}>✓ 100% terbayar</div>;
                          if (pct <= 0) return <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>0% terbayar</div>;
                          return (
                            <div className="payment-progress-wrap">
                              <div className="payment-progress-bar">
                                <div className="payment-progress-bar__fill" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="payment-progress-pct">{pct}% terbayar</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="whitespace-nowrap"><StatusBadge status={t.status} /></td>
                      <td className="td-center hidden md:table-cell">
                        <DueBadge dueDate={t.dueDate} outstanding={t.outstanding} />
                      </td>
                      <td className="td-center whitespace-nowrap">
                        <div className="action-btns flex flex-nowrap gap-1 justify-center">
                          <button
                            onClick={() => onEdit(t)}
                            className="action-btn action-btn--edit"
                            title="Edit transaksi"
                            aria-label={`Edit transaksi ${t.itemName}`}
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
                          {type === "income" && onSuratJalan && (
                            <button
                              onClick={() => onSuratJalan(t)}
                              className="action-btn action-btn--surat-jalan"
                              title="Cetak Surat Jalan"
                              aria-label={`Cetak surat jalan untuk ${t.counterparty}`}
                            >
                              <Icon name="truck" size={12} color="#8b5cf6" />
                            </button>
                          )}
                          {(t.outstanding || 0) > 0 && (
                            <button
                              onClick={() => setPaidTx(t)}
                              className="action-btn action-btn--paid"
                              title="Tandai Lunas"
                              aria-label={`Tandai lunas transaksi ${t.itemName}`}
                            >
                              ✓
                            </button>
                          )}
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
                            onClick={() => handleDelete(t)}
                            className="action-btn action-btn--delete"
                            title="Hapus transaksi"
                            aria-label={`Hapus transaksi ${t.itemName}`}
                          >
                            <Icon name="trash" size={12} color="#ef4444" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedTxId === t.id && (
                      <tr className="payment-history-row">
                        <td colSpan={9} className="payment-history-cell">
                          <PaymentHistoryPanel transaction={t} onClose={() => setExpandedTxId(null)} />
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals & Toasts ── */}
      <StockWarningModal  data={stockWarn}  onClose={() => setStockWarn(null)} />
      <DeleteConfirmModal transaction={deleteTx} onConfirm={confirmDelete} onCancel={() => setDeleteTx(null)} />
      <PaymentUpdateModal transaction={paidTx}   onConfirm={confirmPaid}   onCancel={() => setPaidTx(null)} />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
};

export default TransactionPage;
