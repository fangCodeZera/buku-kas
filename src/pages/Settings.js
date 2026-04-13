/**
 * pages/Settings.js
 * Business settings form + data backup / restore.
 *
 * Features:
 *  - Edit business name, address, phone
 *  - Set low-stock alert threshold
 *  - Export all data as a JSON backup file
 *  - Import a previously exported JSON backup (FileReader)
 */
import React, { useState, useRef } from "react";
import Icon from "../components/Icon";
import { generateId, today } from "../utils/idGenerators";
import { STORAGE_KEY } from "../utils/storage";
import { USE_SUPABASE } from "../utils/storageConfig";

/**
 * @param {{
 *   settings: Object,
 *   transactions: Array,
 *   data: Object,
 *   onSave: (settings: Object) => void,
 *   onImport: (data: Object) => void
 * }} props
 */
const Settings = ({ settings, transactions = [], data, onSave, onImport }) => {
  const [form,        setForm]        = useState({ ...settings, printerType: settings.printerType || "A4" });
  const [flash,       setFlash]       = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [importMsg,   setImportMsg]   = useState("");
  const [exportFormat, setExportFormat] = useState("json");
  const [bizErrors,   setBizErrors]   = useState({});
  // String state for free-typing the due-date days field; validated on blur
  const [dueDaysStr,     setDueDaysStr]     = useState(String(settings.defaultDueDateDays ?? 14));
  // String state for free-typing the low-stock threshold; validated on blur
  const [lowStockStr,    setLowStockStr]    = useState(String(settings.lowStockThreshold ?? 10));
  // String state for free-typing the max bank accounts on invoice; validated on blur
  const [maxBankStr,     setMaxBankStr]     = useState(String(settings.maxBankAccountsOnInvoice ?? 1));
  const fileRef = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (submitting) return;
    setSubmitting(true); // set before validation so rapid double-clicks are blocked immediately
    const errs = {};
    if (!form.businessName?.trim()) errs.businessName = "Nama bisnis wajib diisi";
    if (Object.keys(errs).length > 0) {
      setBizErrors(errs);
      setSubmitting(false);
      return;
    }
    setBizErrors({});
    onSave(form);
    setFlash(true);
    setTimeout(() => { setFlash(false); setSubmitting(false); }, 2000);
  };

  const csvEscape = (val) => {
    const str = String(val ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const exportJSON = () => {
    try {
      let jsonStr;
      if (USE_SUPABASE) {
        jsonStr = JSON.stringify(
          { ...data, _exportedAt: new Date().toISOString(), _normVersion: 18 },
          null,
          2
        );
      } else {
        jsonStr = localStorage.getItem(STORAGE_KEY) || "{}";
      }
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bukukas_backup_${today()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const exportCSV = () => {
    const BOM = "\uFEFF";
    const headers = ["Tanggal","Waktu","No. Invoice","Klien","Jenis","Barang","Karung","Berat (Kg)","Harga/Kg","Subtotal","Nilai Total","Status","Sisa Tagihan","Jatuh Tempo"];
    const rows = [headers.join(",")];

    const sorted = [...transactions].sort((a, b) => {
      const da = (a.date || "") + (a.time || "");
      const db = (b.date || "") + (b.time || "");
      return db.localeCompare(da);
    });

    for (const t of sorted) {
      const itemList = Array.isArray(t.items) && t.items.length > 0
        ? t.items
        : [{ itemName: t.itemName, sackQty: t.stockQty, weightKg: 0, pricePerKg: 0, subtotal: t.value }];
      for (const item of itemList) {
        rows.push([
          t.date || "",
          t.time || "",
          csvEscape(t.txnId || ""),
          csvEscape(t.counterparty || ""),
          t.type === "income" ? "Penjualan" : "Pembelian",
          csvEscape(item.itemName || ""),
          item.sackQty || 0,
          item.weightKg || 0,
          item.pricePerKg || 0,
          item.subtotal || 0,
          t.value || 0,
          csvEscape(t.status || ""),
          t.outstanding || 0,
          t.dueDate || "",
        ].join(","));
      }
    }

    const csv = BOM + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bukukas_transaksi_semua_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (exportFormat === "json") {
        exportJSON();
      } else {
        exportCSV();
      }
      const now = new Date().toISOString();
      set("lastExportDate", now);
      onSave({ ...form, lastExportDate: now });
    } finally {
      setTimeout(() => setSubmitting(false), 1000);
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);

        // ── Structural validation ──────────────────────────────────────────
        if (!Array.isArray(parsed.transactions))
          throw new Error("Field 'transactions' harus berupa array");
        if (!Array.isArray(parsed.contacts))
          throw new Error("Field 'contacts' harus berupa array");

        // ── Per-transaction shape validation (entire array) ────────────────
        for (const tx of parsed.transactions) {
          if (!tx.id)
            throw new Error(`Transaksi tanpa id ditemukan`);
          if (typeof tx.value !== "number")
            throw new Error(`Nilai transaksi (id: ${tx.id}) harus berupa angka, bukan "${typeof tx.value}"`);
          if (!["income", "expense"].includes(tx.type))
            throw new Error(`Tipe transaksi tidak valid: "${tx.type}" (id: ${tx.id})`);
        }

        // ── Financial bounds check ─────────────────────────────────────────
        for (const tx of parsed.transactions) {
          if (typeof tx.outstanding === "number" && (tx.outstanding < 0 || tx.outstanding > tx.value))
            throw new Error(
              `Nilai outstanding tidak valid pada transaksi id: ${tx.id} (harus antara 0 dan nilai transaksi)`
            );
          if (tx.items !== undefined && !Array.isArray(tx.items))
            throw new Error(`Field 'items' pada transaksi id: ${tx.id} harus berupa array`);
          if (Array.isArray(tx.items)) {
            for (const it of tx.items) {
              if (typeof it !== 'object' || it === null)
                throw new Error(`Item tidak valid pada transaksi ${tx.id}`);
            }
          }
          if (tx.paymentHistory !== undefined && !Array.isArray(tx.paymentHistory))
            throw new Error(`Field 'paymentHistory' pada transaksi id: ${tx.id} harus berupa array`);
        }

        // ── Settings structure ─────────────────────────────────────────────
        if (parsed.settings !== undefined) {
          if (typeof parsed.settings !== "object" || Array.isArray(parsed.settings))
            throw new Error("Field 'settings' harus berupa objek");
          if (parsed.settings.bankAccounts !== undefined && !Array.isArray(parsed.settings.bankAccounts))
            throw new Error("Field 'settings.bankAccounts' harus berupa array");
        }

        // ── Strip HTML tags from string fields ─────────────────────────────
        const stripTags = (s) => (typeof s === "string" ? s.replace(/<[^>]*>/g, "") : s);
        for (const tx of parsed.transactions) {
          if (typeof tx.counterparty === "string") tx.counterparty = stripTags(tx.counterparty);
          if (typeof tx.itemName === "string") tx.itemName = stripTags(tx.itemName);
          if (Array.isArray(tx.items)) {
            tx.items = tx.items.map((it) =>
              typeof it.itemName === "string" ? { ...it, itemName: stripTags(it.itemName) } : it
            );
          }
        }
        for (const c of parsed.contacts) {
          if (typeof c.name === "string") c.name = stripTags(c.name);
        }
        if (parsed.settings) {
          if (typeof parsed.settings.businessName === "string")
            parsed.settings.businessName = stripTags(parsed.settings.businessName);
          if (typeof parsed.settings.address === "string")
            parsed.settings.address = stripTags(parsed.settings.address);
        }

        setImportMsg("Mengimpor data...");
        const result = await onImport(parsed);
        // Supabase mode returns { succeeded, failed } — localStorage mode returns undefined
        if (result && result.failed === 0) {
          const txCount = (parsed.transactions || []).length;
          const cCount  = (parsed.contacts     || []).length;
          setImportMsg(`✅ Impor berhasil — ${txCount} transaksi, ${cCount} kontak disinkronkan ke database.`);
        } else if (result && result.failed > 0) {
          setImportMsg(`⚠️ Impor sebagian berhasil. ${result.failed} item gagal disinkronkan. Silakan periksa dan coba lagi.`);
        } else {
          setImportMsg("✅ Data berhasil diimpor!");
        }
      } catch (err) {
        setImportMsg(`❌ Gagal: ${err.message}`);
      }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const inputStyle = {
    width: "100%", padding: "8px 11px",
    border: "1.5px solid #c7ddf7", borderRadius: 8,
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const labelStyle = {
    display: "block", fontSize: 12, fontWeight: 600,
    color: "#1e3a5f", marginBottom: 3,
  };

  return (
    <div>
      <h2 className="page-title" style={{ marginBottom: 18 }}>Pengaturan</h2>

      {/* ── Business info ── */}
      <div className="settings-card">
        <h3 className="settings-section-title">Informasi Bisnis</h3>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Nama Bisnis</label>
          <input
            value={form.businessName || ""}
            onChange={(e) => {
              set("businessName", e.target.value);
              if (bizErrors.businessName) setBizErrors(prev => { const n = { ...prev }; delete n.businessName; return n; });
            }}
            placeholder="cth. UD Maju Bersama"
            style={inputStyle}
            aria-label="Nama Bisnis"
            className={bizErrors.businessName ? "form-input--error" : ""}
          />
          {bizErrors.businessName && <span className="field-error">{bizErrors.businessName}</span>}
        </div>

        {[
          ["address", "Alamat",   "Alamat lengkap bisnis"],
          ["phone",   "Telepon",  "Nomor telepon"],
        ].map(([k, l, p]) => (
          <div key={k} style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{l}</label>
            <input
              value={form[k] || ""}
              onChange={(e) => set(k, e.target.value)}
              placeholder={p}
              style={inputStyle}
              aria-label={l}
            />
          </div>
        ))}

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Batas Stok Rendah (untuk peringatan ⚠)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="text"
              inputMode="numeric"
              value={lowStockStr}
              onChange={(e) => setLowStockStr(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() => {
                const n = parseInt(lowStockStr, 10);
                if (!isNaN(n) && n >= 0) {
                  setLowStockStr(String(n));
                  set("lowStockThreshold", n);
                } else {
                  const prev = form.lowStockThreshold ?? 10;
                  setLowStockStr(String(prev));
                }
              }}
              style={{ ...inputStyle, width: 100 }}
              aria-label="Batas stok rendah"
            />
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Item dengan stok ≤ angka ini ditandai kuning di Inventaris.
            </span>
          </div>
        </div>
        
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Default Jatuh Tempo (Hari)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="text"
              inputMode="numeric"
              value={dueDaysStr}
              onChange={(e) => setDueDaysStr(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() => {
                const n = parseInt(dueDaysStr, 10);
                if (!isNaN(n) && n >= 1) {
                  setDueDaysStr(String(n));
                  set("defaultDueDateDays", n);
                } else {
                  // Revert to the last valid value stored in form (minimum 1)
                  const prev = Math.max(1, form.defaultDueDateDays ?? 14);
                  setDueDaysStr(String(prev));
                }
              }}
              style={{ ...inputStyle, width: 100 }}
              aria-label="Default jatuh tempo"
            />
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Batas waktu pembayaran untuk transaksi belum lunas.
            </span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={submitting}
          className="btn btn-primary"
          aria-label="Simpan pengaturan"
        >
          {flash ? "✓ Tersimpan!" : "Simpan Pengaturan"}
        </button>
      </div>

      {/* ── Print format ── */}
      <div className="settings-card">
        <h3 className="settings-section-title">Format Cetak</h3>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0, marginBottom: 16 }}>
          Untuk cetak Invoice dan Surat Jalan.
        </p>
        <label style={labelStyle}>Format Cetak Default</label>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button
            onClick={() => set("printerType", "A4")}
            className={`filter-btn${form.printerType === "A4" ? " filter-btn--active" : ""}`}
            aria-pressed={form.printerType === "A4"}
          >A4 (Standar)</button>
          <button
            onClick={() => set("printerType", "Dot Matrix")}
            className={`filter-btn${form.printerType === "Dot Matrix" ? " filter-btn--active" : ""}`}
            aria-pressed={form.printerType === "Dot Matrix"}
          >Dot Matrix</button>
        </div>
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, marginBottom: 14 }}>
          Simpan pengaturan untuk menerapkan perubahan.
        </p>
        <button
          onClick={handleSave}
          disabled={submitting}
          className="btn btn-primary"
          aria-label="Simpan format cetak"
        >
          {flash ? "✓ Tersimpan!" : "Simpan Pengaturan"}
        </button>
      </div>

      {/* ── Bank Details ── */}
      <div className="settings-card">
        <h3 className="settings-section-title">Informasi Bank</h3>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0, marginBottom: 16 }}>
          Detail bank untuk ditampilkan pada invoice dan keperluan pembayaran.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Maks. Rekening di Invoice</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="text"
              inputMode="numeric"
              value={maxBankStr}
              onChange={(e) => setMaxBankStr(e.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() => {
                const n = parseInt(maxBankStr, 10);
                if (!isNaN(n) && n >= 0) {
                  setMaxBankStr(String(n));
                  const accounts = form.bankAccounts || [];
                  const checkedIdxs = accounts.reduce((arr, a, i) => a.showOnInvoice ? [...arr, i] : arr, []);
                  let updatedAccounts = accounts;
                  if (checkedIdxs.length > n) {
                    const toUntick = new Set(checkedIdxs.slice(n));
                    updatedAccounts = accounts.map((a, i) => toUntick.has(i) ? { ...a, showOnInvoice: false } : a);
                  }
                  setForm((f) => ({ ...f, bankAccounts: updatedAccounts, maxBankAccountsOnInvoice: n }));
                } else {
                  setMaxBankStr(String(form.maxBankAccountsOnInvoice ?? 1));
                }
              }}
              style={{ ...inputStyle, width: 80 }}
              aria-label="Maks rekening di invoice"
            />
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {(form.bankAccounts || []).filter((a) => a.showOnInvoice).length} dari{" "}
              {(form.bankAccounts || []).length} rekening dipilih untuk invoice.
            </span>
          </div>
        </div>

        {(form.bankAccounts || []).map((acct, idx) => {
          const checkedCount = (form.bankAccounts || []).filter((a) => a.showOnInvoice).length;
          const max = form.maxBankAccountsOnInvoice ?? 1;
          const disableCheck = !acct.showOnInvoice && (max === 0 || checkedCount >= max);
          return (
            <div key={acct.id} style={{ border: "1.5px solid #c7ddf7", borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: disableCheck ? "#9ca3af" : "#1e3a5f", cursor: disableCheck ? "not-allowed" : "pointer" }}>
                  <input
                    type="checkbox"
                    checked={acct.showOnInvoice}
                    disabled={disableCheck}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        bankAccounts: f.bankAccounts.map((a) =>
                          a.id === acct.id ? { ...a, showOnInvoice: !a.showOnInvoice } : a
                        ),
                      }))
                    }
                    style={{ width: 15, height: 15 }}
                  />
                  Tampilkan di Invoice
                </label>
                <button
                  onClick={() => {
                    const accounts = (form.bankAccounts || []).filter((a) => a.id !== acct.id);
                    const newMax = Math.min(form.maxBankAccountsOnInvoice ?? 1, accounts.length);
                    setMaxBankStr(String(newMax));
                    setForm((f) => ({ ...f, bankAccounts: accounts, maxBankAccountsOnInvoice: newMax }));
                  }}
                  style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 4px" }}
                  aria-label={`Hapus rekening ${idx + 1}`}
                >
                  ×
                </button>
              </div>
              {[
                ["bankName",      "Nama Bank",      "cth. BCA, Mandiri, BRI"],
                ["accountNumber", "Nomor Rekening", "cth. 1234567890"],
                ["accountName",   "Atas Nama",      "cth. PT Maju Bersama"],
              ].map(([k, l, p]) => (
                <div key={k} style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>{l}</label>
                  <input
                    value={acct[k] || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        bankAccounts: f.bankAccounts.map((a) =>
                          a.id === acct.id ? { ...a, [k]: e.target.value } : a
                        ),
                      }))
                    }
                    placeholder={p}
                    style={inputStyle}
                    aria-label={`${l} rekening ${idx + 1}`}
                    className={k === "bankName" ? "bank-name-input" : undefined}
                  />
                </div>
              ))}
            </div>
          );
        })}

        <button
          onClick={() => {
            const newAcct = { id: generateId(), bankName: "", accountNumber: "", accountName: "", showOnInvoice: false };
            setForm((f) => ({ ...f, bankAccounts: [...(f.bankAccounts || []), newAcct] }));
            setTimeout(() => {
              const inputs = document.querySelectorAll(".bank-name-input");
              if (inputs.length > 0) inputs[inputs.length - 1].focus();
            }, 50);
          }}
          className="btn btn-outline"
          style={{ marginBottom: 14 }}
          aria-label="Tambah rekening bank"
        >
          ＋ Tambah Rekening
        </button>

        <div>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="btn btn-primary"
            aria-label="Simpan informasi bank"
          >
            {flash ? "✓ Tersimpan!" : "Simpan Pengaturan"}
          </button>
        </div>
      </div>

      {/* ── Backup & Restore ── */}
      <div className="settings-card">
        <h3 className="settings-section-title">Cadangan Data</h3>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0, marginBottom: 16 }}>
          Data tersimpan otomatis di browser. Ekspor cadangan untuk keamanan ekstra,
          atau impor cadangan yang sudah ada.
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className="sort-select"
            style={{ width: 110 }}
            aria-label="Format ekspor"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button
            onClick={handleExport}
            disabled={submitting}
            className="btn btn-outline"
            aria-label="Ekspor semua data"
          >
            <Icon name="download" size={14} color="#007bff" /> Ekspor Backup
          </button>
          <button
            onClick={() => fileRef.current && fileRef.current.click()}
            className="btn btn-outline"
            style={{ borderColor: "#10b981", color: "#10b981" }}
            aria-label="Impor data dari file JSON"
            disabled={importMsg === "Mengimpor data..."}
          >
            <Icon name="upload" size={14} color="#10b981" /> Impor Backup
          </button>

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            style={{ display: "none" }}
            aria-hidden="true"
          />
        </div>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 4px" }}>
          {exportFormat === "json"
            ? "Backup lengkap — dapat diimpor kembali ke aplikasi"
            : "Format tabel — dapat dibuka di Excel / Google Sheets"}
        </p>

        {importMsg && (
          <div
            className={`import-msg ${importMsg.startsWith("✅") ? "import-msg--success" : "import-msg--error"}`}
            role="status"
          >
            {importMsg}
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;