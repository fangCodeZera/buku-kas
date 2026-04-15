/**
 * components/DeleteConfirmModal.js
 * Confirmation dialog for permanently deleting a transaction OR a contact.
 *
 * Props:
 *   transaction  — tx object (for tx delete mode)
 *   isContact    — true to switch to contact delete mode
 *   contact      — contact object { name, txCount } (for contact delete mode)
 *   onConfirm    — called when user confirms
 *   onCancel     — called when user cancels
 */
import React, { useEffect, useState } from "react";
import Icon from "./Icon";
import { fmtDate, fmtIDR } from "../utils/idGenerators";

const DeleteConfirmModal = ({ transaction, isContact, contact, onConfirm, onCancel }) => {
  const [confirmInput, setConfirmInput] = useState("");

  const handleCancel = () => { setConfirmInput(""); onCancel(); };
  const handleConfirm = () => { setConfirmInput(""); onConfirm(); };

  useEffect(() => {
    const visible = isContact ? !!contact : !!transaction;
    if (!visible) return;
    const handleKeyDown = (e) => { if (e.key === "Escape") handleCancel(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isContact, contact, transaction, onCancel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show modal only when we have something to confirm
  if (isContact ? !contact : !transaction) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dcm-title">
      <div className="modal-box" style={{ maxWidth: 440 }}>

        {/* Icon + title + description */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div className="delete-icon-circle">
            <Icon name="trash" size={24} color="#ef4444" />
          </div>

          {isContact ? (
            <>
              <h3 id="dcm-title" className="modal-title">Hapus Kontak?</h3>
              <p className="modal-body" style={{ lineHeight: 1.6 }}>
                Tindakan ini akan <strong>menghapus permanen</strong> kontak ini dari daftar.{" "}
                Semua transaksi terkait akan <strong>tetap tersimpan</strong> di sistem,
                tetapi tidak lagi terkait dengan kontak ini.
                <br />
                <strong style={{ color: "#ef4444" }}>Tidak dapat dibatalkan.</strong>
              </p>
            </>
          ) : (
            <>
              <h3 id="dcm-title" className="modal-title">Hapus Transaksi?</h3>
              <p className="modal-body" style={{ lineHeight: 1.6 }}>
                Tindakan ini akan <strong>menghapus permanen</strong> transaksi berikut dan
                secara otomatis memperbarui stok, saldo piutang/hutang, dan laporan terkait.
                <br />
                <strong style={{ color: "#ef4444" }}>Tidak dapat dibatalkan.</strong>
              </p>
            </>
          )}
        </div>

        {/* Summary row */}
        <div className="delete-tx-summary">
          {isContact ? (
            <>
              <div className="delete-tx-name">{contact.name}</div>
              <div className="delete-tx-meta">
                {contact.txCount || 0} transaksi tersimpan · kontak akan dihapus dari daftar
              </div>
            </>
          ) : (
            <>
              <div className="delete-tx-name">{transaction.itemName}</div>
              <div className="delete-tx-meta">
                {transaction.counterparty} · {fmtDate(transaction.date)} ·{" "}
                {transaction.type === "income" ? "📥 Pemasukan" : "📤 Pengeluaran"} ·{" "}
                {fmtIDR(transaction.value)}
              </div>
            </>
          )}
        </div>

        {/* Confirmation input */}
        <div style={{ margin: "12px 0 4px" }}>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder='Ketik "hapus" untuk melanjutkan'
            className="form-input"
            style={{ width: "100%", boxSizing: "border-box" }}
            aria-label='Ketik hapus untuk mengaktifkan tombol hapus'
          />
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button
            onClick={handleCancel}
            className="btn btn-secondary"
            aria-label="Batal"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            className="btn btn-danger"
            disabled={confirmInput.toLowerCase() !== "hapus"}
            style={confirmInput.toLowerCase() !== "hapus" ? { opacity: 0.5, cursor: "not-allowed" } : {}}
            aria-label={isContact ? "Konfirmasi hapus kontak ini" : "Konfirmasi hapus transaksi ini"}
          >
            🗑 Ya, Hapus
          </button>
        </div>

      </div>
    </div>
  );
};

export default DeleteConfirmModal;