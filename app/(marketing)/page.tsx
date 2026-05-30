import Link from 'next/link';
import { FeaturesSection, PricingSection, FAQSection, CTASection } from './_sections/marketing-sections';

export const metadata = { title: 'Portier — HOA & condo management, reimagined' };

export default function Landing() {
  return (
    <>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 to-white" />
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
              Built for modern management companies
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 md:text-6xl">
              Run your HOAs like it&apos;s 2030,<br/>
              <span className="text-brand-600">not 2005.</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 md:text-xl">
              The complete operating system for property management companies. Collect dues, write checks,
              manage work orders, keep boards informed — all in one place. Half the price of AppFolio.
              Ten times the user experience.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup"
                className="inline-flex h-12 items-center rounded-md bg-brand-600 px-6 text-base font-semibold text-white shadow-sm hover:bg-brand-700">
                Start your 30-day free trial
              </Link>
              <Link href="#demo"
                className="inline-flex h-12 items-center rounded-md border border-gray-300 bg-white px-6 text-base font-medium text-gray-900 hover:bg-gray-50">
                Watch 2-minute demo
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-500">No credit card required · Cancel any time · Your data stays yours</p>
          </div>

          {/* Social proof row */}
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-6 text-center md:grid-cols-4">
            {[
              ['1,200+', 'units under management'],
              ['$3M+',   'dues processed yearly'],
              ['30',     'management companies'],
              ['99.98%', 'uptime SLA'],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="text-3xl font-bold text-gray-900">{n}</div>
                <div className="text-sm text-gray-500">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <div id="features"><FeaturesSection /></div>

      {/* ============ HOW IT WORKS ============ */}
      <section className="border-t border-gray-100 bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">Onboard an association in an afternoon.</h2>
            <p className="mt-4 text-gray-600">
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
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-semibold text-white">{n}</div>
                <h3 className="mt-3 font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{desc}</p>
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
