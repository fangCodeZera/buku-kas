/**
 * pages/Penjualan.js
 * Income (sales) transaction page.
 * Thin wrapper around the shared TransactionPage base component.
 */
import React from "react";
import TransactionPage from "../components/TransactionPage";

const Penjualan = (props) => (
  <TransactionPage
    type="income"
    title="Penjualan"
    accentColor="#10b981"
    {...props}
  />
);

export default Penjualan;
