import Link from 'next/link'

export const metadata = { title: 'Request a Personalized Proposal — Portier369' }

const doorRanges = ['1–500','501–1,000','1,001–2,500','2,501–5,000','5,001–10,000','10,000+']
const assocRanges = ['1–5','6–15','16–50','51–100','100+']
const software = ['AppFolio','Buildium','CINC Systems','Vantaca','TOPS','Condo Control','Yardi','Excel / Manual','Other']
const features = ['Owner Portal','Board Portal','Work Orders','Violations','Architectural Reviews','Vendor Management','Accounting','Document Management','SMS Notifications','AI Automation','White Glove Setup','API Access']
const positions = ['Owner / Principal','Executive Director','Operations Director','Property Manager','Regional Manager','Other']
const contactTimes = ['Morning','Afternoon','Evening']

export default async function ProposalPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const sp = await searchParams
  const submitted = sp.submitted === '1'

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {/* Hero */}
      <section className="bg-white pt-16 pb-8 sm:pt-24 sm:pb-12">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 items-start">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-500 shadow-sm">For Property Management Companies</span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">
                See how Portier369 runs your entire portfolio.
              </h1>
              <p className="mt-4 text-lg text-gray-500">
                Every association, every manager, every board, every vendor — managed from one platform. Request a personalized proposal tailored to your management company.
              </p>

              {/* Portfolio demo stats */}
              <div className="mt-8 grid grid-cols-2 gap-4">
                {[
                  { label: 'Associations', value: '18' }, { label: 'Total Doors', value: '2,450' },
                  { label: 'Managers', value: '6' }, { label: 'Board Members', value: '52' },
                  { label: 'Active Vendors', value: '85' }, { label: 'Monthly Revenue', value: '$42K' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">{s.label}</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-semibold text-gray-900 mb-4">What you&apos;ll receive</h3>
                <div className="space-y-3">
                  {[
                    { title: 'Pricing Estimate', desc: 'Based on your door count and feature needs' },
                    { title: 'Feature Recommendation', desc: 'Which plan fits your portfolio and team' },
                    { title: 'Migration Assessment', desc: 'What it takes to move from your current system' },
                    { title: 'Setup Plan', desc: 'Timeline for onboarding your company and associations' },
                    { title: 'Implementation Timeline', desc: 'From contract to go-live with white glove support' },
                  ].map(item => (
                    <div key={item.title} className="flex gap-3">
                      <svg className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      <div><div className="text-sm font-medium text-gray-900">{item.title}</div><div className="text-xs text-gray-500 mt-0.5">{item.desc}</div></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-[#1E3A5F] p-6 text-white">
                <p className="text-sm font-semibold">Built for management companies, not individual associations.</p>
                <p className="mt-2 text-sm text-gray-300 leading-relaxed">Portier369 is designed for companies managing 5 to 500+ associations. Company Admins oversee their entire portfolio from one dashboard.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proposal Form */}
      <section id="proposal" className="py-10 sm:py-14" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-2xl px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-4xl">
              Request a Personalized Proposal
            </h2>
            <p className="mt-3 text-lg text-gray-500">
              Tell us about your management company and we&apos;ll prepare a customized plan with pricing, features, and an implementation timeline.
            </p>
            {submitted && (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-emerald-700 font-medium">
                Thank you. Your proposal request has been sent to hello@portier369.com. We&apos;ll prepare a customized plan and reach out within one business day.
              </div>
            )}
          </div>

          {!submitted && (
          <form action="/api/demo-request" method="POST" className="space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            {/* Company */}
            <fieldset className="space-y-4">
              <legend className="text-base font-semibold text-gray-900">Your Management Company</legend>
              <label className="block"><span className="text-sm font-medium text-gray-700">Company Name *</span><input name="company_name" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-gray-700">City</span><input name="city" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
                <label className="block"><span className="text-sm font-medium text-gray-700">State</span><input name="state" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
              </div>
              <label className="block"><span className="text-sm font-medium text-gray-700">Website</span><input name="website" type="url" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
            </fieldset>

            {/* Portfolio */}
            <fieldset className="space-y-4 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Your Portfolio</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-gray-700">Number of Associations *</span>
                  <select name="num_associations" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition bg-white">
                    <option value="">Select range</option>{assocRanges.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="block"><span className="text-sm font-medium text-gray-700">Total Doors / Units *</span>
                  <select name="total_doors" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition bg-white">
                    <option value="">Select range</option>{doorRanges.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
              </div>
              <label className="block"><span className="text-sm font-medium text-gray-700">How many property managers on your team?</span><input name="num_managers" type="number" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
              <label className="block"><span className="text-sm font-medium text-gray-700">Types of communities you manage</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {['Condominiums','HOAs','Townhomes','Co-Ops','Commercial','Mixed-Use'].map(t => <label key={t} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="checkbox" name="community_types" value={t} className="sr-only" />{t}</label>)}
                </div>
              </label>
            </fieldset>

            {/* Current Software */}
            <fieldset className="space-y-3 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Current Software</legend>
              <p className="text-sm text-gray-500">What are you using today? (select all that apply)</p>
              <div className="grid grid-cols-2 gap-2">
                {software.map(s => <label key={s} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="checkbox" name="current_software" value={s} className="sr-only" />{s}</label>)}
              </div>
            </fieldset>

            {/* Features */}
            <fieldset className="space-y-3 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Features You Need</legend>
              <div className="grid grid-cols-2 gap-2">
                {features.map(f => <label key={f} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="checkbox" name="interested_features" value={f} className="sr-only" />{f}</label>)}
              </div>
            </fieldset>

            {/* Contact */}
            <fieldset className="space-y-4 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Contact Information</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-gray-700">First Name *</span><input name="first_name" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
                <label className="block"><span className="text-sm font-medium text-gray-700">Last Name *</span><input name="last_name" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
              </div>
              <label className="block"><span className="text-sm font-medium text-gray-700">Position *</span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {positions.map(p => <label key={p} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="radio" name="position" value={p} className="sr-only" />{p}</label>)}
                </div>
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-gray-700">Email *</span><input name="email" type="email" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
                <label className="block"><span className="text-sm font-medium text-gray-700">Phone</span><input name="phone" type="tel" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
              </div>
              <label className="block"><span className="text-sm font-medium text-gray-700">Best Time to Contact</span>
                <div className="mt-2 flex gap-2">
                  {contactTimes.map(t => <label key={t} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="radio" name="contact_time" value={t} className="sr-only" />{t}</label>)}
                </div>
              </label>
            </fieldset>

            {/* Additional Info */}
            <fieldset className="space-y-3 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Additional Information</legend>
              <textarea name="message" rows={4} className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" placeholder="Tell us about your company, your biggest challenges, or what you're looking for in a new platform..." />
            </fieldset>

            <button type="submit" className="w-full rounded-xl bg-[#1E3A5F] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/15 hover:bg-[#152940] transition">Request My Proposal</button>
            <p className="text-center text-sm text-gray-400">Prefer to talk first? <a href="mailto:hello@portier369.com" className="text-[#1E3A5F] font-medium hover:underline">Book a discovery call</a></p>
          </form>
          )}
        </div>
      </section>
    </div>
  )
}
