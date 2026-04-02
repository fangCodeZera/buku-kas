/**
 * components/DotMatrixPrintModal.js
 * Preview and print modal for dot matrix (80-column ASCII) output.
 *
 * Used for both Invoice and Surat Jalan in "Dot Matrix" printer mode.
 * Conditionally mounted — no Escape guard needed.
 *
 * Props:
 *   transaction {Array|Object} — array for mode "invoice", single object for "suratJalan"
 *   mode        {"invoice"|"suratJalan"}
 *   settings    {Object}       — app settings (businessName, bankAccounts, etc.)
 *   onClose     {() => void}
 */
import React, { useMemo, useEffect } from "react";
import { formatInvoice, formatSuratJalan } from "../utils/textFormatter";
import { printWithPortal } from "../utils/printUtils";

const DotMatrixPrintModal = ({ transaction, mode, settings, onClose }) => {
  // Escape key closes modal (conditionally mounted — no guard needed)
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const formattedText = useMemo(() => {
    if (mode === "invoice") {
      return formatInvoice(transaction, settings);
    }
    return formatSuratJalan(transaction, settings);
  }, [transaction, mode, settings]);

  const handlePrint = () => {
    // Escape HTML special chars to prevent injection; pre-tag uses inline styles
    // for print portal compatibility (CSS classes don't resolve outside #root)
    const escaped = formattedText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const printHtml = `<pre style="font-family:'Courier New',Courier,monospace;font-size:12pt;line-height:1;margin:0;padding:0;white-space:pre;border:none;background:none;">${escaped}</pre>`;
    printWithPortal(printHtml);
  };

  const title = mode === "invoice"
    ? "Pratinjau Cetak Dot Matrix \u2014 Invoice"
    : "Pratinjau Cetak Dot Matrix \u2014 Surat Jalan";

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-box" style={{ maxWidth: 750, width: "100%" }}>
        <h3 className="modal-title" style={{ marginTop: 0, marginBottom: 16 }}>{title}</h3>

        <pre className="dot-matrix-preview">{formattedText}</pre>

        <div className="modal-actions" style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-secondary" aria-label="Batal">
            Batal
          </button>
          <button onClick={handlePrint} className="btn btn-primary" aria-label="Konfirmasi cetak">
            🖨 Konfirmasi Cetak
          </button>
        </div>
      </div>
    </div>
  );
};

export default DotMatrixPrintModal;
