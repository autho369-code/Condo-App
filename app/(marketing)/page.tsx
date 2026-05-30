import Link from 'next/link';
import { FeaturesSection, PricingSection, FAQSection, CTASection } from './_sections/marketing-sections';

export const metadata = { title: 'Portier — HOA & condo management, reimagined' };

export default function Landing() {
  return (
    <>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cream-50 via-cream-100 to-cream-200" />
        <div className="absolute right-0 top-0 -z-0 h-[600px] w-[600px] rounded-full bg-cream-300/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 -z-0 h-[400px] w-[400px] rounded-full bg-cream-400/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border border-cream-300 bg-cream-100 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-cream-700">
              Built for modern management companies
            </span>
            <h1 className="mt-8 font-serif text-5xl font-light leading-[1.08] tracking-tightest text-ink-900 md:text-7xl">
              Run your HOAs like it&apos;s 2030,<br/>
              <span className="text-cream-600 italic">not 2005.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-ink-500 md:text-xl">
              The complete operating system for property management companies. Collect dues, write checks,
              manage work orders, keep boards informed — all in one place. Half the price of AppFolio.
              Ten times the user experience.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup"
                className="btn-primary text-base">
                Start your 30-day free trial
              </Link>
              <Link href="#demo"
                className="btn-secondary text-base">
                Watch 2-minute demo
              </Link>
            </div>
            <p className="mt-5 text-xs text-ink-300">No credit card required &middot; Cancel any time &middot; Your data stays yours</p>
          </div>

          {/* Social proof row */}
          <div className="mx-auto mt-20 grid max-w-3xl grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              ['1,200+', 'units under management'],
              ['$3M+',   'dues processed yearly'],
              ['30',     'management companies'],
              ['99.98%', 'uptime SLA'],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="font-serif text-4xl font-light tracking-tightest text-ink-800">{n}</div>
                <div className="mt-1 text-[13px] font-medium uppercase tracking-wider text-cream-600">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <div id="features"><FeaturesSection /></div>

      {/* ============ HOW IT WORKS ============ */}
      <section className="border-t border-cream-200 bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-medium uppercase tracking-widest text-cream-600">How it works</span>
            <h2 className="mt-3 font-serif text-4xl font-light tracking-tightest text-ink-900 md:text-5xl">Onboard an association in an afternoon.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-400">
              Most property management platforms take 90 days to implement. We take 3 hours.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-4">
            {[
              ['1', 'Sign up', 'Create your management company account. 30-day free trial, no card required.'],
              ['2', 'Import', 'Drag in a CSV of units and owners. We handle the rest.'],
              ['3', 'Configure', 'Set assessment amounts, late fees, and banking. Connect Stripe in 2 minutes.'],
              ['4', 'Go live', 'Invite your team, owners, and board. Send your first statements.'],
            ].map(([n, title, desc]) => (
              <div key={n} className="group">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cream-100 font-serif text-xl font-light text-cream-700 transition-colors group-hover:bg-cream-600 group-hover:text-white">
                  {n}
                </div>
                <h3 className="mt-4 font-serif text-lg font-medium text-ink-800">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <div id="pricing"><PricingSection /></div>

      {/* ============ FAQ ============ */}
      <div id="faq"><FAQSection /></div>

      {/* ============ CTA ============ */}
      <CTASection />
    </>
  );
}
