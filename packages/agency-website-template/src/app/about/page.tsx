import { siteConfig } from "@/lib/site-config";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-24">
      <h1 className="text-4xl md:text-5xl font-bold mb-8">About {siteConfig.name}</h1>
      <div className="prose prose-lg max-w-none text-gray-600 space-y-6">
        <p>We are a team of engineers, designers, and strategists who believe technology should work for your business, not the other way around.</p>
        <p>Founded with the mission to make enterprise-grade digital infrastructure accessible to growing companies, we combine deep technical expertise with practical business sense.</p>
        <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">Our Approach</h2>
        <ul className="space-y-3 list-disc pl-5">
          <li><strong>Build fast, iterate faster.</strong> We ship working software in weeks, not months.</li>
          <li><strong>Data over opinions.</strong> Every decision is backed by metrics and user research.</li>
          <li><strong>Your success is our success.</strong> We only win when you grow.</li>
        </ul>
      </div>
    </section>
  );
}
