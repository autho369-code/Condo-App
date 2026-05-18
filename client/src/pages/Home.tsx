import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Building2, BarChart3, Shield, Users, ArrowRight, Star, CheckCircle } from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      navigate("/dashboard");
    }
  }, [user, loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Star className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">Stellar PM</span>
        </div>
        <a
          href={getLoginUrl()}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Sign In <ArrowRight className="w-4 h-4" />
        </a>
      </header>

      {/* Hero */}
      <section className="px-8 py-20 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-6">
          <Star className="w-3.5 h-3.5" />
          Professional Property Management Platform
        </div>
        <h1 className="text-5xl font-bold text-foreground mb-6 leading-tight">
          Manage Every Association,<br />
          <span className="text-primary">From One Platform</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
          Stellar PM brings full accounting, reporting, vendor management, and role-based access control
          to HOA and association property managers — built on the AppFolio workflow you already know.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a
            href={getLoginUrl()}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all active:scale-95"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#features"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground px-6 py-3 rounded-lg border border-border hover:border-foreground/30 transition-colors"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-card py-8 px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-4 gap-8 text-center">
          {[
            { value: "370+", label: "GL Account Codes" },
            { value: "120+", label: "Report Types" },
            { value: "7", label: "Role Levels" },
            { value: "100%", label: "API-Enforced Access" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-primary">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-8 py-20 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-foreground mb-12">
          Everything You Need to Run Associations
        </h2>
        <div className="grid grid-cols-2 gap-6">
          {[
            {
              icon: Building2,
              title: "Association Management",
              desc: "Full HOA and condo association management with units, board members, architectural reviews, and budget tracking.",
              color: "text-blue-400",
              bg: "bg-blue-400/10",
            },
            {
              icon: BarChart3,
              title: "Full Accounting Suite",
              desc: "Receivables, payables, GL accounts, bank reconciliation, journal entries, and 370+ chart of accounts codes.",
              color: "text-purple-400",
              bg: "bg-purple-400/10",
            },
            {
              icon: Shield,
              title: "7-Tier Role Access",
              desc: "Super Admin → Company Admin → Portfolio Manager → Manager → Accountant/Assistant → Board Member. API-enforced at every level.",
              color: "text-green-400",
              bg: "bg-green-400/10",
            },
            {
              icon: Users,
              title: "Invitation Chain",
              desc: "Each role invites the next tier down with explicit property ID assignment. No unauthorized access, ever.",
              color: "text-orange-400",
              bg: "bg-orange-400/10",
            },
          ].map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors">
              <div className={`w-10 h-10 rounded-lg ${f.bg} flex items-center justify-center mb-4`}>
                <f.icon className={`w-5 h-5 ${f.color}`} />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Role overview */}
      <section className="px-8 py-16 bg-card border-y border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">Role Hierarchy</h2>
          <div className="grid grid-cols-7 gap-2">
            {[
              { role: "Super Admin", css: "role-super-admin", perms: "Full system access" },
              { role: "Company Admin", css: "role-company-admin", perms: "Company-wide" },
              { role: "Portfolio Mgr", css: "role-portfolio-manager", perms: "Assigned portfolios" },
              { role: "Manager", css: "role-manager", perms: "Assigned properties" },
              { role: "Accountant", css: "role-accountant", perms: "Same as Manager" },
              { role: "Assistant", css: "role-assistant", perms: "Same as Manager" },
              { role: "Board Member", css: "role-board-member", perms: "View only" },
            ].map((r, i) => (
              <div key={r.role} className="flex flex-col items-center text-center">
                <div className={`role-badge ${r.css} mb-2 w-full justify-center`}>{r.role}</div>
                <p className="text-xs text-muted-foreground">{r.perms}</p>
                {i < 6 && (
                  <div className="text-muted-foreground text-xs mt-1">↓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 py-20 text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">Ready to get started?</h2>
        <p className="text-muted-foreground mb-8">Sign in with your Manus account to access your dashboard.</p>
        <a
          href={getLoginUrl()}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all active:scale-95 text-lg"
        >
          Sign In to Stellar PM <ArrowRight className="w-5 h-5" />
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Stellar PM — Stellar Property Group
      </footer>
    </div>
  );
}
