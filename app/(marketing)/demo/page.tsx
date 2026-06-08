import Link from 'next/link'

export const metadata = { title: 'Request a Personalized Proposal — Portier369' }

const unitRanges = ['1–25','26–50','51–100','101–250','251–500','501–1,000','1,001–5,000','5,000+']
const assocTypes = ['Condominium','Townhome Association','HOA','Co-Op','Self-Managed Community','Management Company']
const software = ['AppFolio','Buildium','CINC Systems','Vantaca','TOPS','Condo Control','Excel / Manual Processes','Other']
const features = ['Owner Portal','Board Portal','Work Orders','Violations','Architectural Reviews','Vendor Management','Accounting Integration','Document Management','SMS Notifications','Community Website','AI Automation','White Glove Setup']
const positions = ['Board Member','President','Treasurer','Property Manager','Community Manager','Association Administrator','Other']
const contactTimes = ['Morning','Afternoon','Evening']

export default async function ProposalPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const sp = await searchParams
  const submitted = sp.submitted === '1'

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      <header className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E3A5F] text-sm font-bold text-white">P</div>
            <span className="text-lg font-semibold text-gray-900">Portier369</span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-white pt-16 pb-8 sm:pt-24 sm:pb-12">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 items-start">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-500 shadow-sm">Demo Association</span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">
                Demo Association
              </h1>
              <p className="mt-3 text-lg text-gray-500">Sample community — representative data shown</p>

              <div className="mt-8 grid grid-cols-2 gap-4">
                {[
                  { label: 'Units', value: '34' }, { label: 'Stories', value: '12' },
                  { label: 'Built', value: '2007' }, { label: 'Elevators', value: '3' },
                  { label: 'Owner Occupied', value: '28' }, { label: 'Tenant Occupied', value: '6' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">{s.label}</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-2">
                <h4 className="text-sm font-semibold text-gray-900">Upcoming Maintenance</h4>
                {[{ date: 'Jun 15', task: 'Elevator Preventive Maintenance' },{ date: 'Jun 20', task: 'Kitchen Line Rodding' },{ date: 'Jun 25', task: 'Roof Inspection' },{ date: 'Jul 1', task: 'Window Washing' }].map(m => (
                  <div key={m.task} className="flex items-center gap-3 text-sm"><span className="text-xs font-semibold text-[#1E3A5F] bg-[#1E3A5F]/5 rounded px-2 py-0.5 w-14 text-center">{m.date}</span><span className="text-gray-600">{m.task}</span></div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gradient-to-br from-[#1E3A5F]/10 via-[#1E3A5F]/5 to-white flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl mb-2">🏢</div>
                  <div className="text-sm font-medium text-[#1E3A5F]">Demo Association</div>
                  <div className="text-xs text-gray-400 mt-1">Sample community dashboard</div>
                </div>
              </div>
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gradient-to-br from-emerald-50 via-white to-[#1E3A5F]/5 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2">📊</div>
                  <div className="text-sm font-medium text-emerald-700">Platform Preview</div>
                  <div className="text-xs text-gray-400 mt-1">Management dashboard</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Health + Financial Snapshot */}
      <section className="py-10 sm:py-14" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { value: '96%', label: 'Maintenance Compliance', color: 'text-emerald-600' },
              { value: '94%', label: 'Vendor Response Rate', color: 'text-emerald-600' },
              { value: '12', label: 'Upcoming Tasks', color: 'text-blue-600' },
            ].map(h => (
              <div key={h.label} className="rounded-2xl bg-white border border-gray-200 p-6 text-center shadow-sm">
                <div className={`text-4xl font-bold ${h.color}`}>{h.value}</div>
                <div className="text-sm text-gray-500 mt-1">{h.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[{ v: '12', l: 'Open Work Orders', c: 'text-amber-600' },{ v: '4', l: 'Open Violations', c: 'text-red-500' },{ v: '6', l: 'Scheduled This Month', c: 'text-blue-600' },{ v: '1', l: 'Board Vote Pending', c: 'text-purple-600' }].map(s => (
              <div key={s.l} className="rounded-xl bg-white border border-gray-200 p-4 text-center shadow-sm">
                <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div><div className="text-xs text-gray-500 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proposal Form */}
      <section id="proposal" className="py-10 sm:py-14 bg-white">
        <div className="mx-auto max-w-2xl px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-4xl">
              Request a Personalized Proposal
            </h2>
            <p className="mt-3 text-lg text-gray-500">
              Tell us about your community or management company and we&apos;ll prepare a customized implementation plan, pricing estimate, and feature recommendation.
            </p>
            {submitted && (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-emerald-700 font-medium">
                Thank you. Your proposal request has been sent. We&apos;ll prepare a customized plan and reach out within one business day.
              </div>
            )}
          </div>

          {!submitted && (
          <form action="/api/demo-request" method="POST" className="space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            {/* Association */}
            <fieldset className="space-y-4">
              <legend className="text-base font-semibold text-gray-900">Community Information</legend>
              <label className="block"><span className="text-sm font-medium text-gray-700">Association Name *</span><input name="association_name" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-gray-700">City</span><input name="city" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
                <label className="block"><span className="text-sm font-medium text-gray-700">State</span><input name="state" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
              </div>
            </fieldset>

            {/* Community Profile */}
            <fieldset className="space-y-4 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Community Profile</legend>
              <label className="block"><span className="text-sm font-medium text-gray-700">Association Type *</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {assocTypes.map(t => <label key={t} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5 has-[:checked]:text-[#1E3A5F]"><input type="radio" name="association_type" value={t} className="sr-only" />{t}</label>)}
                </div>
              </label>
              <label className="block"><span className="text-sm font-medium text-gray-700">Number of Units *</span>
                <select name="units" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition bg-white">
                  <option value="">Select range</option>
                  {unitRanges.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-gray-700">Number of Buildings</span><input name="buildings" type="number" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
                <label className="block"><span className="text-sm font-medium text-gray-700">Number of Elevators</span><input name="elevators" type="number" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block"><span className="text-sm font-medium text-gray-700">Onsite Staff?</span>
                  <div className="mt-2 flex gap-2">
                    {['Yes','No'].map(o => <label key={o} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="radio" name="onsite_staff" value={o} className="sr-only" />{o}</label>)}
                  </div>
                </label>
                <label className="block"><span className="text-sm font-medium text-gray-700">Management Company?</span>
                  <div className="mt-2 flex gap-2">
                    {['Yes','No'].map(o => <label key={o} className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="radio" name="has_mgmt_company" value={o} className="sr-only" />{o}</label>)}
                  </div>
                </label>
              </div>
              <label className="block"><span className="text-sm font-medium text-gray-700">Management Company Name</span><input name="mgmt_company" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
            </fieldset>

            {/* Current Software */}
            <fieldset className="space-y-3 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Current Software</legend>
              <div className="grid grid-cols-2 gap-2">
                {software.map(s => <label key={s} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-[#1E3A5F]/30 cursor-pointer has-[:checked]:border-[#1E3A5F] has-[:checked]:bg-[#1E3A5F]/5"><input type="checkbox" name="current_software" value={s} className="sr-only" />{s}</label>)}
              </div>
            </fieldset>

            {/* Features */}
            <fieldset className="space-y-3 pt-2 border-t border-gray-100">
              <legend className="text-base font-semibold text-gray-900">Features You&apos;re Most Interested In</legend>
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
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              <textarea name="message" rows={5} className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" placeholder="Tell us about your community, challenges, or goals. Examples: Looking to replace AppFolio · Need better violation tracking · Board communication challenges · Self-managed association seeking automation · Portfolio growth and scalability" />
            </fieldset>

            {/* What you'll receive */}
            <div className="rounded-xl bg-[#1E3A5F]/5 border border-[#1E3A5F]/10 p-5 space-y-1.5">
              <p className="text-sm font-semibold text-[#1E3A5F]">What you&apos;ll receive:</p>
              {['Pricing Estimate','Recommended Features','Migration Assessment','White Glove Setup Plan','Implementation Timeline','Personalized Consultation'].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="h-4 w-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> {item}
                </div>
              ))}
            </div>

            <button type="submit" className="w-full rounded-xl bg-[#1E3A5F] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/15 hover:bg-[#152940] transition">Request My Proposal</button>
            <p className="text-center text-sm text-gray-400">Prefer to talk first? <a href="mailto:hello@portier369.com" className="text-[#1E3A5F] font-medium hover:underline">Book a discovery call</a></p>
          </form>
          )}
        </div>
      </section>
    </div>
  )
}
