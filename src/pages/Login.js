// Phase 3: Login page for BukuKas.
// Email + password authentication only. No registration — users are invited by admin.
// All UI text in Indonesian.

import React, { useState } from "react";
import { useAuth } from "../utils/AuthContext";
import Icon from "../components/Icon";

const APP_NAME = "BukuKas";

export default function Login() {
  const { signIn, resetPassword, idleTimedOut, clearIdleTimedOut } = useAuth();
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [error,        setError]        = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail,         setResetEmail]         = useState("");
  const [resetStatus,        setResetStatus]        = useState(null); // null | "sending" | "sent" | "error"
  const [resetError,         setResetError]         = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await signIn(email.trim(), password);
      clearIdleTimedOut(); // clear idle flag after successful re-login
      // On success, AuthContext updates user state — App re-renders automatically
    } catch (err) {
      if (!err) {
        setError("Gagal terhubung. Periksa koneksi internet Anda.");
      } else if (
        err.message === "Invalid login credentials" ||
        err.message?.includes("invalid_credentials") ||
        err.status === 400
      ) {
        setError("Email atau kata sandi salah. Silakan coba lagi.");
      } else if (err.message?.toLowerCase().includes("network") || err.status === 0) {
        setError("Gagal terhubung. Periksa koneksi internet Anda.");
      } else if (err.message?.toLowerCase().includes("not activ") || err.message?.toLowerCase().includes("inactive")) {
        setError("Akun Anda tidak aktif. Hubungi administrator.");
      } else {
        setError("Email atau kata sandi salah. Silakan coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetStatus === "sending") return;
    setResetStatus("sending");
    setResetError("");
    try {
      await resetPassword(resetEmail.trim());
      setResetStatus("sent");
    } catch (err) {
      setResetError(err.message || "Gagal mengirim link reset. Coba lagi.");
      setResetStatus("error");
    }
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setResetStatus(null);
    setResetError("");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo / title — shown in both login and forgot-password views */}
        <div className="login-logo" aria-hidden="true">📒</div>
        <h1 className="login-title">{APP_NAME}</h1>
        <p className="login-subtitle">Pembukuan Digital Usaha Keluarga</p>

        {idleTimedOut && (
          <div
            role="alert"
            style={{
              backgroundColor: "#fffbeb",
              border: "1px solid #f59e0b",
              borderRadius: "6px",
              color: "#f59e0b",
              fontSize: "13px",
              padding: "10px 14px",
              marginBottom: "16px",
              lineHeight: "1.5",
              textAlign: "center",
            }}
          >
            Sesi Anda telah berakhir karena tidak aktif. Silakan masuk kembali.
          </div>
        )}

        {showForgotPassword ? (
          /* ── Forgot password view ────────────────────────────────────────── */
          <>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, textAlign: "center" }}>
              Masukkan email Anda untuk mengatur ulang kata sandi.
            </p>

            {resetStatus === "sent" ? (
              <div
                role="alert"
                style={{
                  color: "#059669",
                  backgroundColor: "#d1fae5",
                  border: "1px solid #10b981",
                  borderRadius: 6,
                  padding: "10px 14px",
                  fontSize: 13,
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                Link reset kata sandi telah dikirim ke email Anda. Periksa kotak masuk Anda.
              </div>
            ) : (
              <form onSubmit={handleResetPassword} noValidate>
                <div className="login-field">
                  <label htmlFor="reset-email" className="login-label">Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    className="form-input"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="nama@email.com"
                    autoComplete="email"
                    autoFocus
                    required
                    disabled={resetStatus === "sending"}
                  />
                </div>

                {resetStatus === "error" && (
                  <div className="login-error" role="alert">{resetError}</div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary login-btn"
                  disabled={resetStatus === "sending" || !resetEmail.trim()}
                >
                  {resetStatus === "sending" ? "Mengirim..." : "Kirim Link Reset"}
                </button>
              </form>
            )}

            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                type="button"
                onClick={handleBackToLogin}
                style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 13 }}
              >
                ← Kembali ke Login
              </button>
            </div>
          </>
        ) : (
          /* ── Login view ──────────────────────────────────────────────────── */
          <form onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="login-email" className="login-label">Email</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                autoComplete="email"
                autoFocus
                required
                disabled={submitting}
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password" className="login-label">Kata Sandi</label>
              <div className="login-password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={submitting}
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  tabIndex={-1}
                >
                  <Icon name="eye" size={16} color={showPassword ? "#007bff" : "#9ca3af"} />
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary login-btn"
              disabled={submitting || !email.trim() || !password}
            >
              {submitting ? "Memproses..." : "Masuk"}
            </button>

            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                type="button"
                onClick={() => { setShowForgotPassword(true); setResetEmail(email); }}
                style={{ background: "none", border: "none", color: "#007bff", cursor: "pointer", fontSize: 13 }}
              >
                Lupa Password?
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
