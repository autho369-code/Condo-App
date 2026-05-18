import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div style={{ minHeight: "100vh", background: "#f5f0e8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        background: "#faf7f2",
        border: "1px solid #d4c9b0",
        borderRadius: 16,
        padding: "48px 40px",
        maxWidth: 440,
        width: "100%",
        margin: "0 16px",
        textAlign: "center",
        boxShadow: "0 4px 24px rgba(26,46,26,0.08)",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(138,58,42,0.10)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
        }}>
          <span style={{ fontSize: 28, color: "#8a3a2a" }}>!</span>
        </div>

        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 48, fontWeight: 700, color: "#1a2e1a", lineHeight: 1 }}>
          404
        </div>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 600, color: "#1a2e1a", margin: "12px 0 8px" }}>
          Page Not Found
        </div>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: "#4a5e4a", lineHeight: 1.6, marginBottom: 32 }}>
          The page you're looking for doesn't exist or has been moved.
        </p>

        <button
          onClick={() => setLocation("/")}
          style={{
            background: "#2d4a2d", color: "#f5f0e8",
            border: "none", borderRadius: 8,
            padding: "10px 28px", fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "system-ui, sans-serif",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1a2e1a")}
          onMouseLeave={e => (e.currentTarget.style.background = "#2d4a2d")}
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
