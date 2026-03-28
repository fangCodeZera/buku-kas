/**
 * components/RupiahInput.js
 * Controlled text input for Indonesian Rupiah amounts.
 *
 * Features:
 *  - Displays thousands separators (commas) as the user types
 *  - Stores a clean integer via onChange
 *  - Restores cursor position after reformatting
 *  - Handles paste, backspace, and leading zeros correctly
 *  - Blocks decimal point entry
 */
import React, { useState, useRef } from "react";
import { numToDisplay } from "../utils/idGenerators";

/**
 * @param {{
 *   value: number,
 *   onChange: (n: number) => void,
 *   hasError?: boolean,
 *   placeholder?: string
 * }} props
 */
const RupiahInput = ({ value, onChange, hasError, placeholder = "0" }) => {
  const inputRef   = useRef(null);
  const prevValRef = useRef(value);

  const [display, setDisplay] = useState(() => numToDisplay(value));

  // Sync display when value prop changes externally (e.g., edit modal pre-fill)
  if (prevValRef.current !== value) {
    prevValRef.current = value;
    const expected = numToDisplay(value);
    if (expected !== display) setDisplay(expected);
  }

  // ── Core formatter ───────────────────────────────────────────────────────────
  const format = (raw, cursorPos) => {
    const beforeCursor         = raw.slice(0, cursorPos);
    const digitsBeforeCursor   = beforeCursor.replace(/[^0-9]/g, "").length;
    const digits               = raw.replace(/[^0-9]/g, "");

    if (!digits) {
      setDisplay("");
      onChange(0);
      return;
    }

    const stripped = digits.replace(/^0+/, "") || "0";
    if (stripped === "0") {
      setDisplay("");
      onChange(0);
      return;
    }

    const formatted = stripped.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setDisplay(formatted);
    onChange(parseInt(stripped, 10));

    // Restore cursor position after React re-renders the value
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      let counted = 0;
      let newPos  = formatted.length; // default: end of string
      for (let i = 0; i < formatted.length; i++) {
        if (/[0-9]/.test(formatted[i])) counted++;
        if (counted === digitsBeforeCursor) {
          newPos = i + 1;
          break;
        }
      }
      inputRef.current.setSelectionRange(newPos, newPos);
    });
  };

  const handleChange = (e) => format(e.target.value, e.target.selectionStart);

  const handleKeyDown = (e) => {
    // Block decimal separators
    if (e.key === "." || e.key === ",") e.preventDefault();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text");
    format(pasted, pasted.length);
  };

  return (
    <div className="rupiah-input-wrap">
      <span className="rupiah-prefix" aria-hidden="true">Rp</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        aria-label="Jumlah Rupiah"
        className={`rupiah-input${hasError ? " input-error" : ""}`}
      />
    </div>
  );
};

export default RupiahInput;
