import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
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
              Silakan muat ulang halaman untuk melanjutkan.
            </p>
            <button
              onClick={() => window.location.reload()}
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
              Muat Ulang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
