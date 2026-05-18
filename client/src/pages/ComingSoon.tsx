import { useLocation } from "wouter";

interface ComingSoonProps {
  role: string;
}

export default function ComingSoon({ role }: ComingSoonProps) {
  const [, navigate] = useLocation();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f5f0e8",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      padding: "2rem",
      textAlign: "center",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
        <div style={{
          width: 36, height: 36, background: "#2d4a2d", borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ color: "#f5f0e8", fontSize: 18, fontWeight: 700 }}>P</span>
        </div>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#1a2e1a", letterSpacing: "-0.01em" }}>Portier369</span>
      </div>

      {/* Badge */}
      <div style={{
        display: "inline-block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "#4a5e4a", border: "1px solid #b8c8b0",
        borderRadius: 4, padding: "4px 12px", marginBottom: 24,
      }}>
        {role}
      </div>

      {/* Heading */}
      <h1 style={{
        fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 800, color: "#1a2e1a",
        letterSpacing: "-0.02em", marginBottom: 16, lineHeight: 1.1,
      }}>
        Coming Soon
      </h1>

      <p style={{
        fontSize: 17, color: "#4a5e4a", lineHeight: 1.6,
        maxWidth: 480, marginBottom: 40,
      }}>
        The <strong>{role}</strong> portal is currently under development. 
        It will be available in an upcoming release.
      </p>

      {/* Divider */}
      <div style={{ width: 48, height: 2, background: "#b8c8b0", borderRadius: 2, marginBottom: 40 }} />

      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        style={{
          background: "#2d4a2d", color: "#f5f0e8",
          border: "none", borderRadius: 8,
          padding: "12px 28px", fontSize: 15, fontWeight: 600,
          cursor: "pointer", transition: "background 0.15s, transform 0.1s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "#1a2e1a")}
        onMouseLeave={e => (e.currentTarget.style.background = "#2d4a2d")}
        onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
        onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        ← Back to Portier369
      </button>
    </div>
  );
}
