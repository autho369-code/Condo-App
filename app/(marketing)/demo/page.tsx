import Link from 'next/link'

export const metadata = { title: 'Request a Demo — Portier369' }

export default function DemoPage() {
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

      <main className="mx-auto max-w-2xl px-6 py-20 lg:py-28">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">
            See Portier369 in action.
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Fill out the form below and we&apos;ll schedule a personalized walkthrough of the platform with your portfolio in mind.
          </p>
        </div>

        <form action="/api/demo-request" method="POST" className="space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">First name *</span>
              <input name="first_name" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Last name *</span>
              <input name="last_name" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Email *</span>
            <input name="email" type="email" required className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" />
          </label>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Company name</span>
              <input name="company" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Phone</span>
              <input name="phone" type="tel" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Approximate number of units/doors</span>
            <select name="doors" className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition bg-white">
              <option value="">Select range</option>
              <option value="1-200">1 – 200</option>
              <option value="201-600">201 – 600</option>
              <option value="601-1000">601 – 1,000</option>
              <option value="1000+">1,000+</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">What are you most interested in?</span>
            <textarea name="message" rows={3} className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10 outline-none transition" placeholder="Tell us about your portfolio and what you'd like to see..." />
          </label>
          <button type="submit" className="w-full rounded-xl bg-[#1E3A5F] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/15 hover:bg-[#152940] transition">
            Submit request
          </button>
          <p className="text-center text-sm text-gray-400">
            We&apos;ll reach out within one business day to schedule your walkthrough.
          </p>
          <div className="text-center pt-2">
            <p className="text-sm text-gray-400">
              Prefer email? Contact us directly at{' '}
              <a href="mailto:hello@portier369.com" className="text-[#1E3A5F] font-medium hover:underline">hello@portier369.com</a>
            </p>
          </div>
        </form>
      </main>
    </div>
  )
}
