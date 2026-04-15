/**
 * components/QtyInput.js
 * Controlled text input for decimal quantities (karung, kg, etc.).
 *
 * Features:
 *  - Accepts decimal entry (dot or comma as separator)
 *  - Displays id-ID locale formatting on blur (thousands dots, comma decimal)
 *  - Suppresses prop-sync while the user is actively typing (isFocusedRef)
 *  - Returns a number via onChange (0 when empty/invalid)
 */
import React, { useState, useRef } from "react";

/**
 * @param {{
 *   value: number,
 *   onChange: (n: number) => void,
 *   hasError?: boolean,
 *   placeholder?: string,
 *   style?: object,
 *   className?: string,
 *   onBlur?: () => void,
 * }} props
 */
const QtyInput = ({ value, onChange, hasError, placeholder = "0", style, className, onBlur: onBlurProp }) => {
  const prevValRef   = useRef(value);
  const isFocusedRef = useRef(false);

  const fmt = (n) => {
    const num = Number(n);
    if (!n && n !== 0) return "";
    if (isNaN(num) || num === 0) return "";
    return num.toLocaleString("id-ID");
  };

  const [display, setDisplay] = useState(() => fmt(value));

  // Sync display when value prop changes externally (e.g. edit modal pre-fill)
  if (!isFocusedRef.current && prevValRef.current !== value) {
    prevValRef.current = value;
    const expected = fmt(value);
    if (expected !== display) setDisplay(expected);
  }

  const handleFocus = () => {
    isFocusedRef.current = true;
    // While editing, show the plain number without thousand separators
    const num = Number(value);
    setDisplay(!isNaN(num) && num !== 0 ? String(num) : "");
  };

  const handleChange = (e) => {
    let raw = e.target.value;
    // Keep only digits and the first decimal separator (. or ,)
    raw = raw.replace(/[^\d.,]/g, "");
    raw = raw.replace(",", ".");                          // normalize comma → dot
    const match = raw.match(/^(\d*)(\.\d*)?/);
    const cleaned = match ? (match[1] || "") + (match[2] || "") : "";
    setDisplay(cleaned);
    const n = parseFloat(cleaned);
    onChange(isNaN(n) ? 0 : n);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const num = Number(value);
    setDisplay(!isNaN(num) && num > 0 ? num.toLocaleString("id-ID") : "");
    if (onBlurProp) onBlurProp();
  };

  const borderStyle = hasError ? { borderColor: "#ef4444" } : {};

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      style={{ ...style, ...borderStyle }}
    />
  );
};

export default QtyInput;
