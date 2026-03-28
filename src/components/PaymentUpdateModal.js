/**
 * components/PaymentUpdateModal.js
 * Modal for recording a payment (full or partial) against a transaction
 * that has an outstanding balance.
 *
 * Behaviour:
 *  - Pre-fills "Jumlah Dibayar" with the full outstanding amount
 *  - If paid == outstanding  → status "Lunas",  outstanding = 0
 *  - If paid <  outstanding  → status "Sebagian Dibayar (Piutang|Utang)", outstanding -= paid
 *  - Validates: 1 ≤ paid ≤ outstanding
 *  - onConfirm(paidAmount) is called; parent handles the state update
 */
import React, { useState, useEffect, useRef } from "react";
import RupiahInput from "./RupiahInput";
import { fmtIDR, fmtDate } from "../utils/idGenerators";

/**
 * @param {{
 *   transaction: Object | null,
 *   onConfirm: (paidAmount: number) => void,
 *   onCancel: () => void
 * }} props
 */
const PaymentUpdateModal = ({ transaction, onConfirm, onCancel }) => {
  const [paidAmount,   setPaidAmount]   = useState(0);
  const [error,        setError]        = useState("");
  const [paymentNote,  setPaymentNote]  = useState("");

  const amountFieldRef = useRef(null);

  // Reset amount input whenever a new transaction is opened
  useEffect(() => {
    if (transaction) {
      setPaidAmount(transaction.outstanding || 0);
      setError("");
      setPaymentNote("");
    }
  }, [transaction]);

  // Auto-focus the amount input when the modal opens
  // RupiahInput does not forward refs, so we query the input inside the payment-field div
  useEffect(() => {
    if (transaction && amountFieldRef.current) {
      const input = amountFieldRef.current.querySelector("input");
      if (input) {
        setTimeout(() => input.focus(), 50);
      }
    }
  }, [transaction]);

  useEffect(() => {
    if (!transaction) return;
    const handleKeyDown = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [transaction, onCancel]);

  if (!transaction) return null;

  const outstanding = transaction.outstanding || 0;
  const isFull      = paidAmount >= outstanding;
  const newOutstanding = isFull ? 0 : outstanding - paidAmount;

  const handleConfirm = () => {
    if (!paidAmount || paidAmount <= 0) {
      setError("Jumlah pembayaran harus lebih dari 0");
      return;
    }
    if (paidAmount > outstanding) {
      setError("Jumlah melebihi sisa tagihan");
      return;
    }
    setError("");
    onConfirm(paidAmount, paymentNote.trim());
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
      <div className="modal-box" style={{ maxWidth: 420 }}>

        {/* Icon */}
        <div className="paid-icon-circle" aria-hidden="true">💳</div>

        <h3 className="modal-title" id="payment-modal-title" style={{ textAlign: "center" }}>
          Bayar Tagihan
        </h3>
        <p className="modal-body" style={{ textAlign: "center", marginBottom: 14, fontSize: 13 }}>
          Masukkan jumlah yang dibayar sekarang. Sisa tagihan akan diperbarui dan
          saldo AR/AP serta total kas akan disesuaikan otomatis.
        </p>

        {/* Transaction summary */}
        <div className="paid-tx-summary">
          <div><span className="paid-tx-label">Klien</span>      <span className="paid-tx-value">{transaction.counterparty}</span></div>
          <div><span className="paid-tx-label">Item</span>       <span className="paid-tx-value">{transaction.itemName}</span></div>
          <div><span className="paid-tx-label">Nilai Total</span><span className="paid-tx-value" style={{ color: "#10b981", fontWeight: 700 }}>{fmtIDR(transaction.value)}</span></div>
          <div>
            <span className="paid-tx-label">Sisa Tagihan</span>
            <span className="paid-tx-value" style={{ color: "#f59e0b", fontWeight: 700 }}>
              {fmtIDR(outstanding)}
            </span>
          </div>
          <div><span className="paid-tx-label">Tanggal</span><span className="paid-tx-value">{fmtDate(transaction.date)}</span></div>
        </div>

        {/* Payment input */}
        <div className="payment-field" ref={amountFieldRef}>
          <label className="payment-field__label" htmlFor="payment-amount-input">
            Jumlah Dibayar Sekarang
          </label>
          <RupiahInput
            value={paidAmount}
            onChange={(n) => { setPaidAmount(n); setError(""); }}
            hasError={!!error}
            placeholder="0"
          />
          {error && (
            <div className="payment-field__error" role="alert">{error}</div>
          )}
        </div>

        {/* Live preview of result */}
        <div className="payment-preview" aria-live="polite">
          {paidAmount > 0 && paidAmount <= outstanding ? (
            isFull ? (
              <span className="payment-preview--full">✅ Transaksi akan ditandai <strong>Lunas</strong></span>
            ) : (
              <span className="payment-preview--partial">
                🔄 Sisa tagihan baru: <strong>{fmtIDR(newOutstanding)}</strong>
                {" "}→ Status: <strong>Belum Lunas</strong>
              </span>
            )
          ) : null}
        </div>

        {/* Optional payment note */}
        <div className="payment-field" style={{ marginTop: 12 }}>
          <label className="payment-field__label" htmlFor="payment-note-input">
            Catatan Pembayaran (opsional)
          </label>
          <input
            id="payment-note-input"
            type="text"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            placeholder="Contoh: Transfer BCA, No. ref: 12345"
            maxLength={100}
            className="search-input"
            style={{ width: "100%", fontSize: 13 }}
          />
        </div>

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            aria-label="Batal pembayaran"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            className="btn btn-paid"
            aria-label="Konfirmasi pembayaran"
          >
            💳 Konfirmasi Bayar
          </button>
        </div>

      </div>
    </div>
  );
};

export default PaymentUpdateModal;