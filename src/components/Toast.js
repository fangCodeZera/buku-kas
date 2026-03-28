/**
 * components/Toast.js
 * Slide-in notification that auto-dismisses after 3 seconds.
 */
import React, { useState, useEffect, useRef } from "react";
import Icon from "./Icon";

const TYPE_STYLES = {
  success: { bg: "#d1fae5", text: "#065f46", border: "#10b981" },
  error:   { bg: "#fee2e2", text: "#991b1b", border: "#ef4444" },
};

/**
 * @param {{
 *   message: string,
 *   type?: "success" | "error",
 *   onDone?: () => void
 * }} props
 */
const Toast = ({ message, type = "success", onDone }) => {
  const [visible, setVisible] = useState(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDoneRef.current && onDoneRef.current();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const { bg, text, border } = TYPE_STYLES[type] || TYPE_STYLES.success;

  return (
    <div
      className="toast"
      role="status"
      aria-live="polite"
      style={{ background: bg, border: `1.5px solid ${border}`, color: text }}
    >
      <Icon name="check" size={16} color={border} />
      {message}
    </div>
  );
};

export default Toast;
