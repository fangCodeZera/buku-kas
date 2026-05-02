/**
 * components/StockReportModal.js
 * Printable Stock Report modal — groups items by category, shows quantities (no prices).
 *
 * Uses 100% inline styles on the printable area — mandatory for printWithPortal()
 * which captures outerHTML into #print-portal outside React's #root.
 * CSS class references would not survive this capture.
 */
import React, { useState, useMemo, useRef, useEffect } from "react";
import { today, fmtDate, normalizeTitleCase, normItem } from "../utils/idGenerators";
import { computeStockMapForDate } from "../utils/stockUtils";
import { printWithPortal } from "../utils/printUtils";
import ToggleSwitch from "./ToggleSwitch";

/**
 * @param {{
 *   stockMap: Object,
 *   itemCatalog: Array,
 *   settings: Object,
 *   transactions: Array,
 *   stockAdjustments: Array,
 *   onClose: () => void
 * }} props
 */
const StockReportModal = ({
  stockMap,
  itemCatalog = [],
  settings,
  transactions,
  stockAdjustments,
  onClose,
}) => {
  const [reportDate, setReportDate] = useState(today());
  const [showZeroStock, setShowZeroStock] = useState(false);
  const [showCompanyName, setShowCompanyName] = useState(false);
  const [showArchivedItems, setShowArchivedItems] = useState(false);
  const docRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // ── Effective stock map (date-specific or current) ──────────────────────────
  const effectiveStockMap = useMemo(() => {
    if (!stockMap) return {};
    if (reportDate === today()) return stockMap;
    return computeStockMapForDate(transactions, reportDate, stockAdjustments);
  }, [reportDate, stockMap, transactions, stockAdjustments]);

  // ── Grouped report data ────────────────────────────────────────────────────
  const groupedData = useMemo(() => {
    if (!effectiveStockMap || Object.keys(effectiveStockMap).length === 0) return [];

    const groups = [];
    const categorized = new Set();

    // Build groups from itemCatalog: base item = group header, subtypes = members.
    // Use ALL catalog entries for grouping — even archived base items still parent their subtypes.
    // Only the base row itself is excluded when cat.archived is true.
    for (const cat of (itemCatalog || [])) {
      const items = [];

      // Base item row — only include if base item is not archived
      const baseKey = normItem(cat.name);
      const baseEntry = effectiveStockMap[baseKey];
      categorized.add(baseKey);
      if (!cat.archived) {
        const baseTxCount = baseEntry?.txCount || 0;
        const baseQty     = baseEntry?.qty     ?? 0;
        const isEmptyBase = baseQty === 0 && baseTxCount === 0;

        if (!isEmptyBase) {
          if (baseEntry) {
            if (showZeroStock || baseEntry.qty !== 0) {
              items.push({
                displayName: baseEntry.displayName || normalizeTitleCase(cat.name),
                qty: baseEntry.qty,
                unit: baseEntry.unit || "karung",
              });
            }
          } else if (showZeroStock) {
            // Item exists in catalog but has no stock history at all — show as 0
            items.push({
              displayName: normalizeTitleCase(cat.name),
              qty: 0,
              unit: "karung",
            });
          }
        }
      }

      // Subtypes (active only)
      const activeSubtypes = (cat.subtypes || []).filter(
        (s) => !(cat.archivedSubtypes || []).map(normItem).includes(normItem(s))
      );
      for (const sub of activeSubtypes) {
        const subKey = normItem(`${cat.name} ${sub}`);
        const subEntry = effectiveStockMap[subKey];
        categorized.add(subKey);
        if (subEntry) {
          if (showZeroStock || subEntry.qty !== 0) {
            items.push({
              displayName: subEntry.displayName || normalizeTitleCase(`${cat.name} ${sub}`),
              qty: subEntry.qty,
              unit: subEntry.unit || "karung",
            });
          }
        } else if (showZeroStock) {
          // Subtype exists in catalog but has no stock history — show as 0
          items.push({
            displayName: normalizeTitleCase(`${cat.name} ${sub}`),
            qty: 0,
            unit: "karung",
          });
        }
      }

      if (items.length > 0) {
        items.sort((a, b) => a.displayName.localeCompare(b.displayName, "id"));
        groups.push({ groupName: cat.name, code: cat.code || '', items });
      }
    }

    // Build set of all archived item keys (base + archived subtypes)
    const archivedKeys = new Set();
    for (const cat of (itemCatalog || [])) {
      if (cat.archived) archivedKeys.add(normItem(cat.name));
      for (const sub of (cat.archivedSubtypes || [])) {
        archivedKeys.add(normItem(`${cat.name} ${sub}`));
      }
    }

    // Catch items in stockMap not covered by active catalog entries.
    // Split into truly uncatalogued vs archived (controlled by showArchivedItems toggle).
    const uncatItems = [];
    const archivedItems = [];
    for (const [normName, entry] of Object.entries(effectiveStockMap)) {
      if (categorized.has(normName)) continue;
      if (!showZeroStock && entry.qty === 0) continue;
      if (archivedKeys.has(normName)) {
        archivedItems.push({
          displayName: entry.displayName || normName,
          qty: entry.qty,
          unit: entry.unit || "karung",
        });
      } else {
        uncatItems.push({
          displayName: entry.displayName || normName,
          qty: entry.qty,
          unit: entry.unit || "karung",
        });
      }
    }
    if (uncatItems.length > 0) {
      uncatItems.sort((a, b) => a.displayName.localeCompare(b.displayName, "id"));
      groups.push({ groupName: "Lainnya", items: uncatItems });
    }
    if (showArchivedItems && archivedItems.length > 0) {
      archivedItems.sort((a, b) => a.displayName.localeCompare(b.displayName, "id"));
      groups.push({ groupName: "Barang Diarsipkan", items: archivedItems });
    }

    groups.sort((a, b) => {
      if (a.groupName === "Barang Diarsipkan") return 1;
      if (b.groupName === "Barang Diarsipkan") return -1;
      if (a.groupName === "Lainnya") return 1;
      if (b.groupName === "Lainnya") return -1;
      return a.groupName.localeCompare(b.groupName, "id");
    });
    return groups;
  }, [effectiveStockMap, itemCatalog, showZeroStock, showArchivedItems]);

  // ── Guard: no stockMap → render nothing ────────────────────────────────────
  if (!stockMap) return null;

  // ── Total item count ───────────────────────────────────────────────────────
  const totalPartCount = groupedData.reduce((sum, g) => sum + g.items.length, 0);

  // ── Printed-on timestamp ───────────────────────────────────────────────────
  let printedOn = "";
  try {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const mon = months[now.getMonth()];
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    printedOn = `${dd}-${mon}-${yyyy} ${hh}:${mm}:${ss}`;
  } catch {
    printedOn = "-";
  }

  // ── Print handler ──────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!docRef.current) return;
    printWithPortal(
      `<style>
        body { margin: 0; background: #fff;
               font-family: 'Segoe UI', Inter, sans-serif;
               -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { box-sizing: border-box; }
        [data-no-print] { display: none !important; }
        [data-stock-report-doc] {
          max-width: 100% !important; width: 100% !important;
          border-radius: 0 !important; box-shadow: none !important;
          display: flex !important; flex-direction: column !important;
          min-height: 100vh;
        }
        .sr-spacer { display: block !important; flex: 1; }
        .sr-footer { display: flex !important; }
        @page { size: A4 portrait; margin: 12mm; }
      </style>${docRef.current.outerHTML}`
    );
  };

  // ── Inline styles ──────────────────────────────────────────────────────────
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
      position: "relative",
    },
    closeBtn: {
      position: "absolute", top: 16, right: 16,
      background: "none", border: "none", fontSize: 22, cursor: "pointer",
      color: "#94a3b8", lineHeight: 1,
    },
    headerSection: { padding: "28px 32px 16px" },
    bizName: { fontSize: 14, fontWeight: 800, color: "#1e3a5f", margin: 0 },
    bizDetail: { fontSize: 11, color: "#64748b", margin: "2px 0" },
    reportTitle: {
      fontSize: 16, fontWeight: 900, color: "#1e3a5f",
      textAlign: "center", margin: "16px 0 4px", letterSpacing: 1,
    },
    reportSubtitle: {
      fontSize: 12, color: "#64748b", textAlign: "center", margin: 0,
    },
    controls: {
      display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap",
      padding: "12px 32px", borderBottom: "1px solid #e2e8f0",
    },
    tableWrap: { padding: "0 32px 16px" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 11, margin: 0 },
    th: {
      background: "#1e3a5f", color: "#fff", padding: "8px 10px",
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: 0.5, border: "1px solid #1e3a5f",
    },
    groupRow: {
      background: "#f0f4f8", fontWeight: 700, fontSize: 11,
      textTransform: "uppercase", borderBottom: "1px solid #cbd5e1",
    },
    td: {
      padding: "5px 10px", borderBottom: "1px solid #e2e8f0",
      borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0",
      fontSize: 11,
    },
    screenFooter: {
      padding: "12px 32px", fontSize: 12, color: "#64748b",
      borderTop: "1px solid #e2e8f0",
    },
    actions: {
      display: "flex", gap: 10, padding: "16px 32px",
      borderTop: "1px solid #e2e8f0",
    },
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={s.overlay} role="dialog" aria-modal="true" aria-labelledby="stock-report-title">
      <div ref={docRef} data-stock-report-doc style={s.modal}>
        <button data-no-print="true" onClick={onClose} style={s.closeBtn} aria-label="Tutup laporan stok">
          ✕
        </button>

        {/* ── Header ── */}
        <div style={s.headerSection}>
          {showCompanyName && (
            <div>
              <h3 style={s.bizName}>{settings.businessName}</h3>
              {settings.address && <div style={s.bizDetail}>{settings.address}</div>}
            </div>
          )}
          <h2 id="stock-report-title" style={s.reportTitle}>
            Stock Report (without Price)
          </h2>
          <p style={s.reportSubtitle}>Until {fmtDate(reportDate)}</p>
        </div>

        {/* ── Controls (hidden in print) ── */}
        <div data-no-print="true" style={s.controls}>
          <label style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
            Tanggal:
            <input
              type="date"
              value={reportDate}
              max={today()}
              onChange={(e) => e.target.value && setReportDate(e.target.value)}
              style={{
                padding: "4px 8px", border: "1px solid #c7ddf7",
                borderRadius: 6, fontSize: 12,
              }}
            />
          </label>
          <ToggleSwitch
            checked={showZeroStock}
            onChange={setShowZeroStock}
            label="Tampilkan stok kosong"
          />
          <ToggleSwitch
            checked={showCompanyName}
            onChange={setShowCompanyName}
            label="Nama perusahaan"
          />
          <ToggleSwitch
            checked={showArchivedItems}
            onChange={setShowArchivedItems}
            label="Tampilkan arsip"
          />
        </div>

        {/* ── Table ── */}
        <div style={s.tableWrap}>
          {groupedData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 14 }}>
              Tidak ada data stok
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th colSpan={2} style={{ ...s.th, textAlign: "center" }}>Part Group</th>
                  <th rowSpan={2} style={{ ...s.th, textAlign: "right", width: 150, verticalAlign: "bottom" }}>
                    Quantity
                  </th>
                </tr>
                <tr>
                  <th style={{ ...s.th, width: 40, textAlign: "center" }}>No.</th>
                  <th style={s.th}>Part</th>
                </tr>
              </thead>
              <tbody>
                {groupedData.map((group) => (
                  <React.Fragment key={group.groupName}>
                    {/* Group header row */}
                    <tr>
                      <td colSpan={3} style={{ ...s.td, ...s.groupRow, padding: "7px 10px" }}>
                        {group.groupName.toUpperCase()}
                        {group.code && (
                          <span style={{
                            marginLeft: 10, fontSize: 10, fontWeight: 700,
                            color: "#64748b", letterSpacing: 0.5,
                          }}>
                            {group.code}
                          </span>
                        )}
                      </td>
                    </tr>
                    {/* Item rows */}
                    {group.items.map((item, idx) => (
                      <tr key={item.displayName}>
                        <td style={{ ...s.td, textAlign: "center" }}>{idx + 1}</td>
                        <td style={s.td}>{item.displayName.toUpperCase()}</td>
                        <td style={{ ...s.td, textAlign: "right" }}>
                          {Number.isInteger(item.qty) ? item.qty.toLocaleString("id-ID") : item.qty.toFixed(2)}&nbsp;&nbsp;{item.unit.toUpperCase()}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Spacer: hidden on screen, flex:1 in print to push footer down ── */}
        <div className="sr-spacer" style={{ display: "none" }} />

        {/* ── Print footer: hidden on screen, shown in print ── */}
        <div
          className="sr-footer"
          style={{
            display: "none", justifyContent: "space-between", alignItems: "flex-end",
            padding: "16px 32px 8px", fontSize: 11, color: "#475569",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              Total Number of Part: {totalPartCount}
            </div>
            <div>Printed on {printedOn}, by ADMIN</div>
          </div>
          <div>Page 1 of 1</div>
        </div>

        {/* ── Screen footer ── */}
        <div data-no-print="true" style={s.screenFooter}>
          Total item: {totalPartCount}
        </div>

        {/* ── Actions ── */}
        <div data-no-print="true" style={s.actions}>
          <button onClick={handlePrint} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
            Cetak Laporan Stok
          </button>
          <button onClick={onClose} className="btn btn-secondary btn-lg">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockReportModal;
