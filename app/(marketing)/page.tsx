import Link from 'next/link';
import { FeaturesSection, HowItWorksSection, SavingsSection, PricingSection, AddOnsSection, WhySwitchSection, FAQSection, ContactSection, CTASection } from './_sections/marketing-sections';

export const metadata = { title: 'Portier — The operating system for condominium and HOA management' };

function Check() {
  return (
    <svg className="h-4 w-4 flex-none text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
    </svg>
  );
}

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
            <p className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/20 px-5 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-400">
              The Best &amp; Most Affordable Property Management Platform
            </p>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-emerald-400 md:text-4xl lg:text-5xl">
              The Operating System for Modern Condominium &amp; HOA Management
            </h2>
            <h1 className="mt-6 text-4xl font-light leading-[1.08] tracking-[-0.025em] text-white md:text-6xl lg:text-7xl">
              Save Up To 60% Compared To<br />
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">
                Other Major Providers
              </span>
              <span className="block mt-2 text-xl md:text-2xl lg:text-3xl text-slate-400 font-normal">
                (using 20 year old software)
              </span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-400">
              The most affordable state-of-the-art property management software for condominiums and HOAs.
              Collect dues, manage work orders, track violations, keep boards informed — all in one platform.
            </p>
            <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-white"><Check /> No implementation fees</span>
              <span className="flex items-center gap-2 text-sm font-medium text-white"><Check /> No long-term contracts</span>
              <span className="flex items-center gap-2 text-sm font-medium text-white"><Check /> Unlimited users included</span>
              <span className="flex items-center gap-2 text-sm font-medium text-white"><Check /> Go live in days, not months</span>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href="#contact"
                className="inline-flex h-14 items-center rounded-xl bg-emerald-500 px-8 text-base font-semibold text-black transition-all hover:bg-emerald-400">
                Request More Info
              </Link>
              <Link href="#pricing"
                className="inline-flex h-14 items-center rounded-xl border border-slate-700 bg-transparent px-8 text-base font-medium text-white transition-all hover:border-slate-500">
                Compare Your Savings
              </Link>
            </div>
          </div>

          {/* Metrics */}
          <div className="mx-auto mt-20 grid max-w-3xl grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              ['7,427', 'units under management'],
              ['$12M+', 'dues processed yearly'],
              ['47', 'management companies'],
              ['99.98%', 'uptime SLA'],
            ].map(([n, l]) => (
              <div key={l}>
                <div className="text-4xl font-light tracking-[-0.02em] text-white">{n}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-widest text-slate-400">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <div id="features"><FeaturesSection /></div>

      {/* HOW IT WORKS */}
      <HowItWorksSection />

      {/* SAVINGS */}
      <SavingsSection />

      {/* PRICING */}
      <div id="pricing"><PricingSection /></div>

      {/* ADD-ONS */}
      <AddOnsSection />

      {/* WHY SWITCH */}
      <WhySwitchSection />

      {/* FAQ */}
      <div id="faq"><FAQSection /></div>

      {/* CONTACT */}
      <div id="contact"><ContactSection /></div>

      {/* CTA */}
      <CTASection />
    </>
  );
}
