import Link from 'next/link'
import { Check } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Professional Services — Migration, Implementation & Custom Work',
  description: 'Professional services for Portier369 customers: data migration from AppFolio, Buildium, or TOPS, historical document and financial migration, accounting conversion, custom integrations, and more. Quoted separately.',
  alternates: { canonical: '/professional-services' },
}

const serviceGroups = [
  {
    name: 'Migration',
    desc: 'Moving your history into Portier369 — accurately and completely.',
    services: [
      'Data retrieval and export from AppFolio, Buildium, TOPS, or another provider',
      'Historical document migration',
      'Historical financial transaction migration',
      'Owner ledger reconstruction',
      'Cleaning incomplete or inconsistent data',
      'Scanning and OCR of paper documents',
    ],
  },
  {
    name: 'Implementation',
    desc: 'Hands-on help beyond standard onboarding.',
    services: [
      'Custom onboarding programs',
      'On-site training',
      'Board workshops',
      'Additional administrator training sessions',
      'Dedicated account management',
    ],
  },
  {
    name: 'Accounting',
    desc: 'Getting the books right before and after go-live.',
    services: [
      'Accounting conversion from your previous system',
      'Chart-of-accounts review',
      'Ledger and balance cleanup',
      'Accounting consulting',
    ],
  },
  {
    name: 'Custom work',
    desc: 'Software built around your operation.',
    services: [
      'Custom integrations',
      'Custom reports and dashboards',
      'Custom AI workflows',
      'API integration assistance',
      'White-label applications',
      'Community websites',
    ],
  },
]

export default function ProfessionalServicesPage() {
  return (
    <div className="bg-white font-sans antialiased">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#060709] pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.14]" style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '88px 88px' }} />
        <div className="relative mx-auto max-w-[1180px] px-6 lg:px-8 text-center">
          <h1 className="text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-6xl lg:text-[64px]">
            Professional Services
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-zinc-400 sm:text-lg">
            Some communities require additional assistance beyond standard onboarding. Professional services are
            quoted separately — scoped up front, so you know exactly what the work covers and what it costs.
          </p>
        </div>
      </section>

      {/* Service groups */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {serviceGroups.map(group => (
              <div key={group.name} className="rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-gray-900">{group.name}</h2>
                <p className="mt-2 text-base text-gray-500">{group.desc}</p>
                <ul className="mt-6 space-y-3">
                  {group.services.map(svc => (
                    <li key={svc} className="flex items-start gap-2.5 text-sm text-gray-600 leading-relaxed">
                      <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                      {svc}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What standard onboarding covers */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[880px] px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-4xl">Already included with every subscription</h2>
          <p className="mt-4 text-lg text-gray-500">
            Standard onboarding — company account configuration, creation of associations, import of units, owners,
            and vendors from properly formatted spreadsheets, one remote administrator training session, and standard
            launch assistance — is included with every plan. Professional services pick up where standard onboarding
            ends.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/onboarding" className="text-base font-semibold text-[#1E3A5F] hover:underline">How onboarding works &rarr;</Link>
            <Link href="/pricing" className="text-base font-semibold text-[#1E3A5F] hover:underline">See pricing &rarr;</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-100 bg-white py-16">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">Tell us what your community needs.</h2>
          <p className="mt-4 text-lg text-gray-500">Describe the work and we&apos;ll return a written quote — no obligation.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/20 hover:bg-[#152940] transition">Request a quote</Link>
            <a href="mailto:hello@portier369.com" className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition">hello@portier369.com</a>
          </div>
        </div>
      </section>
    </div>
  )
}
