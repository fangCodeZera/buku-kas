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
import React, { useState, useMemo, useEffect } from "react";
import { formatInvoice, formatSuratJalan } from "../utils/textFormatter";
import { printWithPortal } from "../utils/printUtils";

const DotMatrixPrintModal = ({ transaction, mode, settings, contacts = [], onClose }) => {
  // Escape key closes modal (conditionally mounted — no guard needed)
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const [invoiceNote,       setInvoiceNote]       = useState("");
  const [platNomor,         setPlatNomor]         = useState("");
  const [catatanPengiriman, setCatatanPengiriman] = useState("");

  const formattedText = useMemo(() => {
    if (mode === "invoice") {
      return formatInvoice(transaction, settings, { note: invoiceNote }, contacts);
    }
    return formatSuratJalan(transaction, settings, { platNomor, catatanPengiriman }, contacts);
  }, [transaction, mode, settings, contacts, invoiceNote, platNomor, catatanPengiriman]);

  const handlePrint = () => {
    const escaped = formattedText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const printHtml = `
      <style>
        @page {
          margin: 4mm 4mm 4mm 4mm;
        }
        html, body {
          margin: 0;
          padding: 0;
        }
        pre {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12pt;
          line-height: 1.2;
          margin: 0;
          padding: 0;
          white-space: pre;
          border: none;
          background: none;
        }
      </style>
      <pre>${escaped}</pre>`;

    printWithPortal(printHtml);
  };

  const title = mode === "invoice"
    ? "Pratinjau Cetak Dot Matrix \u2014 Invoice"
    : "Pratinjau Cetak Dot Matrix \u2014 Surat Jalan";

  const inputStyle = {
    width: "100%", border: "1px solid #e2e8f0", borderRadius: 6,
    padding: "8px 10px", fontSize: 13, boxSizing: "border-box",
  };
  const labelStyle = {
    display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4,
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-box" style={{ maxWidth: 750, width: "100%" }}>
        <h3 className="modal-title" style={{ marginTop: 0, marginBottom: 16 }}>{title}</h3>

        {/* ── Input fields (not printed — values flow into formattedText via useMemo) ── */}
        {mode === "invoice" && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Catatan Invoice (opsional)</label>
            <textarea
              value={invoiceNote}
              onChange={(e) => setInvoiceNote(e.target.value)}
              rows={2}
              maxLength={500}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>
        )}
        {mode === "suratJalan" && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Plat Nomor Kendaraan (opsional)</label>
              <input
                type="text"
                value={platNomor}
                onChange={(e) => setPlatNomor(e.target.value)}
                maxLength={20}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Catatan Pengiriman (opsional)</label>
              <textarea
                value={catatanPengiriman}
                onChange={(e) => setCatatanPengiriman(e.target.value)}
                rows={2}
                maxLength={500}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
          </div>
        )}

        <pre className="dot-matrix-preview" style={{ lineHeight: 1.2 }}>{formattedText}</pre>

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
