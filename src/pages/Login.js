// Phase 3: Login page for BukuKas.
// Email + password authentication only. No registration — users are invited by admin.
// All UI text in Indonesian.

import React, { useState } from "react";
import { useAuth } from "../utils/AuthContext";

const APP_NAME = "BukuKas";

export default function Login() {
  const { signIn } = useAuth();
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [error,      setError]      = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await signIn(email.trim(), password);
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

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo / title */}
        <div className="login-logo" aria-hidden="true">📒</div>
        <h1 className="login-title">{APP_NAME}</h1>
        <p className="login-subtitle">Pembukuan Digital Usaha Keluarga</p>

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
            <input
              id="login-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi"
              autoComplete="current-password"
              required
              disabled={submitting}
            />
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
        </form>
      </div>
    </div>
  );
}
