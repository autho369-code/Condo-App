/*
 * DESIGN PHILOSOPHY: Industrial Blueprint Aesthetic — Searchable Guide Edition
 * Dark navy background, electric cyan accents, amber highlights
 * Space Grotesk display, IBM Plex Sans body, JetBrains Mono labels
 * Searchable + filterable guide for property managers
 */

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search, Building2, Wrench, Calendar, Mail, Users, FileText,
  Shield, Zap, Database, Globe, Code2, Lock, Layers, GitBranch,
  ChevronRight, ExternalLink, X, Filter, CheckCircle2, AlertTriangle,
  Star, ArrowRight, BookOpen, Menu, Lightbulb, SlidersHorizontal,
  MessageSquare, ClipboardList, Bell
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type FitLevel = "best" | "good" | "limited";
type Category = "all" | "ai-tools" | "platforms" | "custom" | "no-code";
type StackCategory = "all" | "frontend" | "backend" | "data" | "integration" | "ai" | "infra";
type MvpCategory = "all" | "core" | "communication" | "automation" | "access";

interface Platform {
  id: string;
  name: string;
  type: string;
  category: Category;
  bestFor: string;
  strengths: string[];
  limitation: string;
  fit: FitLevel;
  recommendation: string;
  tags: string[];
}

interface StackItem {
  id: string;
  layer: string;
  choice: string;
  why: string;
  category: StackCategory;
  examples: string[];
}

interface MvpModule {
  id: string;
  title: string;
  description: string;
  category: MvpCategory;
  icon: React.ReactNode;
  features: string[];
  coord: string;
}

interface DecisionQuestion {
  id: string;
  question: string;
  options: { label: string; value: string; points: Record<string, number> }[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const PLATFORMS: Platform[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    type: "AI Coding Assistant",
    category: "ai-tools",
    bestFor: "Building a custom condo SaaS from scratch with evolving requirements",
    strengths: [
      "Multi-file codebase reasoning and editing",
      "Architecture planning and database schema design",
      "Terminal, IDE, desktop, and web workflows",
      "Git commits, pull requests, and MCP tool integrations",
      "Custom instructions, hooks, skills, and multi-agent support",
    ],
    limitation: "A development tool — not a finished property management platform",
    fit: "best",
    recommendation: "Best first AI coding assistant for your custom build",
    tags: ["ai", "coding", "custom build", "architecture", "anthropic"],
  },
  {
    id: "codex",
    name: "OpenAI Codex",
    type: "AI Coding Agent",
    category: "ai-tools",
    bestFor: "Code review, debugging, GitHub/Slack/Linear workflows, OpenAI ecosystem",
    strengths: [
      "Code generation, review, and debugging",
      "Understanding unfamiliar codebases",
      "GitHub, Slack, Linear integrations",
      "CLI, IDE, and web workflow options",
      "Automating repetitive development tasks",
    ],
    limitation: "Also a development tool — not the finished property management platform",
    fit: "best",
    recommendation: "Excellent alternative or companion to Claude Code",
    tags: ["ai", "coding", "openai", "debugging", "github"],
  },
  {
    id: "condo-hoa-software",
    name: "Existing Condo/HOA Software",
    type: "Off-the-shelf Platform",
    category: "platforms",
    bestFor: "Getting operational quickly with established, proven modules",
    strengths: [
      "Work orders and preventive maintenance",
      "Vendor and insurance certificate tracking",
      "Board governance: agendas, minutes, e-voting",
      "Resident communication and notice tracking",
      "Payments, accounting, and document retention",
    ],
    limitation: "Less customizable; may include unwanted features and create vendor lock-in",
    fit: "best",
    recommendation: "Best immediate business solution — examples: Condo Control, Buildium, DoorLoop, Yardi Breeze",
    tags: ["platform", "off-the-shelf", "condo control", "buildium", "doorloop", "yardi"],
  },
  {
    id: "no-code",
    name: "No-Code / Low-Code Stack",
    type: "Rapid Prototype Tools",
    category: "no-code",
    bestFor: "Fast internal prototype or operational dashboard for a small team",
    strengths: [
      "Quick setup with minimal engineering",
      "Lower initial cost",
      "Useful for admin workflows and automations",
      "Tools: Airtable, Monday.com, Notion, Make/Zapier, Softr, Glide",
    ],
    limitation: "Permissions, audit trails, scale, and integrations become fragile over time",
    fit: "good",
    recommendation: "Good MVP prototype — not ideal as a long-term platform",
    tags: ["no-code", "airtable", "notion", "zapier", "prototype", "low-code"],
  },
  {
    id: "custom-saas",
    name: "Custom SaaS Application",
    type: "Proprietary Web App",
    category: "custom",
    bestFor: "A condo-only product you fully control and can eventually sell or scale",
    strengths: [
      "Full control over every workflow and data model",
      "Condo-only design — no apartment clutter",
      "Role-based permissions for all stakeholder types",
      "AI email/ticket triage built in from day one",
      "Can be productized and sold to other condo companies",
    ],
    limitation: "Requires design, development, security, maintenance, and ongoing support",
    fit: "best",
    recommendation: "Best long-term strategic path if this is a product vision",
    tags: ["custom", "saas", "proprietary", "scalable", "product"],
  },
];

const STACK_ITEMS: StackItem[] = [
  {
    id: "frontend",
    layer: "Front End",
    choice: "React or Next.js",
    why: "Strong for dashboards, portals, calendars, and admin screens.",
    category: "frontend",
    examples: ["React 19", "Next.js 14", "Tailwind CSS", "shadcn/ui"],
  },
  {
    id: "backend",
    layer: "Back End",
    choice: "Node.js/NestJS or Python/FastAPI",
    why: "Reliable for APIs, automation, integrations, and AI workflows.",
    category: "backend",
    examples: ["NestJS", "FastAPI", "Express", "tRPC"],
  },
  {
    id: "database",
    layer: "Database",
    choice: "PostgreSQL via Supabase, Neon, or managed Postgres",
    why: "Strong relational structure for properties, units, owners, tickets, meetings, vendors, and audit trails.",
    category: "data",
    examples: ["Supabase", "Neon", "Railway Postgres", "AWS RDS"],
  },
  {
    id: "auth",
    layer: "Authentication",
    choice: "Clerk, Auth0, or Supabase Auth",
    why: "Needed for managers, board members, vendors, owners, residents, and admins — all with different permissions.",
    category: "data",
    examples: ["Clerk", "Auth0", "Supabase Auth", "NextAuth"],
  },
  {
    id: "email",
    layer: "Email Integration",
    choice: "Microsoft Graph & Gmail API",
    why: "Allows messages to be linked to properties, units, tickets, and board matters.",
    category: "integration",
    examples: ["Microsoft Graph", "Gmail API", "SendGrid", "Postmark"],
  },
  {
    id: "calendar",
    layer: "Calendar Integration",
    choice: "Microsoft 365 / Outlook Calendar & Google Calendar",
    why: "Supports inspections, vendor appointments, preventive maintenance, and board meetings.",
    category: "integration",
    examples: ["Google Calendar API", "Microsoft Graph Calendar", "Calendly"],
  },
  {
    id: "ai",
    layer: "AI Layer",
    choice: "OpenAI or Anthropic API",
    why: "Used for ticket classification, email drafting, meeting summaries, and next-action recommendations.",
    category: "ai",
    examples: ["OpenAI GPT-4o", "Claude 3.5 Sonnet", "Anthropic API", "OpenAI API"],
  },
  {
    id: "storage",
    layer: "File Storage",
    choice: "S3-compatible storage",
    why: "Needed for photos, invoices, notices, minutes, vendor documents, and compliance records.",
    category: "infra",
    examples: ["AWS S3", "Cloudflare R2", "Supabase Storage", "Backblaze B2"],
  },
  {
    id: "automation",
    layer: "Automation Engine",
    choice: "BullMQ, Temporal, or scheduled workers",
    why: "Needed for reminders, SLA alerts, recurring maintenance, and email/calendar sync.",
    category: "infra",
    examples: ["BullMQ", "Temporal", "Inngest", "Trigger.dev"],
  },
];

const MVP_MODULES: MvpModule[] = [
  {
    id: "registry",
    title: "Property & Unit Registry",
    description: "Store condominium communities, buildings, units, owners, residents, board members, managers, vendors, and common areas.",
    category: "core",
    icon: <Building2 className="w-5 h-5" />,
    features: ["Community & building records", "Unit ownership tracking", "Resident & board member profiles", "Vendor directory", "Common area inventory"],
    coord: "01.A",
  },
  {
    id: "tickets",
    title: "Work Ticket Inbox",
    description: "Accept requests from a portal, email, manager entry, or phone notes. Categorize as common-area, unit-related, emergency, vendor, or board matter.",
    category: "core",
    icon: <Wrench className="w-5 h-5" />,
    features: ["Multi-channel intake (portal, email, phone)", "Category tagging", "Priority and SLA tracking", "Vendor assignment", "Status workflow"],
    coord: "01.B",
  },
  {
    id: "scheduling",
    title: "Scheduling Hub",
    description: "Assign inspections, vendor visits, preventive maintenance, board meetings, deadlines, and recurring tasks.",
    category: "core",
    icon: <Calendar className="w-5 h-5" />,
    features: ["Calendar view for all properties", "Recurring maintenance scheduling", "Vendor appointment booking", "Board meeting scheduling", "Deadline tracking"],
    coord: "02.A",
  },
  {
    id: "email-hub",
    title: "Email Hub",
    description: "Sync Gmail/Outlook, attach email threads to tickets/properties/units, and allow AI-drafted responses.",
    category: "communication",
    icon: <Mail className="w-5 h-5" />,
    features: ["Gmail & Outlook sync", "Thread-to-ticket linking", "AI-drafted replies", "Property/unit tagging", "Shared team inbox"],
    coord: "02.B",
  },
  {
    id: "meetings",
    title: "Meeting Hub",
    description: "Create agendas, minutes, motions, action items, follow-ups, and board packets.",
    category: "communication",
    icon: <Users className="w-5 h-5" />,
    features: ["Agenda builder", "AI-generated minutes", "Motion and vote tracking", "Action item assignment", "Board packet export"],
    coord: "03.A",
  },
  {
    id: "vendors",
    title: "Vendor Management",
    description: "Track vendors, insurance certificates, contracts, quotes, appointments, and work history.",
    category: "core",
    icon: <FileText className="w-5 h-5" />,
    features: ["Vendor profiles & ratings", "Insurance certificate expiry alerts", "Contract storage", "Quote comparison", "Work history log"],
    coord: "03.B",
  },
  {
    id: "communication",
    title: "Resident & Board Communication",
    description: "Send notices, updates, ticket responses, reminders, and meeting follow-ups.",
    category: "communication",
    icon: <Bell className="w-5 h-5" />,
    features: ["Bulk notice sending", "Ticket status notifications", "Meeting reminders", "Owner/resident portal", "Announcement board"],
    coord: "04.A",
  },
  {
    id: "access",
    title: "Role-Based Access",
    description: "Separate what owners, residents, board members, vendors, managers, and admins can see or do.",
    category: "access",
    icon: <Shield className="w-5 h-5" />,
    features: ["6 role types", "Granular permission controls", "Property-scoped access", "Vendor-limited views", "Admin override"],
    coord: "04.B",
  },
  {
    id: "audit",
    title: "Audit Trail",
    description: "Record every status change, message, attachment, approval, and decision.",
    category: "access",
    icon: <ClipboardList className="w-5 h-5" />,
    features: ["Immutable event log", "User action timestamps", "Document version history", "Approval records", "Compliance export"],
    coord: "05.A",
  },
  {
    id: "ai-automation",
    title: "AI Automation Layer",
    description: "Classify tickets, summarize emails, draft replies, extract action items from meetings, and flag urgent issues.",
    category: "automation",
    icon: <Zap className="w-5 h-5" />,
    features: ["Ticket auto-classification", "Email summarization", "AI reply drafting", "Meeting action extraction", "Urgency flagging"],
    coord: "05.B",
  },
];

const DECISION_QUESTIONS: DecisionQuestion[] = [
  {
    id: "timeline",
    question: "How quickly do you need a working system?",
    options: [
      { label: "Immediately (days)", value: "now", points: { "condo-hoa-software": 3, "no-code": 2, "custom-saas": 0 } },
      { label: "Within a few weeks", value: "weeks", points: { "no-code": 3, "condo-hoa-software": 2, "custom-saas": 1 } },
      { label: "I can invest 2–6 months", value: "months", points: { "custom-saas": 3, "claude-code": 3, "codex": 2 } },
    ],
  },
  {
    id: "ownership",
    question: "Do you want to own and potentially sell the software?",
    options: [
      { label: "Yes — this is a product vision", value: "product", points: { "custom-saas": 3, "claude-code": 3, "codex": 2 } },
      { label: "No — just for my company's operations", value: "internal", points: { "condo-hoa-software": 3, "no-code": 2 } },
      { label: "Not sure yet", value: "unsure", points: { "no-code": 2, "condo-hoa-software": 2, "custom-saas": 1 } },
    ],
  },
  {
    id: "tech",
    question: "What is your team's technical capability?",
    options: [
      { label: "No developers — non-technical team", value: "none", points: { "condo-hoa-software": 3, "no-code": 3 } },
      { label: "Some technical staff or contractors", value: "some", points: { "no-code": 2, "condo-hoa-software": 2, "custom-saas": 1 } },
      { label: "Full development team available", value: "full", points: { "custom-saas": 3, "claude-code": 3, "codex": 3 } },
    ],
  },
  {
    id: "ai-preference",
    question: "Which AI ecosystem do you prefer?",
    options: [
      { label: "Anthropic / Claude", value: "anthropic", points: { "claude-code": 3 } },
      { label: "OpenAI / ChatGPT", value: "openai", points: { "codex": 3 } },
      { label: "No preference / not sure", value: "none", points: { "claude-code": 1, "codex": 1 } },
    ],
  },
];

// ─── Utility hooks ─────────────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function FitBadge({ fit }: { fit: FitLevel }) {
  const styles: Record<FitLevel, string> = {
    best: "text-[oklch(0.72_0.18_200)] border-[oklch(0.72_0.18_200/0.5)] bg-[oklch(0.72_0.18_200/0.08)]",
    good: "text-[oklch(0.75_0.17_65)] border-[oklch(0.75_0.17_65/0.5)] bg-[oklch(0.75_0.17_65/0.08)]",
    limited: "text-[oklch(0.60_0.22_25)] border-[oklch(0.60_0.22_25/0.5)] bg-[oklch(0.60_0.22_25/0.08)]",
  };
  const labels: Record<FitLevel, string> = { best: "Best Fit", good: "Good Fit", limited: "Limited" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs border rounded font-mono uppercase tracking-wider ${styles[fit]}`}>
      {fit === "best" && <Star className="w-2.5 h-2.5" />}
      {labels[fit]}
    </span>
  );
}

function SectionLabel({ coord, label }: { coord: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.72_0.18_200/0.5)]">{coord}</span>
      <span className="font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.72_0.18_200)]">{label}</span>
      <div className="flex-1 border-t border-dashed border-[oklch(0.30_0.025_230)]" />
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="inline-block px-2 py-0.5 text-[0.65rem] bg-[oklch(0.20_0.018_240)] border border-[oklch(0.28_0.025_230)] rounded text-[oklch(0.60_0.008_220)] font-mono">
      {label}
    </span>
  );
}

// ─── Search Bar ────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[oklch(0.50_0.012_220)]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search platforms, modules, tools, tags…"
        className="w-full pl-11 pr-10 py-3 bg-[oklch(0.16_0.018_240)] border border-[oklch(0.28_0.025_230)] rounded text-sm text-[oklch(0.88_0.008_220)] placeholder-[oklch(0.45_0.008_220)] focus:outline-none focus:border-[oklch(0.72_0.18_200/0.6)] focus:ring-1 focus:ring-[oklch(0.72_0.18_200/0.3)] transition-all duration-200"
        style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[oklch(0.50_0.012_220)] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Decision Wizard ──────────────────────────────────────────────────────────
function DecisionWizard() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);

  const scores = useMemo(() => {
    const s: Record<string, number> = {};
    Object.entries(answers).forEach(([qid, val]) => {
      const q = DECISION_QUESTIONS.find((q) => q.id === qid);
      const opt = q?.options.find((o) => o.value === val);
      if (opt) {
        Object.entries(opt.points).forEach(([pid, pts]) => {
          s[pid] = (s[pid] || 0) + pts;
        });
      }
    });
    return s;
  }, [answers]);

  const topPick = useMemo(() => {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0];
  }, [scores]);

  const topPlatform = PLATFORMS.find((p) => p.id === topPick);
  const allAnswered = DECISION_QUESTIONS.every((q) => answers[q.id]);

  return (
    <div className="bp-card rounded p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-[oklch(0.75_0.17_65/0.12)] rounded text-[oklch(0.75_0.17_65)]">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-white text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Decision Wizard
          </h3>
          <p className="text-[oklch(0.55_0.008_220)] text-xs" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Answer 4 questions to get a personalized recommendation
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {DECISION_QUESTIONS.map((q, qi) => (
          <div key={q.id}>
            <p className="text-sm font-medium text-[oklch(0.85_0.008_220)] mb-3" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              <span className="font-mono text-[oklch(0.72_0.18_200/0.7)] mr-2 text-xs">0{qi + 1}</span>
              {q.question}
            </p>
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setAnswers((a) => ({ ...a, [q.id]: opt.value })); setShowResult(false); }}
                  className={`px-3 py-2 text-xs rounded border transition-all duration-150 ${
                    answers[q.id] === opt.value
                      ? "border-[oklch(0.72_0.18_200)] bg-[oklch(0.72_0.18_200/0.12)] text-[oklch(0.72_0.18_200)]"
                      : "border-[oklch(0.28_0.025_230)] text-[oklch(0.65_0.008_220)] hover:border-[oklch(0.40_0.025_230)] hover:text-white"
                  }`}
                  style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {allAnswered && !showResult && (
        <button
          onClick={() => setShowResult(true)}
          className="mt-6 w-full py-3 bg-[oklch(0.72_0.18_200)] text-[oklch(0.10_0.018_240)] font-semibold text-sm rounded transition-all duration-200 hover:bg-[oklch(0.78_0.18_200)] active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Get My Recommendation <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {showResult && topPlatform && (
        <div className="mt-6 p-5 bg-[oklch(0.72_0.18_200/0.06)] border border-[oklch(0.72_0.18_200/0.3)] rounded">
          <p className="font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.72_0.18_200/0.7)] mb-2">Your Best Match</p>
          <h4 className="font-bold text-white text-xl mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {topPlatform.name}
          </h4>
          <p className="text-[oklch(0.72_0.18_200)] text-sm mb-3" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {topPlatform.recommendation}
          </p>
          <p className="text-[oklch(0.65_0.008_220)] text-xs leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {topPlatform.bestFor}
          </p>
          <button
            onClick={() => { setAnswers({}); setShowResult(false); }}
            className="mt-4 text-xs text-[oklch(0.50_0.012_220)] hover:text-white transition-colors underline underline-offset-2"
            style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
          >
            Start over
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Platform Card ─────────────────────────────────────────────────────────────
function PlatformCard({ platform, delay = 0 }: { platform: Platform; delay?: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="bp-card rounded p-5 cursor-pointer"
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-white text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {platform.name}
            </h3>
            <FitBadge fit={platform.fit} />
          </div>
          <p className="font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.55_0.012_220)]">
            {platform.type}
          </p>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-[oklch(0.50_0.012_220)] shrink-0 mt-1 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        />
      </div>

      <p className="text-[oklch(0.68_0.008_220)] text-sm mb-3 leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
        {platform.bestFor}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {platform.tags.slice(0, 4).map((t) => <Tag key={t} label={t} />)}
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[oklch(0.22_0.020_235)] space-y-4">
          <div>
            <p className="font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.72_0.18_200/0.7)] mb-2">Strengths</p>
            <ul className="space-y-1.5">
              {platform.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[oklch(0.70_0.008_220)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[oklch(0.72_0.18_200)] shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.75_0.17_65/0.7)] mb-2">Main Limitation</p>
            <div className="flex items-start gap-2 text-xs text-[oklch(0.65_0.008_220)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              <AlertTriangle className="w-3.5 h-3.5 text-[oklch(0.75_0.17_65)] shrink-0 mt-0.5" />
              {platform.limitation}
            </div>
          </div>
          <div className="p-3 bg-[oklch(0.72_0.18_200/0.06)] border border-[oklch(0.72_0.18_200/0.2)] rounded">
            <p className="text-xs text-[oklch(0.72_0.18_200)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              <strong>Verdict:</strong> {platform.recommendation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MVP Module Card ───────────────────────────────────────────────────────────
function MvpCard({ mod, delay = 0 }: { mod: MvpModule; delay?: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="bp-card rounded p-5 cursor-pointer"
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-[oklch(0.72_0.18_200/0.10)] rounded text-[oklch(0.72_0.18_200)] shrink-0">
          {mod.icon}
        </div>
        <span className="font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.35_0.025_230)]">{mod.coord}</span>
      </div>
      <h3 className="font-semibold text-white text-sm mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        {mod.title}
      </h3>
      <p className="text-[oklch(0.58_0.008_220)] text-xs leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
        {mod.description}
      </p>
      {expanded && (
        <ul className="mt-4 pt-4 border-t border-[oklch(0.22_0.020_235)] space-y-1.5">
          {mod.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-[oklch(0.65_0.008_220)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              <div className="w-1 h-1 rounded-full bg-[oklch(0.72_0.18_200)]" />
              {f}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-1 text-[oklch(0.45_0.012_220)] text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {expanded ? "collapse" : "expand features"}
        <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
      </div>
    </div>
  );
}

// ─── Stack Card ────────────────────────────────────────────────────────────────
const STACK_ICONS: Record<string, React.ReactNode> = {
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

function StackCard({ item, delay = 0 }: { item: StackItem; delay?: number }) {
  return (
    <div className="bp-card rounded p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[oklch(0.72_0.18_200)]">{STACK_ICONS[item.layer]}</span>
        <span className="font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.72_0.18_200)]">{item.layer}</span>
      </div>
      <p className="font-semibold text-white text-sm mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        {item.choice}
      </p>
      <p className="text-[oklch(0.58_0.008_220)] text-xs leading-relaxed mb-3" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
        {item.why}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {item.examples.map((ex) => <Tag key={ex} label={ex} />)}
      </div>
    </div>
  );
}

// ─── Navbar ────────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: "Guide", href: "#guide" },
  { label: "Platforms", href: "#platforms" },
  { label: "MVP Modules", href: "#mvp" },
  { label: "Tech Stack", href: "#stack" },
  { label: "Next Steps", href: "#nextsteps" },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[oklch(0.11_0.018_240/0.95)] backdrop-blur-md border-b border-[oklch(0.20_0.020_235)]" : "bg-transparent"}`}>
      <div className="container flex items-center justify-between h-14">
        <a href="#" className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[oklch(0.72_0.18_200)]" />
          <span className="font-mono text-[0.65rem] tracking-widest uppercase text-[oklch(0.72_0.18_200)] hidden sm:block">CondoOps Guide</span>
        </a>
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="px-3 py-1.5 text-xs rounded text-[oklch(0.60_0.008_220)] hover:text-white transition-colors duration-150 font-mono tracking-wide">
              {l.label}
            </a>
          ))}
        </div>
        <button className="md:hidden p-2 text-[oklch(0.60_0.008_220)] hover:text-white" onClick={() => setMobileOpen((v) => !v)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden bg-[oklch(0.13_0.018_240)] border-b border-[oklch(0.20_0.020_235)] px-4 pb-4">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="block py-2.5 text-sm text-[oklch(0.65_0.008_220)] hover:text-[oklch(0.72_0.18_200)] transition-colors" onClick={() => setMobileOpen(false)}>
              <ChevronRight className="inline w-3 h-3 mr-1 opacity-50" />{l.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ search, onSearch }: { search: string; onSearch: (v: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLoaded(true), 80); return () => clearTimeout(t); }, []);
  return (
    <section
      className="relative min-h-[70vh] flex flex-col justify-end overflow-hidden"
      style={{
        backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663132279489/KVXVHrh2Zbni8XWHgAy83Y/hero-blueprint-TsGZFsNiWDgbYZpGcwysgk.webp)`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.11_0.018_240/0.55)] via-[oklch(0.11_0.018_240/0.72)] to-[oklch(0.11_0.018_240/0.98)]" />
      <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, oklch(0.30 0.025 230 / 0.4) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
      <div className="relative container pb-16 pt-28">
        <div className={`max-w-3xl transition-all duration-700 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <div className="flex items-center gap-2 mb-5">
            <BookOpen className="w-3.5 h-3.5 text-[oklch(0.72_0.18_200)]" />
            <span className="font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.72_0.18_200)]">
              Property Manager's Searchable Guide — CondoOps v1.0
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight text-white mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Condominium<br />
            <span style={{ color: "oklch(0.72 0.18 200)", textShadow: "0 0 20px oklch(0.72 0.18 200 / 0.4)" }}>Automation Guide</span>
          </h1>
          <p className="text-base md:text-lg text-[oklch(0.72_0.008_220)] max-w-xl leading-relaxed mb-8" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            A searchable, filterable reference for property managers choosing the right platform, AI tool, and build strategy for condominium-only operations.
          </p>
          {/* Global search bar */}
          <div className="max-w-xl">
            <SearchBar value={search} onChange={onSearch} />
            <p className="mt-2 text-xs text-[oklch(0.45_0.008_220)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              Search across platforms, MVP modules, tech stack layers, tags, and descriptions
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Guide Section (Executive Summary) ────────────────────────────────────────
function GuideSection() {
  const { ref, inView } = useInView();
  return (
    <section id="guide" className="py-20" ref={ref}>
      <div className="container">
        <SectionLabel coord="00.A" label="EXECUTIVE GUIDE" />
        <div className={`grid md:grid-cols-3 gap-8 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="md:col-span-2 space-y-5 text-[oklch(0.75_0.008_220)] text-sm leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            <h2 className="text-3xl font-bold text-white leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Neither Claude nor Codex<br />
              <span style={{ color: "oklch(0.72 0.18 200)" }}>is the system itself.</span>
            </h2>
            <p>
              For a condominium-only property management automation system, <strong className="text-white">Claude Code and OpenAI Codex are best understood as AI coding assistants</strong> that help build, debug, and maintain the system. The product itself should be either an existing condo/HOA platform, a no-code prototype, or a custom web application.
            </p>
            <p>
              The recommended path is a <strong className="text-white">hybrid approach</strong>. If you need a working solution immediately, evaluate established platforms such as Condo Control, Buildium, DoorLoop, or Yardi Breeze. If your goal is a proprietary condo-only system, build a custom SaaS and use <strong style={{ color: "oklch(0.72 0.18 200)" }}>Claude Code first</strong>, with Codex as a strong alternative.
            </p>
            <div className="p-4 border-l-[3px] border-[oklch(0.72_0.18_200)] bg-[oklch(0.72_0.18_200/0.05)] rounded-r">
              <p className="text-[oklch(0.85_0.008_220)] italic">
                "Use Claude Code to build the first custom version. Use Codex as a strong alternative or companion for code review, debugging, and OpenAI-centered automation. Use neither as the business platform itself — use them to <em>build</em> the platform."
              </p>
            </div>
          </div>
          <div>
            <DecisionWizard />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Platforms Section ─────────────────────────────────────────────────────────
const PLATFORM_CATEGORIES: { value: Category; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ai-tools", label: "AI Tools" },
  { value: "platforms", label: "Platforms" },
  { value: "custom", label: "Custom Build" },
  { value: "no-code", label: "No-Code" },
];

function PlatformsSection({ search }: { search: string }) {
  const [cat, setCat] = useState<Category>("all");
  const { ref, inView } = useInView();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return PLATFORMS.filter((p) => {
      const matchCat = cat === "all" || p.category === cat;
      const matchSearch = !q || [p.name, p.type, p.bestFor, p.limitation, p.recommendation, ...p.tags, ...p.strengths].join(" ").toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [cat, search]);

  return (
    <section id="platforms" className="py-20 bg-[oklch(0.13_0.018_240)]" ref={ref}>
      <div className="container">
        <SectionLabel coord="01.A" label="PLATFORMS & TOOLS COMPARED" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Choose Your Approach
          </h2>
          <div className="flex items-center gap-1 flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[oklch(0.50_0.012_220)] mr-1" />
            {PLATFORM_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCat(c.value)}
                className={`px-3 py-1.5 text-xs rounded border transition-all duration-150 font-mono ${
                  cat === c.value
                    ? "border-[oklch(0.72_0.18_200)] bg-[oklch(0.72_0.18_200/0.12)] text-[oklch(0.72_0.18_200)]"
                    : "border-[oklch(0.28_0.025_230)] text-[oklch(0.55_0.008_220)] hover:border-[oklch(0.40_0.025_230)] hover:text-white"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[oklch(0.45_0.008_220)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            No results for "{search}" in this category.
          </div>
        ) : (
          <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-5 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            {filtered.map((p, i) => <PlatformCard key={p.id} platform={p} delay={i * 60} />)}
          </div>
        )}

        {/* Claude vs Codex quick comparison */}
        <div className="mt-14">
          <SectionLabel coord="01.B" label="CLAUDE CODE vs. CODEX — DECISION GUIDE" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              <thead>
                <tr className="border-b border-[oklch(0.25_0.025_230)]">
                  <th className="text-left py-3 px-4 font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.50_0.012_220)]">Factor</th>
                  <th className="text-left py-3 px-4 font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.72_0.18_200)]">Choose Claude Code If…</th>
                  <th className="text-left py-3 px-4 font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.50_0.012_220)]">Choose Codex If…</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Product is still undefined", "You want help shaping the architecture and evolving requirements.", "You already know the structure and need fast implementation."],
                  ["Codebase complexity", "You expect many interconnected files and frequent refactors.", "You want strong code review, debugging, and automation workflows."],
                  ["AI provider preference", "You prefer Anthropic/Claude for reasoning and planning.", "You prefer OpenAI/ChatGPT and may use OpenAI APIs in the product."],
                  ["Team workflow", "Terminal/IDE/web workflows with project instructions and tool integrations.", "OpenAI-centered GitHub, Slack, Linear, CLI/IDE/web workflows."],
                  ["Practical recommendation", "Start here for the first build.", "Use as second assistant/reviewer or primary tool if you prefer OpenAI."],
                ].map(([factor, claude, codex], i) => (
                  <tr key={i} className="border-b border-[oklch(0.20_0.020_235)] hover:bg-[oklch(0.72_0.18_200/0.03)] transition-colors duration-150">
                    <td className="py-3 px-4 font-medium text-[oklch(0.78_0.008_220)]">{factor}</td>
                    <td className="py-3 px-4 text-[oklch(0.72_0.18_200/0.85)]">{claude}</td>
                    <td className="py-3 px-4 text-[oklch(0.62_0.008_220)]">{codex}</td>
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

// ─── MVP Section ───────────────────────────────────────────────────────────────
const MVP_CATEGORIES: { value: MvpCategory; label: string }[] = [
  { value: "all", label: "All Modules" },
  { value: "core", label: "Core Operations" },
  { value: "communication", label: "Communication" },
  { value: "automation", label: "Automation" },
  { value: "access", label: "Access & Audit" },
];

function MvpSection({ search }: { search: string }) {
  const [cat, setCat] = useState<MvpCategory>("all");
  const { ref, inView } = useInView();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return MVP_MODULES.filter((m) => {
      const matchCat = cat === "all" || m.category === cat;
      const matchSearch = !q || [m.title, m.description, ...m.features].join(" ").toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [cat, search]);

  return (
    <section id="mvp" className="py-20" ref={ref}>
      <div className="container">
        <SectionLabel coord="02.A" label="MVP MODULE REFERENCE" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Condominium-Only MVP Modules
            </h2>
            <p className="text-[oklch(0.55_0.008_220)] text-xs mt-1" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
              Click any card to expand its feature list
            </p>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-[oklch(0.50_0.012_220)] mr-1" />
            {MVP_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCat(c.value)}
                className={`px-3 py-1.5 text-xs rounded border transition-all duration-150 font-mono ${
                  cat === c.value
                    ? "border-[oklch(0.72_0.18_200)] bg-[oklch(0.72_0.18_200/0.12)] text-[oklch(0.72_0.18_200)]"
                    : "border-[oklch(0.28_0.025_230)] text-[oklch(0.55_0.008_220)] hover:border-[oklch(0.40_0.025_230)] hover:text-white"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[oklch(0.45_0.008_220)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            No modules match "{search}".
          </div>
        ) : (
          <div className={`grid sm:grid-cols-2 lg:grid-cols-4 gap-5 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            {filtered.map((m, i) => <MvpCard key={m.id} mod={m} delay={i * 50} />)}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Stack Section ─────────────────────────────────────────────────────────────
const STACK_CATS: { value: StackCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "frontend", label: "Front End" },
  { value: "backend", label: "Back End" },
  { value: "data", label: "Data & Auth" },
  { value: "integration", label: "Integrations" },
  { value: "ai", label: "AI" },
  { value: "infra", label: "Infrastructure" },
];

function StackSection({ search }: { search: string }) {
  const [cat, setCat] = useState<StackCategory>("all");
  const { ref, inView } = useInView();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return STACK_ITEMS.filter((s) => {
      const matchCat = cat === "all" || s.category === cat;
      const matchSearch = !q || [s.layer, s.choice, s.why, ...s.examples].join(" ").toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [cat, search]);

  return (
    <section id="stack" className="py-20 bg-[oklch(0.13_0.018_240)]" ref={ref}>
      <div className="container">
        <SectionLabel coord="03.A" label="RECOMMENDED TECH STACK" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Build Architecture
          </h2>
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-[oklch(0.50_0.012_220)] mr-1" />
            {STACK_CATS.map((c) => (
              <button
                key={c.value}
                onClick={() => setCat(c.value)}
                className={`px-3 py-1.5 text-xs rounded border transition-all duration-150 font-mono ${
                  cat === c.value
                    ? "border-[oklch(0.72_0.18_200)] bg-[oklch(0.72_0.18_200/0.12)] text-[oklch(0.72_0.18_200)]"
                    : "border-[oklch(0.28_0.025_230)] text-[oklch(0.55_0.008_220)] hover:border-[oklch(0.40_0.025_230)] hover:text-white"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[oklch(0.45_0.008_220)]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            No stack layers match "{search}".
          </div>
        ) : (
          <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-5 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            {filtered.map((s, i) => <StackCard key={s.id} item={s} delay={i * 50} />)}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Next Steps Section ────────────────────────────────────────────────────────
function NextStepsSection() {
  const { ref, inView } = useInView();
  return (
    <section id="nextsteps" className="py-20" ref={ref}>
      <div className="container">
        <SectionLabel coord="04.A" label="SUGGESTED NEXT STEPS" />
        <div className={`grid md:grid-cols-2 gap-12 transition-all duration-500 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div>
            <h2 className="text-2xl font-bold text-white mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              From Guide to Action
            </h2>
            <div className="space-y-4">
              {[
                { step: "01", title: "Define user roles and permissions", desc: "Map out what managers, board members, vendors, owners, and residents need to see and do." },
                { step: "02", title: "Write a one-page product blueprint", desc: "Define the ticket workflow, email/calendar integrations, meeting workflow, and first 30-day MVP scope before any coding begins." },
                { step: "03", title: "Evaluate off-the-shelf platforms first", desc: "Test Condo Control, Buildium, or DoorLoop against your exact workflow. Only build custom if none fit." },
                { step: "04", title: "Initialize the project with Claude Code", desc: "Use Claude Code to generate the project structure, database schema, screens, and API routes from the blueprint." },
                { step: "05", title: "Integrate email and calendar first", desc: "Gmail/Outlook and Google/Microsoft Calendar integrations deliver the highest daily-operations value." },
              ].map((item, i) => (
                <div key={i} className="bp-card p-4 rounded flex gap-4">
                  <span className="font-mono text-[oklch(0.72_0.18_200)] text-lg leading-none mt-0.5 shrink-0">{item.step}</span>
                  <div>
                    <p className="font-semibold text-white text-sm mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{item.title}</p>
                    <p className="text-[oklch(0.58_0.008_220)] text-xs leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <h3 className="font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.72_0.18_200)]">FINAL ANSWER</h3>
            <div className="bp-card p-6 rounded">
              <p className="text-[oklch(0.78_0.008_220)] text-sm leading-relaxed mb-4" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                If you are asking <em>"Should I use Claude, Codex, or something else?"</em>, the answer is:
              </p>
              <p className="text-white text-sm leading-relaxed mb-4" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                <strong style={{ color: "oklch(0.72 0.18 200)" }}>Use Claude Code</strong> to help build the first custom version, especially if you want a condominium-only system. <strong style={{ color: "oklch(0.72 0.18 200)" }}>Use Codex</strong> as a strong alternative or companion for code review, debugging, and OpenAI-centered automation.
              </p>
              <p className="text-[oklch(0.65_0.008_220)] text-sm leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                But the actual system should be a <strong className="text-white">custom web app</strong> or an existing condo/HOA platform — not Claude or Codex alone.
              </p>
            </div>
            <div className="bp-card p-5 rounded">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-[oklch(0.75_0.17_65)]" />
                <span className="font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.75_0.17_65)]">Key Insight</span>
              </div>
              <p className="text-[oklch(0.70_0.008_220)] text-xs leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                A condominium management company needs more than a ticketing tool. Serious platforms combine work orders, preventive maintenance, vendors, communications, board governance, agendas, minutes, notices, documents, reporting, and often accounting/payment integrations. Design your system around the actual operating model — not apartments or leases.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── References & Footer ───────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-[oklch(0.20_0.020_235)] bg-[oklch(0.11_0.018_240)]">
      <div className="container py-10">
        <SectionLabel coord="05.A" label="REFERENCES" />
        <div className="space-y-3 mb-8">
          {[
            { num: "1", title: "Condo Control | Condo, HOA and Property Management Software", url: "https://www.condocontrol.com/" },
            { num: "2", title: "Claude Code Overview — Claude Code Docs", url: "https://code.claude.com/docs/en/overview" },
            { num: "3", title: "Codex | OpenAI Developers", url: "https://developers.openai.com/codex" },
          ].map((ref) => (
            <div key={ref.num} className="flex items-start gap-3 text-sm">
              <span className="font-mono text-[0.6rem] text-[oklch(0.35_0.025_230)] shrink-0 mt-0.5">[{ref.num}]</span>
              <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-[oklch(0.60_0.008_220)] hover:text-[oklch(0.72_0.18_200)] transition-colors duration-150 flex items-center gap-1.5 text-xs" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                {ref.title} <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[oklch(0.18_0.018_240)]">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[oklch(0.72_0.18_200)]" />
            <span className="font-mono text-[0.6rem] tracking-widest uppercase text-[oklch(0.72_0.18_200)]">CondoOps Automation Guide</span>
          </div>
          <p className="text-[oklch(0.40_0.008_220)] text-xs" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            Prepared by Manus AI · May 2026 · Condominium-only property management
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [search, setSearch] = useState("");

  return (
    <div className="min-h-screen bg-[oklch(0.11_0.018_240)]">
      <Navbar />
      <Hero search={search} onSearch={setSearch} />
      <GuideSection />
      <PlatformsSection search={search} />
      <MvpSection search={search} />
      <StackSection search={search} />
      <NextStepsSection />
      <Footer />
    </div>
  );
}
