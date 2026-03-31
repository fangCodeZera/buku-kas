/**
 * pages/Contacts.js
 * Buyer / Supplier contact management.
 *
 * Left panel: contact list with net AR/AP balance indicator
 * Right panel: contact detail with:
 *   - Contact info + edit / delete contact
 *   - AR / AP balance breakdown
 *   - Full transaction history with per-row delete button
 */
import React, { useState, useMemo, useRef, useEffect } from "react";
import { StatusBadge } from "../components/Badge";
import DueBadge            from "../components/DueBadge";
import Icon                from "../components/Icon";
import DeleteConfirmModal  from "../components/DeleteConfirmModal";
import PaymentUpdateModal  from "../components/PaymentUpdateModal";
import PaymentHistoryPanel from "../components/PaymentHistoryPanel";
import Toast               from "../components/Toast";
import { fmtIDR, fmtDate, generateId, normalizeTitleCase } from "../utils/idGenerators";
import { computePaymentProgress } from "../utils/paymentUtils";

/**
 * @param {{
 *   contacts: Array,
 *   transactions: Array,
 *   onAddContact: (c: Object) => void,
 *   onUpdateContact: (c: Object) => void,
 *   onDeleteContact: (id: string) => void,
 *   onDeleteTransaction: (id: string) => void,
 *   onEditTransaction: (tx: Object) => void,
 *   onMarkPaid: (id: string) => void
 * }} props
 */
const Contacts = ({
  contacts, transactions, balanceMap,
  onAddContact, onUpdateContact, onDeleteContact,
  onArchiveContact = () => {},
  onUnarchiveContact = () => {},  // eslint-disable-line no-unused-vars
  onNavigateToArchive = () => {},
  onDeleteTransaction,
  onEditTransaction, onMarkPaid,
}) => {
  const [search,      setSearch]      = useState("");
  const [alphaFilter, setAlphaFilter] = useState("all");
  const [sortBy,      setSortBy]      = useState("nameAsc");
  const [selected,    setSelected]    = useState(null); // contact id or "new"
  const [editMode,    setEditMode]    = useState(false);
  const [form,        setForm]        = useState({ name: "", email: "", phone: "", address: "" });
  const [deleteTx,    setDeleteTx]    = useState(null);
  const [paidTx,      setPaidTx]      = useState(null);
  const [toast,       setToast]       = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [contactAction,   setContactAction]   = useState(null); // { type: "archive"|"delete", contact }
  const [expandedTxId,    setExpandedTxId]    = useState(null);
  const [nameError,       setNameError]       = useState("");
  const nameInputRef = useRef(null);



  // Active (non-archived) contacts — drives main list, alpha filter, count
  const activeContacts = useMemo(() => contacts.filter((c) => !c.archived), [contacts]);

  const archivedCount = useMemo(() => contacts.filter((c) => c.archived).length, [contacts]);

  // Transaction count per contact name (case-insensitive) — for archive vs delete decision
  const txCountMap = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (!t.counterparty) continue;
      const key = t.counterparty.toLowerCase().trim();
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [transactions]);

  // Enrich each ACTIVE contact from the pre-computed balanceMap (O(contacts), not O(contacts×tx))
  const withBalance = useMemo(() => {
    const enriched = activeContacts.map((c) => {
      const key = c.name.toLowerCase();
      const bal = balanceMap?.[key] || { totalIncome: 0, totalExpense: 0, ar: 0, ap: 0, netOut: 0, txs: [] };
      return { ...c, ...bal, txCount: bal.txs?.length || 0 };
    });

    const filtered = enriched.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (alphaFilter !== "all") {
        const firstChar = c.name.trim()[0]?.toUpperCase() || "";
        if (firstChar !== alphaFilter) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "nameAsc")  return a.name.localeCompare(b.name, "id");
      if (sortBy === "nameDesc") return b.name.localeCompare(a.name, "id");
      if (sortBy === "txCount")  return b.txCount - a.txCount;
      return 0;
    });
  }, [activeContacts, balanceMap, search, alphaFilter, sortBy]);

  // Which letters have at least one ACTIVE contact
  const lettersWithContacts = useMemo(() => {
    const set = new Set();
    activeContacts.forEach((c) => {
      const ch = c.name.trim()[0]?.toUpperCase();
      if (ch) set.add(ch);
    });
    return set;
  }, [activeContacts]);

  const sel = selected ? withBalance.find((c) => c.id === selected) : null;

  const handleSave = () => {
    if (!form.name.trim()) {
      setNameError("Nama kontak wajib diisi");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    const normForm = { ...form, name: normalizeTitleCase(form.name) };
    if (editMode && sel) {
      if (normForm.name.toLowerCase() !== sel.name.toLowerCase()) {
        const duplicate = contacts.find(
          (c) => c.id !== sel.id && c.name.toLowerCase() === normForm.name.toLowerCase()
        );
        if (duplicate) {
          setNameError("Kontak dengan nama ini sudah ada");
          setSubmitting(false);
          return;
        }
      }
      onUpdateContact({ ...sel, ...normForm });
      setToast("Kontak berhasil diperbarui");
    } else {
      onAddContact({ ...normForm, id: generateId() });
      setToast("Kontak berhasil ditambahkan");
    }
    setNameError("");
    setForm({ name: "", email: "", phone: "", address: "" });
    setEditMode(false);
    setSelected(null);
    setSubmitting(false);
  };

  useEffect(() => {
    if ((selected === "new" || editMode) && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [selected, editMode]);

  // Escape closes contact action modal
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && contactAction) setContactAction(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [contactAction]);

  const handleDeleteTx  = (tx) => setDeleteTx(tx);
  const confirmDeleteTx = () => {
    onDeleteTransaction && onDeleteTransaction(deleteTx.id);
    setDeleteTx(null);
    setToast("Transaksi dihapus. Stok dan saldo diperbarui.");
  };

  const confirmPaidTx = (paidAmount, paymentNote) => {
    const tx        = paidTx;
    const isFull    = paidAmount >= (tx.outstanding || 0);
    const remaining = Math.max(0, (tx.outstanding || 0) - paidAmount);
    const label     = tx.type === "income" ? "diterima" : "dibayar";
    const totLabel  = tx.type === "income" ? "pemasukan" : "pengeluaran";
    onMarkPaid && onMarkPaid(tx.id, paidAmount, paymentNote);
    setPaidTx(null);
    setToast(
      isFull
        ? `${fmtIDR(paidAmount)} telah ${label}. Transaksi Lunas. Total ${totLabel} bertambah ${fmtIDR(paidAmount)}.`
        : `${fmtIDR(paidAmount)} telah ${label}. Sisa tagihan ${fmtIDR(remaining)}. Total ${totLabel} bertambah ${fmtIDR(paidAmount)}.`
    );
  };

  return (
    <div className={`contacts-page ${sel ? "contacts-page--split" : "contacts-page--full"}`}>
      {/* ── Left: contact list ── */}
      <div className="contacts-list-panel">
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h2 className="page-title">Kontak</h2>
          <div style={{ display: "flex", gap: 6 }}>
            {archivedCount > 0 && (
              <button onClick={onNavigateToArchive} className="btn btn-outline btn-sm" aria-label="Lihat kontak diarsipkan">
                📦 Arsip ({archivedCount})
              </button>
            )}
            <button
              onClick={() => { setEditMode(false); setForm({ name: "", email: "", phone: "", address: "" }); setSelected("new"); }}
              className="btn btn-primary btn-sm"
              aria-label="Tambah kontak baru"
            >
              <Icon name="plus" size={13} color="#fff" /> Tambah
            </button>
          </div>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kontak..."
          className="search-input"
          style={{ width: "100%", marginBottom: 8 }}
          aria-label="Cari kontak"
        />

        {/* Alphabet filter */}
        <div className="alpha-filter" role="group" aria-label="Filter alfabet">
          <button
            className={`alpha-btn alpha-btn--all${alphaFilter === "all" ? " alpha-btn--active" : ""}`}
            onClick={() => setAlphaFilter("all")}
          >Semua</button>
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch) => (
            <button
              key={ch}
              className={`alpha-btn${alphaFilter === ch ? " alpha-btn--active" : ""}${!lettersWithContacts.has(ch) ? " alpha-btn--empty" : ""}`}
              onClick={() => setAlphaFilter(ch)}
              disabled={!lettersWithContacts.has(ch)}
              aria-label={`Filter huruf ${ch}`}
            >{ch}</button>
          ))}
        </div>

        {/* Sort + count row */}
        <div className="contacts-sort-row">
          <span className="contacts-count">{withBalance.length} kontak</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="contacts-sort-label">Urut:</span>
            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Urutkan kontak"
            >
              <option value="nameAsc">Nama A–Z</option>
              <option value="nameDesc">Nama Z–A</option>
              <option value="txCount">Transaksi Terbanyak</option>
            </select>
          </div>
        </div>

        {/* New / edit form */}
        {(selected === "new" || editMode) && (
          <div className="contact-form-card">
            <h4 className="contact-form-title">{editMode ? "Edit" : "Tambah"} Kontak</h4>
            {[["name", "Nama*"], ["email", "Email"], ["phone", "Telepon"], ["address", "Alamat"]].map(([k, p]) => (
              <React.Fragment key={k}>
                <input
                  ref={k === "name" ? nameInputRef : null}
                  value={form[k]}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, [k]: e.target.value }));
                    if (k === "name" && nameError) setNameError("");
                  }}
                  placeholder={p}
                  className={`contact-input${k === "name" && nameError ? " form-input--error" : ""}`}
                  aria-label={p}
                />
                {k === "name" && nameError && <span className="field-error">{nameError}</span>}
              </React.Fragment>
            ))}
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={handleSave} disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>{submitting ? "Menyimpan..." : "Simpan"}</button>
              <button onClick={() => { setNameError(""); setEditMode(false); if (selected === "new") setSelected(null); }} className="btn btn-secondary">Batal</button>
            </div>
          </div>
        )}

        {/* Contact list */}
        <div className="table-card" style={{ padding: 0 }}>
          {withBalance.length === 0 ? (
            <div className="empty-state">
              {alphaFilter !== "all"
                ? <>
                    Tidak ada kontak yang dimulai dengan huruf &ldquo;{alphaFilter}&rdquo;.{" "}
                    <button className="btn btn-sm btn-secondary" style={{ marginTop: 6 }} onClick={() => setAlphaFilter("all")}>Tampilkan semua</button>
                  </>
                : "Belum ada kontak"
              }
            </div>
          ) : (
            withBalance.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`contact-item ${selected === c.id ? "contact-item--active" : ""}`}
                role="button"
                aria-label={`Lihat detail ${c.name}`}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelected(c.id)}
              >
                <div className="contact-item__left">
                  <div className="contact-item__name">{c.name}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{c.txCount} transaksi</div>
                </div>
                <div className="contact-item__middle">
                  {c.ar > 0 && <span className="contact-item__tag contact-item__tag--ar">💚 Piutang: {fmtIDR(c.ar)}</span>}
                  {c.ap > 0 && <span className="contact-item__tag contact-item__tag--ap">❤️ Hutang: {fmtIDR(c.ap)}</span>}
                </div>
                <div className="contact-item__right">
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.netOut >= 0 ? "#10b981" : "#ef4444" }}>
                    {fmtIDR(Math.abs(c.netOut))}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: c.netOut >= 0 ? "#10b981" : "#ef4444" }}>
                    {c.netOut > 0 ? "💚 Hutang ke kita" : c.netOut < 0 ? "❤️ Kita hutang" : "✓ Lunas"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: contact detail ── */}
      {sel && (
        <div className="contacts-detail-panel">
          {/* Consolidated header: ← Kembali | Name + info | Edit | Hapus */}
          <div className="contacts-detail-hdr">
            <button
              onClick={() => setSelected(null)}
              className="contacts-detail-back"
              aria-label="Kembali ke daftar kontak"
            >
              ← Kembali
            </button>
            <div className="contacts-detail-hdr__name">
              <h3 className="contact-detail-name" style={{ margin: 0 }}>{sel.name}</h3>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 2 }}>
                {sel.email   && <span className="text-muted" style={{ fontSize: 11 }}>📧 {sel.email}</span>}
                {sel.phone   && <span className="text-muted" style={{ fontSize: 11 }}>📞 {sel.phone}</span>}
                {sel.address && <span className="text-muted" style={{ fontSize: 11 }}>📍 {sel.address}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
              <button
                onClick={() => {
                  setForm({ name: sel.name, email: sel.email || "", phone: sel.phone || "", address: sel.address || "" });
                  setEditMode(true);
                  // Intentionally NOT setting selected="new" so we keep original contact ID for save
                }}
                className="btn btn-sm btn-outline"
                aria-label={`Edit kontak ${sel.name}`}
              >
                Edit
              </button>
              {(txCountMap[sel.name.toLowerCase().trim()] || 0) > 0 ? (
                <button
                  onClick={() => setContactAction({ type: "archive", contact: sel })}
                  className="btn btn-sm btn-outline"
                  style={{ borderColor: "#f59e0b", color: "#b45309" }}
                  aria-label={`Arsipkan kontak ${sel.name}`}
                >
                  📦 Arsipkan
                </button>
              ) : (
                <button
                  onClick={() => setContactAction({ type: "delete", contact: sel })}
                  className="btn btn-sm btn-danger-outline"
                  aria-label={`Hapus kontak ${sel.name}`}
                >
                  Hapus
                </button>
              )}
            </div>
          </div>

          {/* Income / Expense cards (cash-basis) */}
          <div className="summary-grid summary-grid--2" style={{ marginBottom: 9 }}>
            {[
              { l: "Total Pemasukan",  sub: "Kas diterima",   v: sel.totalIncome,  c: "#10b981" },
              { l: "Total Pengeluaran", sub: "Kas dikeluarkan", v: sel.totalExpense, c: "#ef4444" },
            ].map((x) => (
              <div key={x.l} className="mini-card" style={{ borderLeft: `3px solid ${x.c}` }}>
                <div className="mini-card__label">{x.l}</div>
                <div className="mini-card__value" style={{ color: x.c }}>{fmtIDR(x.v)}</div>
                <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>{x.sub}</div>
              </div>
            ))}
          </div>

          {/* AR / AP cards */}
          <div className="summary-grid summary-grid--2" style={{ marginBottom: 16 }}>
            {sel.ar > 0 && (
              <div className="mini-card" style={{ background: "#f0fdf4", borderLeft: "3px solid #10b981" }}>
                <div className="mini-card__label">💚 Mereka hutang ke kita</div>
                <div className="mini-card__value" style={{ color: "#10b981" }}>{fmtIDR(sel.ar)}</div>
              </div>
            )}
            {sel.ap > 0 && (
              <div className="mini-card" style={{ background: "#fef2f2", borderLeft: "3px solid #ef4444" }}>
                <div className="mini-card__label">❤️ Kita hutang ke mereka</div>
                <div className="mini-card__value" style={{ color: "#ef4444" }}>{fmtIDR(sel.ap)}</div>
              </div>
            )}
            {sel.ar === 0 && sel.ap === 0 && (
              <div className="mini-card" style={{ background: "#f0fdf4", borderLeft: "3px solid #10b981", gridColumn: "1/-1" }}>
                <div className="mini-card__label">✅ Saldo Bersih</div>
                <div className="mini-card__value" style={{ color: "#10b981" }}>Semua Lunas</div>
              </div>
            )}
          </div>

          {/* Transaction history */}
          <h4 className="section-subtitle">Riwayat Transaksi</h4>
          {sel.txs.length === 0 ? (
            <div className="text-muted">Belum ada transaksi</div>
          ) : (
            <div className="contacts-table-scroll">
              <table className="data-table contacts-history-table">
                <colgroup>
                  <col style={{ width: 90 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 105 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 100 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>No. Invoice</th>
                    <th>Item</th>
                    <th className="th-center">Stok</th>
                    <th className="th-center">Status</th>
                    <th className="th-center">Jatuh Tempo</th>
                    <th className="th-right">Nilai (Rp)</th>
                    <th className="th-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {sel.txs.map((t, i) => (
                    <React.Fragment key={t.id}>
                    <tr className={i % 2 === 0 ? "" : "row-alt"}>
                      <td className="text-muted td-date">{fmtDate(t.date)}</td>
                      <td style={{ fontSize: 11, fontWeight: 600, color: t.type === "income" ? "#6366f1" : "#374151", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                        {t.txnId || <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      <td className="td-name" style={Array.isArray(t.items) && t.items.length > 1 ? { verticalAlign: "top" } : {}}>
                        {Array.isArray(t.items) && t.items.length > 1 ? (
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
                      <td className="td-center" style={{ color: t.type === "income" ? "#ef4444" : "#10b981", fontWeight: 600, ...(Array.isArray(t.items) && t.items.length > 1 ? { verticalAlign: "top" } : {}) }}>
                        {Array.isArray(t.items) && t.items.length > 1 ? (
                          <div className="item-list" style={{ alignItems: "center" }}>
                            {t.items.map((item, idx) => (
                              <div key={idx} className="item-list__row" style={{ justifyContent: "center" }}>
                                <span className="stock-delta" style={{ color: t.type === "income" ? "#ef4444" : "#10b981" }}>
                                  {t.type === "income" ? "-" : "+"}{parseFloat(item.sackQty) || 0} karung
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>{t.type === "income" ? "-" : "+"}{parseFloat(t.stockQty) || 0} {t.stockUnit}</>
                        )}
                      </td>
                      <td className="td-center"><StatusBadge status={t.status} /></td>
                      <td className="td-center"><DueBadge dueDate={t.dueDate} outstanding={t.outstanding} /></td>
                      <td style={{ textAlign: "right", minWidth: 150, maxWidth: 160, fontWeight: 700, color: t.type === "income" ? "#10b981" : "#ef4444", ...(t.items && t.items.length > 1 ? { verticalAlign: "top" } : {}) }}>
                        <div style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtIDR(t.value)}</div>
                        {(t.outstanding || 0) > 0 && (
                          <div style={{ fontSize: 10, color: "#f59e0b", whiteSpace: "nowrap" }}>Sisa: {fmtIDR(t.outstanding)}</div>
                        )}
                        {t.items && t.items.length > 1 && (
                          <div className="item-list__subtotal">
                            {t.items.map((item, idx) => (
                              <div key={idx} style={{ fontSize: 10 }}>{item.itemName}: {fmtIDR(item.subtotal || 0)}</div>
                            ))}
                          </div>
                        )}
                        {(() => {
                          const prog = computePaymentProgress(t.value, t.outstanding);
                          if (!prog) return null;
                          const { percent: pct } = prog;
                          if (pct >= 100) return <div style={{ fontSize: 10, color: "#10b981", marginTop: 2 }}>✓ 100%</div>;
                          if (pct <= 0) return <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>0%</div>;
                          return (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 2 }}>
                              <div style={{ width: 60, height: 5, background: "#e5e7eb", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
                                <div style={{ height: "100%", background: "#10b981", borderRadius: 99, width: `${pct}%` }} />
                              </div>
                              <span style={{ fontSize: 9, color: "#6b7280", whiteSpace: "nowrap" }}>{pct}%</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="td-center">
                        <div className="action-btns" style={{ justifyContent: "center" }}>
                          <button
                            onClick={() => onEditTransaction && onEditTransaction(t)}
                            className="action-btn action-btn--edit"
                            title="Edit transaksi"
                            aria-label={`Edit transaksi ${t.itemName}`}
                          >
                            <Icon name="edit" size={11} color="#007bff" />
                          </button>
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
                            onClick={() => handleDeleteTx(t)}
                            className="action-btn action-btn--delete"
                            title="Hapus transaksi"
                            aria-label={`Hapus transaksi ${t.itemName}`}
                          >
                            <Icon name="trash" size={11} color="#ef4444" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedTxId === t.id && (
                      <tr className="payment-history-row">
                        <td colSpan={8} className="payment-history-cell">
                          <PaymentHistoryPanel transaction={t} onClose={() => setExpandedTxId(null)} />
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}

      <DeleteConfirmModal
        transaction={deleteTx}
        onConfirm={confirmDeleteTx}
        onCancel={() => setDeleteTx(null)}
      />
      {/* Contact archive / delete confirmation */}
      {contactAction && (
        <div className="modal-overlay" onClick={() => setContactAction(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3 className="modal-title">
              {contactAction.type === "archive" ? "📦 Arsipkan Kontak?" : "Hapus Kontak?"}
            </h3>
            <div className="modal-body">
              {contactAction.type === "archive" ? (
                <>
                  <p>Arsipkan <strong>{contactAction.contact.name}</strong>?</p>
                  <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
                    Kontak akan dipindahkan ke arsip. Data transaksi tidak terpengaruh.
                    Dapat dikembalikan kapan saja.
                  </p>
                </>
              ) : (
                <>
                  <p>Hapus <strong>{contactAction.contact.name}</strong> secara permanen?</p>
                  <p style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
                    Kontak ini tidak memiliki transaksi. Tindakan ini tidak dapat dibatalkan.
                  </p>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setContactAction(null)}>Batal</button>
              {contactAction.type === "archive" ? (
                <button
                  className="btn btn-primary"
                  style={{ background: "#f59e0b", borderColor: "#f59e0b" }}
                  onClick={() => {
                    onArchiveContact(contactAction.contact.id);
                    setSelected(null);
                    setContactAction(null);
                    setToast(`${contactAction.contact.name} berhasil diarsipkan`);
                  }}
                >
                  Arsipkan
                </button>
              ) : (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    onDeleteContact(contactAction.contact.id);
                    setSelected(null);
                    setContactAction(null);
                    setToast(`${contactAction.contact.name} berhasil dihapus`);
                  }}
                >
                  Hapus
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <PaymentUpdateModal
        transaction={paidTx}
        onConfirm={confirmPaidTx}
        onCancel={() => setPaidTx(null)}
      />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
};

export default Contacts;