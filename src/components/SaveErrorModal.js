/**
 * components/SaveErrorModal.js
 * Phase 4: Blocking modal shown when any Supabase write fails.
 * Cannot be dismissed by clicking outside. Offers Retry and Dismiss options.
 * All UI text in Indonesian.
 */
import React, { useState, useEffect } from "react";

/**
 * @param {{
 *   message: string,
 *   onRetry: () => void,
 *   onDismiss: () => void
 * }} props
 */
export default function SaveErrorModal({ message, onRetry, onDismiss }) {
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  // Escape key retries (not dismisses) — user must explicitly choose to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onRetry();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onRetry]);

  return (
    <div
      className="modal-overlay modal-overlay--blocking"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="save-error-title"
      // Intentionally no onClick to dismiss — this modal is blocking
    >
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-title" id="save-error-title" style={{ color: "#991b1b" }}>
          ⚠️ Gagal Menyimpan Data
        </div>
        <div className="modal-body">
          <p style={{ marginTop: 0 }}>
            Terjadi kesalahan saat menyimpan data. Periksa koneksi internet
            Anda dan coba lagi. Data Anda belum tersimpan.
          </p>
          {message && (
            <pre style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 12,
              color: "#991b1b",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: "0 0 8px",
            }}>
              {message}
            </pre>
          )}
          {confirmDismiss && (
            <p style={{ color: "#b45309", fontSize: 13, margin: "8px 0 0", fontWeight: 600 }}>
              ⚠️ Perhatian: Mengabaikan kesalahan ini berarti perubahan terakhir mungkin tidak tersimpan.
              Klik "Abaikan" lagi untuk konfirmasi.
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-primary"
            onClick={onRetry}
            autoFocus
          >
            Coba Lagi
          </button>
          <button
            className="btn btn-danger-outline"
            onClick={() => {
              if (!confirmDismiss) {
                setConfirmDismiss(true);
              } else {
                onDismiss();
              }
            }}
          >
            {confirmDismiss ? "Abaikan (Konfirmasi)" : "Abaikan"}
          </button>
        </div>
      </div>
    </div>
  );
}
