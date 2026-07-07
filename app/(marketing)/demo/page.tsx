import Link from 'next/link'

export const metadata = {
  title: 'Request a Proposal — See Portier369 in Action',
  description:
    'Get a free, no-obligation proposal for your management company or association. See how Portier369 handles accounting, violations, work orders, and portals.',
  alternates: { canonical: '/demo' },
}

const assocRanges = ['1–10','11–25','26–50','51–100','100+']
const doorRanges = ['Under 250','251–1,000','1,001–4,000','4,001–10,000','10,000+']
const titles = ['Owner','President','Operations Director','Company Administrator','Regional Manager','Portfolio Manager','Other']
const software = ['AppFolio','Buildium','Vantaca','CINC Systems','TOPS','Excel / Manual Processes','Other']
const challenges = ['Work Orders','Violations','Board Communication','Vendor Coordination','Architectural Reviews','Reporting','Resident Requests','Portfolio Visibility','Scaling Operations']
const timelines = ['Immediately','Within 30 Days','Within 90 Days','Researching Options']
const lookingFor = ['Software Demonstration','Pricing Proposal','Portfolio Migration Review','White Glove Setup Information','Custom Enterprise Solution']
const markets = ['Condominiums','HOAs','Townhomes','Mixed Portfolio']
const contactTimes = ['Morning','Afternoon','Evening']

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const sp = await searchParams
  const submitted = sp.submitted === '1'

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {/* Hero */}
      <section className="bg-white pt-16 pb-8 sm:pt-24 sm:pb-12">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 items-start">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-500 shadow-sm">Built for property management companies</span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">
                Request a Proposal
              </h1>
              <p className="mt-4 text-lg text-gray-500">
                See how Portier369 can streamline operations, reduce administrative workload, and support your growing portfolio.
              </p>
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
                <p className="text-sm font-semibold text-amber-800">We onboard 2 property management companies a week.</p>
                <p className="text-sm text-amber-700 mt-1">Submit your proposal now to secure current pricing and your onboarding slot.</p>
              </div>
              {submitted && (
                <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-emerald-700 font-medium">
                  Thank you. Your portfolio assessment request has been sent to hello@portier369.com. We&apos;ll prepare a customized plan and reach out within one business day.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-4">What you&apos;ll receive</h3>
              <div className="space-y-3">
                {[
                  { title: 'Portfolio-Level Visibility', desc: 'See every association, manager, and door from one dashboard.' },
                  { title: 'Manager Accountability', desc: 'Track workload, response times, and performance across your team.' },
                  { title: 'Board & Owner Portals', desc: 'Self-service access for every stakeholder in every association.' },
                  { title: 'Vendor Coordination', desc: 'Compliance tracking, work order assignment, and 1099 records.' },
                  { title: 'Violation Management', desc: 'Automated workflows from photo capture to hearing resolution.' },
                  { title: 'White Glove Onboarding', desc: 'Data migration, training, and launch support included.' },
                ].map(item => (
                  <div key={item.title} className="flex gap-3">
                    <svg className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    <div><div className="text-sm font-medium text-gray-900">{item.title}</div><div className="text-xs text-gray-500 mt-0.5">{item.desc}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="py-10 sm:py-14" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-2xl px-6 lg:px-8">
          {submitted ? (
            <div className="text-center py-8">
              <Link href="/" className="text-[#1E3A5F] font-medium hover:underline">&larr; Return home</Link>
            </div>
          ) : (
          <form action="/api/demo-request" method="POST" className="space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            {/* Company */}
            <fieldset className="space-y-4">
              <legend className="text-base font-semibold text-gray-900">Tell Us About Your Company</legend>
              <label className="block"><span className="text-sm font-medium text-gray-700">Management Company Name *</span><input name="company_name" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-gray-700">Primary Contact Name *</span><input name="contact_name" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
                <label className="block"><span className="text-sm font-medium text-gray-700">Title *</span>
                  <select name="title" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition bg-white">
                    <option value="">Select</option>{titles.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-gray-700">Email Address *</span><input name="email" type="email" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
                <label className="block"><span className="text-sm font-medium text-gray-700">Phone Number</span><input name="phone" type="tel" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
              </div>
              <label className="block"><span className="text-sm font-medium text-gray-700">Company Website</span><input name="website" type="url" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
            </fieldset>

            {/* Portfolio */}
            <fieldset className="space-y-4 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Portfolio Information</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-gray-700">Number of Associations Managed *</span>
                  <select name="num_associations" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition bg-white">
                    <option value="">Select</option>{assocRanges.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="block"><span className="text-sm font-medium text-gray-700">Total Units Under Management *</span>
                  <select name="total_doors" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition bg-white">
                    <option value="">Select</option>{doorRanges.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
              </div>
              <label className="block"><span className="text-sm font-medium text-gray-700">Primary Market</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {markets.map(m => <label key={m} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="checkbox" name="market" value={m} className="sr-only" />{m}</label>)}
                </div>
              </label>
            </fieldset>

            {/* Current Operations */}
            <fieldset className="space-y-4 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Current Operations</legend>
              <div><span className="text-sm font-medium text-gray-700">Current Software</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {software.map(s => <label key={s} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="checkbox" name="current_software" value={s} className="sr-only" />{s}</label>)}
                </div>
              </div>
              <div><span className="text-sm font-medium text-gray-700">Biggest Operational Challenges</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {challenges.map(c => <label key={c} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="checkbox" name="challenges" value={c} className="sr-only" />{c}</label>)}
                </div>
              </div>
            </fieldset>

            {/* Plan Selection */}
            <fieldset className="space-y-4 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Select Your Plan</legend>
              <p className="text-sm text-gray-500">Which plan fits your portfolio? Pricing is based on active doors. All plans include unlimited owners, board members, and vendors.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { name: 'Foundation', price: '$157/mo', doors: 'Up to 200 units', desc: 'Owner Portal, Board Portal, Manager Dashboard, Work Orders, Violations, Document Management, White Glove Setup' },
                  { name: 'Growth', price: '$382/mo', doors: 'Up to 600 units', desc: 'Everything in Foundation + Vendor Portal, Maintenance Calendar, Compliance Tracking, Association Health Scores, SMS Notifications' },
                  { name: 'Portfolio', price: '$642/mo', doors: 'Up to 1,000 units', desc: 'Everything in Growth + Company Admin Dashboard, Architectural Reviews, AI Automation, Advanced Reporting, API Access' },
                  { name: 'Enterprise', price: 'Custom', doors: '1,000+ units', desc: 'Everything in Portfolio + Multi-Office, Custom Integrations, SLA Guarantee, Volume Pricing' },
                ].map(plan => (
                  <label key={plan.name} className={`relative flex flex-col rounded-xl border p-4 cursor-pointer hover:border-[#1E3A5F]/40 transition has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5 has-[:checked]:ring-2 has-[:checked]:ring-[#1E3A5F] ${plan.name === 'Growth' ? 'border-gray-300' : 'border-gray-200'}`}>
                    <input type="radio" name="selected_plan" value={plan.name} className="sr-only" />
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
                      <span className="text-lg font-bold text-[#1E3A5F]">{plan.price}</span>
                    </div>
                    <span className="text-xs text-gray-500 mb-2">{plan.doors}</span>
                    <span className="text-[11px] text-gray-400 leading-relaxed">{plan.desc}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Premium Add-On Services */}
            <fieldset className="space-y-3 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Premium Add-On Services</legend>
              <p className="text-sm text-gray-500">Optional services available at additional cost. Select any you&apos;re interested in.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { name: 'Data migration', desc: 'Full portfolio migration from any legacy system — units, owners, vendors, documents, financial history.' },
                  { name: 'AI document assistant', desc: 'Custom AI workflows trained on your documents. Auto-classify, extract, summarize, and organize.' },
                  { name: 'Custom website development', desc: 'Branded association websites, owner portals, and board communication hubs.' },
                  { name: 'White-label mobile app', desc: 'Your management company brand on iOS and Android — owners and boards access from their phone.' },
                  { name: 'Accounting outsourcing', desc: 'Turn over your books. Assessments, payables, reconciliation, financial reporting.' },
                  { name: 'Full-service onboarding', desc: 'We set up every association, import every record, train every team member.' },
                  { name: 'Bulk document digitization', desc: 'Decades of paper records scanned, OCR\'d, organized, and uploaded into your document center.' },
                  { name: 'Dedicated account manager', desc: 'A named contact who knows your portfolio, handles escalations, and manages your account.' },
                ].map(svc => (
                  <label key={svc.name} className="flex items-start gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm cursor-pointer hover:border-[#1E3A5F]/30 transition has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5">
                    <input type="checkbox" name="addon_services" value={svc.name} className="sr-only" />
                    <div>
                      <span className="font-medium text-gray-900">{svc.name}</span>
                      <span className="text-xs text-gray-500 block mt-0.5 leading-relaxed">{svc.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Implementation */}
            <fieldset className="space-y-4 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Implementation Needs</legend>
              <label className="block"><span className="text-sm font-medium text-gray-700">How Soon Are You Looking To Implement?</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {timelines.map(t => <label key={t} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="radio" name="timeline" value={t} className="sr-only" />{t}</label>)}
                </div>
              </label>
              <div><span className="text-sm font-medium text-gray-700">What Are You Looking For?</span>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {lookingFor.map(l => <label key={l} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="checkbox" name="looking_for" value={l} className="sr-only" />{l}</label>)}
                </div>
              </div>
            </fieldset>

            {/* Additional */}
            <fieldset className="space-y-3 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Additional Information</legend>
              <textarea name="message" rows={4} className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" placeholder="Tell us about your portfolio and operational goals." />
            </fieldset>

            {/* What you get */}
            <div className="rounded-xl bg-[#1E3A5F]/5 border border-[#1E3A5F]/10 p-5">
              <p className="text-sm font-semibold text-[#1E3A5F] mb-3">Built For Property Management Companies</p>
              <p className="text-sm text-gray-600 mb-3 leading-relaxed">Portier369 was designed by property management professionals to help management companies scale operations, improve oversight, and simplify community management.</p>
              <div className="grid grid-cols-2 gap-1.5">
                {['Portfolio-Level Visibility','Manager Accountability','Board & Owner Portals','Vendor Coordination','Violation Management','White Glove Onboarding'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="h-4 w-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> {item}
                  </div>
                ))}
              </div>
            </div>

            <label className="block"><span className="text-sm font-medium text-gray-700">Best Time to Contact</span>
              <div className="mt-2 flex gap-2">
                {contactTimes.map(t => <label key={t} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="radio" name="contact_time" value={t} className="sr-only" />{t}</label>)}
              </div>
            </label>

            <button type="submit" className="w-full rounded-xl bg-[#1E3A5F] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/15 hover:bg-[#152940] transition">Request My Proposal</button>
            <p className="text-center text-sm text-gray-400">Prefer to talk first? <a href="mailto:hello@portier369.com" className="text-[#1E3A5F] font-medium hover:underline">Book a Discovery Call</a></p>
          </form>
          )}
        </div>
      </section>
    </div>
  )
}
