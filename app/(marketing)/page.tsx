import Link from 'next/link';
import { FeaturesSection, PricingSection, FAQSection, CTASection } from './_sections/marketing-sections';

export const metadata = { title: 'Portier — HOA & condo management, reimagined' };

export default function Landing() {
  return (
    <>
      {/* HERO — Stripe-inspired */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-[1080px] px-6 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-[4px] border border-border-purple bg-brand-50 px-4 py-1.5 text-[13px] font-normal text-brand-500">
              Built for modern management companies
            </span>
            <h1 className="mt-8 text-[56px] font-light leading-[1.03] tracking-[-0.025em] text-navy-600 md:text-[64px]">
              Run your HOAs like it&apos;s 2030,<br/>
              <span className="text-brand-500">not 2005.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-[18px] font-light leading-[1.40] text-slate-400">
              The complete operating system for property management companies. Collect dues, write checks,
              manage work orders, keep boards informed — all in one place. Half the price of AppFolio.
              Ten times the user experience.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="btn-primary text-[16px] px-6 h-12">
                Start your 30-day free trial
              </Link>
              <Link href="#demo" className="btn-secondary text-[16px] px-6 h-12">
                Watch 2-minute demo
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-slate-400">No credit card required &middot; Cancel any time &middot; Your data stays yours</p>
          </div>

          {/* Social proof */}
          <div className="mx-auto mt-20 grid max-w-3xl grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              ['1,200+', 'units under management'],
              ['$3M+',   'dues processed yearly'],
              ['30',     'management companies'],
              ['99.98%', 'uptime SLA'],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="text-[32px] font-light tracking-[-0.02em] text-navy-600">{n}</div>
                <div className="mt-1 text-[13px] font-normal text-slate-400">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <div id="features"><FeaturesSection /></div>

      {/* HOW IT WORKS */}
      <section className="border-t border-border bg-white py-24">
        <div className="mx-auto max-w-[1080px] px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-[13px] font-medium text-brand-500 uppercase tracking-wider">How it works</span>
            <h2 className="mt-3 text-[32px] font-light leading-[1.10] tracking-[-0.02em] text-navy-600 md:text-[40px]">
              Onboard an association in an afternoon.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-slate-400">
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
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-[4px] bg-brand-50 text-[18px] font-light text-brand-500">
                  {n}
                </div>
                <h3 className="mt-4 text-[18px] font-semibold text-navy-600">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{desc}</p>
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
