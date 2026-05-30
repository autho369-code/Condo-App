"use client";

import { siteConfig } from "@/lib/site-config";

export default function ContactPage() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission handled by client-side or external service
    alert("Thanks! We'll be in touch within 24 hours.");
  };

  return (
    <section className="max-w-4xl mx-auto px-6 py-24">
      <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">Let&apos;s Talk</h1>
      <p className="text-gray-500 text-center max-w-xl mx-auto mb-16">Tell us about your project. We&apos;ll get back to you within 24 hours.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-3xl mx-auto">
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-sm text-gray-400 uppercase mb-1">Email</h3>
            <p className="text-gray-900">{siteConfig.email}</p>
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-400 uppercase mb-1">Phone</h3>
            <p className="text-gray-900">{siteConfig.phone}</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <input type="text" placeholder="Your Name" required className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          <input type="email" placeholder="Your Email" required className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          <textarea rows={4} placeholder="Tell us about your project" required className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          <button type="submit" className="w-full py-3 rounded-lg text-white font-medium transition-opacity hover:opacity-90" style={{ backgroundColor: siteConfig.branding.primaryColor }}>
            Send Message
          </button>
        </form>
      </div>
    </section>
  );
}
