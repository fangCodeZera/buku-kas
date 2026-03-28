/**
 * pages/Pembelian.js
 * Expense (purchase) transaction page.
 * Thin wrapper around the shared TransactionPage base component.
 */
import React from "react";
import TransactionPage from "../components/TransactionPage";

const Pembelian = (props) => (
  <TransactionPage
    type="expense"
    title="Pembelian"
    accentColor="#ef4444"
    {...props}
  />
);

export default Pembelian;
