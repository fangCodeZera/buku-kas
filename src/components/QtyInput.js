/**
 * components/QtyInput.js
 * Controlled text input for decimal quantities (karung, kg, etc.).
 *
 * Features:
 *  - Formats live on every keystroke using id-ID locale (dot thousands, comma decimal)
 *  - Accepts comma (,) as the decimal separator — id-ID convention
 *  - Preserves trailing comma so the user can finish typing the decimal part
 *  - Suppresses prop-sync while the user is actively typing (isFocusedRef)
 *  - Selects all text on focus for easy replacement
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

  const fmtNum = (n) => {
    if (n == null) return "";
    const num = Number(n);
    if (isNaN(num)) return "";
    return num.toLocaleString("id-ID");
  };

  const [display, setDisplay] = useState(() => fmtNum(value));

  // Sync display when value prop changes externally (e.g. edit modal pre-fill)
  if (!isFocusedRef.current && prevValRef.current !== value) {
    prevValRef.current = value;
    const expected = fmtNum(value);
    if (expected !== display) setDisplay(expected);
  }

  const handleFocus = (e) => {
    isFocusedRef.current = true;
    // Clear display when value is 0 so typing replaces it; otherwise select all
    if (Number(value) === 0) {
      setDisplay("");
    } else {
      e.target.select();
    }
  };

  const handleChange = (e) => {
    const raw = e.target.value;

    // Strip all non-digit, non-comma characters (dots are thousand separators — remove them)
    const stripped = raw.replace(/[^\d,]/g, "");

    // Split on the first comma (id-ID decimal separator)
    const commaIdx = stripped.indexOf(",");
    const hasComma = commaIdx !== -1;
    const intPart  = hasComma ? stripped.slice(0, commaIdx) : stripped;
    // Remove any extra commas in the decimal part
    const decPart  = hasComma ? stripped.slice(commaIdx + 1).replace(/,/g, "") : "";

    // Format integer part with id-ID dot thousand separators
    const intNum = parseInt(intPart || "0", 10);
    const fmtInt = intPart.length > 0 ? intNum.toLocaleString("id-ID") : "";

    // Preserve trailing comma so user can continue typing the decimal part
    const newDisplay = hasComma ? fmtInt + "," + decPart : fmtInt;
    setDisplay(newDisplay);

    // Parse to number (parseFloat requires dot as decimal — normalize comma → dot)
    const numStr = intPart + (hasComma && decPart ? "." + decPart : "");
    const n = parseFloat(numStr);
    onChange(isNaN(n) ? 0 : n);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    // Clean up trailing comma or incomplete decimal on blur
    const num = Number(value);
    setDisplay(!isNaN(num) && num > 0 ? num.toLocaleString("id-ID") : display.trim() === "" ? "0" : "");
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
