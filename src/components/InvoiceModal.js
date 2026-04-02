/**
 * components/InvoiceModal.js
 * Printable invoice modal — redesigned to match INV461.pdf reference.
 *
 * Layout:
 *   - Business header (left) + Invoice meta (right, includes Invoice No from txnId)
 *   - Counterparty "Kepada" section
 *   - Line-items table: No | Jenis Barang | Berat (Kg) | Harga | Total
 *   - Totals section (subtotal, sisa tagihan, grand total)
 *   - Bank Details section (from settings)
 *   - Footer + print/close actions
 */
import { useState, useRef, useEffect } from "react";
import { fmtIDR, fmtDate, today, addDays } from "../utils/idGenerators";
import { printWithPortal } from "../utils/printUtils";

/**
 * InvoiceModal uses inline styles intentionally.
 * The print system uses printWithPortal() which captures outerHTML —
 * inline styles survive this capture, while CSS class references would not
 * since the portal content renders outside #root.
 * Do not migrate to CSS classes without updating the print approach.
 */
const InvoiceModal = ({ transactions, settings, onClose }) => {
  const modalRef = useRef(null);
  const [invoiceNote, setInvoiceNote] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    if (!modalRef.current) return;
    /* InvoiceModal is 100% inline-styled — outerHTML captures everything.
       data-no-print elements (close btn + actions bar) are hidden by CSS.
       inv-spacer + inv-sig are display:none on screen; !important reveals them for print. */
    printWithPortal(
      `<style>
        body { margin: 0; background: #fff;
               font-family: 'Segoe UI', Inter, sans-serif;
               -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { box-sizing: border-box; }
        [data-no-print] { display: none !important; }
        [data-invoice-doc] {
          max-width: 100% !important; width: 100% !important;
          border-radius: 0 !important; box-shadow: none !important;
          display: flex !important; flex-direction: column !important;
          min-height: 100vh;
        }
        .inv-spacer { display: block !important; flex: 1; }
        .inv-sig {
          display: grid !important; grid-template-columns: 1fr 1fr;
          gap: 20px; padding: 16px 32px 0; margin-bottom: 8px;
        }
        .inv-sig-block { display: flex !important; flex-direction: column; }
        .inv-sig-label { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
        .inv-sig-space { height: 55px; }
        .inv-sig-line { border-top: 1.5px solid #000; width: 100%; }
        .inv-sig-name { font-size: 11px; text-align: center; font-style: italic; margin-top: 3px; }
        @page { size: A4 portrait; margin: 12mm; }
      </style>${modalRef.current.outerHTML}`
    );
  };
  // Flatten all items across all transactions into individual line items
  const lineItems = transactions.flatMap((t) => {
    const items = Array.isArray(t.items) && t.items.length > 0
      ? t.items
      : [{ itemName: t.itemName, sackQty: t.sackQty || t.stockQty || 0, weightKg: t.weightKg || 0, pricePerKg: t.pricePerKg || 0, subtotal: t.value || 0 }];
    return items.map((it) => ({ ...it, txType: t.type }));
  });

  const subtotal    = transactions.reduce((a, t) => a + (t.value || 0), 0);
  const outstanding = transactions.reduce((a, t) => a + (t.outstanding || 0), 0);

  // Use the first transaction's txnId as the Invoice No, fallback to timestamp
  const invNumber = transactions[0]?.txnId || `INV-${Date.now().toString().slice(-6)}`;

  // Use the first transaction's dueDate if available, otherwise today + 14
  const dueDate = transactions[0]?.dueDate || addDays(today(), 14);

  // ── Inline print styles ─────────────────────────────────────────────────────
  const s = {
    overlay: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: "30px 16px", overflowY: "auto", zIndex: 9999,
    },
    modal: {
      background: "#fff", maxWidth: 720, width: "100%",
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
    metaTitle: { fontSize: 22, fontWeight: 900, color: "#1e3a5f", letterSpacing: 2, margin: 0 },
    metaRow: { fontSize: 12, color: "#64748b", marginTop: 4 },
    metaValue: { fontWeight: 700, color: "#1e293b" },
    section: { padding: "0 32px" },
    kepadaBlock: {
      margin: "16px 0", padding: "12px 16px",
      background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0",
    },
    kepadaLabel: { fontSize: 10, textTransform: "uppercase", color: "#94a3b8", fontWeight: 700, letterSpacing: 1 },
    kepadaName: { fontSize: 15, fontWeight: 700, color: "#1e293b", marginTop: 2 },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 13, margin: "12px 0", tableLayout: "fixed" },
    th: {
      background: "#1e3a5f", color: "#fff", padding: "10px 12px",
      textAlign: "left", fontSize: 11, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: 0.5,
    },
    thR: { textAlign: "right" },
    thC: { textAlign: "center" },
    td: { padding: "10px 12px", borderBottom: "1px solid #e2e8f0" },
    tdR: { textAlign: "right", fontWeight: 600 },
    tdC: { textAlign: "center" },
    rowAlt: { background: "#f8fafc" },
    totalsWrap: { padding: "0 32px 16px" },
    totalRow: {
      display: "flex", justifyContent: "space-between",
      padding: "8px 0", fontSize: 13, borderBottom: "1px solid #f1f5f9",
    },
    grandRow: {
      display: "flex", justifyContent: "space-between",
      padding: "12px 0", fontSize: 16, fontWeight: 900,
      borderTop: "3px solid #1e3a5f",
    },
    bankSection: {
      margin: "0 32px 20px", padding: "16px 20px",
      background: "#f0f9ff", borderRadius: 8, border: "1px dashed #93c5fd",
    },
    bankTitle: { fontSize: 12, fontWeight: 800, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
    bankRow: { fontSize: 12, color: "#475569", marginBottom: 3 },
    bankValue: { fontWeight: 700, color: "#1e293b" },
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
    <div style={s.overlay} role="dialog" aria-modal="true" aria-labelledby="invoice-title">
      <div ref={modalRef} data-invoice-doc style={{ ...s.modal, position: "relative" }}>
        <button data-no-print="true" onClick={onClose} style={s.closeBtn} aria-label="Tutup invoice">✕</button>

        {/* ── Controls panel: invoice note input (not printed) ── */}
        <div data-no-print="true" style={{ padding: "12px 32px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>
            Catatan Invoice (opsional)
          </label>
          <textarea
            value={invoiceNote}
            onChange={(e) => setInvoiceNote(e.target.value)}
            placeholder="Tulis catatan untuk invoice ini (opsional)"
            rows={2}
            maxLength={500}
            style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        {/* ── Header: Business info + Invoice meta ── */}
        <div style={s.header}>
          <div>
            <h2 style={s.bizName}>{settings.businessName}</h2>
            {settings.address && <div style={s.bizDetail}>{settings.address}</div>}
            {settings.phone && <div style={s.bizDetail}>Tel: {settings.phone}</div>}
          </div>
          <div style={s.metaBlock}>
            <h3 id="invoice-title" style={s.metaTitle}>INVOICE</h3>
            <div style={s.metaRow}>Invoice No: <span style={s.metaValue}>{invNumber}</span></div>
            <div style={s.metaRow}>Tanggal: <span style={s.metaValue}>{fmtDate(today())}</span></div>
            {outstanding > 0 && (
              <div style={s.metaRow}>Jatuh Tempo: <span style={s.metaValue}>{fmtDate(dueDate)}</span></div>
            )}
          </div>
        </div>

        {/* ── Kepada (Bill To) ── */}
        <div style={s.section}>
          <div style={s.kepadaBlock}>
            <div style={s.kepadaLabel}>
              {transactions[0]?.type === "income" ? "Kepada (Pembeli)" : "Dari (Supplier)"}
            </div>
            <div style={s.kepadaName}>{transactions[0]?.counterparty}</div>
          </div>
        </div>

        {/* ── Line Items Table: No | Jenis Barang | Karung | Berat (Kg) | Harga/Kg | Total ── */}
        <div style={s.section}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, ...s.thC, width: 40 }}>No</th>
                <th style={{ ...s.th, maxWidth: "200px" }}>Jenis Barang</th>
                <th style={{ ...s.th, ...s.thR }}>Karung</th>
                <th style={{ ...s.th, ...s.thR }}>Berat (Kg)</th>
                <th style={{ ...s.th, ...s.thR }}>Harga/Kg</th>
                <th style={{ ...s.th, ...s.thR }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((it, i) => (
                <tr key={i} style={i % 2 !== 0 ? s.rowAlt : {}}>
                  <td style={{ ...s.td, ...s.tdC }}>{i + 1}</td>
                  <td style={{ ...s.td, maxWidth: "200px", wordBreak: "break-word", whiteSpace: "normal", overflowWrap: "break-word" }}>
                    <strong>{it.itemName}</strong>

                  </td>
                  <td style={{ ...s.td, ...s.tdR }}>
                    {parseFloat(it.sackQty) > 0 ? `${parseFloat(it.sackQty).toLocaleString("id-ID")} krg` : "—"}
                  </td>
                  <td style={{ ...s.td, ...s.tdR }}>
                    {parseFloat(it.weightKg) > 0 ? `${parseFloat(it.weightKg).toLocaleString("id-ID")} kg` : "—"}
                  </td>
                  <td style={{ ...s.td, ...s.tdR }}>
                    {Number(it.pricePerKg) > 0 ? fmtIDR(it.pricePerKg) : "—"}
                  </td>
                  <td style={{ ...s.td, ...s.tdR, fontWeight: 700, color: it.txType === "income" ? "#10b981" : "#ef4444" }}>
                    {fmtIDR(it.subtotal || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Totals ── */}
        <div style={s.totalsWrap}>
          <div style={s.totalRow}>
            <span>Subtotal</span>
            <span style={{ fontWeight: 700 }}>{fmtIDR(subtotal)}</span>
          </div>
          {outstanding > 0 && (
            <div style={{ ...s.totalRow, color: "#f59e0b" }}>
              <span>Sisa Tagihan</span>
              <span style={{ fontWeight: 700 }}>{fmtIDR(outstanding)}</span>
            </div>
          )}
          <div style={{
            ...s.grandRow,
            color: outstanding === 0 ? "#10b981" : "#ef4444",
            borderTopColor: outstanding === 0 ? "#10b981" : "#ef4444",
          }}>
            <span>{outstanding === 0 ? "TOTAL LUNAS" : "TOTAL TERHUTANG"}</span>
            <span>{outstanding === 0 ? fmtIDR(subtotal) : fmtIDR(outstanding)}</span>
          </div>
          {outstanding === 0 && (
            <div style={{ fontSize: 11, color: "#10b981", marginTop: 4, textAlign: "right" }}>
              Semua tagihan telah lunas. Terima kasih!
            </div>
          )}
        </div>

        {/* ── Bank Details ── */}
        {(() => {
          const visibleAccounts = (settings.bankAccounts || []).filter((a) => a.showOnInvoice);
          if (visibleAccounts.length === 0 || (settings.maxBankAccountsOnInvoice ?? 1) === 0) return null;
          return (
            <div style={s.bankSection}>
              <div style={s.bankTitle}>Informasi Pembayaran</div>
              {visibleAccounts.map((acct, i) => (
                <div key={acct.id}>
                  {i > 0 && <div style={{ borderTop: "1px dashed #93c5fd", margin: "8px 0" }} />}
                  {acct.bankName      && <div style={s.bankRow}>NAMA BANK: <span style={s.bankValue}>{acct.bankName}</span></div>}
                  {acct.accountNumber && <div style={s.bankRow}>NO. REKENING: <span style={s.bankValue}>{acct.accountNumber}</span></div>}
                  {acct.accountName   && <div style={s.bankRow}>ATAS NAMA: <span style={s.bankValue}>{acct.accountName}</span></div>}
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Catatan: shown only when invoiceNote is non-empty ── */}
        {invoiceNote.trim() && (
          <div style={{ margin: "0 32px 16px", padding: "12px 16px", borderTop: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Catatan:</div>
            <div style={{ fontSize: 12, color: "#475569", whiteSpace: "pre-wrap" }}>{invoiceNote.trim()}</div>
          </div>
        )}

        {/* ── Spacer: hidden on screen, flex:1 in print to push sigs toward bottom ── */}
        <div className="inv-spacer" style={{ display: "none" }} />

        {/* ── Signature section: hidden on screen, shown in print ── */}
        <div className="inv-sig" style={{ display: "none" }}>
          <div className="inv-sig-block">
            <div className="inv-sig-label">Penerima,</div>
            <div className="inv-sig-space" />
            <div className="inv-sig-line" />
          </div>
          <div className="inv-sig-block">
            <div className="inv-sig-label">Hormat Kami,</div>
            <div className="inv-sig-space" />
            <div className="inv-sig-line" />
            <div className="inv-sig-name">{settings.businessName || "Usaha Kami"}</div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={s.footer}>
          Dibuat: {new Date().toLocaleString("id-ID")} · {settings.businessName}
        </div>

        {/* ── Actions ── */}
        <div data-no-print="true" style={s.actions}>
          <button
            onClick={handlePrint}
            className="btn btn-primary btn-lg"
            style={{ flex: 1 }}
            aria-label="Cetak invoice"
          >
            🖨️ Cetak Invoice
          </button>
          <button onClick={onClose} className="btn btn-secondary btn-lg">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;