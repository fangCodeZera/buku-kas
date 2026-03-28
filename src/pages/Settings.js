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

/**
 * @param {{
 *   settings: Object,
 *   onSave: (settings: Object) => void,
 *   onImport: (data: Object) => void
 * }} props
 */
const Settings = ({ settings, onSave, onImport }) => {
  const [form,        setForm]        = useState(settings);
  const [flash,       setFlash]       = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [importMsg,   setImportMsg]   = useState("");
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
    const errs = {};
    if (!form.businessName?.trim()) errs.businessName = "Nama bisnis wajib diisi";
    if (Object.keys(errs).length > 0) {
      setBizErrors(errs);
      return;
    }
    setBizErrors({});
    setSubmitting(true);
    onSave(form);
    setFlash(true);
    setTimeout(() => { setFlash(false); setSubmitting(false); }, 2000);
  };

  const exportAll = () => {
    if (submitting) return;
    setSubmitting(true);
    const raw = localStorage.getItem(STORAGE_KEY) || "{}";
    const a = document.createElement("a");
    a.href = "data:application/json;charset=utf-8," + encodeURIComponent(raw);
    a.download = `bukukas_backup_${today()}.json`;
    a.click();

    const now = new Date().toISOString();
    set("lastExportDate", now);
    onSave({ ...form, lastExportDate: now });
    setTimeout(() => setSubmitting(false), 1000);
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
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

        onImport(parsed);
        setImportMsg("✅ Data berhasil diimpor!");
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
                if (!isNaN(n) && n >= 0) {
                  setDueDaysStr(String(n));
                  set("defaultDueDateDays", n);
                } else {
                  // Revert to the last valid value stored in form
                  const prev = form.defaultDueDateDays ?? 14;
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
          Data tersimpan otomatis di browser. Ekspor cadangan JSON untuk keamanan ekstra,
          atau impor cadangan yang sudah ada.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={exportAll}
            disabled={submitting}
            className="btn btn-outline"
            aria-label="Ekspor semua data sebagai JSON"
          >
            <Icon name="download" size={14} color="#007bff" /> Ekspor Data (JSON)
          </button>

          <button
            onClick={() => fileRef.current && fileRef.current.click()}
            className="btn btn-outline"
            style={{ borderColor: "#10b981", color: "#10b981" }}
            aria-label="Impor data dari file JSON"
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