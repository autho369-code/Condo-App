import Link from 'next/link'
import Image from 'next/image'

export const metadata = { title: 'See Portier369 in Action — Demo Association' }

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
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
          <Link href="#request" className="inline-flex h-9 items-center rounded-lg bg-[#1E3A5F] px-4 text-sm font-medium text-white hover:bg-[#152940] transition">Request a demo</Link>
        </div>
      </header>

      {/* Hero with images */}
      <section className="bg-white pt-16 pb-8 sm:pt-24 sm:pb-12">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-500 shadow-sm">Demo Association</span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl lg:text-6xl">
              50 East Chestnut Condominium Association
            </h1>
            <p className="mt-3 text-lg text-gray-500">Chicago, Illinois</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              <Image src="/demo-chestnut.jpg" alt="50 East Chestnut — exterior" fill className="object-cover" />
            </div>
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              <Image src="/demo-lobby.jpg" alt="50 East Chestnut — lobby" fill className="object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Association Overview */}
      <section className="py-10 sm:py-14" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Profile */}
            <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Association Profile</h3>
              <div className="space-y-2 text-sm">
                {['34 Residential Units', 'Chicago, Illinois', 'High-Rise Condominium', 'Built in 2007', '3 Elevators', 'Heated Garage', 'Fitness Center', 'Roof Deck', 'Interior Corridors', 'Professionally Managed'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-gray-600">
                    <div className="h-1 w-1 rounded-full bg-[#1E3A5F]" /> {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Occupancy + Financial */}
            <div className="space-y-6">
              <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Occupancy</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                    <div className="text-3xl font-bold text-emerald-700">28</div>
                    <div className="text-xs text-emerald-600 mt-1">Owner Occupied</div>
                  </div>
                  <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-center">
                    <div className="text-3xl font-bold text-blue-700">6</div>
                    <div className="text-xs text-blue-600 mt-1">Tenant Occupied</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Snapshot</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Operating Account', value: '$72,450' },
                    { label: 'Reserve Account', value: '$548,900' },
                    { label: 'Monthly Assessments', value: '$24,820' },
                    { label: 'Delinquent Accounts', value: '2', warn: true },
                  ].map(f => (
                    <div key={f.label} className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">{f.label}</span>
                      <span className={`text-sm font-semibold ${f.warn ? 'text-amber-600' : 'text-gray-900'}`}>{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Board + Manager */}
            <div className="space-y-6">
              <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Board of Directors</h3>
                <div className="space-y-2">
                  {[{ name: 'James Wilson', role: 'President' }, { name: 'Susan Miller', role: 'Treasurer' }, { name: 'Michael Anderson', role: 'Secretary' }].map(b => (
                    <div key={b.name} className="text-sm text-gray-600"><span className="font-medium text-gray-900">{b.name}</span> — {b.role}</div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Property Manager</div>
                  <div className="text-sm font-medium text-gray-900">Sarah Thompson, CMCA</div>
                </div>
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Active Vendors</h3>
                <div className="space-y-1.5">
                  {['Chicago Elevator', 'Atlas Plumbing', 'ServiceMaster', 'Skyline Window Cleaning', 'ABC Roofing', 'BrightView Landscaping'].map(v => (
                    <div key={v} className="text-sm text-gray-600 flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-emerald-400" /> {v}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Maintenance Calendar + Work Orders */}
      <section className="py-10 sm:py-14 bg-white">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Maintenance Calendar */}
            <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Maintenance</h3>
              <div className="space-y-2">
                {[
                  { date: 'Jun 15', task: 'Elevator Preventive Maintenance' },
                  { date: 'Jun 18', task: 'Emergency Light Inspection' },
                  { date: 'Jun 20', task: 'Kitchen Line Rodding' },
                  { date: 'Jun 25', task: 'Roof Inspection' },
                  { date: 'Jul 1', task: 'Window Washing' },
                  { date: 'Jul 10', task: 'Hallway Carpet Cleaning' },
                  { date: 'Jul 15', task: 'Fire Extinguisher Inspection' },
                  { date: 'Oct 15', task: 'Heating System Startup' },
                  { date: 'Apr 15', task: 'Cooling System Startup' },
                ].map(m => (
                  <div key={m.task} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs font-semibold text-[#1E3A5F] bg-[#1E3A5F]/5 rounded-lg px-2.5 py-1 w-16 text-center flex-shrink-0">{m.date}</span>
                    <span className="text-sm text-gray-600">{m.task}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Work Orders + Activity */}
            <div className="space-y-6">
              <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Open Work Orders</h3>
                <div className="space-y-2">
                  {['Lobby Door Closer Adjustment', 'Garage Access Reader Repair', 'Elevator Cab Lighting Replacement', 'Roof Deck Furniture Repair'].map(wo => (
                    <div key={wo} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" /> {wo}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Board Approvals Pending</h3>
                <div className="space-y-2">
                  {['Landscape Contract Renewal', 'Window Washing Proposal', 'Garage Pressure Washing Proposal'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-purple-400 flex-shrink-0" /> {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Association Health Score */}
      <section className="py-10 sm:py-14" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="rounded-2xl bg-white border border-gray-200 p-8 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">Association Health Score</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 text-center">
              {[
                { label: 'Maintenance Compliance', value: '96%', color: 'emerald' },
                { label: 'Vendor Response Rate', value: '94%', color: 'emerald' },
                { label: 'Upcoming Tasks', value: '12', color: 'blue' },
              ].map(h => (
                <div key={h.label}>
                  <div className={`text-4xl font-bold ${h.color === 'emerald' ? 'text-emerald-600' : 'text-blue-600'}`}>{h.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{h.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
              {[
                { value: '12', label: 'Open Work Orders', color: 'text-amber-600' },
                { value: '4', label: 'Open Violations', color: 'text-red-500' },
                { value: '6', label: 'Scheduled This Month', color: 'text-blue-600' },
                { value: '1', label: 'Board Vote Pending', color: 'text-purple-600' },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-gray-50 p-4">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Request Form */}
      <section id="request" className="py-10 sm:py-14 bg-white">
        <div className="mx-auto max-w-2xl px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-4xl">
              See your portfolio in Portier369.
            </h2>
            <p className="mt-3 text-lg text-gray-500">
              Fill out the form and we&apos;ll walk you through a live dashboard with your own association data.
            </p>
            {submitted && (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-emerald-700 font-medium">
                Thank you. Your request has been sent to hello@portier369.com. We&apos;ll reach out within one business day.
              </div>
            )}
          </div>

          {!submitted && (
          <form action="/api/demo-request" method="POST" className="space-y-5 rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-medium text-gray-700">First name *</span><input name="first_name" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
              <label className="block"><span className="text-sm font-medium text-gray-700">Last name *</span><input name="last_name" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
            </div>
            <label className="block"><span className="text-sm font-medium text-gray-700">Email *</span><input name="email" type="email" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-medium text-gray-700">Company</span><input name="company" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
              <label className="block"><span className="text-sm font-medium text-gray-700">Phone</span><input name="phone" type="tel" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" /></label>
            </div>
            <label className="block"><span className="text-sm font-medium text-gray-700">Number of units/doors</span>
              <select name="doors" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition bg-white">
                <option value="">Select range</option><option value="1-200">1 – 200</option><option value="201-600">201 – 600</option><option value="601-1000">601 – 1,000</option><option value="1000+">1,000+</option>
              </select>
            </label>
            <label className="block"><span className="text-sm font-medium text-gray-700">What would you like to see?</span><textarea name="message" rows={3} className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" placeholder="Tell us about your portfolio..." /></label>
            <button type="submit" className="w-full rounded-xl bg-[#1E3A5F] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/15 hover:bg-[#152940] transition">Submit request</button>
            <p className="text-center text-sm text-gray-400">Prefer email? <a href="mailto:hello@portier369.com" className="text-[#1E3A5F] font-medium hover:underline">hello@portier369.com</a></p>
          </form>
          )}
        </div>
      </section>
    </div>
  )
}
