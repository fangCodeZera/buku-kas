/**
 * components/ToggleSwitch.js
 * Reusable toggle switch — replaces checkbox toggles app-wide.
 * Uses app theme colors: #007bff (active), #cbd5e1 (inactive).
 */
import React from "react";

const ToggleSwitch = ({ checked, onChange, label, hint }) => {
  const handleClick = () => onChange(!checked);
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}
      onClick={handleClick}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); handleClick(); } }}
    >
      {/* Track */}
      <div style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? "#007bff" : "#cbd5e1",
        transition: "background 0.2s ease",
        flexShrink: 0,
      }}>
        {/* Thumb */}
        <div style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
          transition: "left 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          color: checked ? "#007bff" : "#9ca3af",
        }}>
          {checked ? "✓" : "✕"}
        </div>
      </div>
      {/* Label + hint */}
      <div>
        <div style={{ fontSize: 13, color: "#374151", fontWeight: 500, lineHeight: 1.3 }}>
          {label}
        </div>
        {hint && (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
};

export default ToggleSwitch;
