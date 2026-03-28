/**
 * components/StockWarningModal.js
 * Warning dialog shown when a sale would push stock into negative territory.
 * The user can override and proceed, or cancel to correct the quantity.
 */
import React, { useEffect } from "react";

/**
 * @param {{
 *   data: { item: string, current: number, selling: number, items?: Array<{item: string, current: number, selling: number}>, onConfirm: () => void, onCancel?: () => void } | null,
 *   onClose: () => void
 * }} props
 */
const StockWarningModal = ({ data, onClose }) => {
  useEffect(() => {
    if (!data) return;
    const handleKeyDown = (e) => { if (e.key === "Escape") { data.onCancel?.(); onClose(); } };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [data, onClose]);

  if (!data) return null;

  const isMulti = data.items && data.items.length > 1;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="swm-title">
      <div className="modal-box" style={{ maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>⚠️</div>
        <h3 id="swm-title" className="modal-title">Peringatan Stok</h3>
        {isMulti ? (
          <>
            <p className="modal-body">Stok akan menjadi negatif untuk beberapa barang:</p>
            <ul style={{ textAlign: "left", margin: "0 0 20px", padding: "0 0 0 20px" }}>
              {data.items.map((it, i) => (
                <li key={i} style={{ marginBottom: 4, fontSize: 14 }}>
                  <strong>{it.item}</strong>: stok {it.current}, dijual {it.selling}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="modal-body">
              Anda menjual <strong>{data.selling}</strong> dari <strong>"{data.item}"</strong>,
            </p>
            <p className="modal-body" style={{ marginBottom: 20 }}>
              namun stok tersedia hanya{" "}
              <strong style={{ color: data.current <= 0 ? "#ef4444" : "#f59e0b" }}>
                {data.current}
              </strong>
              . Stok akan menjadi negatif.
            </p>
          </>
        )}
        <div className="modal-actions">
          <button
            onClick={() => { data.onConfirm(); onClose(); }}
            className="btn btn-danger"
            aria-label="Tetap lanjutkan meski stok negatif"
          >
            Tetap Lanjutkan
          </button>
          <button
            onClick={() => { data.onCancel?.(); onClose(); }}
            className="btn btn-secondary"
            aria-label="Batal dan koreksi jumlah"
          >
            Batal & Koreksi
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockWarningModal;
