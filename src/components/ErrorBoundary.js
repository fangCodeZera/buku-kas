/**
 * components/ErrorBoundary.js
 * Catches unhandled React render errors and attempts auto-recovery.
 *
 * Auto-recovery: waits 3 seconds then resets hasError → re-renders children.
 * If the error was transient (Supabase reconnect, realtime timeout), the app
 * recovers silently. If persistent (same error re-throws), the error screen
 * reappears and the user can manually retry or do a full reload.
 *
 * Max 3 auto-retry attempts before giving up and showing only manual options.
 */
import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
    this._retryTimer = null;
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Auto-retry up to 3 times for transient errors
    if (this.state.retryCount < 3) {
      this._retryTimer = setTimeout(() => {
        this.setState((s) => ({
          hasError: false,
          retryCount: s.retryCount + 1,
        }));
      }, 3000);
    }
  }

  componentWillUnmount() {
    if (this._retryTimer) clearTimeout(this._retryTimer);
  }

  handleManualRetry = () => {
    if (this._retryTimer) clearTimeout(this._retryTimer);
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      const attemptsLeft = 3 - this.state.retryCount;
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            backgroundColor: "#f0f6ff",
            fontFamily: "sans-serif",
            padding: "24px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #c7ddf7",
              borderRadius: "12px",
              padding: "40px 32px",
              maxWidth: "420px",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
            <p
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#1e3a5f",
                margin: "0 0 8px 0",
              }}
            >
              Terjadi kesalahan yang tidak terduga.
            </p>
            <p
              style={{
                fontSize: "14px",
                color: "#6b7280",
                margin: "0 0 24px 0",
              }}
            >
              {attemptsLeft > 0
                ? "Mencoba memulihkan secara otomatis..."
                : "Silakan coba lagi atau muat ulang halaman."}
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={this.handleManualRetry}
                style={{
                  backgroundColor: "#007bff",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "10px 28px",
                  fontSize: "15px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Coba Lagi
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: "#fff",
                  color: "#6b7280",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "10px 28px",
                  fontSize: "15px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Muat Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
