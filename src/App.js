/**
 * App.js
 * Root application component.
 *
 * Responsibilities:
 *  - Load / persist global data (transactions, contacts, settings)
 *  - Own all global state: page, sidebar, edit modal, invoice modal
 *  - Compute derived data: stockMap, AR/AP, alert counts
 *  - Provide all CRUD handlers to child pages via props
 *  - Render the sidebar navigation and main content area
 */
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";

import "./styles.css";

// ── Pages ─────────────────────────────────────────────────────────────────────
import Penjualan  from "./pages/Penjualan";
import Pembelian  from "./pages/Pembelian";
import Inventory from "./pages/Inventory";
import Contacts  from "./pages/Contacts";
import Reports   from "./pages/Reports";
import Settings  from "./pages/Settings";
import Outstanding from "./pages/Outstanding";
import ArchivedItems    from "./pages/ArchivedItems";
import ArchivedContacts from "./pages/ArchivedContacts";
import ActivityLog      from "./pages/ActivityLog";

// ── Components ────────────────────────────────────────────────────────────────
import TransactionForm    from "./components/TransactionForm";
import StockWarningModal  from "./components/StockWarningModal";
import InvoiceModal       from "./components/InvoiceModal";
import SuratJalanModal    from "./components/SuratJalanModal";
import Icon               from "./components/Icon";
import ReportModal        from "./components/ReportModal";
import StockReportModal   from "./components/StockReportModal";
import DotMatrixPrintModal from "./components/DotMatrixPrintModal";
import Toast               from "./components/Toast";

// ── Auth ──────────────────────────────────────────────────────────────────────
import { useAuth } from "./utils/AuthContext";
import Login from "./pages/Login";

// ── Phase 4: Supabase storage layer ───────────────────────────────────────────
import { USE_SUPABASE } from "./utils/storageConfig";
import {
  loadDataFromSupabase,
  saveTransaction as sbSaveTransaction,
  deleteTransaction as sbDeleteTransaction,
  saveContact as sbSaveContact,
  deleteContact as sbDeleteContact,
  saveStockAdjustment as sbSaveStockAdjustment,
  deleteStockAdjustment as sbDeleteStockAdjustment,
  saveItemCategories as sbSaveItemCategories,
  saveItemCatalogItem as sbSaveItemCatalogItem,
  deleteItemCatalogItem as sbDeleteItemCatalogItem,
  saveSettings as sbSaveSettings,
  saveActivityLog as sbSaveActivityLog,
  loadActivityLog as sbLoadActivityLog,
  mapTransaction,
  mapContact,
  mapStockAdjustment,
  mapCatalogItem,
  getNextTxnSerial,
  isSupabaseReachable,
} from "./utils/supabaseStorage";
import SaveErrorModal from "./components/SaveErrorModal";
import ConflictModal from "./components/ConflictModal";
import { subscribeToChanges, subscribeToPresence } from "./utils/realtimeManager";

// ── Utils ─────────────────────────────────────────────────────────────────────
import { loadData, saveData } from "./utils/storage";
import { computeStockMap }         from "./utils/stockUtils";
import { computeARandAP }          from "./utils/balanceUtils";
import { generateId, generateTxnId, fmtIDR, normItem, normalizeTitleCase, addDays, today, nowTime } from "./utils/idGenerators";
import { deriveStatus }            from "./utils/statusUtils";
import { generateCode }           from "./utils/categoryUtils";

// ─── Edit Modal ───────────────────────────────────────────────────────────────
/**
 * Wraps TransactionForm in a modal overlay for editing existing transactions.
 * Adjusts stockMap to remove the current transaction's contribution before
 * validation, preventing false stock-warning triggers on edit.
 */
function EditModal({ transaction, contacts, transactions = [], stockMap, itemCatalog = [], onSave, onClose, onCreateContact, onAddCatalogItem = () => {}, onUpdateCatalogItem = () => {}, onUnarchiveCatalogItem = () => {}, onUnarchiveSubtype = () => {}, onUnarchiveContact = () => {} }) {
  const [stockWarn, setStockWarn] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const adjustedStockMap = useMemo(() => {
    const m = { ...stockMap };
    const itemList = Array.isArray(transaction.items) && transaction.items.length > 0
      ? transaction.items
      : [{ itemName: transaction.itemName, sackQty: transaction.stockQty }];
    for (const item of itemList) {
      const key = normItem(item.itemName);
      if (m[key]) {
        const origDelta =
          transaction.type === "expense"
            ? parseFloat(item.sackQty) || 0
            : -(parseFloat(item.sackQty) || 0);
        m[key] = { ...m[key], qty: m[key].qty - origDelta };
      }
    }
    return m;
  }, [stockMap, transaction]);

  return (
    <div className="edit-modal-overlay" role="dialog" aria-modal="true">
      <div className="edit-modal-box">
        <TransactionForm
          initial={transaction}
          contacts={contacts}
          transactions={transactions}
          stockMap={adjustedStockMap}
          itemCatalog={itemCatalog}
          onStockWarning={setStockWarn}
          onCreateContact={onCreateContact}
          onAddCatalogItem={onAddCatalogItem}
          onUpdateCatalogItem={onUpdateCatalogItem}
          onUnarchiveCatalogItem={onUnarchiveCatalogItem}
          onUnarchiveSubtype={onUnarchiveSubtype}
          onUnarchiveContact={onUnarchiveContact}
          onSave={(t) => { onSave(t); onClose(); }}
          onCancel={onClose}
        />
        <StockWarningModal data={stockWarn} onClose={() => setStockWarn(null)} />
      </div>
    </div>
  );
}

// ─── Database Paused Screen ───────────────────────────────────────────────────
/**
 * Full-screen fallback shown when Supabase free tier has auto-paused the database.
 * Replaces the entire app UI — not a modal.
 */
function DatabasePausedScreen() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", backgroundColor: "#f0f6ff", padding: 24,
    }}>
      <div style={{
        backgroundColor: "#fff", borderRadius: 12, padding: 32,
        maxWidth: 480, width: "100%", textAlign: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😴</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1e3a5f", marginBottom: 12 }}>
          Database Sedang Istirahat
        </h2>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, marginBottom: 20 }}>
          Database BukuKas sedang dalam mode istirahat karena tidak ada aktivitas
          selama 7 hari. Ini adalah fitur otomatis dari Supabase untuk menghemat
          sumber daya.
        </p>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, marginBottom: 24 }}>
          Untuk mengaktifkan kembali, pemilik akun perlu masuk ke{" "}
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#007bff" }}
          >
            Supabase Dashboard
          </a>{" "}
          dan klik tombol "Restore" pada project BukuKas.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
          style={{ minWidth: 200 }}
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}

// ─── Password Change Modal ────────────────────────────────────────────────────
/**
 * Shown when the user arrives via a Supabase PASSWORD_RECOVERY reset link.
 * Lets the user set a new password without leaving the app.
 */
function PasswordChangeModal({ onSubmit }) {
  const [newPassword,      setNewPassword]      = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");
  const [error,            setError]            = useState("");
  const [submitting,       setSubmitting]       = useState(false);
  const [showNewPassword,  setShowNewPassword]  = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) { setError("Kata sandi minimal 6 karakter."); return; }
    if (newPassword !== confirmPassword) { setError("Kata sandi tidak cocok."); return; }
    setSubmitting(true);
    try {
      await onSubmit(newPassword);
    } catch (err) {
      setError(err.message || "Gagal mengubah kata sandi. Coba lagi.");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 400 }}>
        <h2 className="modal-title">Ubah Kata Sandi</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Masukkan kata sandi baru Anda.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Kata Sandi Baru
            </label>
            <div className="login-password-wrapper">
              <input
                type={showNewPassword ? "text" : "password"}
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                autoFocus
                disabled={submitting}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowNewPassword((v) => !v)}
                disabled={submitting}
                aria-label={showNewPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                tabIndex={-1}
              >
                <Icon name="eye" size={16} color={showNewPassword ? "#007bff" : "#9ca3af"} />
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Konfirmasi Kata Sandi
            </label>
            <div className="login-password-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang kata sandi"
                disabled={submitting}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowConfirmPassword((v) => !v)}
                disabled={submitting}
                aria-label={showConfirmPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                tabIndex={-1}
              >
                <Icon name="eye" size={16} color={showConfirmPassword ? "#007bff" : "#9ca3af"} />
              </button>
            </div>
          </div>
          {error && (
            <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}
          <div className="modal-actions" style={{ justifyContent: "center" }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !newPassword.trim()}
              style={{ minWidth: 200 }}
            >
              {submitting ? "Menyimpan..." : "Simpan Kata Sandi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Auth (must be first hook) ─────────────────────────────────────────────
  const { user, profile, loading: authLoading, signOut, passwordRecovery, updatePassword } = useAuth();

  // ── Global state ────────────────────────────────────────────────────────────
  const [data, setData] = useState(() =>
    USE_SUPABASE ? {
      transactions: [], contacts: [], stockAdjustments: [],
      itemCategories: [], itemCatalog: [],
      settings: {
        businessName: "Usaha Keluarga Saya", address: "", phone: "",
        lowStockThreshold: 10, bankAccounts: [], maxBankAccountsOnInvoice: 1,
        lastExportDate: null, defaultDueDateDays: 14, printerType: "A4",
      },
      _normVersion: 18,
    } : loadData()
  );
  const [appLoading,      setAppLoading]      = useState(USE_SUPABASE);
  const [databasePaused,  setDatabasePaused]  = useState(false);
  const [saveErrorModal,  setSaveErrorModal]  = useState(null); // { message, retryFn } | null
  const [page,        setPage]        = useState("penjualan");
  const [saved,       setSaved]       = useState(true);
  const [saveError,   setSaveError]   = useState(false);
  const [editTx,      setEditTx]      = useState(null);
  const [invoiceTxs,  setInvoiceTxs]  = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 1024);
  const [reportItemFilter,   setReportItemFilter]   = useState(null); // item name pre-filter from Inventory "Lihat"
  const [outstandingHighlight, setOutstandingHighlight] = useState(null); // array of tx IDs to highlight on Outstanding page
  const [txPageHighlight, setTxPageHighlight] = useState(null); // { txId, date } — highlight a tx on Penjualan/Pembelian from ActivityLog
  const [reportState, setReportState] = useState(null); // { transactions, dateFrom, dateTo }
  const [backupBannerDismissed, setBackupBannerDismissed] = useState(false);
  const [suratJalanTx, setSuratJalanTx] = useState(null);
  const [showStockReport, setShowStockReport] = useState(false);
  const [dotMatrixData, setDotMatrixData] = useState(null); // { transaction, mode } | null
  // Phase 5: Realtime + conflict detection
  const [showConflictModal,  setShowConflictModal]  = useState(false);
  const [conflictUpdatedBy,  setConflictUpdatedBy]  = useState('');
  const [onlineUsers,        setOnlineUsers]        = useState([]); // [{ id, name, role }]
  const [toast,              setToast]              = useState(null); // app-level warning toast (e.g. txnId collision)
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const saveTimer = useRef();
  // dataRef always mirrors the latest committed data. update() reads from it instead
  // of using setData's functional updater, which prevents React StrictMode from
  // double-invoking persistToSupabase and causing concurrent saveItemCategories calls.
  const dataRef = useRef(data);

  // ── Persistence ─────────────────────────────────────────────────────────────
  /** Debounced save: marks "saving" immediately, writes after 500 ms idle */
  const persist = useCallback((nd) => {
    setSaved(false);
    setSaveError(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const ok = saveData(nd);
      if (ok) {
        setSaved(true);
        setSaveError(false);
      } else {
        setSaveError(true);
        // saved stays false — beforeunload guard stays active
      }
    }, 500);
  }, []);

  /** Manual retry: attempt to save current data immediately */
  const retrySave = useCallback(() => {
    const ok = saveData(data);
    if (ok) {
      setSaved(true);
      setSaveError(false);
    }
  }, [data]);

  // ── Phase 4: async Supabase persistence ─────────────────────────────────
  const persistToSupabase = useCallback(async (operation, retryFn) => {
    setSaved(false);
    setSaveError(false);
    try {
      await operation();
      setSaved(true);
      setSaveError(false);
    } catch (err) {
      if (err.isConflict) {
        // Another user saved first — show conflict modal, don't block UI
        setConflictUpdatedBy(err.updatedBy);
        setShowConflictModal(true);
        setSaved(true); // CRITICAL: prevent stuck 'Menyimpan...' state
        return;
      }
      setSaveError(true);
      setSaved(false);
      // Check if the failure is due to a paused database before showing the generic retry modal.
      isSupabaseReachable().then((reachable) => {
        if (!reachable) {
          setDatabasePaused(true);
        } else {
          setSaveErrorModal({ message: err.message, retryFn });
        }
      });
    }
  }, [setDatabasePaused]);

  // Keep dataRef in sync with every committed state update.
  // Must be a useEffect (not inline) so it runs after React commits the new state.
  useEffect(() => { dataRef.current = data; }, [data]);

  // update() reads from dataRef.current (latest committed state) and calls
  // persistToSupabase OUTSIDE setData. This prevents React StrictMode from
  // double-invoking persistToSupabase (which previously caused two concurrent
  // saveItemCategories calls → race condition → duplicate key violation).
  /** Immutable state updater — routes to Supabase or localStorage based on USE_SUPABASE flag */
  const update = (fn, supabaseOperation) => {
    const nd = fn(dataRef.current);
    dataRef.current = nd; // sync immediately — don't wait for useEffect, prevents stale reads on rapid successive calls
    setData(nd);
    if (USE_SUPABASE && supabaseOperation) {
      persistToSupabase(
        () => supabaseOperation(nd),
        () => update(fn, supabaseOperation)
      );
    } else if (!USE_SUPABASE) {
      persist(nd);
    }
  };

  // ── Phase 6: non-blocking audit log helper ───────────────────────────────────
  // Failures silently warn — must never surface to SaveErrorModal.
  const logActivity = useCallback((action, entityType, entityId, changes = {}) => {
    if (!user) return Promise.resolve();
    return sbSaveActivityLog({
      user_name:   profile?.full_name || user.email || '',
      action,
      entity_type: entityType,
      entity_id:   String(entityId || ''),
      changes,
    }, user.id).catch((err) => {
      console.warn('[activity_log] write failed (non-blocking):', err.message);
    });
  }, [user, profile]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const stockMap  = useMemo(() => computeStockMap(data.transactions, data.stockAdjustments || []), [data.transactions, data.stockAdjustments]);
  const threshold = data.settings.lowStockThreshold ?? 10;
  const { ar: globalAR, ap: globalAP } = useMemo(
    () => computeARandAP(data.transactions),
    [data.transactions]
  );
  const alertCount = useMemo(() => {
    const v = Object.values(stockMap);
    return v.filter((s) => s.qty < 0).length + v.filter((s) => s.qty >= 0 && s.qty <= threshold).length;
  }, [stockMap, threshold]);

  // Badge counts for near-due outstanding transactions (within 3 days, per type)
  const { penjualanBadge, pembelianBadge, outstandingBadge } = useMemo(() => {
    const todayMs = new Date(today() + "T00:00:00Z").getTime();
    let penjualan = 0, pembelian = 0;
    for (const t of data.transactions) {
      if ((t.outstanding || 0) <= 0 || !t.dueDate) continue;
      try {
        const diff = (new Date(t.dueDate + "T00:00:00Z").getTime() - todayMs) / 86400000;
        if (diff <= 3) {
          if (t.type === "income") penjualan++;
          else pembelian++;
        }
      } catch { /* ignore */ }
    }
    return { penjualanBadge: penjualan, pembelianBadge: pembelian, outstandingBadge: penjualan + pembelian };
  }, [data.transactions]);

  // ── beforeunload guard — warns if browser closes during 500ms debounce ───
  useEffect(() => {
    const handler = (e) => {
      if (!saved) {
        e.preventDefault();
        e.returnValue = ""; // triggers browser's native "Leave site?" dialog
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saved]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Open password-change modal when user arrives via a reset-password email link.
  useEffect(() => {
    if (passwordRecovery && user) {
      setShowPasswordChange(true);
    }
  }, [passwordRecovery, user]);

  // ── Phase 4: load data from Supabase on mount ────────────────────────────
  // loadedRef guards against React StrictMode double-invoking this effect in
  // development, which would cause two concurrent loads and potentially overwrite
  // in-flight state updates with stale data from the first load completing late.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!USE_SUPABASE) return;
    if (!user) return;
    if (loadedRef.current) return; // prevent double-load (React StrictMode)
    loadedRef.current = true;
    loadDataFromSupabase(user.id)
      .then((loaded) => {
        setData(loaded);
        setAppLoading(false);
      })
      .catch(async (err) => {
        console.error("Failed to load data from Supabase:", err);
        const reachable = await isSupabaseReachable();
        if (!reachable) {
          setDatabasePaused(true);
          setAppLoading(false);
          return;
        }
        setAppLoading(false);
        setSaveErrorModal({ message: err.message, retryFn: () => window.location.reload() });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Phase 5: Realtime — apply incoming DB changes directly to state ─────────
  // CRITICAL: uses setData directly, NEVER update(). Calling update() would trigger
  // persistToSupabase and write the incoming data back to Supabase — causing write
  // loops and corrupting updated_by audit fields.
  const handleRealtimeUpdate = useCallback((table, eventType, record) => {
    setData((d) => {
      if (eventType === 'DELETE') {
        if (table === 'transactions')
          return { ...d, transactions: d.transactions.filter((x) => x.id !== record.id) };
        if (table === 'contacts')
          return { ...d, contacts: d.contacts.filter((x) => x.id !== record.id) };
        if (table === 'stock_adjustments')
          return { ...d, stockAdjustments: (d.stockAdjustments || []).filter((x) => x.id !== record.id) };
        if (table === 'item_catalog')
          return { ...d, itemCatalog: (d.itemCatalog || []).filter((x) => x.id !== record.id) };
        return d;
      }
      // INSERT or UPDATE
      const mapped =
        table === 'transactions'    ? mapTransaction(record) :
        table === 'contacts'        ? mapContact(record) :
        table === 'stock_adjustments' ? mapStockAdjustment(record) :
        table === 'item_catalog'    ? mapCatalogItem(record) :
        null;
      if (!mapped) return d;
      if (table === 'transactions') {
        const exists = d.transactions.some((x) => x.id === mapped.id);
        return { ...d, transactions: exists
          ? d.transactions.map((x) => x.id === mapped.id ? mapped : x)
          : [...d.transactions, mapped] };
      }
      if (table === 'contacts') {
        const exists = d.contacts.some((x) => x.id === mapped.id);
        return { ...d, contacts: exists
          ? d.contacts.map((x) => x.id === mapped.id ? mapped : x)
          : [...d.contacts, mapped] };
      }
      if (table === 'stock_adjustments') {
        const arr = d.stockAdjustments || [];
        const exists = arr.some((x) => x.id === mapped.id);
        return { ...d, stockAdjustments: exists
          ? arr.map((x) => x.id === mapped.id ? mapped : x)
          : [...arr, mapped] };
      }
      if (table === 'item_catalog') {
        const arr = d.itemCatalog || [];
        const exists = arr.some((x) => x.id === mapped.id);
        return { ...d, itemCatalog: exists
          ? arr.map((x) => x.id === mapped.id ? mapped : x)
          : [...arr, mapped] };
      }
      return d;
    });
  }, []);

  useEffect(() => {
    if (!USE_SUPABASE || !user) return;
    const cleanup = subscribeToChanges(handleRealtimeUpdate);
    return cleanup;
  }, [user, handleRealtimeUpdate]);

  // ── Phase 5: Presence — track online users ───────────────────────────────
  const handlePresenceChange = useCallback((presences) => {
    setOnlineUsers(presences);
  }, []);

  useEffect(() => {
    if (!USE_SUPABASE || !user || !profile) return;
    const cleanup = subscribeToPresence(
      user.id,
      { id: user.id, name: profile.full_name || profile.email, role: profile.role },
      handlePresenceChange
    );
    return cleanup;
  }, [user, profile, handlePresenceChange]);

  // Note: totalIncome/totalExpense are CASH-BASIS (value - outstanding), not gross values.
  // The Contacts page labels these as "Total Penjualan/Pembelian" which may imply gross.
  // ── Pre-computed per-contact balance map (O(tx) once, not O(contacts×tx)) ─
  // Shape: { [lowerCaseName]: { totalIncome, totalExpense, ar, ap, netOut, txs } }
  const balanceMap = useMemo(() => {
    const map = {};
    for (const t of data.transactions) {
      const key = t.counterparty.toLowerCase();
      if (!map[key]) map[key] = { totalIncome: 0, totalExpense: 0, ar: 0, ap: 0, txs: [] };
      const out  = Number(t.outstanding) || 0;
      const cash = Number(t.value) - out;
      if (t.type === "income") {
        map[key].totalIncome += cash;
        map[key].ar          += out;
      } else {
        map[key].totalExpense += cash;
        map[key].ap           += out;
      }
      map[key] = { ...map[key], txs: [...map[key].txs, t] };
    }
    // Sort each contact's tx list descending by createdAt
    for (const key of Object.keys(map)) {
      map[key].txs.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime()
          : new Date((a.date || "1970-01-01") + "T" + (a.time || "00:00") + ":00Z").getTime();
        const tb = b.createdAt ? new Date(b.createdAt).getTime()
          : new Date((b.date || "1970-01-01") + "T" + (b.time || "00:00") + ":00Z").getTime();
        return tb - ta;
      });
      map[key].netOut = map[key].ar - map[key].ap;
    }
    return map;
  }, [data.transactions]);

  // ── Auto-create contact when a new counterparty appears ───────────────────
  const ensureContact = (cp, contacts) => {
    const normName = normalizeTitleCase(cp);
    if (contacts.some((c) => c.name.toLowerCase() === normName.toLowerCase())) return contacts;
    return [...contacts, { id: generateId(), name: normName, email: "", phone: "", address: "", archived: false }];
  };

  /** Normalize item/counterparty fields before any save */
  const normTx = (t) => ({
    ...t,
    itemName:     normalizeTitleCase(t.itemName),
    counterparty: normalizeTitleCase(t.counterparty),
  });

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const addTransaction = async (t) => {
    const out = Number(t.outstanding) || 0;
    const dueDate = out > 0 ? (addDays(t.date, t.customDueDays) ?? null) : null;
    const nt = { ...normTx(t), createdAt: new Date().toISOString(), dueDate };
    const value    = Number(nt.value) || 0;
    const paidNow  = value - out;
    const initialPayment = {
      id:                generateId(),
      paidAt:            new Date().toISOString(),
      date:              today(),
      time:              nowTime(),
      amount:            out === 0 ? value : (paidNow > 0 ? paidNow : 0),
      outstandingBefore: value,
      outstandingAfter:  out,
      note:              out === 0
        ? "Lunas saat transaksi dibuat"
        : paidNow > 0
        ? "Pembayaran awal"
        : "Belum ada pembayaran saat transaksi dibuat",
      method: null,
    };

    // H2 LONG-TERM FIX: In Supabase mode, get an atomic serial from the DB before
    // touching local state. This prevents duplicate txnIds under concurrent writes.
    // In localStorage mode, generateTxnId() inside update() is still correct (single user).
    if (USE_SUPABASE && nt.type === "income") {
      try {
        nt.txnId = await getNextTxnSerial(nt.date);
      } catch (err) {
        // If the RPC fails (e.g. network blip), fall back to local generation so the
        // user isn't blocked. The short-term collision toast below will catch any
        // resulting duplicate.
        console.error("getNextTxnSerial failed, falling back to local generateTxnId:", err);
      }
    }

    // C2 fix: state mutation only — no supabaseOperation passed, so update() does not set a retry.
    // We call persistToSupabase directly below with a retry that only re-runs the Supabase write,
    // not the state mutation. This prevents duplicate transactions on SaveErrorModal retry.
    update((d) => {
      const txnId = nt.type === "income"
        // Supabase mode: nt.txnId already set atomically above (or fell back on error).
        // localStorage mode: generate from local state as before.
        ? (nt.txnId || generateTxnId(d.transactions, nt.date))
        : (nt.txnId || null);
      const newTx = { ...nt, txnId, paymentHistory: [initialPayment] };
      return {
        ...d,
        transactions: [...d.transactions, newTx],
        contacts: ensureContact(nt.counterparty, d.contacts),
      };
    });
    if (USE_SUPABASE) {
      // dataRef.current === nd at this point (set synchronously inside update())
      const nd = dataRef.current;
      const newTx     = nd.transactions.find((x) => x.id === nt.id);
      const newContact = nd.contacts.find(
        (c) => c.name.toLowerCase() === normalizeTitleCase(nt.counterparty).toLowerCase()
      );
      const supabaseSave = () => Promise.all([
        newTx     ? sbSaveTransaction(newTx,     user.id) : Promise.resolve(),
        newContact ? sbSaveContact(newContact, user.id)   : Promise.resolve(),
        logActivity('create', 'transaction', newTx?.txnId, {
          type: nt.type, counterparty: nt.counterparty, value: nt.value,
          items: nt.items?.map((i) => i.itemName),
        }),
      ]);
      const retryFn = () => persistToSupabase(supabaseSave, retryFn);
      persistToSupabase(supabaseSave, retryFn);
      // H2 SHORT-TERM FIX (kept as defense-in-depth alongside DB sequence):
      // Post-save collision detection for txnId. Catches any duplicate that slips
      // through (e.g. RPC fallback path above, or stale Realtime state).
      if (nt.type === "income" && newTx?.txnId) {
        const collision = nd.transactions.some(
          (x) => x.id !== newTx.id && x.txnId === newTx.txnId
        );
        if (collision) {
          setToast("⚠️ Nomor faktur mungkin duplikat — periksa dan perbaiki secara manual.");
        }
      }
    }
  };

  const editTransaction = (t) => {
    const nt = normTx(t);
    update((d) => ({
      ...d,
      transactions: d.transactions.map((x) => {
        if (x.id !== nt.id) return x;
        const out = Number(nt.outstanding) || 0;
        // dueDate rules on edit:
        //  - fully paid → null
        //  - partial/unpaid and date changed → recalculate from new date
        //  - partial/unpaid, date unchanged → keep existing dueDate (don't restart clock)
        //  - partial/unpaid, no existing dueDate → set from new date
        let dueDate;
        if (out === 0) {
          dueDate = null;
        } else if (x.dueDate && nt.date === x.date && nt.customDueDays === x.customDueDays) {
          dueDate = x.dueDate; // keep — date and terms didn't change
        } else {
          dueDate = addDays(nt.date, nt.customDueDays) ?? null; // date changed, terms changed, or no prior dueDate
        }
        // txnId logic on edit:
        //  - income: auto-generated; regenerate only if YY-MM prefix changes (BUG-005)
        //  - expense: use whatever the user entered (allows add/update/clear of supplier invoice no)
        let txnId;
        if (nt.type === "income") {
          const oldPrefix = (x.date || "").slice(2, 7);
          const newPrefix = (nt.date || "").slice(2, 7);
          txnId = (oldPrefix && newPrefix && oldPrefix !== newPrefix)
            ? generateTxnId(d.transactions, nt.date)
            : x.txnId;
        } else {
          txnId = nt.txnId || null;
        }

        const valueChanged = Number(x.value) !== Number(nt.value) ||
          Number(x.outstanding) !== Number(nt.outstanding);
        const editPaymentEntry = valueChanged ? {
          id:                generateId(),
          paidAt:            new Date().toISOString(),
          date:              today(),
          time:              nowTime(),
          amount:            0,
          outstandingBefore: Number(x.outstanding) || 0,
          outstandingAfter:  Number(nt.outstanding) || 0,
          note:              "Transaksi diedit — nilai diperbarui",
          method:            null,
        } : null;
        return {
          ...nt,
          txnId,
          dueDate,
          createdAt:      x.createdAt || nt.createdAt || new Date().toISOString(),
          paymentHistory: editPaymentEntry
            ? [...(x.paymentHistory || []), editPaymentEntry]
            : (x.paymentHistory || []),
          // BUG-008 Fix: Store slim snapshot to prevent localStorage bloat (full copy was 2-3KB each × 20)
          editLog: [...(x.editLog || []), { at: new Date().toISOString(), prev: {
            date:         x.date,
            time:         x.time,
            counterparty: x.counterparty,
            itemName:     x.itemName,
            stockQty:     x.stockQty,
            stockUnit:    x.stockUnit,
            value:        x.value,
            outstanding:  x.outstanding,
            status:       x.status,
            dueDate:      x.dueDate,
            itemNames:    Array.isArray(x.items) ? x.items.map((it) => it.itemName) : [x.itemName],
          }}].slice(-20),
        };
      }),
    }),
    (nd) => {
      const updated = nd.transactions.find((x) => x.id === nt.id);
      return Promise.all([
        updated ? sbSaveTransaction(updated, user.id, true) : Promise.resolve(),
        logActivity('edit', 'transaction', updated?.txnId || nt.txnId, {
          counterparty: nt.counterparty, value: nt.value,
        }),
      ]);
    }
    );
  };

  const deleteTransaction = (id) => {
    const txnId = dataRef.current.transactions.find((t) => t.id === id)?.txnId || id;
    return update(
      (d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }),
      () => Promise.all([sbDeleteTransaction(id), logActivity('delete', 'transaction', txnId)])
    );
  };

  // ── Apply a payment (full or partial) against a transaction's outstanding ──
  /**
   * @param {string} id          - transaction id
   * @param {number} paidAmount  - amount being paid now (1 ≤ paidAmount ≤ outstanding)
   */
  const applyPayment = (id, paidAmount, paymentNote = "") => {
    // C2 fix: state mutation only — retry closure below only re-runs the Supabase write,
    // not the state mutation. This prevents duplicate payment history entries on retry.
    update((d) => ({
      ...d,
      transactions: d.transactions.map((t) => {
        if (t.id !== id) return t;
        const outstandingBefore = Number(t.outstanding) || 0;
        const newOutstanding    = Math.max(0, outstandingBefore - paidAmount);
        const isFullyPaid       = newOutstanding === 0;
        const newPaymentEntry   = {
          id:                generateId(),
          paidAt:            new Date().toISOString(),
          date:              today(),
          time:              nowTime(),
          amount:            paidAmount,
          outstandingBefore,
          outstandingAfter:  newOutstanding,
          note:              paymentNote || (isFullyPaid ? "Pelunasan" : "Pembayaran sebagian"),
          method:            null,
        };
        return {
          ...t,
          outstanding:    newOutstanding,
          status:         deriveStatus(t.type, !isFullyPaid),
          dueDate:        isFullyPaid ? null : (t.dueDate ?? null),
          paymentHistory: [...(t.paymentHistory || []), newPaymentEntry],
          editLog:        [...(t.editLog || []), { at: new Date().toISOString(), prev: {
            date:         t.date,
            time:         t.time,
            counterparty: t.counterparty,
            itemName:     t.itemName,
            stockQty:     t.stockQty,
            stockUnit:    t.stockUnit,
            value:        t.value,
            outstanding:  t.outstanding,
            status:       t.status,
            dueDate:      t.dueDate,
            itemNames:    Array.isArray(t.items) ? t.items.map((it) => it.itemName) : [t.itemName],
          }}].slice(-20),
        };
      }),
    }));
    if (USE_SUPABASE) {
      const nd = dataRef.current;
      const updated = nd.transactions.find((x) => x.id === id);
      const supabaseSave = () => Promise.all([
        updated ? sbSaveTransaction(updated, user.id) : Promise.resolve(),
        logActivity('payment', 'transaction', updated?.txnId || id, { amount: paidAmount, note: paymentNote }),
      ]);
      const retryFn = () => persistToSupabase(supabaseSave, retryFn);
      persistToSupabase(supabaseSave, retryFn);
    }
  };

  // ── Instantly create a named contact (called from TransactionForm dropdown) ─
  const createContact = (name) => {
    const trimmed = normalizeTitleCase(name);
    if (!trimmed) return;
    const newContact = { id: generateId(), name: trimmed, email: "", phone: "", address: "", archived: false };
    update(
      (d) => {
        if (d.contacts.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return d;
        return { ...d, contacts: [...d.contacts, newContact] };
      },
      (nd) => {
        // Only save if the contact was actually added (guard may have returned d unchanged)
        const wasAdded = nd.contacts.some((c) => c.id === newContact.id);
        return Promise.all([
          wasAdded ? sbSaveContact(newContact, user.id) : Promise.resolve(),
          wasAdded ? logActivity('create', 'contact', newContact.id, { name: trimmed }) : Promise.resolve(),
        ]);
      }
    );
  };

  // ── Archive / unarchive a contact ─────────────────────────────────────────
  const archiveContact = (contactId) =>
    update(
      (d) => ({
        ...d,
        contacts: d.contacts.map((c) => c.id === contactId ? { ...c, archived: true } : c),
      }),
      (nd) => {
        const c = nd.contacts.find((x) => x.id === contactId);
        return Promise.all([
          c ? sbSaveContact(c, user.id) : Promise.resolve(),
          logActivity('edit', 'contact', contactId, { archived: true }),
        ]);
      }
    );

  const unarchiveContact = (contactId) =>
    update(
      (d) => ({
        ...d,
        contacts: d.contacts.map((c) => c.id === contactId ? { ...c, archived: false } : c),
      }),
      (nd) => {
        const c = nd.contacts.find((x) => x.id === contactId);
        return Promise.all([
          c ? sbSaveContact(c, user.id) : Promise.resolve(),
          logActivity('edit', 'contact', contactId, { archived: false }),
        ]);
      }
    );

  // ── Permanently delete a contact (0-transaction contacts only) ────────────
  const deleteContact = (contactId) =>
    update(
      (d) => {
        const contact = d.contacts.find((c) => c.id === contactId);
        if (!contact) return d;
        const hasTx = d.transactions.some(
          (t) => t.counterparty.toLowerCase().trim() === contact.name.toLowerCase().trim()
        );
        if (hasTx) return d;
        return { ...d, contacts: d.contacts.filter((c) => c.id !== contactId) };
      },
      (nd) => {
        if (nd.contacts.some((c) => c.id === contactId)) return Promise.resolve(); // guard blocked deletion
        return Promise.all([
          sbDeleteContact(contactId),
          logActivity('delete', 'contact', contactId),
        ]);
      }
    );

  // ── Update a contact and cascade name changes to transactions ───────────────
  const updateContact = (contact) => {
    // Compute newName and isNameChange before update() so both the state fn
    // and the supabaseOperation can share them via closure without re-computing.
    const newName = normalizeTitleCase(contact.name);
    const preUpdateContact = dataRef.current.contacts.find((c) => c.id === contact.id);
    const isNameChange = preUpdateContact
      ? preUpdateContact.name.toLowerCase() !== newName.toLowerCase()
      : false;
    update(
      (d) => {
        const oldContact = d.contacts.find((c) => c.id === contact.id);
        if (!oldContact) return d;
        if (isNameChange && d.contacts.some((c) =>
          c.id !== contact.id && c.name.toLowerCase().trim() === newName.toLowerCase().trim()
        )) {
          return d;
        }
        return {
          ...d,
          contacts: d.contacts.map((c) => (c.id === contact.id ? { ...contact, name: newName } : c)),
          transactions: isNameChange
            ? d.transactions.map((t) =>
                t.counterparty.toLowerCase() === oldContact.name.toLowerCase()
                  ? { ...t, counterparty: newName }
                  : t
              )
            : d.transactions,
        };
      },
      (nd) => {
        const updated = nd.contacts.find((c) => c.id === contact.id);
        // nd.transactions already has the updated counterparty values — filter by newName.
        const cascadedTxs = isNameChange
          ? nd.transactions.filter(
              (t) => t.counterparty.toLowerCase() === newName.toLowerCase()
            )
          : [];
        return Promise.all([
          updated ? sbSaveContact(updated, user.id, true) : Promise.resolve(),
          ...cascadedTxs.map((tx) => sbSaveTransaction(tx, user.id)),
          logActivity('edit', 'contact', contact.id, { name: newName }),
        ]);
      }
    );
  };

  // ── Import handler for Settings backup restore ────────────────────────────
  const handleImport = async (importedData) => {
    if (!USE_SUPABASE) {
      // localStorage mode: write then re-read to run migrations
      saveData(importedData);
      const migrated = loadData();
      update(() => migrated);
      return undefined; // Settings.js shows its default success message
    }

    // Supabase mode: update local React state first (also writes to localStorage as backup)
    update(() => importedData);

    // Then upsert each entity to Supabase — merge/add only, no deletions
    const txPromises      = (importedData.transactions     || []).map((tx)  => sbSaveTransaction(tx, user.id));
    const contactPromises = (importedData.contacts         || []).map((c)   => sbSaveContact(c, user.id));
    const adjPromises     = (importedData.stockAdjustments || []).map((adj) => sbSaveStockAdjustment(adj, user.id));
    const catalogPromises = (importedData.itemCatalog      || []).map((item)=> sbSaveItemCatalogItem(item, user.id));
    const catPromise      = sbSaveItemCategories(importedData.itemCategories || []);
    // NOTE: importedData.settings intentionally NOT synced — app_settings managed separately

    const results = await Promise.allSettled([
      ...txPromises,
      ...contactPromises,
      ...adjPromises,
      ...catalogPromises,
      catPromise,
    ]);

    const failed    = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.filter((r) => r.status === "fulfilled").length;

    logActivity("import", "settings", null, { count: (importedData.transactions || []).length });

    return { succeeded, failed, total: results.length };
  };

  // ── Add a manual stock adjustment (Inventory page) ────────────────────────
  const addStockAdjustment = (adj) => {
    // C2 fix: state mutation only — retry closure below only re-runs the Supabase write,
    // not the state mutation. This prevents duplicate stock adjustments on retry.
    update((d) => ({ ...d, stockAdjustments: [...(d.stockAdjustments || []), adj] }));
    if (USE_SUPABASE) {
      const supabaseSave = () => Promise.all([
        sbSaveStockAdjustment(adj, user.id),
        logActivity('stock_adjustment', 'stock_adjustment', adj.id, { itemName: adj.itemName, qty: adj.adjustmentQty }),
      ]);
      const retryFn = () => persistToSupabase(supabaseSave, retryFn);
      persistToSupabase(supabaseSave, retryFn);
    }
  };

  // ── Delete a single stock adjustment by id ───────────────────────────────
  const deleteStockAdjustment = (adjustmentId) =>
    update(
      (d) => ({ ...d, stockAdjustments: (d.stockAdjustments || []).filter((a) => a.id !== adjustmentId) }),
      () => Promise.all([
        sbDeleteStockAdjustment(adjustmentId),
        logActivity('delete', 'stock_adjustment', adjustmentId),
      ])
    );

  // ── Replace entire itemCategories array (called from Inventory category UI) ─
  const updateItemCategories = (categories) =>
    update(
      (d) => ({ ...d, itemCategories: categories }),
      () => sbSaveItemCategories(categories, user.id)
    );

  // ── Item Catalog CRUD ────────────────────────────────────────────────────────
  const addCatalogItem = (item) =>
    update((d) => {
      const catalog = d.itemCatalog || [];
      const categories = d.itemCategories || [];
      const normalizedName = normalizeTitleCase(item.name);

      let newCatalog;
      let catalogItemName;

      const existing = catalog.find((c) => normItem(c.name) === normItem(item.name));
      if (existing) {
        // Safety guard: merge subtypes instead of creating a duplicate entry
        const existingNorm = new Set((existing.subtypes || []).map(normItem));
        const merged = [
          ...(existing.subtypes || []),
          ...(item.subtypes || []).filter((s) => !existingNorm.has(normItem(s))),
        ];
        newCatalog = catalog.map((c) => c.id === existing.id ? { ...c, subtypes: merged } : c);
        catalogItemName = existing.name;
      } else {
        newCatalog = [...catalog, {
          id:          generateId(),
          name:        normalizedName,
          defaultUnit: item.defaultUnit || "karung",
          subtypes:    item.subtypes    || [],
        }];
        catalogItemName = normalizedName;
      }

      // Auto-create a matching itemCategories entry if none exists for this item
      const hasCat = categories.some((c) => normItem(c.groupName) === normItem(catalogItemName));
      let newCategories = categories;
      if (!hasCat) {
        const existingCodes = new Set(categories.map((c) => c.code));
        let code = generateCode(catalogItemName);
        let suffix = 2;
        while (existingCodes.has(code)) {
          code = generateCode(catalogItemName) + suffix;
          suffix++;
        }
        newCategories = [...categories, {
          id:        generateId(),
          groupName: catalogItemName,
          code,
          items:     [normItem(catalogItemName)],
        }];
      }

      return { ...d, itemCatalog: newCatalog, itemCategories: newCategories };
    },
    (nd) => {
      const savedItem = nd.itemCatalog.find((c) => normItem(c.name) === normItem(item.name));
      return Promise.all([
        savedItem ? sbSaveItemCatalogItem(savedItem, user.id) : Promise.resolve(),
        sbSaveItemCategories(nd.itemCategories, user.id),
        savedItem ? logActivity('create', 'catalog_item', savedItem.id, { name: savedItem.name }) : Promise.resolve(),
      ]);
    }
    );

  const updateCatalogItem = (updatedItem) =>
    update(
      (d) => {
        const newCatalog = (d.itemCatalog || []).map((c) => c.id === updatedItem.id ? updatedItem : c);
        const newCategories = (d.itemCategories || []).map((cat) => {
          if (normItem(cat.groupName) !== normItem(updatedItem.name)) return cat;
          const baseKey = normItem(updatedItem.name);
          const subKeys = (updatedItem.subtypes || []).map((sub) => normItem(`${updatedItem.name} ${sub}`));
          return { ...cat, items: [baseKey, ...subKeys] };
        });
        return { ...d, itemCatalog: newCatalog, itemCategories: newCategories };
      },
      (nd) => Promise.all([
        sbSaveItemCatalogItem(updatedItem, user.id),
        sbSaveItemCategories(nd.itemCategories, user.id),
        logActivity('edit', 'catalog_item', updatedItem.id, { name: updatedItem.name }),
      ])
    );

  const deleteCatalogItem = (itemId) => {
    let adjIdsToDelete = [];
    update(
      (d) => {
        const cat = (d.itemCatalog || []).find((c) => c.id === itemId);
        if (!cat) return d;
        const allNames = [cat.name, ...(cat.subtypes || []).map((s) => `${cat.name} ${s}`)];
        const hasTx = d.transactions.some((t) => {
          const items = Array.isArray(t.items) && t.items.length > 0
            ? t.items : [{ itemName: t.itemName }];
          return items.some((it) => allNames.some((n) => normItem(n) === normItem(it.itemName)));
        });
        if (hasTx) return d;
        // Capture adjustment IDs before filtering them out
        adjIdsToDelete = (d.stockAdjustments || [])
          .filter((a) => allNames.some((n) => normItem(n) === normItem(a.itemName)))
          .map((a) => a.id);
        return {
          ...d,
          itemCatalog:      (d.itemCatalog || []).filter((c) => c.id !== itemId),
          itemCategories:   (d.itemCategories || []).filter((c) => normItem(c.groupName) !== normItem(cat.name)),
          stockAdjustments: (d.stockAdjustments || []).filter(
            (a) => !allNames.some((n) => normItem(n) === normItem(a.itemName))
          ),
        };
      },
      (nd) => {
        if (nd.itemCatalog.some((it) => it.id === itemId)) return Promise.resolve(); // guard blocked deletion
        return Promise.all([
          sbDeleteItemCatalogItem(itemId),
          sbSaveItemCategories(nd.itemCategories, user.id),
          ...adjIdsToDelete.map((id) => sbDeleteStockAdjustment(id)),
          logActivity('delete', 'catalog_item', itemId),
        ]);
      }
    );
  };

  // ── Archive / unarchive catalog items ─────────────────────────────────────
  const archiveCatalogItem = (itemId) =>
    update(
      (d) => ({
        ...d,
        itemCatalog: (d.itemCatalog || []).map((c) => c.id === itemId ? { ...c, archived: true } : c),
      }),
      (nd) => {
        const c = nd.itemCatalog.find((x) => x.id === itemId);
        return Promise.all([
          c ? sbSaveItemCatalogItem(c, user.id) : Promise.resolve(),
          logActivity('edit', 'catalog_item', itemId, { archived: true }),
        ]);
      }
    );

  const unarchiveCatalogItem = (itemId) =>
    update(
      (d) => ({
        ...d,
        itemCatalog: (d.itemCatalog || []).map((c) =>
          c.id === itemId ? { ...c, archived: false } : c
        ),
      }),
      (nd) => {
        const c = nd.itemCatalog.find((x) => x.id === itemId);
        return Promise.all([
          c ? sbSaveItemCatalogItem(c, user.id) : Promise.resolve(),
          logActivity('edit', 'catalog_item', itemId, { archived: false }),
        ]);
      }
    );

  const archiveSubtype = (itemId, subtypeName) =>
    update(
      (d) => ({
        ...d,
        itemCatalog: (d.itemCatalog || []).map((c) => {
          if (c.id !== itemId) return c;
          const existing = c.archivedSubtypes || [];
          if (existing.some((s) => normItem(s) === normItem(subtypeName))) return c;
          return { ...c, archivedSubtypes: [...existing, subtypeName] };
        }),
      }),
      (nd) => {
        const c = nd.itemCatalog.find((x) => x.id === itemId);
        return c ? sbSaveItemCatalogItem(c, user.id) : Promise.resolve();
      }
    );

  const unarchiveSubtype = (itemId, subtypeName) =>
    update(
      (d) => ({
        ...d,
        itemCatalog: (d.itemCatalog || []).map((c) => {
          if (c.id !== itemId) return c;
          return {
            ...c,
            archivedSubtypes: (c.archivedSubtypes || []).filter(
              (s) => normItem(s) !== normItem(subtypeName)
            ),
          };
        }),
      }),
      (nd) => {
        const c = nd.itemCatalog.find((x) => x.id === itemId);
        return c ? sbSaveItemCatalogItem(c, user.id) : Promise.resolve();
      }
    );

  // ── Rename an inventory item across all transactions and adjustments ───────
  const renameInventoryItem = (oldName, newName) =>
    update((d) => ({
      ...d,
      transactions: d.transactions.map((t) => {
        const matchesTop = normItem(t.itemName) === normItem(oldName);
        return {
          ...t,
          itemName: matchesTop ? newName : t.itemName,
          items: Array.isArray(t.items)
            ? t.items.map((it) =>
                normItem(it.itemName) === normItem(oldName)
                  ? { ...it, itemName: newName }
                  : it
              )
            : t.items,
        };
      }),
      stockAdjustments: (d.stockAdjustments || []).map((a) =>
        normItem(a.itemName) === normItem(oldName) ? { ...a, itemName: newName } : a
      ),
    }),
    (nd) => Promise.all([
      ...nd.transactions
        .filter((t) => {
          const items = Array.isArray(t.items) && t.items.length > 0 ? t.items : [{ itemName: t.itemName }];
          return items.some((it) => normItem(it.itemName) === normItem(newName));
        })
        .map((tx) => sbSaveTransaction(tx, user.id)),
      ...nd.stockAdjustments
        .filter((a) => normItem(a.itemName) === normItem(newName))
        .map((adj) => sbSaveStockAdjustment(adj, user.id)),
    ])
    );

  // ── Delete all transactions and adjustments for an inventory item ──────────
  const deleteInventoryItem = (itemName) => {
    // Capture IDs in closure variables so they are available to the supabaseOperation
    // without polluting the returned data state with extra keys.
    let txIdsToDelete = [];
    let adjIdsToDelete = [];
    update(
      (d) => {
        txIdsToDelete = d.transactions
          .filter((t) => {
            const itemList = Array.isArray(t.items) && t.items.length > 0
              ? t.items : [{ itemName: t.itemName }];
            return itemList.some((it) => normItem(it.itemName) === normItem(itemName));
          })
          .map((t) => t.id);
        adjIdsToDelete = (d.stockAdjustments || [])
          .filter((a) => normItem(a.itemName) === normItem(itemName))
          .map((a) => a.id);
        return {
          ...d,
          transactions: d.transactions.filter((t) => {
            const itemList = Array.isArray(t.items) && t.items.length > 0
              ? t.items : [{ itemName: t.itemName }];
            return !itemList.some((it) => normItem(it.itemName) === normItem(itemName));
          }),
          stockAdjustments: (d.stockAdjustments || []).filter(
            (a) => normItem(a.itemName) !== normItem(itemName)
          ),
        };
      },
      () => Promise.all([
        ...txIdsToDelete.map((id) => sbDeleteTransaction(id)),
        ...adjIdsToDelete.map((id) => sbDeleteStockAdjustment(id)),
      ])
    );
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const navItems = [
    { key: "penjualan",   label: "Penjualan",        icon: "income",   badge: penjualanBadge },
    { key: "pembelian",   label: "Pembelian",         icon: "expense",  badge: pembelianBadge },
    { key: "inventory",   label: "Inventaris",        icon: "inventory", badge: alertCount },
    { key: "contacts",    label: "Kontak",            icon: "contacts" },
    { key: "reports",     label: "Laporan",           icon: "reports" },
    { key: "outstanding", label: "Piutang & Hutang",  icon: "warning",  badge: outstandingBadge },
    { key: "settings",    label: "Pengaturan",        icon: "settings" },
    ...(profile?.role === "owner"
      ? [{ key: "activityLog", label: "Log Aktivitas", icon: "clock" }]
      : []),
  ];

  /**
   * "Lihat" button in Inventory.js — navigates to Reports pre-filtered to all-time for that item.
   * Sets reportItemFilter which Reports reads on mount, then immediately clears via onClearItemFilter.
   */
  const handleViewItem = (itemName) => {
    setReportItemFilter(itemName);
    setPage("reports");
  };

  const navigateToOutstanding = (txIds) => {
    setOutstandingHighlight(txIds);
    setPage("outstanding");
  };

  // Print routing: checks printerType before opening A4 or dot matrix modal
  const handleInvoice = (txOrArray) => {
    if (data.settings.printerType === "Dot Matrix") {
      setDotMatrixData({ transaction: txOrArray, mode: "invoice" });
    } else {
      setInvoiceTxs(txOrArray);
    }
  };

  const handleSuratJalan = (tx) => {
    if (data.settings.printerType === "Dot Matrix") {
      setDotMatrixData({ transaction: tx, mode: "suratJalan" });
    } else {
      setSuratJalanTx(tx);
    }
  };

  // ── Quick Export (backup banner inline download) ─────────────────────────
  const quickExport = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BukuKas_Backup_${today()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const now = new Date().toISOString();
      const newSettings = { ...data.settings, lastExportDate: now };
      update(
        (d) => ({ ...d, settings: newSettings }),
        () => Promise.all([
          sbSaveSettings(newSettings, user.id),
          logActivity('export', 'settings', 'singleton', {}),
        ])
      );
    } catch (err) {
      console.error("quickExport failed:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, user, logActivity]);

  // ── Backup Warning Logic ──────────────────────────────────────────────────
  const lastExport = data.settings.lastExportDate;
  const daysSinceExport = lastExport
    ? (new Date().getTime() - new Date(lastExport).getTime()) / (1000 * 3600 * 24)
    : Infinity;
  const showBackupWarning = profile?.role === "owner" && daysSinceExport > 7;

  // ── Auth gate (after all hooks) ───────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 12, background: "#f0f6ff" }}>
        <div style={{ fontSize: 32 }}>📒</div>
        <div style={{ color: "#1e3a5f", fontWeight: 600 }}>Memuat...</div>
      </div>
    );
  }
  if (!user) return <Login />;

  // ── App data loading gate ─────────────────────────────────────────────────
  if (appLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
        <div className="spinner" />
        <p style={{ color: "#1e3a5f", fontWeight: 600, margin: 0 }}>Memuat data...</p>
      </div>
    );
  }

  if (databasePaused) return <DatabasePausedScreen />;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : "sidebar--closed"}`} aria-label="Navigasi">
        {/* Logo */}
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon" aria-hidden="true">📒</div>
          {sidebarOpen && (
            <div>
              <div className="sidebar__biz-name">BukuKas</div>
              <div className="sidebar__biz-sub">Pembukuan Digital</div>
            </div>
          )}
        </div>

        {/* Business name */}
        {sidebarOpen && (
          <div className="sidebar__meta">
            <div className="sidebar__meta-label">Bisnis</div>
            <div className="sidebar__meta-value">{data.settings.businessName}</div>
          </div>
        )}

        {/* Quick AR / AP snapshot */}
        {sidebarOpen && (globalAR > 0 || globalAP > 0) && (
          <div className="sidebar__ar-ap">
            {globalAR > 0 && (
              <div>
                <div className="sidebar__ar-ap-label" style={{ color: "#6ee7b7" }}>💚 Piutang</div>
                <div className="sidebar__ar-ap-val">{fmtIDR(globalAR)}</div>
              </div>
            )}
            {globalAP > 0 && (
              <div>
                <div className="sidebar__ar-ap-label" style={{ color: "#fca5a5" }}>❤️ Hutang</div>
                <div className="sidebar__ar-ap-val">{fmtIDR(globalAP)}</div>
              </div>
            )}
          </div>
        )}

        {/* Nav links */}
        <nav className="sidebar__nav" aria-label="Menu utama">
          {navItems.map((item) => (
            <div
              key={item.key}
              onClick={() => setPage(item.key)}
              className={`nav-item ${page === item.key ? "nav-item--active" : ""}`}
              role="button"
              tabIndex={0}
              aria-current={page === item.key ? "page" : undefined}
              aria-label={item.label}
              onKeyDown={(e) => e.key === "Enter" && setPage(item.key)}
            >
              <div className="nav-item__icon">
                <Icon
                  name={item.icon}
                  size={18}
                  color={page === item.key ? "#fff" : "#93c5fd"}
                />
              </div>
              {sidebarOpen && <span>{item.label}</span>}
              {item.badge > 0 && (
                <span className="nav-item__badge" aria-label={`${item.badge} peringatan`}>
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </nav>

        {/* Online users (presence) */}
        {sidebarOpen && USE_SUPABASE && onlineUsers.length > 0 && (
          <div className="presence-section">
            <div className="presence-label">Online sekarang</div>
            {[...onlineUsers].sort((a, b) => a.name.localeCompare(b.name, 'id')).map((u) => (
              <div key={u.id} className="presence-user">
                <span className="presence-dot" />
                <span>{u.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Collapse toggle + user info + logout */}
        <div className="sidebar__foot">
          <div
            onClick={() => setSidebarOpen((o) => !o)}
            className="sidebar__toggle"
            role="button"
            tabIndex={0}
            aria-label={sidebarOpen ? "Ciutkan sidebar" : "Buka sidebar"}
            onKeyDown={(e) => e.key === "Enter" && setSidebarOpen((o) => !o)}
          >
            <Icon name="menu" size={18} color="#93c5fd" />
            {sidebarOpen && <span>Ciutkan</span>}
          </div>
          {sidebarOpen && profile && (
            <div className="sidebar__user">
              <div className="sidebar__user-name">{profile.full_name || profile.email}</div>
              <div className="sidebar__user-role">
                {profile.role === "owner" ? "Pemilik" : "Karyawan"}
              </div>
            </div>
          )}
          <button
            className="btn-logout"
            onClick={signOut}
            title="Keluar"
            aria-label="Keluar dari akun"
          >
            <Icon name="warning" size={14} color="#fca5a5" />
            {sidebarOpen && <span>Keluar</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="main-content" aria-label="Konten utama">
        {/* ── Save Error Banner (localStorage mode only) ── */}
        {saveError && !USE_SUPABASE && (
          <div role="alert" style={{
            background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8,
            padding: "12px 16px", margin: "0 0 16px", display: "flex",
            alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div>
              <strong style={{ color: "#991b1b" }}>⚠️ Gagal menyimpan data!</strong>
              <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>
                Penyimpanan lokal (localStorage) mungkin penuh. Data Anda belum tersimpan.
                Segera ekspor backup dari halaman Pengaturan untuk menghindari kehilangan data.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={retrySave} className="btn btn-primary btn-sm">Coba Lagi</button>
              <button onClick={() => setPage("settings")} className="btn btn-outline btn-sm">Buka Pengaturan</button>
            </div>
          </div>
        )}

        {/* ── Backup Warning Banner ── */}
        {showBackupWarning && !backupBannerDismissed && (
          <div role="alert" className="backup-banner">
            <span className="backup-banner__text">
              ⚠️ Anda belum melakukan backup lebih dari 7 hari. Silakan ekspor data Anda di halaman Pengaturan.
              <span
                role="button"
                tabIndex={0}
                onClick={quickExport}
                onKeyDown={(e) => e.key === "Enter" && quickExport()}
                style={{ marginLeft: 4, color: "#007bff", fontWeight: 700, textDecoration: "underline", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Ekspor Sekarang
              </span>
            </span>
            <button
              onClick={() => setBackupBannerDismissed(true)}
              className="backup-banner__dismiss"
              aria-label="Tutup peringatan backup"
            >
              ✕
            </button>
          </div>
        )}

        {page === "penjualan" && (
          <Penjualan
            transactions={data.transactions}
            contacts={data.contacts}
            stockMap={stockMap}
            itemCatalog={data.itemCatalog || []}
            threshold={threshold}
            defaultDueDateDays={data.settings.defaultDueDateDays || 14}
            onAdd={addTransaction}
            onEdit={setEditTx}
            onDelete={deleteTransaction}
            onInvoice={handleInvoice}
            onMarkPaid={applyPayment}
            onCreateContact={createContact}
            onSuratJalan={handleSuratJalan}
            onNavigateOutstanding={navigateToOutstanding}
            onAddCatalogItem={addCatalogItem}
            onUpdateCatalogItem={updateCatalogItem}
            onUnarchiveCatalogItem={unarchiveCatalogItem}
            onUnarchiveSubtype={unarchiveSubtype}
            onUnarchiveContact={unarchiveContact}
            saved={saved}
            initViewDate={txPageHighlight?.date}
            highlightTxIds={txPageHighlight ? [txPageHighlight.txId] : null}
            onClearHighlight={() => setTxPageHighlight(null)}
          />
        )}
        {page === "pembelian" && (
          <Pembelian
            transactions={data.transactions}
            contacts={data.contacts}
            stockMap={stockMap}
            itemCatalog={data.itemCatalog || []}
            threshold={threshold}
            defaultDueDateDays={data.settings.defaultDueDateDays || 14}
            onAdd={addTransaction}
            onEdit={setEditTx}
            onDelete={deleteTransaction}
            onInvoice={handleInvoice}
            onMarkPaid={applyPayment}
            onCreateContact={createContact}
            onNavigateOutstanding={navigateToOutstanding}
            onAddCatalogItem={addCatalogItem}
            onUpdateCatalogItem={updateCatalogItem}
            onUnarchiveCatalogItem={unarchiveCatalogItem}
            onUnarchiveSubtype={unarchiveSubtype}
            onUnarchiveContact={unarchiveContact}
            saved={saved}
            initViewDate={txPageHighlight?.date}
            highlightTxIds={txPageHighlight ? [txPageHighlight.txId] : null}
            onClearHighlight={() => setTxPageHighlight(null)}
          />
        )}
        {page === "inventory" && (
          <Inventory
            stockMap={stockMap}
            threshold={threshold}
            onViewItem={handleViewItem}
            onAddAdjustment={addStockAdjustment}
            onRenameItem={renameInventoryItem}
            onDeleteItem={deleteInventoryItem}
            onDeleteAdjustment={deleteStockAdjustment}
            itemCategories={data.itemCategories || []}
            onUpdateCategories={updateItemCategories}
            transactions={data.transactions}
            stockAdjustments={data.stockAdjustments || []}
            onStockReport={() => setShowStockReport(true)}
            itemCatalog={data.itemCatalog || []}
            onAddCatalogItem={addCatalogItem}
            onUpdateCatalogItem={updateCatalogItem}
            onDeleteCatalogItem={deleteCatalogItem}
            onArchiveCatalogItem={archiveCatalogItem}
            onUnarchiveCatalogItem={unarchiveCatalogItem}
            onArchiveSubtype={archiveSubtype}
            onUnarchiveSubtype={unarchiveSubtype}
            onNavigateToArchive={() => setPage("archivedItems")}
          />
        )}
        {page === "archivedItems" && (
          <ArchivedItems
            itemCatalog={data.itemCatalog || []}
            stockMap={stockMap}
            transactions={data.transactions}
            onUnarchiveCatalogItem={unarchiveCatalogItem}
            onUnarchiveSubtype={unarchiveSubtype}
            onDeleteCatalogItem={deleteCatalogItem}
            onViewItem={handleViewItem}
            onBack={() => setPage("inventory")}
          />
        )}
        {page === "contacts" && (
          <Contacts
            contacts={data.contacts}
            transactions={data.transactions}
            balanceMap={balanceMap}
            onAddContact={(c) => {
              const newC = { ...c, archived: false };
              update(
                (d) => {
                  if (d.contacts.some((x) => x.name.toLowerCase() === newC.name.toLowerCase())) return d;
                  return { ...d, contacts: [...d.contacts, newC] };
                },
                (nd) => {
                  const wasAdded = nd.contacts.some((x) => x.id === newC.id);
                  return wasAdded ? sbSaveContact(newC, user.id) : Promise.resolve();
                }
              );
            }}
            onUpdateContact={updateContact}
            onDeleteContact={deleteContact}
            onArchiveContact={archiveContact}
            onUnarchiveContact={unarchiveContact}
            onNavigateToArchive={() => setPage("archivedContacts")}
            onDeleteTransaction={deleteTransaction}
            onEditTransaction={setEditTx}
            onMarkPaid={applyPayment}
          />
        )}
        {page === "archivedContacts" && (
          <ArchivedContacts
            contacts={data.contacts}
            transactions={data.transactions}
            onUnarchiveContact={unarchiveContact}
            onDeleteContact={deleteContact}
            onBack={() => setPage("contacts")}
          />
        )}
        {page === "reports" && (
          <Reports
            transactions={data.transactions}
            contacts={data.contacts}
            settings={data.settings}
            onInvoice={handleInvoice}
            onReport={setReportState}
            initItemFilter={reportItemFilter}
            onClearItemFilter={() => setReportItemFilter(null)}
            profile={profile}
          />
        )}
        {page === "outstanding" && (
          <Outstanding
            transactions={data.transactions}
            onEdit={setEditTx}
            onMarkPaid={applyPayment}
            onDelete={deleteTransaction}
            onInvoice={handleInvoice}
            highlightTxIds={outstandingHighlight}
            onClearHighlight={() => setOutstandingHighlight(null)}
          />
        )}
        {page === "settings" && (
          <Settings
            settings={data.settings}
            transactions={data.transactions}
            data={data}
            onSave={(s) => update(
              (d) => ({ ...d, settings: s }),
              () => Promise.all([
                sbSaveSettings(s, user.id),
                logActivity('edit', 'settings', 'singleton', {}),
              ])
            )}
            onImport={handleImport}
          />
        )}
        {page === "activityLog" && profile?.role === "owner" && (
          <ActivityLog
            currentUser={user}
            profile={profile}
            onLoadLog={sbLoadActivityLog}
            onBack={() => setPage("penjualan")}
            onViewTransaction={(entityId) => {
              const tx = data.transactions.find((t) => t.txnId === entityId)
                      || data.transactions.find((t) => t.id === entityId);
              if (tx) {
                setTxPageHighlight({ txId: tx.id, date: tx.date });
                setPage(tx.type === "income" ? "penjualan" : "pembelian");
              }
            }}
          />
        )}
      </main>

      {/* ── Global modals ── */}
      {editTx && (
        <EditModal
          transaction={editTx}
          contacts={data.contacts}
          transactions={data.transactions}
          stockMap={stockMap}
          itemCatalog={data.itemCatalog || []}
          onSave={editTransaction}
          onClose={() => setEditTx(null)}
          onCreateContact={createContact}
          onAddCatalogItem={addCatalogItem}
          onUpdateCatalogItem={updateCatalogItem}
          onUnarchiveCatalogItem={unarchiveCatalogItem}
          onUnarchiveSubtype={unarchiveSubtype}
          onUnarchiveContact={unarchiveContact}
        />
      )}
      {invoiceTxs && (
        <InvoiceModal
          transactions={invoiceTxs}
          settings={data.settings}
          contacts={data.contacts}
          onClose={() => setInvoiceTxs(null)}
        />
      )}
      {suratJalanTx && (
        <SuratJalanModal
          transaction={suratJalanTx}
          settings={data.settings}
          contacts={data.contacts}
          onClose={() => setSuratJalanTx(null)}
        />
      )}
      {reportState && (
        <ReportModal
          transactions={reportState.transactions}
          settings={data.settings}
          dateFrom={reportState.dateFrom}
          dateTo={reportState.dateTo}
          onClose={() => setReportState(null)}
        />
      )}
      {showStockReport && (
        <StockReportModal
          stockMap={stockMap}
          categories={data.itemCategories || []}
          settings={data.settings}
          transactions={data.transactions}
          stockAdjustments={data.stockAdjustments || []}
          onClose={() => setShowStockReport(false)}
        />
      )}
      {dotMatrixData && (
        <DotMatrixPrintModal
          transaction={dotMatrixData.transaction}
          mode={dotMatrixData.mode}
          settings={data.settings}
          contacts={data.contacts}
          onClose={() => setDotMatrixData(null)}
        />
      )}
      {saveErrorModal && (
        <SaveErrorModal
          message={saveErrorModal.message}
          onRetry={() => {
            setSaveErrorModal(null);
            saveErrorModal.retryFn?.();
          }}
          onDismiss={() => setSaveErrorModal(null)}
        />
      )}
      {showConflictModal && (
        <ConflictModal
          updatedBy={conflictUpdatedBy}
          onClose={() => { setShowConflictModal(false); setConflictUpdatedBy(''); }}
        />
      )}
      {showPasswordChange && (
        <PasswordChangeModal
          onSubmit={async (newPassword) => {
            await updatePassword(newPassword);
            setShowPasswordChange(false);
            setToast("Kata sandi berhasil diubah.");
          }}
        />
      )}
      {toast && <Toast message={toast} type="error" onDone={() => setToast(null)} />}
    </div>
  );
}