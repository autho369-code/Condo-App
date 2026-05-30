import { siteConfig } from "@/lib/site-config";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-24 md:py-32 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight mb-6">
          {siteConfig.tagline}
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          {siteConfig.description}
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/contact"
            className="px-8 py-3 rounded-lg text-white font-medium text-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: siteConfig.branding.primaryColor }}
          >
            Get Started
          </a>
          <a
            href="/services"
            className="px-8 py-3 rounded-lg font-medium text-lg border border-gray-200 hover:border-gray-400 transition-colors"
          >
            Our Services
          </a>
        </div>
      </section>

      {/* Services */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">What We Do</h2>
          <p className="text-gray-500 text-center max-w-xl mx-auto mb-12">
            We help businesses grow with modern technology and proven strategies.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {siteConfig.services.map((service) => (
              <div key={service.title} className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-white text-xl font-bold"
                  style={{ backgroundColor: siteConfig.branding.primaryColor }}>
                  {service.icon === "code" && "{"}
                  {service.icon === "cpu" && "⚡"}
                  {service.icon === "trending-up" && "↑"}
                </div>
                <h3 className="text-lg font-bold mb-2">{service.title}</h3>
                <p className="text-gray-500 text-sm">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto rounded-2xl p-12 text-white" style={{ background: `linear-gradient(135deg, ${siteConfig.branding.primaryColor}, ${siteConfig.branding.secondaryColor})` }}>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to grow?</h2>
          <p className="text-white/80 text-lg mb-8">Let&apos;s build something great together.</p>
          <a href="/contact" className="inline-block px-8 py-3 rounded-lg bg-white font-medium text-gray-900 hover:bg-gray-100 transition-colors">
            Start a Project
          </a>
        </div>
      </section>
    </>
  );
}
