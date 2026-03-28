import React from "react";
import { diffDays, fmtDate, today } from "../utils/idGenerators";

export default function DueBadge({ dueDate, outstanding }) {
  if (!dueDate || (outstanding !== undefined && outstanding <= 0)) {
    return <span style={{ color: "#9ca3af", fontSize: 11 }}>—</span>;
  }
  
  const d = diffDays(today(), dueDate);
  if (d === null) return <span style={{ color: "#9ca3af", fontSize: 11 }}>—</span>;

  if (d < 0) return (
    <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 6,
      padding: "2px 7px", fontSize: 11, fontWeight: 700, display: "inline-block" }}>
      Lewat {Math.abs(d)} hari
    </span>
  );
  if (d === 0) return (
    <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 6,
      padding: "2px 7px", fontSize: 11, fontWeight: 700, display: "inline-block" }}>
      Jatuh tempo hari ini
    </span>
  );
  return (
    <div style={{ fontSize: 11, lineHeight: 1.4 }}>
      <div style={{ color: "#374151" }}>{fmtDate(dueDate)}</div>
      <div style={{ color: d <= 3 ? "#f59e0b" : "#9ca3af" }}>
        {d <= 3 ? `⚠ ${d} hari lagi` : `${d} hari lagi`}
      </div>
    </div>
  );
}
