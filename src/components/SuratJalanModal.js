/**
 * components/SuratJalanModal.js
 * Printable delivery note (Surat Jalan) for Penjualan transactions.
 *
 * Props:
 *   transaction: Object — a single income (Penjualan) transaction
 *   onClose:     function — close handler
 *
 * Print approach: printWithPortal() from utils/printUtils.js
 *   - Puts docRef.current.outerHTML into #print-portal (outside #root)
 *   - @media print hides #root, shows #print-portal
 *   - window.print() is synchronous — class removed after dialog closes
 *   - No body class on screen, no grey flash, no iframe, no new tab
 *
 * NOTE: This component uses CSS classes (via styles.css) for print layout,
 * unlike InvoiceModal which uses 100% inline styles. Both approaches work
 * with printWithPortal as long as styles.css is loaded. If styles are ever
 * lazy-loaded or split, migrate printable content to inline styles.
 */
import { useState, useRef, useEffect } from "react";
import { fmtDate, fmtQty } from "../utils/idGenerators";
import { printWithPortal } from "../utils/printUtils";

/** Extract displayable item rows from any transaction shape */
function getSuratJalanItems(t) {
  if (Array.isArray(t.items) && t.items.length > 0) {
    return t.items.map((it) => ({
      nama:   it.itemName || "—",
      jumlah: parseFloat(it.sackQty) || 0,
      unit:   t.stockUnit || "karung",
    }));
  }
  return [{
    nama:   t.itemName || "—",
    jumlah: parseFloat(t.sackQty ?? t.stockQty) || 0,
    unit:   t.stockUnit || "karung",
  }];
}

/** Determine font/spacing scale preset based on item count */
function getScale(itemCount) {
  if (itemCount <= 3) {
    return { titleSize: 22, bodyFont: 13, tableFont: 13, cellPadding: "8px 10px", sigSpace: 48, docPadding: 20, headerMargin: 16 };
  }
  if (itemCount <= 6) {
    return { titleSize: 18, bodyFont: 12, tableFont: 12, cellPadding: "6px 8px",  sigSpace: 36, docPadding: 16, headerMargin: 12 };
  }
  if (itemCount <= 10) {
    return { titleSize: 15, bodyFont: 11, tableFont: 11, cellPadding: "4px 6px",  sigSpace: 24, docPadding: 12, headerMargin: 8  };
  }
  return   { titleSize: 12, bodyFont: 10, tableFont: 10, cellPadding: "2px 4px",  sigSpace: 16, docPadding: 10, headerMargin: 6  };
}

/**
 * @param {{ transaction: Object, onClose: function }} props
 */
const SuratJalanModal = ({ transaction, contacts = [], onClose }) => {
  const [platMobil,    setPlatMobil]    = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [isPrinting,   setIsPrinting]   = useState(false);
  const docRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!transaction) return null;

  // Look up client address from contacts (case-insensitive)
  const clientAddress = contacts.find(
    (c) => (c.name || "").toLowerCase() === (transaction.counterparty || "").toLowerCase()
  )?.address?.trim() || "";

  const items       = getSuratJalanItems(transaction);
  const totalKarung = items.reduce((s, it) => s + it.jumlah, 0);
  const itemCount   = items.length;
  const sc          = getScale(itemCount);
  const isCompact   = itemCount > 6;

  const handlePrint = () => {
    if (isPrinting || !docRef.current) return;
    setIsPrinting(true);
    try {
      /* outerHTML captures the doc div with all its CSS classes AND inline
         styles (the sc.* values). styles.css is still loaded globally so
         .surat-jalan-doc__* classes are styled correctly in #print-portal.
         The embedded <style> adds page setup + removes the screen border. */
      printWithPortal(
        `<style>
          body { margin: 0; background: #fff;
                 -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          * { box-sizing: border-box; }
          .surat-jalan-doc { border: none !important; border-radius: 0 !important; }
          @page { size: A5 portrait; margin: 8mm; }
        </style>${docRef.current.outerHTML}`
      );
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="surat-jalan-overlay" role="dialog" aria-modal="true" aria-labelledby="sj-title">
      <div className="surat-jalan-modal">

        {/* ── Controls (not in portal content — hidden by being outside docRef) ── */}
        <div className="surat-jalan-controls">
          <span className="surat-jalan-controls__title">
            🚚 Surat Jalan — {transaction.counterparty || "—"}
          </span>

          <div className="surat-jalan-controls__input-group">
            <label className="surat-jalan-controls__label">
              Plat Nomor Kendaraan (opsional)
            </label>
            <input
              className="surat-jalan-controls__input"
              value={platMobil}
              onChange={(e) => setPlatMobil(e.target.value)}
              placeholder="Contoh: BG 8868 ID"
            />
          </div>

          <div className="surat-jalan-controls__input-group">
            <label className="surat-jalan-controls__label">
              Catatan Pengiriman (opsional)
            </label>
            <textarea
              className="surat-jalan-controls__input"
              rows={2}
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder="Contoh: Barang dikirim dengan truk, harap hati-hati"
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignSelf: "flex-end" }}>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="btn btn-primary"
              aria-label="Cetak surat jalan"
            >
              {isPrinting ? "⏳ Menyiapkan..." : "🖨️ Cetak Surat Jalan"}
            </button>
            <button onClick={onClose} className="btn btn-secondary">
              ✕ Tutup
            </button>
          </div>
          <p className="surat-jalan-print-tip">
            💡 Tip: Untuk hasil terbaik, hilangkan centang "Headers and footers" di dialog print browser.
          </p>
        </div>

        {/* ── Print preview — only this div (via docRef) goes to the portal ── */}
        <div className="surat-jalan-preview">
          <div
            ref={docRef}
            className="surat-jalan-doc"
            style={{ fontSize: sc.bodyFont, padding: sc.docPadding }}
          >

            {/* Title */}
            <div
              className="surat-jalan-doc__title"
              id="sj-title"
              style={{ fontSize: sc.titleSize }}
            >
              SURAT JALAN
            </div>
            <div
              className="surat-jalan-doc__title-line"
              style={{ marginBottom: sc.headerMargin }}
            />

            {/* Info grid: left = recipient, right = date/invoice/plate */}
            <div
              className="surat-jalan-doc__info"
              style={{ marginBottom: sc.headerMargin }}
            >
              <div className="surat-jalan-doc__info-block">
                <div className="surat-jalan-doc__info-row">
                  <span className="surat-jalan-doc__info-label">KEPADA YTH</span>
                  <span className="surat-jalan-doc__info-value">
                    {transaction.counterparty || "—"}
                  </span>
                </div>
                {clientAddress && (
                  <div style={{ fontSize: sc.bodyFont, marginLeft: 98, marginTop: 2 }}>
                    {clientAddress}
                  </div>
                )}
              </div>

              <div className="surat-jalan-doc__info-block">
                <div className="surat-jalan-doc__info-row">
                  <span className="surat-jalan-doc__info-label">TANGGAL</span>
                  <span className="surat-jalan-doc__info-value">
                    {fmtDate(transaction.date)}
                  </span>
                </div>
                <div className="surat-jalan-doc__info-row">
                  <span className="surat-jalan-doc__info-label">NO. INVOICE</span>
                  <span className="surat-jalan-doc__info-value">
                    {transaction.txnId || "—"}
                  </span>
                </div>
                <div className="surat-jalan-doc__info-row">
                  <span className="surat-jalan-doc__info-label">PLAT MOBIL</span>
                  {platMobil
                    ? <span className="surat-jalan-doc__info-value">{platMobil}</span>
                    : <span className="surat-jalan-doc__info-value--blank" />
                  }
                </div>
              </div>
            </div>

            {/* Items table */}
            <table className="surat-jalan-doc__table" style={{ tableLayout: "fixed", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ padding: sc.cellPadding, fontSize: sc.tableFont }}>NO</th>
                  <th style={{ padding: sc.cellPadding, fontSize: sc.tableFont, maxWidth: "250px" }}>JENIS BARANG</th>
                  <th style={{ padding: sc.cellPadding, fontSize: sc.tableFont }}>JUMLAH BARANG</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ padding: sc.cellPadding, fontSize: sc.tableFont }}>{i + 1}</td>
                    <td style={{ padding: sc.cellPadding, fontSize: sc.tableFont, textAlign: "left", maxWidth: "250px", wordBreak: "break-word", whiteSpace: "normal", overflowWrap: "break-word" }}>{it.nama}</td>
                    <td style={{ padding: sc.cellPadding, fontSize: sc.tableFont }}>{fmtQty(it.jumlah)} {it.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total */}
            <div className="surat-jalan-doc__total">
              Total: {fmtQty(totalKarung)} karung
            </div>

            {/* Transaction notes */}
            {transaction.notes && (
              <div className="surat-jalan-doc__notes">
                <div className="surat-jalan-doc__notes-label">Keterangan</div>
                {transaction.notes}
              </div>
            )}

            {/* Delivery note from control input */}
            {deliveryNote && (
              <div className="surat-jalan-doc__notes">
                <div className="surat-jalan-doc__notes-label">Keterangan Pengiriman</div>
                {deliveryNote}
              </div>
            )}

            {/* Signatures */}
            <div
              className="surat-jalan-doc__signatures"
              style={{ marginTop: sc.headerMargin }}
            >
              <div className="surat-jalan-doc__sig-block">
                <div className="surat-jalan-doc__sig-label">Penerima,</div>
                <div
                  className="surat-jalan-doc__sig-space"
                  style={{ height: sc.sigSpace }}
                />
                <div className="surat-jalan-doc__sig-line" />
              </div>
              <div className="surat-jalan-doc__sig-block">
                <div className="surat-jalan-doc__sig-label">Hormat Kami,</div>
                <div
                  className="surat-jalan-doc__sig-space"
                  style={{ height: sc.sigSpace }}
                />
                <div className="surat-jalan-doc__sig-line" />
              </div>
            </div>

          </div>

          {/* Scale indicator — only shown for small/compact presets */}
          {isCompact && (
            <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
              ℹ Teks diperkecil otomatis agar muat 1 halaman ({itemCount} item)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuratJalanModal;
