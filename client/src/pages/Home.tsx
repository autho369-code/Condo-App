import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Ticket, CalendarDays, Mail, Users, BarChart3,
  ChevronDown, ChevronRight, Shield, Star, CheckCircle2,
  ArrowRight, Menu, X, Briefcase
} from "lucide-react";
import { Link } from "wouter";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const } }),
};

const FEATURES = [
  { icon: Ticket, title: "Work Ticket Management", desc: "AI-classified tickets from any source — portal, email, or phone. Track status from open to resolved with full comment history.", color: "bg-amber-50 text-amber-700" },
  { icon: CalendarDays, title: "Smart Scheduling Hub", desc: "Unified calendar for inspections, vendor visits, board meetings, and maintenance. Recurring events and deadline tracking built in.", color: "bg-emerald-50 text-emerald-700" },
  { icon: Mail, title: "Email Integration", desc: "Centralize all property emails in one inbox. Link threads to tickets, draft AI-powered replies, and never miss a resident message.", color: "bg-blue-50 text-blue-700" },
  { icon: Users, title: "Meeting Management", desc: "Agenda builder, minutes capture, and AI-generated summaries. Action items tracked automatically so nothing falls through the cracks.", color: "bg-purple-50 text-purple-700" },
  { icon: Briefcase, title: "Vendor Directory", desc: "Full vendor profiles with insurance expiry alerts, work history, and category management. Know exactly who is on-site and why.", color: "bg-rose-50 text-rose-700" },
  { icon: BarChart3, title: "Portfolio Analytics", desc: "Cross-property dashboards for portfolio managers. Open tickets, upcoming events, and team performance at a glance.", color: "bg-orange-50 text-orange-700" },
];

const ROLES = [
  { role: "Super Admin", desc: "Platform-wide visibility across all companies, invisible login, and subscription management.", icon: Shield },
  { role: "Company Admin", desc: "Full control over all properties, managers, billing, and white-label branding for your firm.", icon: Building2 },
  { role: "Portfolio Manager", desc: "Aggregate view across all properties under your management company — tickets, schedules, and metrics.", icon: BarChart3 },
  { role: "Property Manager", desc: "Your property workspace: tickets, calendar, emails, meetings, and the ability to add sub-users.", icon: Briefcase },
  { role: "Sub-Roles", desc: "Accountants, assistant managers, owners, vendors, and residents — each with scoped access.", icon: Users },
];

const PRICING = [
  { tier: "Starter", price: "$149", period: "/mo", properties: "Up to 3 properties", features: ["Work tickets", "Scheduling", "Email hub", "2 managers"], cta: "Start Free Trial", highlight: false },
  { tier: "Growth", price: "$349", period: "/mo", properties: "Up to 15 properties", features: ["Everything in Starter", "Meeting hub", "Vendor directory", "Portfolio view", "10 managers"], cta: "Start Free Trial", highlight: true },
  { tier: "Professional", price: "$749", period: "/mo", properties: "Up to 50 properties", features: ["Everything in Growth", "AI email drafting", "AI meeting summaries", "White-label branding", "Unlimited managers"], cta: "Start Free Trial", highlight: false },
  { tier: "Enterprise", price: "Custom", period: "", properties: "Unlimited properties", features: ["Everything in Professional", "Dedicated onboarding", "SLA support", "Custom integrations", "Multi-company management"], cta: "Contact Sales", highlight: false },
];

const FAQS = [
  { q: "Is Portier369 only for condominiums?", a: "Yes. We are purpose-built for condominium associations and HOA communities. Every feature, workflow, and role is designed around the unique needs of condo property management — not apartments or commercial real estate." },
  { q: "How does the role hierarchy work?", a: "Your company admin sets up the organization. Portfolio managers oversee multiple properties. Each property manager controls their own building and can invite accountants, assistant managers, owners, vendors, and residents with scoped access." },
  { q: "Can I white-label Portier369 for my clients?", a: "Yes. Professional and Enterprise plans include white-label branding — custom logo, colors, and domain — so you can present the platform as your own product to the boards and communities you manage." },
  { q: "What AI features are included?", a: "Portier369 uses AI to auto-classify incoming work tickets by category, draft email replies in your voice, and generate structured meeting summaries with action items extracted automatically." },
  { q: "How does email integration work?", a: "You can manually log emails or connect your Gmail / Outlook account. All threads are linked to properties and tickets. The AI draft reply feature suggests responses you can edit and send." },
];

export default function Home() {
  const { user, isAuthenticated, loginUrl } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Navigation ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-olive" />
            <span className="font-serif text-xl font-semibold text-charcoal">Portier<span className="text-gold">369</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#roles" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="sm" className="bg-olive text-cream hover:bg-olive/90">Go to Dashboard <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
              </Link>
            ) : (
              <>
                <a href={loginUrl}><Button variant="ghost" size="sm">Sign In</Button></a>
                <a href={loginUrl}><Button size="sm" className="bg-olive text-cream hover:bg-olive/90">Start Free Trial</Button></a>
              </>
            )}
          </div>
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-4 flex flex-col gap-4">
            <a href="#features" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>Features</a>
            <a href="#roles" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>How It Works</a>
            <a href="#pricing" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>Pricing</a>
            <a href="#faq" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>FAQ</a>
            <a href={loginUrl}><Button className="w-full bg-olive text-cream">Start Free Trial</Button></a>
          </div>
        )}
      </header>

      {/* ─── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-28 bg-gradient-to-b from-[oklch(0.95_0.02_85)] to-background">
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(oklch(0.18 0.02 60) 1px, transparent 1px), linear-gradient(90deg, oklch(0.18 0.02 60) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="container relative text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <Badge variant="outline" className="mb-6 border-gold text-gold bg-amber-50 px-4 py-1.5 text-xs font-medium tracking-wider uppercase">
              White-Glove Condominium Management
            </Badge>
          </motion.div>
          <motion.h1 initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="font-serif text-5xl md:text-7xl font-bold text-charcoal leading-tight max-w-4xl mx-auto">
            Every ticket, schedule,<br />
            <span className="text-olive">email & meeting</span><br />
            in one place.
          </motion.h1>
          <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Portier369 is the purpose-built operations platform for condominium property management companies — designed to be sold to the communities you serve.
          </motion.p>
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <a href={loginUrl}>
              <Button size="lg" className="bg-olive text-cream hover:bg-olive/90 px-8 py-6 text-base font-medium shadow-lg">
                Start Free Trial <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </a>
            <a href="#features">
              <Button size="lg" variant="outline" className="px-8 py-6 text-base font-medium border-border">
                See All Features <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </a>
          </motion.div>
          <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={4}
            className="mt-5 text-sm text-muted-foreground">
            No credit card required · 14-day free trial · Cancel anytime
          </motion.p>
        </div>
      </section>

      {/* ─── Stats Bar ───────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card py-10">
        <div className="container grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[["500+", "Properties Managed"], ["12k+", "Tickets Resolved"], ["98%", "Manager Satisfaction"], ["<2min", "Avg. Response Time"]].map(([val, label]) => (
            <div key={label}>
              <p className="font-serif text-3xl font-bold text-olive">{val}</p>
              <p className="text-sm text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────── */}
      <section id="features" className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-gold text-gold bg-amber-50 text-xs uppercase tracking-wider">Platform Modules</Badge>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-charcoal">Everything your team needs</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">Six integrated modules that replace five separate tools — purpose-built for condominium operations.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-charcoal mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Role Hierarchy ──────────────────────────────────────────── */}
      <section id="roles" className="py-24 bg-[oklch(0.95_0.02_85)]">
        <div className="container">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-gold text-gold bg-amber-50 text-xs uppercase tracking-wider">Role-Based Access</Badge>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-charcoal">Built for every level of your organization</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">From the platform owner to individual residents — every user sees exactly what they need and nothing they don't.</p>
          </div>
          <div className="flex flex-col gap-3 max-w-3xl mx-auto">
            {ROLES.map((r, i) => (
              <motion.div key={r.role} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-olive/10 flex items-center justify-center flex-shrink-0">
                  <r.icon className="w-5 h-5 text-olive" />
                </div>
                <div>
                  <p className="font-semibold text-charcoal">{r.role}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{r.desc}</p>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <Badge variant="outline" className="text-xs text-muted-foreground">Level {5 - i}</Badge>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-gold text-gold bg-amber-50 text-xs uppercase tracking-wider">Transparent Pricing</Badge>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-charcoal">Simple plans that scale with you</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">All plans include a 14-day free trial. No setup fees. Cancel anytime.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING.map((p, i) => (
              <motion.div key={p.tier} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className={`relative rounded-xl border p-6 flex flex-col ${p.highlight ? "border-olive bg-olive text-cream shadow-xl scale-105" : "border-border bg-card"}`}>
                {p.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><Badge className="bg-gold text-charcoal text-xs px-3">Most Popular</Badge></div>}
                <p className={`text-sm font-semibold uppercase tracking-wider mb-2 ${p.highlight ? "text-cream/70" : "text-muted-foreground"}`}>{p.tier}</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className={`font-serif text-4xl font-bold ${p.highlight ? "text-cream" : "text-charcoal"}`}>{p.price}</span>
                  <span className={`text-sm mb-1 ${p.highlight ? "text-cream/70" : "text-muted-foreground"}`}>{p.period}</span>
                </div>
                <p className={`text-xs mb-5 ${p.highlight ? "text-cream/70" : "text-muted-foreground"}`}>{p.properties}</p>
                <ul className="flex flex-col gap-2 mb-6 flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${p.highlight ? "text-cream/80" : "text-olive"}`} />
                      <span className={p.highlight ? "text-cream/90" : "text-foreground"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a href={loginUrl}>
                  <Button className={`w-full ${p.highlight ? "bg-cream text-olive hover:bg-cream/90" : "bg-olive text-cream hover:bg-olive/90"}`}>{p.cta}</Button>
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 bg-[oklch(0.95_0.02_85)]">
        <div className="container max-w-3xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-gold text-gold bg-amber-50 text-xs uppercase tracking-wider">FAQ</Badge>
            <h2 className="font-serif text-4xl font-bold text-charcoal">Common questions</h2>
          </div>
          <div className="flex flex-col gap-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                <button className="w-full text-left p-5 flex items-center justify-between gap-4" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="font-medium text-charcoal">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="container">
          <div className="bg-olive rounded-2xl p-12 text-center text-cream">
            <Star className="w-8 h-8 text-gold mx-auto mb-4" />
            <h2 className="font-serif text-4xl font-bold mb-4">Ready to elevate your operations?</h2>
            <p className="text-cream/80 max-w-xl mx-auto mb-8 text-lg">Join property management companies that trust Portier369 to run their condominium portfolios with precision and care.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={loginUrl}><Button size="lg" className="bg-cream text-olive hover:bg-cream/90 px-8 py-6 text-base font-medium">Start Free Trial <ArrowRight className="w-4 h-4 ml-2" /></Button></a>
              <a href="mailto:hello@portier369.com"><Button size="lg" variant="outline" className="border-cream/40 text-cream hover:bg-cream/10 px-8 py-6 text-base font-medium">Contact Sales</Button></a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-12">
        <div className="container flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-olive" />
            <span className="font-serif text-lg font-semibold text-charcoal">Portier<span className="text-gold">369</span></span>
          </div>
          <p className="text-sm text-muted-foreground text-center">Purpose-built for condominium property management. Not for apartments.</p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="mailto:hello@portier369.com" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
        <div className="container mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Portier369. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
