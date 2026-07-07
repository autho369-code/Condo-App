import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Us — Built by Property Managers',
  description: 'Built by property managers, for property managers. Portier369 replaces fragmented systems with one unified platform for HOA and condo management companies across the USA.',
  alternates: { canonical: '/company' },
};

export default function CompanyPage() {
  return (
    <div className="bg-white">
      {/* Hero — dark to match landing */}
      <section className="relative overflow-hidden bg-[#060709] pt-20 pb-20 sm:pt-24 sm:pb-24">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[860px] -translate-x-1/2 rounded-full opacity-[0.14]" style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-56 -right-24 h-[460px] w-[460px] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, #c9a86a 0%, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '88px 88px' }} />
        <div className="relative max-w-[1180px] mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[12px] font-medium tracking-[0.02em] text-zinc-300 mb-7">
            About Portier369
          </div>
          <h1 className="text-[36px] leading-[1.06] tracking-[-0.03em] font-semibold text-white max-w-4xl mx-auto sm:text-5xl lg:text-[60px]">
            Built from 29 years in the field — not from a conference room.
          </h1>
          <p className="mt-6 text-[17px] leading-8 text-zinc-400 max-w-2xl mx-auto sm:text-lg">
            Portier369 was founded by a CAM, CMCA, and AMS professional who has managed thousands of units, worked with
            hundreds of board members, coordinated major capital projects, resolved violations, handled emergencies, and
            navigated the daily realities of community management.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="bg-[#F5F4F1] py-16 sm:py-20">
        <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-[40px] leading-[1.1] tracking-[-0.02em] font-bold text-gray-900">
              Every workflow reflects how property managers actually work.
            </h2>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed">
              After nearly three decades in the trenches — managing associations, handling emergencies at 2 AM, chasing vendors for insurance certificates, preparing board packets at midnight — the founder knew exactly what the industry was missing. Not another generic property management system. Not a tool designed by software developers who have never walked an association property. Something built from real experience.
            </p>
            <p className="mt-4 text-lg text-gray-600 leading-relaxed">
              Portier369 is the operating system that should have existed decades ago. One platform that replaces the six disconnected systems most management companies juggle. Workflows that mirror how managers actually think and operate. AI that is genuinely useful — not a bolt-on checkbox feature.
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-gray-200 p-8 shadow-[0_25px_70px_-20px_rgba(30,58,95,0.15)]">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Portier369 vs Traditional Software</h3>
            <div className="space-y-0">
              {[
                { traditional: 'Complex setup', portier: 'White-glove onboarding' },
                { traditional: 'Multiple systems', portier: 'One platform' },
                { traditional: 'Generic workflows', portier: 'HOA-focused workflows' },
                { traditional: 'Limited support', portier: 'Direct access to experts' },
                { traditional: 'Expensive scaling', portier: 'Predictable pricing' },
                { traditional: 'Built by software companies', portier: 'Built by managers' },
              ].map((row, i) => (
                <div key={i} className={`flex items-center py-3 ${i < 5 ? 'border-b border-gray-100' : ''}`}>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-red-400 text-sm">✕</span>
                    <span className="text-sm text-gray-500">{row.traditional}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-emerald-500 text-sm">✓</span>
                    <span className="text-sm font-medium text-gray-900">{row.portier}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 sm:py-20">
        <div className="max-w-[1280px] mx-auto px-6">
          <h2 className="text-[40px] leading-[1.1] tracking-[-0.02em] font-bold text-gray-900 text-center mb-12">
            What drives us
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_25px_70px_-20px_rgba(30,58,95,0.08)]">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Manager-first design</h3>
              <p className="text-gray-600 leading-relaxed">Every feature starts with the question: &ldquo;Would this make a property manager&apos;s day easier?&rdquo; If the answer is no, we do not build it.</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_25px_70px_-20px_rgba(30,58,95,0.08)]">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Operational excellence</h3>
              <p className="text-gray-600 leading-relaxed">We believe property management software should prevent problems, not just document them. Proactive alerts, automated workflows, and AI that catches issues before they escalate.</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_25px_70px_-20px_rgba(30,58,95,0.08)]">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Radical transparency</h3>
              <p className="text-gray-600 leading-relaxed">No hidden modules. No implementation fees. No long-term contracts. Predictable, door-based pricing that scales with your portfolio — not your headaches.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Credentials */}
      <section className="bg-[#1E3A5F] py-16 sm:py-20">
        <div className="max-w-[1280px] mx-auto px-6 text-center">
          <h2 className="text-[40px] leading-[1.1] tracking-[-0.02em] font-bold text-white mb-6">
            Industry credentials that matter
          </h2>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto mb-12">
            The Portier369 founding team holds CAM, CMCA, and AMS designations — the highest professional credentials in community association management.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { label: 'CAM', full: 'Certified Association Manager' },
              { label: 'CMCA', full: 'Certified Manager of Community Associations' },
              { label: 'AMS', full: 'Association Management Specialist' },
            ].map((c, i) => (
              <div key={i} className="rounded-xl bg-white/10 border border-white/10 p-6">
                <div className="text-2xl font-bold text-white mb-1">{c.label}</div>
                <div className="text-sm text-blue-200">{c.full}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="max-w-[1280px] mx-auto px-6 text-center">
          <h2 className="text-[40px] leading-[1.1] tracking-[-0.02em] font-bold text-gray-900">
            Talk with someone who understands your business.
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            Our team has managed associations, not just built software for them.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-[#1E3A5F] text-white font-semibold hover:bg-[#152d4a] transition"
            >
              Request a Proposal
            </Link>
            <a
              href="mailto:hello@portier369.com"
              className="inline-flex items-center justify-center h-12 px-8 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
            >
              Book a Discovery Call
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
