import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Building2,
  BarChart3,
  Shield,
  Users,
  ArrowRight,
  Star,
  Calendar,
  Mail,
  FileText,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";

const FEATURES = [
  {
    icon: Building2,
    title: "Association Management",
    desc: "Full HOA and condo association management with units, board members, architectural reviews, and budget tracking.",
  },
  {
    icon: BarChart3,
    title: "Full Accounting Suite",
    desc: "Receivables, payables, GL accounts, bank reconciliation, journal entries, and 370+ chart of accounts codes.",
  },
  {
    icon: FileText,
    title: "120+ Report Types",
    desc: "Balance sheets, income statements, delinquency reports, budget variance, owner ledgers, and every AppFolio-equivalent report.",
  },
  {
    icon: Shield,
    title: "7-Tier Role Access",
    desc: "Super Admin → Company Admin → Portfolio Manager → Manager → Accountant/Assistant → Board Member. API-enforced at every level.",
  },
  {
    icon: Users,
    title: "Invitation Chain",
    desc: "Each role invites the next tier down with explicit property assignment. No unauthorized access, ever.",
  },
  {
    icon: Briefcase,
    title: "Vendor & Owner Portal",
    desc: "Full vendor directory with insurance tracking, work history, and owner ledger views scoped to their own accounts only.",
  },
];

const ROLES = [
  {
    title: "Super Admin",
    level: "Level 7",
    desc: "Platform-wide visibility across all companies, invisible login, and full system management.",
  },
  {
    title: "Company Admin",
    level: "Level 6",
    desc: "Full control over all properties, portfolio managers, billing, and company-wide reporting.",
  },
  {
    title: "Portfolio Manager",
    level: "Level 5",
    desc: "Aggregate view across all assigned properties — tickets, accounting, schedules, and team metrics.",
  },
  {
    title: "Manager",
    level: "Level 4",
    desc: "Your property workspace: full 3-panel AppFolio-style dashboard with accounting, reports, vendors, and owners.",
  },
  {
    title: "Accountant / Assistant",
    level: "Level 3",
    desc: "Same property access as Manager, scoped to accounting tasks and support functions respectively.",
  },
  {
    title: "Board Member",
    level: "Level 2",
    desc: "View-only access to financials, meeting minutes, and association documents. No write permissions.",
  },
  {
    title: "Owner",
    level: "Level 1",
    desc: "Owners see only their own account — ledger, statements, and association notices.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$149",
    period: "/mo",
    sub: "Up to 3 associations",
    features: ["Association management", "Full accounting suite", "GL accounts (370+ codes)", "2 managers"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$349",
    period: "/mo",
    sub: "Up to 15 associations",
    features: ["Everything in Starter", "120+ report types", "Vendor directory", "Portfolio view", "10 managers"],
    cta: "Get Started",
    highlight: true,
  },
  {
    name: "Professional",
    price: "$749",
    period: "/mo",
    sub: "Up to 50 associations",
    features: ["Everything in Growth", "Scheduled reports", "Compliance module", "Board member portal", "Unlimited managers"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    sub: "Unlimited associations",
    features: ["Everything in Professional", "Dedicated onboarding", "SLA support", "Custom integrations", "Multi-company management"],
    cta: "Contact Sales",
    highlight: false,
  },
];

const FAQS = [
  {
    q: "Is Portier369 only for HOA associations?",
    a: "Portier369 is purpose-built for HOA and condominium association management. It is not designed for apartment or single-family rental portfolios.",
  },
  {
    q: "How does the role hierarchy work?",
    a: "Each role invites the next tier down via a secure invitation chain. A Super Admin invites Company Admins, who invite Portfolio Managers, who invite Managers — and so on. Property access is assigned at invitation time and enforced at the API level.",
  },
  {
    q: "What accounting features are included?",
    a: "Full receivables, payables, bank reconciliation, journal entries, GL accounts with 370+ codes, and 120+ report types including balance sheets, income statements, delinquency reports, and budget variance.",
  },
  {
    q: "Can Board Members see financial data?",
    a: "Yes — Board Members have view-only access to financials, meeting minutes, and association documents. They cannot create or modify any records.",
  },
  {
    q: "Is access enforced at the API level?",
    a: "Yes. Every tRPC procedure enforces role and property-scope checks server-side. Frontend role gates are a UX convenience only — the backend will reject any unauthorized request regardless.",
  },
];

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // No auto-redirect — landing page always shows first

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f0e8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "2px solid #2d4a2d", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f0e8", color: "#1a2e1a", fontFamily: "'Georgia', 'Times New Roman', serif" }}>

      {/* ── NAV ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(245,240,232,0.95)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid #d4c9b0",
        padding: "0 2rem", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, background: "#2d4a2d", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Star style={{ width: 14, height: 14, color: "#f5f0e8" }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", color: "#1a2e1a" }}>Portier369</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {[["Features", "#features"], ["Roles", "#roles"], ["Pricing", "#pricing"], ["FAQ", "#faq"]].map(([label, href]) => (
            <a key={label} href={href} style={{ fontSize: 14, color: "#4a5e4a", textDecoration: "none", fontFamily: "system-ui, sans-serif" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#1a2e1a")}
              onMouseLeave={e => (e.currentTarget.style.color = "#4a5e4a")}>
              {label}
            </a>
          ))}
          <a href={getLoginUrl()} style={{ fontSize: 14, color: "#4a5e4a", textDecoration: "none", fontFamily: "system-ui, sans-serif" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1a2e1a")}
            onMouseLeave={e => (e.currentTarget.style.color = "#4a5e4a")}>
            Sign In
          </a>
          <a href={getLoginUrl()} style={{
            fontSize: 13, fontWeight: 600, fontFamily: "system-ui, sans-serif",
            background: "#2d4a2d", color: "#f5f0e8",
            padding: "7px 16px", borderRadius: 6, textDecoration: "none",
            transition: "background 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "#1a2e1a")}
            onMouseLeave={e => (e.currentTarget.style.background = "#2d4a2d")}>
            Sign In to Portier369
          </a>
        </nav>
      </header>

      {/* ── HERO ── */}
      <section style={{ padding: "80px 2rem 60px", maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <div style={{
          display: "inline-block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
          textTransform: "uppercase", fontFamily: "system-ui, sans-serif",
          color: "#4a5e4a", border: "1px solid #b8c8b0", borderRadius: 4,
          padding: "4px 12px", marginBottom: 28,
        }}>
          HOA &amp; Association Property Management
        </div>
        <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 3.8rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: 24, color: "#1a2e1a", letterSpacing: "-0.02em" }}>
          Every association, account,<br />
          <span style={{ color: "#4a7a4a" }}>owner &amp; vendor</span><br />
          in one platform.
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: "#4a5e4a", marginBottom: 36, fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "0 auto 36px" }}>
          Portier369 is the purpose-built operations platform for HOA and condominium association management companies — built on the AppFolio workflow you already know.
        </p>
        {/* 4 Role Login Buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
          {[
            { label: "Admin Login", role: "admin", path: "/dashboard/super-admin", bg: "#1a2e1a", hover: "#0f1f0f" },
            { label: "Portfolio Manager Login", role: "portfolio_manager", path: "/dashboard/portfolio-manager", bg: "#2d4a2d", hover: "#1a2e1a" },
            { label: "Manager Login", role: "manager", path: "/dashboard/manager", bg: "#4a7a4a", hover: "#2d4a2d" },
            { label: "Board Member Login", role: "board_member", path: "/dashboard/board-member", bg: "#6a9a6a", hover: "#4a7a4a" },
          ].map(({ label, path, bg, hover }) => (
            <a key={label} href={getLoginUrl()} onClick={(e) => { e.preventDefault(); sessionStorage.setItem('loginReturnPath', path); window.location.href = getLoginUrl(); }} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: bg, color: "#f5f0e8",
              padding: "11px 20px", borderRadius: 8, fontWeight: 600,
              fontSize: 14, textDecoration: "none", fontFamily: "system-ui, sans-serif",
              transition: "background 0.15s, transform 0.1s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = hover)}
              onMouseLeave={e => (e.currentTarget.style.background = bg)}
              onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
              onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}>
              {label} <ArrowRight style={{ width: 14, height: 14 }} />
            </a>
          ))}
        </div>
        <a href="#features" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "transparent", color: "#2d4a2d",
          padding: "10px 20px", borderRadius: 8, fontWeight: 500,
          fontSize: 14, textDecoration: "none", fontFamily: "system-ui, sans-serif",
          border: "1px solid #b8c8b0", transition: "border-color 0.15s",
        }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "#2d4a2d")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "#b8c8b0")}>
          See All Features <ChevronDown style={{ width: 16, height: 16 }} />
        </a>
        <p style={{ marginTop: 16, fontSize: 13, color: "#7a8e7a", fontFamily: "system-ui, sans-serif" }}>
          White-glove HOA management · 6-tier role access · API-enforced permissions
        </p>
      </section>

      {/* ── STATS ── */}
      <section style={{ borderTop: "1px solid #d4c9b0", borderBottom: "1px solid #d4c9b0", padding: "32px 2rem", background: "#ede8dc" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, textAlign: "center" }}>
          {[
            { value: "370+", label: "GL Account Codes" },
            { value: "120+", label: "Report Types" },
            { value: "7", label: "Role Levels" },
            { value: "100%", label: "API-Enforced Access" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#1a2e1a", letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "#4a5e4a", marginTop: 4, fontFamily: "system-ui, sans-serif" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: "80px 2rem", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", fontFamily: "system-ui, sans-serif",
            color: "#4a5e4a", border: "1px solid #b8c8b0", borderRadius: 4,
            padding: "4px 12px", marginBottom: 16,
          }}>Platform Modules</div>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 800, color: "#1a2e1a", marginBottom: 12, letterSpacing: "-0.02em" }}>
            Everything your team needs
          </h2>
          <p style={{ fontSize: 16, color: "#4a5e4a", fontFamily: "system-ui, sans-serif", maxWidth: 520, margin: "0 auto" }}>
            Six integrated modules that replace five separate tools — purpose-built for association operations.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              background: "#ede8dc", border: "1px solid #d4c9b0", borderRadius: 12,
              padding: "24px 20px", transition: "border-color 0.15s, box-shadow 0.15s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#4a7a4a"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(45,74,45,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#d4c9b0"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}>
              <div style={{ width: 36, height: 36, background: "#d4c9b0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <f.icon style={{ width: 18, height: 18, color: "#2d4a2d" }} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a2e1a", marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "#4a5e4a", lineHeight: 1.6, fontFamily: "system-ui, sans-serif" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ROLES ── */}
      <section id="roles" style={{ padding: "80px 2rem", background: "#ede8dc", borderTop: "1px solid #d4c9b0", borderBottom: "1px solid #d4c9b0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{
              display: "inline-block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
              textTransform: "uppercase", fontFamily: "system-ui, sans-serif",
              color: "#4a5e4a", border: "1px solid #b8c8b0", borderRadius: 4,
              padding: "4px 12px", marginBottom: 16,
            }}>Role-Based Access</div>
            <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 800, color: "#1a2e1a", marginBottom: 12, letterSpacing: "-0.02em" }}>
              Built for every level of your organization
            </h2>
            <p style={{ fontSize: 16, color: "#4a5e4a", fontFamily: "system-ui, sans-serif" }}>
              From platform owner to individual board members — every user sees exactly what they need and nothing they don't.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ROLES.map((r) => (
              <div key={r.title} style={{
                background: "#f5f0e8", border: "1px solid #d4c9b0", borderRadius: 10,
                padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 16,
              }}>
                <div style={{ width: 32, height: 32, background: "#d4c9b0", borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Shield style={{ width: 15, height: 15, color: "#2d4a2d" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1a2e1a", marginBottom: 4 }}>{r.title}</div>
                  <div style={{ fontSize: 13, color: "#4a5e4a", lineHeight: 1.5, fontFamily: "system-ui, sans-serif" }}>{r.desc}</div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: "#4a5e4a", fontFamily: "system-ui, sans-serif",
                  background: "#d4c9b0", borderRadius: 4, padding: "3px 8px", flexShrink: 0,
                }}>{r.level}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: "80px 2rem", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", fontFamily: "system-ui, sans-serif",
            color: "#4a5e4a", border: "1px solid #b8c8b0", borderRadius: 4,
            padding: "4px 12px", marginBottom: 16,
          }}>Transparent Pricing</div>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 800, color: "#1a2e1a", marginBottom: 12, letterSpacing: "-0.02em" }}>
            Simple plans that scale with you
          </h2>
          <p style={{ fontSize: 16, color: "#4a5e4a", fontFamily: "system-ui, sans-serif" }}>
            All plans include full role-based access control and API-enforced permissions. No setup fees.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {PLANS.map((p) => (
            <div key={p.name} style={{
              background: p.highlight ? "#2d4a2d" : "#ede8dc",
              border: `1px solid ${p.highlight ? "#2d4a2d" : "#d4c9b0"}`,
              borderRadius: 12, padding: "28px 20px",
              display: "flex", flexDirection: "column", gap: 0,
              position: "relative",
            }}>
              {p.highlight && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: "#c8a84b", color: "#1a2e1a", fontSize: 11, fontWeight: 700,
                  padding: "3px 12px", borderRadius: 20, fontFamily: "system-ui, sans-serif",
                  letterSpacing: "0.04em", textTransform: "uppercase",
                }}>Most Popular</div>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "system-ui, sans-serif", color: p.highlight ? "#a8c8a8" : "#4a5e4a", marginBottom: 12 }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: p.highlight ? "#f5f0e8" : "#1a2e1a", letterSpacing: "-0.02em" }}>{p.price}</span>
                <span style={{ fontSize: 14, color: p.highlight ? "#a8c8a8" : "#4a5e4a", fontFamily: "system-ui, sans-serif" }}>{p.period}</span>
              </div>
              <div style={{ fontSize: 13, color: p.highlight ? "#a8c8a8" : "#4a5e4a", fontFamily: "system-ui, sans-serif", marginBottom: 20 }}>{p.sub}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 8 }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: p.highlight ? "#d4e8d4" : "#4a5e4a", fontFamily: "system-ui, sans-serif" }}>
                    <Check style={{ width: 14, height: 14, color: p.highlight ? "#a8c8a8" : "#4a7a4a", flexShrink: 0, marginTop: 1 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <a href={getLoginUrl()} style={{
                display: "block", textAlign: "center",
                background: p.highlight ? "#f5f0e8" : "#2d4a2d",
                color: p.highlight ? "#1a2e1a" : "#f5f0e8",
                padding: "10px 0", borderRadius: 7, fontWeight: 600,
                fontSize: 14, textDecoration: "none", fontFamily: "system-ui, sans-serif",
                transition: "opacity 0.15s",
                marginTop: "auto",
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: "80px 2rem", background: "#ede8dc", borderTop: "1px solid #d4c9b0" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{
              display: "inline-block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
              textTransform: "uppercase", fontFamily: "system-ui, sans-serif",
              color: "#4a5e4a", border: "1px solid #b8c8b0", borderRadius: 4,
              padding: "4px 12px", marginBottom: 16,
            }}>FAQ</div>
            <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 800, color: "#1a2e1a", letterSpacing: "-0.02em" }}>
              Common questions
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FAQS.map((f, i) => (
              <div key={i} style={{ background: "#f5f0e8", border: "1px solid #d4c9b0", borderRadius: 10, overflow: "hidden" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%", textAlign: "left", padding: "16px 20px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 15, fontWeight: 600, color: "#1a2e1a",
                    fontFamily: "Georgia, serif",
                  }}>
                  {f.q}
                  {openFaq === i
                    ? <ChevronUp style={{ width: 16, height: 16, color: "#4a5e4a", flexShrink: 0 }} />
                    : <ChevronDown style={{ width: 16, height: 16, color: "#4a5e4a", flexShrink: 0 }} />}
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 20px 16px", fontSize: 14, color: "#4a5e4a", lineHeight: 1.6, fontFamily: "system-ui, sans-serif" }}>
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: "80px 2rem", textAlign: "center", background: "#f5f0e8", borderTop: "1px solid #d4c9b0" }}>
        <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 800, color: "#1a2e1a", marginBottom: 12, letterSpacing: "-0.02em" }}>
          Ready to elevate your operations?
        </h2>
        <p style={{ fontSize: 16, color: "#4a5e4a", fontFamily: "system-ui, sans-serif", marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
          Join association management companies that trust Portier369 to run their portfolios with precision and care.
        </p>
        <a href={getLoginUrl()} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#2d4a2d", color: "#f5f0e8",
          padding: "14px 32px", borderRadius: 8, fontWeight: 600,
          fontSize: 16, textDecoration: "none", fontFamily: "system-ui, sans-serif",
          transition: "background 0.15s, transform 0.1s",
        }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1a2e1a")}
          onMouseLeave={e => (e.currentTarget.style.background = "#2d4a2d")}
          onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}>
          Sign In to Portier369 <ArrowRight style={{ width: 18, height: 18 }} />
        </a>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid #d4c9b0", padding: "24px 2rem", background: "#ede8dc" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 22, height: 22, background: "#2d4a2d", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Star style={{ width: 11, height: 11, color: "#f5f0e8" }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1a2e1a" }}>Portier369</span>
          </div>
          <div style={{ fontSize: 13, color: "#7a8e7a", fontFamily: "system-ui, sans-serif" }}>
            Purpose-built for HOA and association property management.
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            {[["Features", "#features"], ["Pricing", "#pricing"], ["FAQ", "#faq"]].map(([label, href]) => (
              <a key={label} href={href} style={{ fontSize: 13, color: "#4a5e4a", textDecoration: "none", fontFamily: "system-ui, sans-serif" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#1a2e1a")}
                onMouseLeave={e => (e.currentTarget.style.color = "#4a5e4a")}>
                {label}
              </a>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#9aaa9a", fontFamily: "system-ui, sans-serif" }}>
          © {new Date().getFullYear()} Portier369 — Portier369
        </div>
      </footer>

    </div>
  );
}
