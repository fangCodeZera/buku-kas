/**
 * components/TransactionDetailModal.js
 * Read-only detail popup for a single transaction.
 * Shown when the user clicks a transaction row (outside action buttons).
 *
 * Props:
 *   transaction — full transaction object
 *   onClose     — called to dismiss
 *
 * Conditionally mounted — no Escape guard needed.
 * No action buttons — read-only display only.
 */
import { useEffect } from "react";
import { fmtQty, fmtIDR, fmtDate } from "../utils/idGenerators";
import { computePaymentProgress } from "../utils/paymentUtils";
import { StatusBadge, TypeBadge } from "./Badge";

const TransactionDetailModal = ({ transaction, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!transaction) return null;

  const t = transaction;
  const items = Array.isArray(t.items) && t.items.length > 0
    ? t.items
    : [{ itemName: t.itemName || "—", sackQty: t.sackQty ?? t.stockQty ?? 0, weightKg: t.weightKg || 0, pricePerKg: t.pricePerKg || 0, subtotal: t.value || 0 }];

  // Payment history most-recent first
  const history = [...(t.paymentHistory || [])].reverse();

  const SYSTEM_NOTES = new Set([
    "Pembayaran awal", "Pelunasan", "Pembayaran sebagian",
    "Transaksi diedit", "Piutang dihapus", "Hutang dihapus",
    "(data lama)",
  ]);

  const labelStyle = { fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 };
  const valueStyle = { fontSize: 13, fontWeight: 600, color: "#1e293b" };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tdm-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-box" style={{ maxWidth: 600, width: "100%", padding: 0, overflow: "hidden" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <h3 id="tdm-title" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1e3a5f" }}>
            Detail Transaksi
          </h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1, padding: "0 4px" }}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "16px 20px" }}>

          {/* ── Section 1: Top metadata two columns ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 16 }}>
            <div>
              <div style={labelStyle}>Tanggal</div>
              <div style={valueStyle}>{fmtDate(t.date)} {t.time && <span style={{ color: "#9ca3af", fontWeight: 400 }}>{t.time}</span>}</div>
            </div>
            <div>
              <div style={labelStyle}>No. Invoice</div>
              <div style={{ ...valueStyle, fontFamily: "monospace", color: t.type === "income" ? "#6366f1" : "#374151" }}>
                {t.txnId || <span style={{ color: "#d1d5db" }}>—</span>}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Jenis</div>
              <div><TypeBadge type={t.type} /></div>
            </div>
            <div>
              <div style={labelStyle}>Status</div>
              <div><StatusBadge status={t.status} /></div>
            </div>
            {t.dueDate && (
              <div>
                <div style={labelStyle}>Jatuh Tempo</div>
                <div style={valueStyle}>{fmtDate(t.dueDate)}</div>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid #f1f5f9", marginBottom: 16 }} />

          {/* ── Section 2: Client ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>{t.type === "income" ? "Pembeli" : "Supplier"}</div>
            <div style={{ ...valueStyle, fontSize: 15 }}>{t.counterparty || "—"}</div>
          </div>

          <div style={{ borderTop: "1px solid #f1f5f9", marginBottom: 16 }} />

          {/* ── Section 3: Items table ── */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Barang</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left",  fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Barang</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Karung</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Berat</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Harga/Kg</th>
                    <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                      <td style={{ padding: "7px 8px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#1e293b" }}>{it.itemName || "—"}</td>
                      <td style={{ padding: "7px 8px", borderBottom: "1px solid #f1f5f9", textAlign: "right", color: "#374151" }}>
                        {Number(it.sackQty) > 0 ? `${fmtQty(it.sackQty)} ${t.stockUnit || "krg"}` : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", borderBottom: "1px solid #f1f5f9", textAlign: "right", color: "#374151" }}>
                        {Number(it.weightKg) > 0 ? `${fmtQty(it.weightKg)} kg` : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", borderBottom: "1px solid #f1f5f9", textAlign: "right", color: "#374151" }}>
                        {Number(it.pricePerKg) > 0 ? fmtIDR(it.pricePerKg) : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 700, color: t.type === "income" ? "#10b981" : "#ef4444" }}>
                        {fmtIDR(it.subtotal || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section 4: Unified totals + payment summary ── */}
          <div style={{ marginTop: 8, marginBottom: 16 }}>
            {/* Total Nilai */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", fontSize: 13, borderTop: "2px solid #1e3a5f" }}>
              <span style={{ fontWeight: 700, color: "#1e3a5f" }}>Total Nilai</span>
              <span style={{ fontWeight: 800, color: t.type === "income" ? "#10b981" : "#ef4444" }}>{fmtIDR(t.value || 0)}</span>
            </div>

            {/* Payment breakdown — divider + Sudah Dibayar + Sisa Tagihan + progress bar */}
            <div style={{ borderTop: "1px solid #e5e7eb", padding: "8px 8px 6px" }}>
              {/* Sudah Dibayar */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#10b981", fontWeight: 600 }}>Sudah Dibayar</span>
                <span style={{ color: "#10b981", fontWeight: 700 }}>{fmtIDR((t.value || 0) - (t.outstanding || 0))}</span>
              </div>
              {/* Sisa Tagihan */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 8 }}>
                <span style={{ color: (t.outstanding || 0) > 0 ? "#f59e0b" : "#10b981", fontWeight: 600 }}>
                  {(t.outstanding || 0) > 0 ? "Sisa Tagihan" : "Lunas ✓"}
                </span>
                {(t.outstanding || 0) > 0 && (
                  <span style={{ color: "#f59e0b", fontWeight: 700 }}>{fmtIDR(t.outstanding)}</span>
                )}
              </div>
              {/* Progress bar */}
              {(() => {
                const prog = computePaymentProgress(t.value, t.outstanding);
                if (!prog) return null;
                return (
                  <div className="payment-progress-wrap">
                    <div className="payment-progress-bar">
                      <div className="payment-progress-bar__fill" style={{ width: `${prog.percent}%` }} />
                    </div>
                    <span className="payment-progress-pct">{prog.percent}%</span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Section 5: Notes (conditional) ── */}
          {t.notes?.trim() && (
            <>
              <div style={{ borderTop: "1px solid #f1f5f9", marginBottom: 12 }} />
              <div style={{ marginBottom: 16 }}>
                <div style={labelStyle}>Catatan</div>
                <div style={{ fontSize: 13, color: "#475569", whiteSpace: "pre-wrap", marginTop: 2 }}>{t.notes.trim()}</div>
              </div>
            </>
          )}

          {/* ── Section 6: Payment history ── */}
          {history.length > 0 && (
            <>
              <div style={{ borderTop: "1px solid #f1f5f9", marginBottom: 12 }} />
              <div>
                <div style={{ ...labelStyle, marginBottom: 8 }}>Riwayat Pembayaran ({history.length})</div>

                {history.map((ph, i) => {
                  const isEdit = ph.note === "Transaksi Diedit" || ph.note === "Transaksi diedit — nilai diperbarui";
                  const isSystem = SYSTEM_NOTES.has(ph.note);
                  const isPending = !ph.amount && i === history.length - 1 && (t.outstanding || 0) > 0;
                  return (
                    <div key={ph.id || i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: isPending ? "#f59e0b" : "#10b981", flexShrink: 0, marginTop: 5 }} />
                      <div style={{ flex: 1, fontSize: 12, color: "#374151" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          {isEdit
                            ? <span style={{ fontWeight: 700, fontSize: 13, color: "#1e3a5f" }}>Transaksi Diedit</span>
                            : <span style={{ fontWeight: 700, fontSize: 13, color: "#1e3a5f" }}>{fmtIDR(ph.amount || 0)}</span>
                          }
                          <span style={{ color: "#6b7280", fontSize: 11, flexShrink: 0 }}>{fmtDate(ph.date)} {ph.time}</span>
                        </div>
                        {isEdit && ph.valueAfter != null && (
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, lineHeight: 1.6 }}>
                            <div>Total Nilai: {fmtIDR(ph.valueBefore)} → {fmtIDR(ph.valueAfter)}</div>
                            <div>Sudah Dibayar: {fmtIDR(ph.paidBefore ?? 0)} → {fmtIDR(ph.paidAfter ?? 0)}</div>
                            <div>Sisa Tagihan: {fmtIDR(ph.outstandingBefore)} → {fmtIDR(ph.outstandingAfter)}</div>
                            <div>Status: {ph.statusBefore} → {ph.statusAfter}</div>
                          </div>
                        )}
                        {isEdit && ph.valueAfter == null && ph.outstandingAfter != null && (
                          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>
                            Sisa setelah: {fmtIDR(ph.outstandingAfter)}
                          </div>
                        )}
                        {!isEdit && ph.note && (
                          <div style={{ color: "#374151", fontSize: 11, marginTop: 2 }}>
                            {isSystem ? ph.note : `Catatan: ${ph.note}`}
                          </div>
                        )}
                        {!isEdit && ph.outstandingAfter != null && (
                          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>
                            Sisa setelah: {fmtIDR(ph.outstandingAfter)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Footer close button ── */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
          <button onClick={onClose} className="btn btn-secondary">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailModal;
