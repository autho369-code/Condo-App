import { CTASection } from '../_sections/marketing-sections';
import { submitContactForm } from './actions';

export const metadata = { title: 'Contact — Portier' };

export default function ContactPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h1 className="text-4xl font-bold text-gray-900">Let&apos;s talk</h1>
          <p className="mt-4 text-lg text-gray-600">
            Questions about pricing, features, or onboarding? We&apos;re here to help.
          </p>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-white py-20">
        <div className="mx-auto max-w-lg px-6">
          <form action={submitContactForm} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input type="text" name="name" required
                className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Company</label>
              <input type="text" name="company" required
                className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" required
                className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">How many units do you manage?</label>
              <select name="units" required
                className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500">
                <option value="">Select...</option>
                <option>Under 50</option>
                <option>50–200</option>
                <option>200–500</option>
                <option>500–1,000</option>
                <option>1,000+</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Message</label>
              <textarea name="message" rows={4} required
                className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="Tell us about your needs..." />
            </div>
            <button type="submit"
              className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
              Send message
            </button>
            <p className="text-center text-xs text-gray-500">
              We&apos;ll get back to you within 24 hours. No spam, no sales calls.
            </p>
          </form>
        </div>
      </section>

      <CTASection />
    </>
  );
}
