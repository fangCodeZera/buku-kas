/**
 * components/StockChip.js
 * Coloured pill badge showing current stock level with status colouring.
 */
import React from "react";
import Icon from "./Icon";

/**
 * @param {{ qty: number, unit: string, threshold?: number }} props
 */
const StockChip = ({ qty, unit, threshold = 10 }) => {
  const isNeg  = qty < 0;
  const isLow  = !isNeg && qty <= threshold;
  const color  = isNeg ? "#ef4444" : isLow ? "#f59e0b" : "#10b981";
  const bg     = isNeg ? "#fee2e2" : isLow ? "#fef3c7" : "#d1fae5";

  return (
    <span className="stock-chip" style={{ background: bg, color }}>
      {qty <= 0 && <Icon name="warning" size={11} color={color} />}
      {Number(qty).toFixed(qty % 1 === 0 ? 0 : 2)} {unit}
    </span>
  );
};

export default StockChip;
