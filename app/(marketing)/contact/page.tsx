import { CTASection } from '../_sections/marketing-sections';
import { submitContactForm } from './actions';

export const metadata = { title: 'Contact — Portier' };

export default function ContactPage() {
  return (
    <>
      <section className="bg-[#060B18] py-20">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h1 className="text-4xl font-light tracking-tight text-white md:text-5xl">Let&apos;s talk</h1>
          <p className="mt-4 text-lg text-slate-400">
            Questions about pricing, features, or onboarding? We&apos;re here to help.
          </p>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-[#0B1121] py-20">
        <div className="mx-auto max-w-lg px-6">
          <form action={submitContactForm} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300">Name</label>
              <input type="text" name="name" required
                className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-[#0A1628] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Company</label>
              <input type="text" name="company" required
                className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-[#0A1628] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Email</label>
              <input type="email" name="email" required
                className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-[#0A1628] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">How many units do you manage?</label>
              <select name="units" required
                className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-[#0A1628] px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                <option value="">Select...</option>
                <option>Under 50</option>
                <option>50–200</option>
                <option>200–500</option>
                <option>500–1,000</option>
                <option>1,000+</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Message</label>
              <textarea name="message" rows={4} required
                className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-[#0A1628] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="Tell us about your needs..." />
            </div>
            <button type="submit"
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-emerald-400">
              Send message
            </button>
            <p className="text-center text-xs text-slate-500">
              We&apos;ll get back to you within 24 hours. No spam, no sales calls.
            </p>
          </form>
        </div>
      </section>

      <CTASection />
    </>
  );
}
