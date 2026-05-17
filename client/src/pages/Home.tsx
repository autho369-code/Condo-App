import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Building2, ChevronDown, ChevronRight, Menu, X,
  BarChart3, Briefcase, Users, ArrowRight,
  Shield, FileText, Wrench, MessageSquare, DollarSign, Zap,
  CheckCircle2, AlertCircle, Calendar, Bell, ClipboardCheck,
  AlertTriangle
} from "lucide-react";
import { Link } from "wouter";
import { AccessModal } from "@/components/AccessModal";

/* ─── Easing ─────────────────────────────────────────────────────── */
const EASE = [0.23, 1, 0.32, 1] as [number, number, number, number];

const fadeUp = {
  hidden: { opacity: 0, y: 36 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.65, ease: EASE }
  }),
};

/* ─── Login portals ──────────────────────────────────────────────── */
const LOGIN_PORTALS = [
  { role: "company_admin",     label: "Company Admin",     desc: "Full operational oversight and reporting",    icon: Building2, color: "text-teal" },
  { role: "portfolio_manager", label: "Portfolio Manager", desc: "Aggregate view across all properties",        icon: BarChart3, color: "text-blue-400" },
  { role: "property_manager",  label: "Property Manager",  desc: "Daily workflow execution and operations",     icon: Briefcase, color: "text-amber-400" },
  { role: "owner",             label: "Owner Portal",      desc: "Financials, documents, and communications",  icon: Users,    color: "text-emerald-400" },
];

/* ─── Live ops items ─────────────────────────────────────────────── */
const OPS_ITEMS = [
  { icon: CheckCircle2,  text: "3 violations resolved",               sub: "Unit 4B, 12A, 7C",          color: "text-emerald-400", dot: "bg-emerald-400", time: "2m ago" },
  { icon: CheckCircle2,  text: "Elevator reservation approved",       sub: "Penthouse — Sat 10am",       color: "text-emerald-400", dot: "bg-emerald-400", time: "14m ago" },
  { icon: Bell,          text: "Reserve study reminder triggered",    sub: "Annual review due Q3",       color: "text-amber-400",   dot: "bg-amber-400",   time: "1h ago" },
  { icon: AlertTriangle, text: "Vendor insurance expiring in 14 days",sub: "Apex Plumbing Inc.",         color: "text-rose-400",    dot: "bg-rose-400",    time: "2h ago" },
  { icon: ClipboardCheck,text: "Board packet generated",              sub: "June AGM — 47 pages",        color: "text-blue-400",    dot: "bg-blue-400",    time: "3h ago" },
  { icon: AlertCircle,   text: "Water shutoff notices delivered",     sub: "All 84 units notified",      color: "text-teal",        dot: "bg-teal",        time: "5h ago" },
];

/* ─── Operational modules ────────────────────────────────────────── */
const MODULES = [
  { icon: Shield,      title: "Governance & Compliance",  desc: "Violation tracking, hearing workflows, architectural review, audit logs." },
  { icon: Wrench,      title: "Maintenance Intelligence", desc: "Vendor coordination, service requests, preventive scheduling, work order visibility." },
  { icon: Users,       title: "Owner Experience",         desc: "Announcements, approvals, reservations, notices, digital communication." },
  { icon: FileText,    title: "Board Operations",         desc: "Meeting packets, agendas, voting preparation, financial visibility." },
  { icon: DollarSign,  title: "Financial Oversight",      desc: "Assessment tracking, reporting, reserves, banking visibility." },
  { icon: Zap,         title: "Automation Layer",         desc: "Reminders, escalations, notices, recurring workflows, compliance triggers." },
];

/* ─── Roles ──────────────────────────────────────────────────────── */
const ROLES = [
  { label: "Executive Management", desc: "Portfolio oversight, escalations, financial visibility, compliance tracking." },
  { label: "Property Managers",    desc: "Daily operations, violations, vendors, notices, scheduling." },
  { label: "Board Members",        desc: "Approvals, reporting, meeting visibility, governance access." },
  { label: "Owners",               desc: "Requests, announcements, reservations, documents, payments." },
];

/* ─── FAQs ───────────────────────────────────────────────────────── */
const FAQS = [
  {
    q: "Is Portier369 built specifically for condominiums and HOAs?",
    a: "Yes. Every workflow, permission layer, and operational module was designed around the specific realities of condominium associations, HOA communities, and professional management firms — not generic leasing or apartment management.",
  },
  {
    q: "How does the invite-only access hierarchy work?",
    a: "Portier369 operates on a strict five-level hierarchy. Your company receives access from Portier369. Company Admins invite Portfolio Managers. Portfolio Managers invite Property Managers. Property Managers invite sub-users — accountants, assistants, owners, and vendors. No one self-registers.",
  },
  {
    q: "What does white-glove onboarding include?",
    a: "Every deployment includes guided setup, workflow configuration, data migration assistance, permission structuring, staff training, and operational consulting. You will not be handed a login and left to figure it out.",
  },
  {
    q: "Can Portier369 be white-labeled for our firm?",
    a: "Yes. Enterprise deployments include custom branding — your logo, your colors, your domain — so your clients interact with your platform, not ours.",
  },
  {
    q: "How is Portier369 different from AppFolio or Buildium?",
    a: "Those platforms were built for generic leasing workflows. Portier369 was engineered around the operational reality of condominium associations — violations, architectural reviews, board governance, vendor accountability, and compliance tracking. It is purpose-built.",
  },
];

/* ─── Component ──────────────────────────────────────────────────── */
export default function Home() {
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessPlan, setAccessPlan] = useState<string | undefined>(undefined);
  const loginRef = useRef<HTMLDivElement>(null);

  function openAccess(plan?: string) {
    setAccessPlan(plan);
    setAccessOpen(true);
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (loginRef.current && !loginRef.current.contains(e.target as Node)) setLoginOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ─── Navigation ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/96 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <Building2 style={{ width: "17px", height: "17px" }} className="text-gold" />
            </div>
            <span className="font-serif text-xl font-bold text-navy tracking-tight">
              Portier<span className="text-teal">369</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#operations" className="hover:text-navy transition-colors">Operations</a>
            <a href="#precision"  className="hover:text-navy transition-colors">Why Portier369</a>
            <a href="#access"     className="hover:text-navy transition-colors">Access</a>
            <a href="#faq"        className="hover:text-navy transition-colors">FAQ</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm" className="bg-navy text-cream hover:bg-navy-light">
                  Dashboard <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            ) : (
              <>
                <div className="relative" ref={loginRef}>
                  <button
                    onClick={() => setLoginOpen(!loginOpen)}
                    className="flex items-center gap-1.5 text-sm font-medium text-navy hover:text-teal transition-colors px-3 py-2 rounded-md hover:bg-muted"
                  >
                    Login
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${loginOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {loginOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.18, ease: EASE }}
                        className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-border overflow-hidden z-50"
                        style={{ transformOrigin: "top right" }}
                      >
                        <div className="px-4 pt-3.5 pb-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select your portal</p>
                        </div>
                        {LOGIN_PORTALS.map((portal) => (
                          <Link key={portal.role} href={`/login?role=${portal.role}`} onClick={() => setLoginOpen(false)}>
                            <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors cursor-pointer group">
                              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-white transition-colors">
                                <portal.icon className={`w-4 h-4 ${portal.color}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-navy">{portal.label}</p>
                                <p className="text-xs text-muted-foreground truncate">{portal.desc}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                        ))}
                        <div className="border-t border-border px-4 py-3">
                          <p className="text-xs text-muted-foreground">
                            New to Portier369?{" "}
                            <button onClick={() => openAccess()} className="text-teal font-medium hover:underline">Contact us for access</button>
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Button size="sm" onClick={() => openAccess()} className="bg-navy text-cream hover:bg-navy-light font-medium px-5">
                  Request Private Access
                </Button>
              </>
            )}
          </div>

          <button className="md:hidden p-2 rounded-md hover:bg-muted" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden overflow-hidden border-t border-border bg-white"
            >
              <div className="px-4 py-5 flex flex-col gap-1">
                {[["operations","Operations"],["precision","Why Portier369"],["access","Access"],["faq","FAQ"]].map(([id, label]) => (
                  <a key={id} href={`#${id}`} className="py-2.5 text-sm font-medium text-navy hover:text-teal transition-colors" onClick={() => setMobileOpen(false)}>{label}</a>
                ))}
                <div className="pt-3 border-t border-border mt-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Login as</p>
                  {LOGIN_PORTALS.map((p) => (
                    <Link key={p.role} href={`/login?role=${p.role}`} onClick={() => setMobileOpen(false)}>
                      <div className="flex items-center gap-3 py-2.5 hover:text-teal transition-colors">
                        <p.icon className={`w-4 h-4 ${p.color}`} />
                        <span className="text-sm font-medium text-navy">{p.label}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy" style={{ minHeight: "92vh" }}>
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.035]" style={{
          backgroundImage: "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
          backgroundSize: "120px 120px"
        }} />
        {/* Radial glows */}
        <div className="absolute top-0 right-0 w-[900px] h-[900px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 80% 10%, oklch(0.52 0.12 195 / 0.12) 0%, transparent 60%)" }} />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 20% 90%, oklch(0.72 0.13 78 / 0.07) 0%, transparent 60%)" }} />

        <div className="container relative flex items-center" style={{ minHeight: "92vh", paddingTop: "5rem", paddingBottom: "5rem" }}>
          <div className="grid lg:grid-cols-[1fr_460px] gap-16 xl:gap-24 items-center w-full">

            {/* Left — headline */}
            <div>
              <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={0}
                className="text-[10px] font-bold tracking-[0.3em] text-teal/60 uppercase mb-8">
                Private Operations Platform for Modern Communities
              </motion.p>

              <motion.h1 initial="hidden" animate="visible" variants={fadeUp} custom={1}
                className="font-serif font-bold text-cream leading-[1.02] tracking-tight"
                style={{ fontSize: "clamp(3rem, 6vw, 5.5rem)" }}>
                The Private<br />
                Operating System<br />
                <span className="gradient-text">For High-Standard<br />Communities.</span>
              </motion.h1>

              <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2}
                className="mt-10 text-xl text-cream/50 max-w-lg leading-[1.8]">
                Violations. Maintenance. Board operations. Owner communication. Compliance. Scheduling. Automation. One unified platform. One source of truth.
              </motion.p>

              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}
                className="mt-12 flex flex-wrap gap-4 items-center">
                <Button size="lg" onClick={() => openAccess()} className="bg-teal hover:bg-teal-light text-white font-semibold px-10 shadow-xl shadow-teal/20 transition-all"
                  style={{ height: "54px", fontSize: "15px" }}>
                  Request Private Access
                </Button>
                <Button size="lg" variant="outline" onClick={() => openAccess()}
                  className="border-white/20 text-cream hover:bg-white/8 bg-transparent font-medium"
                  style={{ height: "54px", fontSize: "15px", padding: "0 2.5rem" }}>
                  Schedule Executive Demo
                </Button>
              </motion.div>

              <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={4}
                className="mt-8 text-sm text-cream/25">
                <a href="#operations" className="hover:text-cream/50 transition-colors">
                  See how top management firms operate →
                </a>
              </motion.p>
            </div>

            {/* Right — Live Ops Panel */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}
              className="hidden lg:block">
              <div className="rounded-2xl overflow-hidden border border-white/10"
                style={{ background: "oklch(1 0 0 / 0.05)", backdropFilter: "blur(24px)" }}>

                {/* Panel header */}
                <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.22em] text-cream/40 uppercase">Live Community Operations</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
                    </span>
                    <span className="text-[10px] font-semibold text-teal/70 tracking-wide">LIVE</span>
                  </div>
                </div>

                {/* Ops items */}
                <div className="divide-y divide-white/[0.05]">
                  {OPS_ITEMS.map((item, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.1, duration: 0.45, ease: EASE }}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.04] transition-colors group"
                    >
                      {/* Status dot */}
                      <div className="relative flex-shrink-0">
                        <span className={`w-2 h-2 rounded-full ${item.dot} block`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-cream/80 leading-snug">{item.text}</p>
                        <p className="text-xs text-cream/30 mt-0.5">{item.sub}</p>
                      </div>
                      <span className="text-[10px] text-cream/20 flex-shrink-0 tabular-nums">{item.time}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Panel footer */}
                <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                  <p className="text-[10px] text-cream/20">Portier369 · Operational Command Center</p>
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1 h-1 rounded-full bg-white/20" />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Trust band ────────────────────────────────────────────── */}
      <section className="border-b border-border bg-white py-12">
        <div className="container">
          <p className="text-center text-sm text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Trusted by professional managers, condominium boards, and high-accountability communities across complex operations.
          </p>
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-3">
            {[
              "Board governance workflows",
              "Compliance-driven operations",
              "White-glove onboarding",
              "Enterprise-grade permissions",
              "Multi-property oversight",
            ].map((t) => (
              <span key={t} className="flex items-center gap-2 text-xs font-medium text-navy/50">
                <span className="w-1 h-1 rounded-full bg-teal inline-block" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Luxury statement section ──────────────────────────────── */}
      <section className="py-40 bg-background">
        <div className="container max-w-4xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-center">
            <p className="font-serif font-bold text-navy leading-[1.15] mb-10"
              style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}>
              Property management became fragmented.
            </p>
            <p className="text-xl text-muted-foreground leading-[1.9] mb-10">
              Emails. Vendors. Violations. Board approvals. Spreadsheets.<br />
              Owner complaints. Paper trails.
            </p>
            <p className="font-serif font-bold text-navy leading-[1.15] mb-10"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}>
              Portier369 brings structure, accountability,<br />
              and operational clarity back into one secure ecosystem.
            </p>
            <p className="text-lg text-muted-foreground/70">
              Built for communities that expect more than basic software.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── Operational Modules ───────────────────────────────────── */}
      <section id="operations" className="py-40 bg-muted/20">
        <div className="container">
          <div className="max-w-2xl mb-24">
            <p className="text-[10px] font-bold tracking-[0.22em] text-teal uppercase mb-5">Concierge-Level Operations</p>
            <h2 className="font-serif font-bold text-navy leading-[1.08]"
              style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}>
              One secure workspace for every operational layer of your community.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden">
            {MODULES.map((m, i) => (
              <motion.div key={m.title}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className="bg-white p-12 hover:bg-muted/20 transition-colors group"
              >
                <div className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center mb-8 group-hover:bg-teal/10 transition-colors">
                  <m.icon className="w-5 h-5 text-navy/40 group-hover:text-teal transition-colors" />
                </div>
                <h3 className="font-serif text-xl font-bold text-navy mb-4">{m.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Dark precision section ─────────────────────────────────── */}
      <section id="precision" className="py-40 bg-navy relative overflow-hidden">
        {/* Large background gradient */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 60% 50%, oklch(0.52 0.12 195 / 0.10) 0%, transparent 65%)" }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
          backgroundSize: "80px 80px"
        }} />

        <div className="container relative">
          <div className="grid lg:grid-cols-2 gap-24 items-start">
            {/* Left */}
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] text-teal/50 uppercase mb-6">Why Portier369</p>
              <h2 className="font-serif font-bold text-cream leading-[1.08] mb-10"
                style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}>
                Not another property<br />management app.<br />
                <span className="text-teal">An operational<br />command center.</span>
              </h2>
              <p className="text-cream/45 text-xl leading-[1.85] mb-6">
                Most platforms were built for generic leasing workflows.
              </p>
              <p className="text-cream/45 text-xl leading-[1.85]">
                Portier369 was designed around the operational reality of condominium associations, HOA communities, luxury townhomes, and high-accountability management firms — where every action is structured, every approval is tracked, and every workflow is auditable.
              </p>
            </div>

            {/* Right — glass pain-point panels */}
            <div className="flex flex-col gap-5 lg:pt-20">
              <p className="font-serif text-2xl font-bold text-cream mb-2">
                Designed for Associations<br />That Expect Precision.
              </p>
              {[
                { title: "Eliminate operational blind spots",    desc: "No more scattered emails, spreadsheets, paper trails, or missing approvals." },
                { title: "Protect institutional knowledge",      desc: "Every action, approval, violation, vendor update, and communication is permanently organized." },
                { title: "Operate with accountability",          desc: "Role-based permissions ensure everyone sees exactly what they should — nothing more." },
                { title: "Scale without operational collapse",   desc: "Whether managing 5 associations or 500, Portier369 scales with structure." },
              ].map((p, i) => (
                <motion.div key={p.title}
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                  className="rounded-2xl p-7 border border-white/10 hover:border-white/20 transition-colors"
                  style={{ background: "oklch(1 0 0 / 0.05)", backdropFilter: "blur(12px)" }}
                >
                  <h3 className="font-semibold text-cream mb-2.5">{p.title}</h3>
                  <p className="text-sm text-cream/45 leading-relaxed">{p.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Role Access ───────────────────────────────────────────── */}
      <section id="access" className="py-40 bg-background">
        <div className="container">
          <div className="max-w-2xl mb-20">
            <p className="text-[10px] font-bold tracking-[0.22em] text-teal uppercase mb-5">Access Architecture</p>
            <h2 className="font-serif font-bold text-navy leading-[1.08]"
              style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}>
              Every User Sees<br />
              Exactly What They Need —<br />
              <span className="text-teal">Nothing More.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden mb-12">
            {ROLES.map((r, i) => (
              <motion.div key={r.label}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className="bg-white p-12 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3 mb-6">
                  <span className="font-mono text-xs font-bold text-teal/40">0{i + 1}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-navy mb-4">{r.label}</h3>
                <p className="text-muted-foreground leading-relaxed">{r.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="p-10 rounded-2xl bg-navy/3 border border-border">
            <p className="text-muted-foreground leading-relaxed max-w-3xl">
              <span className="font-semibold text-navy">Invite-only hierarchy.</span> Portier369 operates on a strict five-level access chain. Your company is onboarded by Portier369. Company Admins invite Portfolio Managers. Portfolio Managers invite Property Managers. Property Managers invite sub-users. Every user is accountable to the level that granted their access.
            </p>
          </div>
        </div>
      </section>

      {/* ─── White-Glove Onboarding ────────────────────────────────── */}
      <section className="py-40 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
          backgroundSize: "80px 80px"
        }} />
        <div className="container relative">
          <div className="grid lg:grid-cols-2 gap-24 items-center">
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] text-teal/50 uppercase mb-6">Deployment</p>
              <h2 className="font-serif font-bold text-cream leading-[1.08] mb-10"
                style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}>
                White-glove<br />onboarding included.
              </h2>
              <p className="text-cream/45 text-xl leading-[1.85] mb-4">
                We do not believe enterprise systems should feel generic.
              </p>
              <p className="text-cream/45 text-xl leading-[1.85]">
                Every Portier369 deployment includes guided setup, workflow configuration, migration assistance, permission structuring, and operational consulting. No outsourced onboarding. No disconnected support.
              </p>
              <div className="mt-12 flex flex-wrap gap-4">
                <Button size="lg" onClick={() => openAccess()} className="bg-teal hover:bg-teal-light text-white font-semibold shadow-xl shadow-teal/20"
                  style={{ height: "54px", fontSize: "15px", padding: "0 2.5rem" }}>
                  Request Private Access
                </Button>
                <Button size="lg" variant="outline" onClick={() => openAccess()}
                  className="border-white/20 text-cream hover:bg-white/8 bg-transparent font-medium"
                  style={{ height: "54px", fontSize: "15px", padding: "0 2.5rem" }}>
                  Schedule Executive Demo
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {["Private onboarding","White-glove migration","Custom workflows","Dedicated implementation","Staff training","Priority support"].map((item, i) => (
                <motion.div key={item}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07, duration: 0.45, ease: EASE }}
                  className="flex items-center gap-4 rounded-xl px-7 py-5 border border-white/10 hover:border-white/20 transition-colors"
                  style={{ background: "oklch(1 0 0 / 0.05)" }}
                >
                  <CheckCircle2 className="w-4 h-4 text-teal flex-shrink-0" />
                  <span className="text-cream/75 font-medium">{item}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing ───────────────────────────────────────────────── */}
      <section id="pricing" className="py-40 bg-background">
        <div className="container">
          <div className="text-center mb-20">
            <p className="text-[10px] font-bold tracking-[0.22em] text-teal uppercase mb-5">Operational Plans</p>
            <h2 className="font-serif font-bold text-navy leading-[1.08] mb-7"
              style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}>
              Built Around Community Scale
            </h2>
            <p className="text-xl text-muted-foreground leading-[1.85] max-w-2xl mx-auto">
              Portier369 deployments scale around unit count, operational complexity, and management structure — not generic software tiers. Every deployment includes white-glove onboarding, workflow configuration, and guided implementation support.
            </p>
          </div>

          {/* Plans grid */}
          <div className="grid lg:grid-cols-4 gap-5 mb-8">

            {/* Foundation */}
            <div className="rounded-2xl border border-border bg-white p-8 flex flex-col">
              <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase mb-4">Foundation</p>
              <div className="mb-2">
                <span className="font-serif font-bold text-navy" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>$149</span>
                <span className="text-muted-foreground text-sm ml-1">/month</span>
              </div>
              <p className="text-xs text-teal font-semibold mb-4">Up to 50 units · 1 admin seat</p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                For smaller associations and self-managed communities.
              </p>
              <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                {["Single-property management","Standard workflows","Basic automation","Violations workflow","Work orders","Owner announcements","Document portal","Maintenance requests","Email notices"].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal flex-shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <div className="border-t border-border pt-4 mb-6 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground/70">Additional Units: <span className="text-teal">+$1.25/unit over 50</span></p>
                <p className="font-medium text-foreground/70">Additional Seats: <span className="text-teal">+$19/user</span></p>
              </div>
              <Button variant="outline" onClick={() => openAccess("foundation")} className="w-full border-navy text-navy hover:bg-navy hover:text-cream transition-colors font-semibold">
                Request Private Access
              </Button>
            </div>

            {/* Professional — highlighted */}
            <div className="lg:col-span-1 rounded-2xl border-2 border-teal bg-navy relative p-8 flex flex-col"
              style={{ boxShadow: "0 0 40px oklch(0.72 0.15 185 / 0.25), 0 25px 50px -12px oklch(0 0 0 / 0.5)", transform: "scale(1.03)", transformOrigin: "center" }}>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-gold text-navy text-[10px] font-bold tracking-[0.18em] uppercase px-4 py-1.5 rounded-full shadow-lg">
                  Most Popular
                </span>
              </div>
              <p className="text-[10px] font-bold tracking-[0.2em] text-teal/70 uppercase mb-4">Professional</p>
              <div className="mb-2">
                <span className="font-serif font-bold text-cream" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>$349</span>
                <span className="text-cream/40 text-sm ml-1">/month</span>
              </div>
              <p className="text-xs text-teal font-semibold mb-4">Up to 150 units · 3 admin/manager seats</p>
              <p className="text-sm text-cream/55 leading-relaxed mb-5">
                For growing management firms and operationally active associations.
              </p>
              <p className="text-[10px] font-bold tracking-[0.15em] text-teal/60 uppercase mb-3">Everything in Foundation, plus:</p>
              <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                {["Multi-property dashboard","Architectural reviews","Advanced permissions","Board workflows","Vendor coordination","Escalation workflows","Smart reminders","Compliance tracking","Meeting management"].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-cream/80">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal flex-shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <div className="border-t border-white/10 pt-4 mb-6 text-xs text-cream/40 space-y-1">
                <p className="font-medium text-cream/60">Additional Units: <span className="text-teal">+$0.95/unit over 150</span></p>
                <p className="font-medium text-cream/60">Additional Seats: <span className="text-teal">+$24/user</span></p>
              </div>
              <Button onClick={() => openAccess("professional")} className="w-full bg-teal hover:bg-teal-light text-white font-semibold shadow-lg shadow-teal/25">
                Schedule Executive Demo
              </Button>
            </div>

            {/* Portfolio */}
            <div className="rounded-2xl border border-border bg-white p-8 flex flex-col">
              <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase mb-4">Portfolio</p>
              <div className="mb-2">
                <span className="font-serif font-bold text-navy" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>$749</span>
                <span className="text-muted-foreground text-sm ml-1">/month</span>
              </div>
              <p className="text-xs text-teal font-semibold mb-4">Up to 500 units · 6 admin/manager seats</p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                For established portfolios requiring operational oversight and automation at scale.
              </p>
              <p className="text-[10px] font-bold tracking-[0.15em] text-teal/60 uppercase mb-3">Everything in Professional, plus:</p>
              <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                {["Portfolio reporting","Operational analytics","White-label portal","Priority onboarding","Workflow automations","Advanced governance tools","Portfolio-level visibility"].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal flex-shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <div className="border-t border-border pt-4 mb-6 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground/70">Additional Units: <span className="text-teal">+$0.65/unit over 500</span></p>
                <p className="font-medium text-foreground/70">Additional Seats: <span className="text-teal">+$29/user</span></p>
              </div>
              <Button variant="outline" onClick={() => openAccess("portfolio")} className="w-full border-navy text-navy hover:bg-navy hover:text-cream transition-colors font-semibold">
                Speak With Our Team
              </Button>
            </div>

            {/* Enterprise */}
            <div className="rounded-2xl border border-border bg-muted/30 p-8 flex flex-col">
              <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase mb-4">Enterprise</p>
              <div className="mb-2">
                <span className="font-serif font-bold text-navy" style={{ fontSize: "clamp(1.2rem, 2vw, 1.6rem)" }}>Custom Deployment</span>
              </div>
              <p className="text-xs text-teal font-semibold mb-4">Unlimited portfolio architecture</p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                For large management organizations and complex operational infrastructures.
              </p>
              <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                {["Dedicated onboarding","API integrations","Staff training","Custom workflows","Priority support","Migration assistance","Infrastructure customization","Multi-company architecture","Compliance consulting"].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal flex-shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <div className="border-t border-border pt-4 mb-6 text-xs text-muted-foreground">
                <p className="font-medium text-foreground/70">Custom unit and seat architecture.</p>
              </div>
              <Button variant="outline" onClick={() => openAccess("enterprise")} className="w-full border-navy text-navy hover:bg-navy hover:text-cream transition-colors font-semibold">
                Request Deployment Consultation
              </Button>
            </div>
          </div>

          {/* Unlimited residents note */}
          <p className="text-center text-sm font-medium text-teal mb-5">
            All plans include unlimited owners and board member access.
          </p>
          <p className="text-center text-sm text-muted-foreground max-w-xl mx-auto">
            A more focused platform with fair pricing — purpose-built for condominium associations and professional management firms.
          </p>
        </div>
      </section>

      {/* ─── Operational Enhancements ───────────────────────────────── */}
      <section className="py-40" style={{ background: "oklch(0.13 0.025 255)" }}>
        <div className="container">
          <div className="text-center mb-16">
            <p className="text-[10px] font-bold tracking-[0.22em] text-teal/60 uppercase mb-5">Modular Capabilities</p>
            <h2 className="font-serif font-bold text-cream leading-[1.08] mb-7"
              style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}>
              Operational Enhancements
            </h2>
            <p className="text-xl text-cream/40 leading-[1.85] max-w-2xl mx-auto mb-5">
              Extend Portier369 with advanced governance, automation, communication, and intelligence modules designed for high-accountability communities.
            </p>
            <p className="text-sm text-teal/70 font-medium">
              Most communities start with the Professional deployment and expand operational capabilities over time.
            </p>
          </div>

          <div className="flex flex-col gap-3 max-w-4xl mx-auto">
            {[
              { icon: Shield,       title: "AI Violations Assistant",      price: "+$79/mo",  desc: "Automated violation categorization, notice drafting, escalation recommendations, and compliance workflow assistance." },
              { icon: ClipboardCheck, title: "Elections & Online Voting",  price: "+$99/mo",  desc: "Annual election workflows, proxy tracking, secure online voting, and board reporting." },
              { icon: Wrench,       title: "Vendor Compliance Monitoring",  price: "+$79/mo",  desc: "Track insurance expirations, licensing documents, vendor approvals, and compliance reminders." },
              { icon: DollarSign,   title: "Reserve Planning Toolkit",      price: "+$149/mo", desc: "Reserve study visibility, capital project planning, maintenance forecasting, and funding analysis." },
              { icon: FileText,     title: "AI Document Intelligence",      price: "+$199/mo", desc: "Search governing documents, meeting minutes, resolutions, and rules using natural language queries." },
              { icon: Bell,         title: "SMS & Emergency Notifications", price: "+$49/mo",  desc: "Emergency alerts, water shutoff notifications, weather notices, and broadcast communication." },
              { icon: Building2,    title: "White-Label Owner Portal",      price: "+$199/mo", desc: "Custom-branded owner portal experience for management firms deploying Portier369 under their own brand." },
            ].map((addon, i) => (
              <motion.div key={addon.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.45, ease: EASE }}
                className="flex items-center gap-6 rounded-2xl px-8 py-6 border border-white/8 hover:border-teal/30 transition-all duration-300 group"
                style={{ background: "oklch(1 0 0 / 0.04)", backdropFilter: "blur(8px)" }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10 group-hover:border-teal/30 transition-colors"
                  style={{ background: "oklch(1 0 0 / 0.06)" }}>
                  <addon.icon className="w-5 h-5 text-teal/70 group-hover:text-teal transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-cream text-base mb-1">{addon.title}</p>
                  <p className="text-sm text-cream/40 leading-relaxed">{addon.desc}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="font-serif font-bold text-gold text-lg">{addon.price}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────────── */}
      <section id="faq" className="py-40 bg-muted/20">
        <div className="container max-w-3xl">
          <div className="mb-20">
            <p className="text-[10px] font-bold tracking-[0.22em] text-teal uppercase mb-5">FAQ</p>
            <h2 className="font-serif font-bold text-navy leading-[1.08]"
              style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
              Frequently Asked<br />By Boards & Management Firms
            </h2>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {FAQS.map((faq, i) => (
              <div key={i} className="py-8">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-start justify-between text-left gap-6 group"
                >
                  <span className="font-semibold text-navy text-lg group-hover:text-teal transition-colors leading-snug">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground flex-shrink-0 mt-1 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-5 text-muted-foreground leading-relaxed text-lg">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─────────────────────────────────────────────── */}
      <section className="py-40 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 100%, oklch(0.52 0.12 195 / 0.12) 0%, transparent 60%)" }} />
        <div className="container relative text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <h2 className="font-serif font-bold text-cream max-w-3xl mx-auto leading-[1.08] mb-8"
              style={{ fontSize: "clamp(2rem, 5vw, 4.5rem)" }}>
              Operational Clarity<br />
              Starts Here.
            </h2>
            <p className="text-cream/40 max-w-lg mx-auto text-xl leading-[1.85] mb-6">
              Portier369 delivers structure, governance, visibility, and operational control for communities that cannot afford disorder.
            </p>
            <p className="text-cream/25 max-w-md mx-auto text-sm leading-relaxed mb-14">
              Private onboarding available for qualified organizations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => openAccess()} className="bg-teal hover:bg-teal-light text-white font-semibold shadow-xl shadow-teal/20"
                style={{ height: "58px", fontSize: "16px", padding: "0 3.5rem" }}>
                Request Private Access
              </Button>
              <Button size="lg" variant="outline" onClick={() => openAccess()}
                className="border-white/20 text-cream hover:bg-white/8 bg-transparent font-medium"
                style={{ height: "58px", fontSize: "16px", padding: "0 3.5rem" }}>
                Schedule Executive Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-white/8 py-20" style={{ background: "oklch(0.11 0.03 255)" }}>
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-start gap-14">
            <div>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-gold" />
                </div>
                <span className="font-serif text-lg font-bold text-cream">Portier<span className="text-teal">369</span></span>
              </div>
              <p className="text-sm text-cream/25 max-w-xs leading-relaxed">
                Private operational infrastructure for modern associations.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-12 text-sm">
              <div>
                <p className="font-semibold text-cream/40 mb-5 text-[10px] uppercase tracking-widest">Platform</p>
                <div className="flex flex-col gap-3">
                  <a href="#operations" className="text-cream/25 hover:text-cream/60 transition-colors">Operations</a>
                  <a href="#precision"  className="text-cream/25 hover:text-cream/60 transition-colors">Why Portier369</a>
                  <a href="#access"     className="text-cream/25 hover:text-cream/60 transition-colors">Access</a>
                  <a href="#faq"        className="text-cream/25 hover:text-cream/60 transition-colors">FAQ</a>
                </div>
              </div>
              <div>
                <p className="font-semibold text-cream/40 mb-5 text-[10px] uppercase tracking-widest">Portals</p>
                <div className="flex flex-col gap-3">
                  {LOGIN_PORTALS.map((p) => (
                    <Link key={p.role} href={`/login?role=${p.role}`} className="text-cream/25 hover:text-cream/60 transition-colors">{p.label}</Link>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-semibold text-cream/40 mb-5 text-[10px] uppercase tracking-widest">Contact</p>
                <div className="flex flex-col gap-3">
                  <a href="mailto:hello@portier369.com" className="text-cream/25 hover:text-cream/60 transition-colors">hello@portier369.com</a>
                  <button onClick={() => openAccess()} className="text-cream/25 hover:text-cream/60 transition-colors text-left">Request Access</button>
                  <button onClick={() => openAccess()} className="text-cream/25 hover:text-cream/60 transition-colors text-left">Executive Demo</button>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-16 pt-7 border-t border-white/8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[11px] text-cream/15">© {new Date().getFullYear()} Portier369. All rights reserved.</p>
            <div className="flex gap-7 text-[11px] text-cream/15">
              <a href="#" className="hover:text-cream/40 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-cream/40 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── Lead Capture Modal ─────────────────────────────────────── */}
      <AccessModal
        isOpen={accessOpen}
        onClose={() => setAccessOpen(false)}
        defaultPlan={accessPlan}
      />
    </div>
  );
}
