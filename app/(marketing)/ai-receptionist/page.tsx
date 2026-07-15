import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AI Receptionist for HOA & Condo Management',
  description:
    'The Portier AI Receptionist answers owner calls 24/7 — recognizes callers by phone number, answers association-specific questions, creates maintenance requests, routes emergencies, and notifies managers. Call (872) 269-8818 to try it live.',
  alternates: { canonical: '/ai-receptionist' },
}

const FLOW_STEPS = [
  {
    title: 'Owner calls',
    body: 'An owner dials the association line — at lunch, at midnight, on a holiday. The call is answered on the first ring, every time.',
  },
  {
    title: 'Phone number recognized',
    body: 'The receptionist matches the incoming number against the owner records already in Portier369. Known callers are greeted by name; unknown callers are helped and politely asked who they are.',
  },
  {
    title: 'Association identified',
    body: 'Because the owner is matched, the receptionist knows exactly which association they belong to — and answers from that association’s own rules, amenities, hours, and contacts.',
  },
  {
    title: 'Unit identified',
    body: 'The conversation is anchored to the caller’s unit, so a "my garage door" report or a parking question lands on the right record without spelling out addresses.',
  },
]

const OUTCOMES = [
  { title: 'Question answered', body: 'Pool hours, assessment due dates, trash day, guest parking rules — answered from the association’s knowledge base.' },
  { title: 'Maintenance request created', body: 'The issue is captured as a maintenance request inside the platform, tied to the right unit and association.' },
  { title: 'Emergency routed', body: 'Water, fire, gas, no-heat — the call follows the association’s emergency routing rules to the right person immediately.' },
  { title: 'Manager notified', body: 'The manager gets an SMS or email summary, so nothing waits in a voicemail box until morning.' },
]

const CAPABILITIES = [
  {
    title: 'Owner recognition by phone number',
    body: 'Incoming calls are matched against owner records, so known owners are greeted by name and connected to their unit’s context instantly.',
  },
  {
    title: 'Association-specific knowledge',
    body: 'Each association gets its own knowledge base — rules, amenities, hours, contacts — so answers are specific, not generic.',
  },
  {
    title: 'Emergency routing rules',
    body: 'You define what counts as an emergency per association and where those calls go. The receptionist follows the rules exactly, at 3 PM or 3 AM.',
  },
  {
    title: 'Maintenance request intake',
    body: 'Reported issues become maintenance requests in the platform — with the caller, unit, and description already filled in.',
  },
  {
    title: 'After-hours coverage',
    body: 'Nights, weekends, and holidays are covered without an answering service. Every call is handled the same professional way.',
  },
  {
    title: 'Conversation records inside the platform',
    body: 'Every call is documented in Portier369, so managers can review what was asked and what was done — no black box.',
  },
  {
    title: 'Manager notifications by SMS/email',
    body: 'Managers are alerted on the channels they choose, with a summary of the call and any action the receptionist took.',
  },
  {
    title: 'Staff transfer during business hours',
    body: 'When a caller needs a person and staff are available, the receptionist hands the call to your team instead of dead-ending.',
  },
  {
    title: 'Multi-language ready',
    body: 'Built to converse in the languages your communities actually speak, so owners are helped in the language they call in.',
  },
]

const BENEFITS = [
  {
    title: 'Fewer interruptions',
    body: 'Routine questions — hours, rules, due dates, "what’s my trash day" — stop landing on your managers’ desks, so they can do the work that actually needs them.',
  },
  {
    title: 'No missed after-hours calls',
    body: 'The 2 AM burst pipe gets routed by the emergency rules; the 9 PM parking question gets answered. Nothing waits in voicemail, and nothing gets lost.',
  },
  {
    title: 'Every call documented',
    body: 'Each conversation becomes a record inside the platform — who called, what they asked, what happened. When a board asks, the answer is on file.',
  },
]

export default function AiReceptionistPage() {
  return (
    <div className="bg-white font-sans antialiased">
      {/* Hero */}
      <section className="border-b border-gray-100 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <span className="block text-[13px] font-semibold uppercase tracking-[0.14em] text-[#1E3A5F]">
            Portier AI Receptionist
          </span>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-gray-950 sm:text-[52px]">
            Meet Your 24/7 AI Receptionist
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-500">
            Every owner call answered on the first ring — day, night, weekend, holiday. The receptionist recognizes
            owners by phone number, answers questions from each association&rsquo;s own knowledge base, creates
            maintenance requests, routes emergencies, and keeps your managers informed.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="tel:+18722698818"
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[#152940]"
            >
              Call (872) 269-8818 — talk to it now
            </a>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 px-6 py-3 text-[15px] font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              Request a Proposal
            </Link>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-400">
            That&rsquo;s a live line. The receptionist on it answers questions about Portier369 itself — call it and
            experience exactly what your owners would.
          </p>
        </div>
      </section>

      {/* How it works — vertical flow */}
      <section className="py-14 sm:py-16" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#0D9488]">How it works</span>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-gray-950 sm:text-4xl">
            From ringing phone to handled call, automatically.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-500 sm:text-lg">
            The receptionist is connected to your Portier369 data, so it does not just answer the phone — it knows who
            is calling, which association they belong to, and what to do next.
          </p>

          <div className="mt-10 max-w-2xl">
            <ol className="relative border-l-2 border-[#1E3A5F]/15 pl-8">
              {FLOW_STEPS.map((step, i) => (
                <li key={step.title} className="relative pb-10">
                  <span
                    aria-hidden
                    className="absolute -left-[45px] flex h-8 w-8 items-center justify-center rounded-full bg-[#1E3A5F] text-[13px] font-semibold text-white ring-4 ring-[#F5F4F1]"
                  >
                    {i + 1}
                  </span>
                  <h3 className="text-[17px] font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-7 text-gray-600">{step.body}</p>
                </li>
              ))}
              <li className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[45px] flex h-8 w-8 items-center justify-center rounded-full bg-[#0D9488] text-[13px] font-semibold text-white ring-4 ring-[#F5F4F1]"
                >
                  5
                </span>
                <h3 className="text-[17px] font-semibold text-gray-900">Handled</h3>
                <p className="mt-1.5 text-[15px] leading-7 text-gray-600">
                  The call ends with one of four outcomes — and a record of all of them inside the platform:
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {OUTCOMES.map((o) => (
                    <div key={o.title} className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                      <h4 className="text-[15px] font-semibold text-gray-900">{o.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-gray-600">{o.body}</p>
                    </div>
                  ))}
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Capabilities grid */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#1E3A5F]">Capabilities</span>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-gray-950 sm:text-4xl">
            A receptionist that knows your associations.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((cap) => (
              <div key={cap.title} className="rounded-2xl border border-gray-200 bg-white p-7 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <div className="mb-4 h-2 w-10 rounded-full bg-[#1E3A5F]" />
                <h3 className="text-lg font-semibold text-gray-900">{cap.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-gray-500">{cap.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-14 sm:py-16" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#0D9488]">
            For management companies
          </span>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-gray-950 sm:text-4xl">
            What changes for your team.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <h3 className="text-xl font-semibold text-gray-900">{b.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-[880px] px-6 lg:px-8">
          <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#1E3A5F]">Pricing</span>
          <h2 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-gray-950 sm:text-4xl">
            Available as an add-on to any Portier369 plan.
          </h2>
          <div className="mt-8 rounded-2xl border border-[#1E3A5F]/15 bg-[#1E3A5F]/[0.03] p-8">
            <p className="text-[15px] leading-7 text-gray-600">
              The AI Receptionist is priced as an add-on: a base monthly fee per management company that includes a
              block of voice minutes, with per-minute usage billed beyond the included allowance. Setup of each
              association&rsquo;s knowledge base and call-routing rules is quoted as part of onboarding.
            </p>
            <p className="mt-4 text-[15px] leading-7 text-gray-600">
              <Link href="/contact" className="font-semibold text-[#1E3A5F] hover:underline">
                Contact us for current rates
              </Link>{' '}
              — we&rsquo;ll size it to your portfolio and call volume.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#060709] py-20 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[760px] -translate-x-1/2 rounded-full opacity-[0.14]"
          style={{ background: 'radial-gradient(circle, #6d8dff 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-[1180px] px-6 text-center lg:px-8">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl">
            Hear it answer before you buy it.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-zinc-400">
            Call the live line and ask it anything about Portier369 — that&rsquo;s the same receptionist your owners
            would reach.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a
              href="tel:+18722698818"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[15px] font-semibold text-gray-950 shadow-lg shadow-black/30 transition hover:bg-zinc-100"
            >
              Call (872) 269-8818
            </a>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-7 py-3.5 text-[15px] font-semibold text-white transition hover:bg-white/[0.08]"
            >
              Request a Proposal
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
