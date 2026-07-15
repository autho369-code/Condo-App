import Link from 'next/link'
import { Check } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How Onboarding Works — Guided 4-Week Launch',
  description: 'Standard onboarding is included with every Portier369 subscription: account configuration, spreadsheet imports, administrator training, and launch assistance over a guided four-week timeline.',
  alternates: { canonical: '/onboarding' },
}

const weeks = [
  {
    week: 'Week 1',
    title: 'Account creation & configuration',
    desc: 'We create your company account, configure your branding and settings, and set up your associations so the platform reflects your operation from day one.',
    items: ['Company account configuration', 'Creation of associations', 'Branding and settings review'],
  },
  {
    week: 'Week 2',
    title: 'Imports',
    desc: 'Your units, current owners, and vendors are imported from properly formatted spreadsheets. We provide the templates; you provide the data.',
    items: ['Import of units and current owners from a properly formatted spreadsheet', 'Import of vendors from a properly formatted spreadsheet', 'Import verification'],
  },
  {
    week: 'Week 3',
    title: 'Administrator training',
    desc: 'One remote training session walks your administrator through daily operations — accounting, work orders, violations, communications, and the portals.',
    items: ['One remote administrator training session', 'Q&A on your own data', 'Operating checklists'],
  },
  {
    week: 'Week 4',
    title: 'Go live & launch assistance',
    desc: 'We help you send owner and board invitations, confirm everything is working, and stand by through your first days live.',
    items: ['Owner and board invitations', 'Standard launch assistance', 'Go-live confirmation'],
  },
]

const included = [
  'Company account configuration',
  'Creation of associations',
  'Import of units and current owners from a properly formatted spreadsheet',
  'Import of vendors from a properly formatted spreadsheet',
  'One remote administrator training session',
  'Standard launch assistance',
]

const professional = [
  'Retrieving or exporting data from AppFolio or another provider',
  'Cleaning incomplete or inconsistent data',
  'Historical document migration',
  'Historical financial transaction migration',
  'Reconstructing owner ledgers',
  'Scanning and OCR of paper documents',
  'Additional training and on-site onboarding',
  'Accounting conversion or cleanup',
]

export default function OnboardingPage() {
  return (
    <div className="bg-white font-sans antialiased">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#060709] pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.14]" style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '88px 88px' }} />
        <div className="relative mx-auto max-w-[1180px] px-6 lg:px-8 text-center">
          <h1 className="text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-6xl lg:text-[64px]">
            How onboarding works
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-zinc-400 sm:text-lg">
            Standard onboarding is included with every subscription — a guided four-week path from signed order form
            to live portfolio. Advanced migration is available as a quoted professional service.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[1080px] px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {weeks.map(w => (
              <div key={w.week} className="rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <div className="inline-flex rounded-full bg-[#1E3A5F]/5 border border-[#1E3A5F]/15 px-4 py-1 text-xs font-semibold text-[#1E3A5F]">{w.week}</div>
                <h2 className="mt-4 text-xl font-semibold tracking-[-0.01em] text-gray-900">{w.title}</h2>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{w.desc}</p>
                <ul className="mt-5 space-y-2.5">
                  {w.items.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600 leading-relaxed">
                      <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Included vs professional service */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1080px] px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-4xl">What&apos;s included — and what&apos;s a professional service</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Included with every subscription</h3>
              <ul className="mt-5 space-y-3">
                {included.map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600 leading-relaxed">
                    <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Quoted separately as professional services</h3>
              <ul className="mt-5 space-y-3">
                {professional.map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600 leading-relaxed">
                    <span aria-hidden className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#1E3A5F]/40" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/professional-services" className="mt-6 inline-flex text-sm font-semibold text-[#1E3A5F] hover:underline">
                Explore professional services &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-100 bg-white py-16">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">Ready to plan your launch?</h2>
          <p className="mt-4 text-lg text-gray-500">Request a proposal and we&apos;ll map your portfolio onto this timeline.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/20 hover:bg-[#152940] transition">Request Proposal</Link>
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition">See pricing</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
