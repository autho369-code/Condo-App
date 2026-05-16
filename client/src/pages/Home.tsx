/*
 * DESIGN PHILOSOPHY: Industrial Blueprint Aesthetic
 * Dark navy background, electric cyan accents, amber highlights
 * Space Grotesk display, IBM Plex Sans body, JetBrains Mono labels
 * Asymmetric layout with annotation-style section labels and dot-grid textures
 */

import { useState, useEffect, useRef } from "react";
import {
  Wrench, Calendar, Mail, Users, Building2, Shield,
  FileText, Zap, ChevronRight, ExternalLink, Menu, X,
  CheckCircle2, AlertTriangle, ArrowRight, Code2, Database,
  Globe, Lock, Layers, GitBranch
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface NavItem { label: string; href: string; }
interface ComparisonRow {
  option: string;
  bestFor: string;
  strengths: string;
  limitation: string;
  fit: "high" | "medium" | "low";
}
interface MvpModule {
  icon: React.ReactNode;
  title: string;
  description: string;
  coord: string;
}
interface StackRow {
  layer: string;
  choice: string;
  why: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { label: "Recommendation", href: "#recommendation" },
  { label: "Comparison", href: "#comparison" },
  { label: "MVP Scope", href: "#mvp" },
  { label: "Tech Stack", href: "#stack" },
  { label: "Build Strategy", href: "#strategy" },
];

const COMPARISON_DATA: ComparisonRow[] = [
  {
    option: "Claude Code",
    bestFor: "Building a custom SaaS with an AI coding assistant",
    strengths: "Multi-file reasoning, project planning, codebase understanding, terminal/IDE/web workflow, Git, MCP, custom instructions",
    limitation: "A development tool, not a finished property-management platform",
    fit: "high",
  },
  {
    option: "OpenAI Codex",
    bestFor: "Coding, reviewing, debugging, and automating code workflows",
    strengths: "Code generation, review, debugging, GitHub/Slack/Linear integrations, CLI/IDE/web options, automation features",
    limitation: "Also a development tool, not the finished operating platform",
    fit: "high",
  },
  {
    option: "Off-the-shelf condo/HOA software",
    bestFor: "Getting operational quickly with established modules",
    strengths: "Mature work orders, resident communication, board governance, payments, records, calendars, vendors",
    limitation: "May be expensive, less customizable, may include unwanted features, data lock-in",
    fit: "high",
  },
  {
    option: "No-code / Low-code stack",
    bestFor: "Fast internal prototype or operational dashboard",
    strengths: "Quick setup, lower initial engineering cost, useful for admin workflows and automations",
    limitation: "Harder to enforce complex permissions, audit trails, integrations, and long-term product quality",
    fit: "medium",
  },
  {
    option: "Custom SaaS application",
    bestFor: "A condo-only product you fully control and can sell or scale",
    strengths: "Full control, condo-only workflows, role-based permissions, AI email/ticket triage, custom calendars/meetings",
    limitation: "Requires design, development, security, maintenance, and support",
    fit: "high",
  },
];

const MVP_MODULES: MvpModule[] = [
  {
    icon: <Building2 className="w-5 h-5" />,
    title: "Property & Unit Registry",
    description: "Store condominium communities, buildings, units, owners, residents, board members, managers, vendors, and common areas.",
    coord: "01.A",
  },
  {
    icon: <Wrench className="w-5 h-5" />,
    title: "Work Ticket Inbox",
    description: "Accept requests from a portal, email, manager entry, or phone notes. Categorize as common-area, unit-related, emergency, vendor, or board matter.",
    coord: "01.B",
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    title: "Scheduling Hub",
    description: "Assign inspections, vendor visits, preventive maintenance, board meetings, deadlines, and recurring tasks.",
    coord: "02.A",
  },
  {
    icon: <Mail className="w-5 h-5" />,
    title: "Email Hub",
    description: "Sync Gmail/Outlook, attach email threads to tickets/properties/units, and allow AI-drafted responses.",
    coord: "02.B",
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: "Meeting Hub",
    description: "Create agendas, minutes, motions, action items, follow-ups, and board packets.",
    coord: "03.A",
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: "Vendor Management",
    description: "Track vendors, insurance certificates, contracts, quotes, appointments, and work history.",
    coord: "03.B",
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: "Role-Based Access",
    description: "Separate what owners, residents, board members, vendors, managers, and admins can see or do.",
    coord: "04.A",
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: "AI Automation Layer",
    description: "Classify tickets, summarize emails, draft replies, extract action items from meetings, and flag urgent issues.",
    coord: "04.B",
  },
];

const STACK_DATA: StackRow[] = [
  { layer: "Front End", choice: "React / Next.js", why: "Strong for dashboards, portals, calendars, and admin screens." },
  { layer: "Back End", choice: "Node.js / NestJS or Python / FastAPI", why: "Reliable for APIs, automation, integrations, and AI workflows." },
  { layer: "Database", choice: "PostgreSQL via Supabase, Neon, or managed Postgres", why: "Strong relational structure for properties, units, owners, tickets, meetings, vendors, and audit trails." },
  { layer: "Authentication", choice: "Clerk, Auth0, or Supabase Auth", why: "Needed for managers, board members, vendors, owners, residents, and admins." },
  { layer: "Email Integration", choice: "Microsoft Graph & Gmail API", why: "Allows messages to be linked to properties, units, tickets, and board matters." },
  { layer: "Calendar Integration", choice: "Microsoft 365 / Outlook Calendar & Google Calendar", why: "Supports inspections, vendor appointments, preventive maintenance, and board meetings." },
  { layer: "AI Layer", choice: "OpenAI or Anthropic API", why: "Used for ticket classification, email drafting, meeting summaries, and next-action recommendations." },
  { layer: "File Storage", choice: "S3-compatible storage", why: "Needed for photos, invoices, notices, minutes, vendor documents, and compliance records." },
  { layer: "Automation Engine", choice: "BullMQ, Temporal, or scheduled workers", why: "Needed for reminders, SLA alerts, recurring maintenance, and email/calendar sync." },
];

// ─── Utility: Intersection Observer hook ──────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FitBadge({ fit }: { fit: "high" | "medium" | "low" }) {
  const map = {
    high: "text-[oklch(0.72_0.18_200)] border-[oklch(0.72_0.18_200/0.4)] bg-[oklch(0.72_0.18_200/0.08)]",
    medium: "text-[oklch(0.75_0.17_65)] border-[oklch(0.75_0.17_65/0.4)] bg-[oklch(0.75_0.17_65/0.08)]",
    low: "text-[oklch(0.60_0.22_25)] border-[oklch(0.60_0.22_25/0.4)] bg-[oklch(0.60_0.22_25/0.08)]",
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs border rounded font-mono uppercase tracking-wider ${map[fit]}`}>
      {fit}
    </span>
  );
}

function SectionLabel({ coord, label }: { coord: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="bp-label opacity-60">{coord}</span>
      <span className="bp-label">{label}</span>
      <div className="flex-1 border-t border-dashed border-[oklch(0.30_0.025_230)]" />
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function HeroSection() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLoaded(true), 80); return () => clearTimeout(t); }, []);

  return (
    <section
      id="hero"
      className="relative min-h-[92vh] flex flex-col justify-end overflow-hidden"
      style={{
        backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663132279489/KVXVHrh2Zbni8XWHgAy83Y/hero-blueprint-TsGZFsNiWDgbYZpGcwysgk.webp)`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
      }}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.11_0.018_240/0.55)] via-[oklch(0.11_0.018_240/0.70)] to-[oklch(0.11_0.018_240/0.98)]" />

      {/* Dot grid overlay */}
      <div className="absolute inset-0 dot-grid opacity-20" />

      <div className="relative container pb-20 pt-32">
        <div
          className={`max-w-3xl transition-all duration-700 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "100ms" }}
        >
          <div className="bp-label mb-5 flex items-center gap-2">
            <span className="inline-block w-6 h-px bg-[oklch(0.72_0.18_200)]" />
            SPECIFICATION DOCUMENT — CONDOOPS v1.0
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight text-white mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Condominium<br />
            <span className="cyan-glow">Automation</span><br />
            Blueprint
          </h1>
          <p className="text-lg md:text-xl text-[oklch(0.75_0.008_220)] max-w-xl leading-relaxed mb-10" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            A complete technical recommendation for building a condominium-only property management system — work tickets, schedules, emails, and meetings in one place.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="#recommendation"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[oklch(0.72_0.18_200)] text-[oklch(0.10_0.018_240)] font-semibold text-sm rounded transition-all duration-200 hover:bg-[oklch(0.78_0.18_200)] hover:shadow-[0_0_24px_oklch(0.72_0.18_200/0.4)] active:scale-[0.97]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Read the Recommendation <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#mvp"
              className="inline-flex items-center gap-2 px-6 py-3 border border-[oklch(0.40_0.025_230)] text-[oklch(0.80_0.008_220)] font-semibold text-sm rounded transition-all duration-200 hover:border-[oklch(0.72_0.18_200/0.5)] hover:text-white active:scale-[0.97]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              View MVP Scope
            </a>
          </div>
        </div>
      </div>

      {/* Bottom dimension line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-[oklch(0.72_0.18_200/0.2)]" />
    </section>
  );
}

function RecommendationSection() {
  const { ref, inView } = useInView();
  return (
    <section id="recommendation" className="py-24 dot-grid" ref={ref}>
      <div className="container">
        <SectionLabel coord="00.A" label="EXECUTIVE RECOMMENDATION" />
        <div className={`grid md:grid-cols-5 gap-12 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="md:col-span-3">
            <h2 className="text-4xl font-bold text-white mb-6 leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Neither Claude nor Codex<br />
              <span className="cyan-glow">is the system itself.</span>
            </h2>
            <div className="space-y-5 text-[oklch(0.78_0.008_220)] leading-relaxed text-base" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              <p>
                For a condominium-only property management automation system, <strong className="text-white">Claude Code and OpenAI Codex are best understood as AI coding assistants</strong> that can help build, debug, and maintain the system. The product itself should be either an existing condominium/HOA management platform, a no-code prototype, or a custom web application with integrations for tickets, schedules, emails, and meetings.
              </p>
              <p>
                The recommended path is a <strong className="text-white">hybrid approach</strong>. If you need a working solution immediately, evaluate established condo/HOA platforms such as Condo Control, Buildium, DoorLoop, or Yardi Breeze. If your goal is to create your own proprietary system that fits your exact condominium-only workflow, build a custom SaaS web application and use <strong className="text-[oklch(0.72_0.18_200)]">Claude Code first</strong>, with Codex as a strong alternative or second reviewer.
              </p>
              <p>
                A condominium management company needs more than a simple help desk. Serious condo/HOA platforms combine work orders, preventive maintenance, vendors, communications, board governance, agendas, minutes, notices, documents, reporting, and often accounting/payment integrations.
              </p>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="bp-card p-6 rounded h-full">
              <div className="bp-label mb-4">SHORT ANSWER</div>
              <div className="bp-quote p-4 rounded mb-6">
                <p className="text-[oklch(0.88_0.008_220)] text-sm leading-relaxed italic" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  Use <span className="text-[oklch(0.72_0.18_200)] not-italic font-semibold">Claude Code</span> to build the first custom version. Use <span className="text-[oklch(0.72_0.18_200)] not-italic font-semibold">Codex</span> as a strong alternative or companion for code review, debugging, and OpenAI-centered automation. Use neither as the business platform itself — use them to build the platform.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { icon: <CheckCircle2 className="w-4 h-4 text-[oklch(0.72_0.18_200)]" />, text: "Condo-only workflows, no apartment clutter" },
                  { icon: <CheckCircle2 className="w-4 h-4 text-[oklch(0.72_0.18_200)]" />, text: "Tickets, schedules, emails, meetings unified" },
                  { icon: <CheckCircle2 className="w-4 h-4 text-[oklch(0.72_0.18_200)]" />, text: "Role-based access for all stakeholders" },
                  { icon: <CheckCircle2 className="w-4 h-4 text-[oklch(0.72_0.18_200)]" />, text: "AI triage and automation layer built in" },
                  { icon: <AlertTriangle className="w-4 h-4 text-[oklch(0.75_0.17_65)]" />, text: "Requires product design and development work" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-[oklch(0.75_0.008_220)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    {item.icon}
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  const { ref, inView } = useInView();
  return (
    <section id="comparison" className="py-24 bg-[oklch(0.13_0.018_240)]" ref={ref}>
      <div className="container">
        <SectionLabel coord="01.A" label="OPTIONS COMPARED" />
        <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Platform & Tool Comparison
        </h2>
        <p className="text-[oklch(0.65_0.008_220)] mb-10 max-w-2xl text-sm leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
          Each option evaluated against the core requirement: a condominium-only system covering work tickets, schedules, emails, and meetings.
        </p>
        <div
          className={`overflow-x-auto transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <table className="w-full text-sm border-collapse" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            <thead>
              <tr className="border-b border-[oklch(0.25_0.025_230)]">
                {["Option", "Best For", "Strengths", "Main Limitation", "Fit"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 bp-label text-[oklch(0.55_0.012_220)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_DATA.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-[oklch(0.20_0.020_235)] hover:bg-[oklch(0.72_0.18_200/0.04)] transition-colors duration-150 group"
                >
                  <td className="py-4 px-4 font-semibold text-white group-hover:text-[oklch(0.72_0.18_200)] transition-colors duration-150 whitespace-nowrap">
                    {row.option}
                  </td>
                  <td className="py-4 px-4 text-[oklch(0.70_0.008_220)] max-w-[180px]">{row.bestFor}</td>
                  <td className="py-4 px-4 text-[oklch(0.65_0.008_220)] max-w-[220px]">{row.strengths}</td>
                  <td className="py-4 px-4 text-[oklch(0.60_0.008_220)] max-w-[180px]">{row.limitation}</td>
                  <td className="py-4 px-4"><FitBadge fit={row.fit} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Claude vs Codex decision table */}
        <div className="mt-16">
          <SectionLabel coord="01.B" label="CLAUDE CODE vs. CODEX — DECISION GUIDE" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              <thead>
                <tr className="border-b border-[oklch(0.25_0.025_230)]">
                  <th className="text-left py-3 px-4 bp-label text-[oklch(0.55_0.012_220)]">Decision Factor</th>
                  <th className="text-left py-3 px-4 bp-label text-[oklch(0.72_0.18_200)]">Choose Claude Code If…</th>
                  <th className="text-left py-3 px-4 bp-label text-[oklch(0.55_0.012_220)]">Choose Codex If…</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Product is still undefined", "You want help shaping the architecture and evolving requirements.", "You already know the structure and need fast implementation."],
                  ["Codebase complexity", "You expect many interconnected files and frequent refactors.", "You want strong code review, debugging, and automation workflows."],
                  ["AI provider preference", "You prefer Anthropic/Claude for reasoning and planning.", "You prefer OpenAI/ChatGPT and may use OpenAI APIs in the product."],
                  ["Team workflow", "You want terminal/IDE/web workflows with project instructions and tool integrations.", "You want OpenAI-centered GitHub, Slack, Linear, CLI/IDE/web workflows."],
                  ["Practical recommendation", "Start here for the first build.", "Use as a second assistant/reviewer or primary tool if you already prefer OpenAI."],
                ].map(([factor, claude, codex], i) => (
                  <tr key={i} className="border-b border-[oklch(0.20_0.020_235)] hover:bg-[oklch(0.72_0.18_200/0.03)] transition-colors duration-150">
                    <td className="py-3 px-4 font-medium text-[oklch(0.80_0.008_220)]">{factor}</td>
                    <td className="py-3 px-4 text-[oklch(0.72_0.18_200/0.9)]">{claude}</td>
                    <td className="py-3 px-4 text-[oklch(0.65_0.008_220)]">{codex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function MvpSection() {
  const { ref, inView } = useInView();
  return (
    <section id="mvp" className="py-24 dot-grid" ref={ref}>
      <div className="container">
        <SectionLabel coord="02.A" label="MVP SCOPE" />
        <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Condominium-Only MVP Modules
        </h2>
        <p className="text-[oklch(0.65_0.008_220)] mb-12 max-w-2xl text-sm leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
          The first version should be narrow, practical, and condominium-specific. It should avoid apartment concepts such as leases, rent rolls, tenant turnover, and unit marketing.
        </p>
        <div
          ref={ref}
          className={`grid sm:grid-cols-2 lg:grid-cols-4 gap-5 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          {MVP_MODULES.map((mod, i) => (
            <div
              key={i}
              className="bp-card p-5 rounded"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-[oklch(0.72_0.18_200/0.10)] rounded text-[oklch(0.72_0.18_200)]">
                  {mod.icon}
                </div>
                <span className="bp-label text-[oklch(0.40_0.025_230)]">{mod.coord}</span>
              </div>
              <h3 className="font-semibold text-white text-sm mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {mod.title}
              </h3>
              <p className="text-[oklch(0.60_0.008_220)] text-xs leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                {mod.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StackSection() {
  const { ref, inView } = useInView();
  const ICONS: Record<string, React.ReactNode> = {
    "Front End": <Globe className="w-4 h-4" />,
    "Back End": <Code2 className="w-4 h-4" />,
    "Database": <Database className="w-4 h-4" />,
    "Authentication": <Lock className="w-4 h-4" />,
    "Email Integration": <Mail className="w-4 h-4" />,
    "Calendar Integration": <Calendar className="w-4 h-4" />,
    "AI Layer": <Zap className="w-4 h-4" />,
    "File Storage": <Layers className="w-4 h-4" />,
    "Automation Engine": <GitBranch className="w-4 h-4" />,
  };
  return (
    <section id="stack" className="py-24 bg-[oklch(0.13_0.018_240)]" ref={ref}>
      <div className="container">
        <SectionLabel coord="03.A" label="RECOMMENDED TECHNOLOGY STACK" />
        <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Build Architecture
        </h2>
        <p className="text-[oklch(0.65_0.008_220)] mb-10 max-w-2xl text-sm leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
          A custom SaaS web application with a clean operational dashboard, centralizing all condominium management work into one place.
        </p>
        <div
          className={`grid md:grid-cols-3 gap-4 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          {STACK_DATA.map((row, i) => (
            <div key={i} className="bp-card p-5 rounded" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[oklch(0.72_0.18_200)]">{ICONS[row.layer]}</span>
                <span className="bp-label">{row.layer}</span>
              </div>
              <p className="font-semibold text-white text-sm mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {row.choice}
              </p>
              <p className="text-[oklch(0.60_0.008_220)] text-xs leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                {row.why}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StrategySection() {
  const { ref, inView } = useInView();
  return (
    <section id="strategy" className="py-24 dot-grid" ref={ref}>
      <div className="container">
        <SectionLabel coord="04.A" label="BUILD STRATEGY & NEXT STEPS" />
        <div
          className={`grid md:grid-cols-2 gap-12 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <div>
            <h2 className="text-3xl font-bold text-white mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Recommended<br />
              <span className="cyan-glow">Build Strategy</span>
            </h2>
            <div className="space-y-5 text-[oklch(0.75_0.008_220)] text-sm leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              <p>
                The strongest practical path is a <strong className="text-white">hybrid approach</strong>. Use an off-the-shelf condo/HOA product immediately if the company needs operations improved now, while building a custom MVP only if the goal is to create a proprietary platform or the existing tools do not fit the condominium-only workflow.
              </p>
              <p>
                If building custom, use Claude Code or Codex as the coding assistant, but pair it with a real application stack and integration strategy. Between the two, <strong className="text-[oklch(0.72_0.18_200)]">Claude Code is slightly better for early product shaping</strong> and broad multi-file implementation; Codex is excellent if the team is already centered around OpenAI/ChatGPT, GitHub workflows, code review, and OpenAI APIs.
              </p>
              <p>
                The AI layer should support the workflow, not replace it. Ticket classification, email drafting, meeting summaries, and next-action recommendations should augment the manager's judgment, not override it.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="bp-label mb-5">SUGGESTED NEXT STEPS</h3>
            {[
              { step: "01", title: "Define user roles and permissions", desc: "Map out what managers, board members, vendors, owners, and residents need to see and do." },
              { step: "02", title: "Write a one-page product blueprint", desc: "Define the ticket workflow, email/calendar integrations, meeting workflow, and first 30-day MVP scope." },
              { step: "03", title: "Evaluate off-the-shelf options", desc: "Test Condo Control, Buildium, or DoorLoop against your exact workflow before committing to a custom build." },
              { step: "04", title: "Initialize the project with Claude Code", desc: "Use Claude Code to generate the project structure, database schema, screens, and API routes from the blueprint." },
              { step: "05", title: "Integrate email and calendar first", desc: "Gmail/Outlook and Google/Microsoft Calendar integrations are the highest-value connectors for daily operations." },
            ].map((item, i) => (
              <div key={i} className="bp-card p-4 rounded flex gap-4">
                <span className="bp-label text-[oklch(0.72_0.18_200)] text-lg leading-none mt-0.5 shrink-0">{item.step}</span>
                <div>
                  <p className="font-semibold text-white text-sm mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{item.title}</p>
                  <p className="text-[oklch(0.60_0.008_220)] text-xs leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReferencesSection() {
  return (
    <section className="py-16 bg-[oklch(0.13_0.018_240)] border-t border-[oklch(0.20_0.020_235)]">
      <div className="container">
        <SectionLabel coord="05.A" label="REFERENCES" />
        <div className="space-y-3" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {[
            { num: "1", title: "Condo Control | Condo, HOA and Property Management Software", url: "https://www.condocontrol.com/" },
            { num: "2", title: "Claude Code Overview — Claude Code Docs", url: "https://code.claude.com/docs/en/overview" },
            { num: "3", title: "Codex | OpenAI Developers", url: "https://developers.openai.com/codex" },
          ].map((ref) => (
            <div key={ref.num} className="flex items-start gap-3 text-sm">
              <span className="bp-label text-[oklch(0.40_0.025_230)] shrink-0">[{ref.num}]</span>
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[oklch(0.65_0.008_220)] hover:text-[oklch(0.72_0.18_200)] transition-colors duration-150 flex items-center gap-1.5"
              >
                {ref.title}
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-8 border-t border-[oklch(0.20_0.020_235)] bg-[oklch(0.11_0.018_240)]">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-4 h-4 text-[oklch(0.72_0.18_200)]" />
          <span className="bp-label">CONDOOPS AUTOMATION BLUEPRINT</span>
        </div>
        <p className="text-[oklch(0.45_0.008_220)] text-xs" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
          Prepared by Manus AI · May 2026
        </p>
      </div>
    </footer>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = ["hero", "recommendation", "comparison", "mvp", "stack", "strategy"];
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActiveSection(e.target.id); });
      },
      { threshold: 0.3 }
    );
    sections.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[oklch(0.11_0.018_240/0.95)] backdrop-blur-md border-b border-[oklch(0.20_0.020_235)]" : "bg-transparent"}`}
    >
      <div className="container flex items-center justify-between h-14">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[oklch(0.72_0.18_200)]" />
          <span className="bp-label hidden sm:block">CONDOOPS</span>
        </div>
        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const sectionId = item.href.replace("#", "");
            const isActive = activeSection === sectionId;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-xs rounded transition-all duration-150 ${isActive ? "text-[oklch(0.72_0.18_200)] bg-[oklch(0.72_0.18_200/0.08)]" : "text-[oklch(0.60_0.008_220)] hover:text-white"}`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {item.label}
              </a>
            );
          })}
        </div>
        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-[oklch(0.60_0.008_220)] hover:text-white transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[oklch(0.13_0.018_240)] border-b border-[oklch(0.20_0.020_235)] px-4 pb-4">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block py-2.5 text-sm text-[oklch(0.65_0.008_220)] hover:text-[oklch(0.72_0.18_200)] transition-colors"
              style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
              onClick={() => setMobileOpen(false)}
            >
              <ChevronRight className="inline w-3 h-3 mr-1 opacity-50" />
              {item.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen bg-[oklch(0.11_0.018_240)]">
      <Navbar />
      <HeroSection />
      <RecommendationSection />
      <ComparisonSection />
      <MvpSection />
      <StackSection />
      <StrategySection />
      <ReferencesSection />
      <Footer />
    </div>
  );
}
