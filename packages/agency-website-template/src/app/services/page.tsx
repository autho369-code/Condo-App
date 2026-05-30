import { siteConfig } from "@/lib/site-config";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-24">
      <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">Our Services</h1>
      <p className="text-gray-500 text-center max-w-xl mx-auto mb-16">Everything you need to grow your digital presence.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {siteConfig.services.map((s) => (
          <div key={s.title} className="p-8 rounded-xl border border-gray-100 hover:border-gray-300 transition-colors">
            <h3 className="text-xl font-bold mb-2">{s.title}</h3>
            <p className="text-gray-500">{s.description}</p>
          </div>
        ))}
        <div className="p-8 rounded-xl border border-gray-100 hover:border-gray-300 transition-colors">
          <h3 className="text-xl font-bold mb-2">SEO & Content</h3>
          <p className="text-gray-500">Search engine optimization, content strategy, and AI-powered search visibility.</p>
        </div>
      </div>
    </section>
  );
}
