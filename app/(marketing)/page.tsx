import Link from 'next/link';
import { FeaturesSection, PricingSection, FAQSection, CTASection } from './_sections/marketing-sections';

export const metadata = { title: 'Portier — The operating system for condominium and HOA management' };

export default function Landing() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#060B18]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A1628] to-transparent" />
        <div className="absolute right-0 top-0 h-[700px] w-[700px] translate-x-1/3 -translate-y-1/4 rounded-full bg-emerald-500/[0.03] blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[500px] w-[500px] -translate-x-1/4 translate-y-1/4 rounded-full bg-blue-500/[0.03] blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6 py-28 md:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/50 bg-slate-800/50 px-4 py-1.5 text-xs font-medium text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              The operating system for condominium &amp; HOA management
            </span>
            <h1 className="mt-8 text-5xl font-light leading-[1.06] tracking-[-0.025em] text-white md:text-7xl">
              Run your portfolio like a<br/>
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">
                $50M management firm.
              </span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-400">
              The complete operating system for property management companies. Collect dues, write checks,
              manage work orders, keep boards informed — all in one place. Half the price of legacy systems.
              Ten times the experience.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup"
                className="inline-flex h-14 items-center rounded-xl bg-emerald-500 px-8 text-base font-semibold text-black transition-all hover:bg-emerald-400">
                Start your 30-day free trial
              </Link>
              <Link href="#features"
                className="inline-flex h-14 items-center rounded-xl border border-slate-700 bg-transparent px-8 text-base font-medium text-white transition-all hover:border-slate-500">
                See how it works
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-600">No credit card required &middot; Cancel any time &middot; Your data stays yours</p>
          </div>

          {/* Metrics */}
          <div className="mx-auto mt-20 grid max-w-3xl grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              ['1,200+', 'units under management'],
              ['$3M+',   'dues processed yearly'],
              ['30',     'management companies'],
              ['99.98%', 'uptime SLA'],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="text-4xl font-light tracking-[-0.02em] text-white">{n}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-widest text-slate-500">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <div id="features"><FeaturesSection /></div>

      {/* HOW IT WORKS */}
      <section className="border-t border-slate-800 bg-[#0B1121] py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">How it works</span>
            <h2 className="mt-4 text-4xl font-light tracking-tight text-white md:text-5xl">
              Onboard an association in an afternoon.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-400">
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
              <div key={n}>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-lg font-light text-emerald-400">
                  {n}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <div id="pricing"><PricingSection /></div>

      {/* FAQ */}
      <div id="faq"><FAQSection /></div>

      {/* CTA */}
      <CTASection />
    </>
  );
}
