import { promises as fs } from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';
import Link from 'next/link';

// This function gets called at build time
export async function generateStaticParams() {
  const filePath = path.join(process.cwd(), 'cities.csv');
  const fileContents = await fs.readFile(filePath, 'utf8');
  const cities = fileContents.split('\n').slice(1).map(line => line.split(',')[0].toLowerCase().replace(/ /g, '-'));
 
  return cities.map((city) => ({
    slug: city,
  }));
}

async function getCityData(slug) {
  const filePath = path.join(process.cwd(), 'cities.csv');
  const fileContents = await fs.readFile(filePath, 'utf8');
  const cityLine = fileContents.split('\n').find(line => line.toLowerCase().startsWith(slug.replace(/-/g, ' ')));

  if (!cityLine) {
    notFound();
  }

  const [city, state, neighborhoods] = cityLine.split(',');
  return { city, state, neighborhoods: neighborhoods.replace(/"/g, '').split('; ') };
}

const keyFeatures = [
    { title: 'Manager Dashboard', desc: 'Work orders, violations, maintenance, vendors — everything a property manager needs in one command center.' },
    { title: 'Board Portal', desc: 'Financial visibility, violation oversight, budget tracking, and documents — scoped to the association only.' },
    { title: 'Owner Self-Service', desc: 'Pay assessments, submit requests, view documents, upload insurance — everything owners need.' },
    { title: 'Maintenance Calendar', desc: 'Annual, seasonal, and vendor maintenance tracked across every association. Automated reminders before every deadline.' },
    { title: 'Violation Workflow', desc: 'Photo capture → notice generation → hearing scheduling → fine assessment — the entire lifecycle automated.' },
    { title: 'Platform Command Center', desc: 'CEO-level visibility. Doors under management, company health, provisioning — every management company in one view.' },
];

export default async function CityPage({ params }) {
  const { city, state, neighborhoods } = await getCityData(params.slug);
  
  const faqItems = [
    {
      question: `What is the best HOA management software for a community in ${city}?`,
      answer: 'Portier369 is a top-rated choice for communities in {city}, offering an all-in-one platform for financials, maintenance, violations, and communication. Its ease of use and powerful features make it ideal for both self-managed communities and professional property managers.'
    },
    {
      question: `How much does HOA software cost in ${city}?`,
      answer: 'Pricing can vary, but Portier369 offers transparent, door-based pricing that is often more affordable than traditional enterprise solutions. You can request a free, no-obligation proposal to see how much you can save.'
    },
    {
      question: `Can I migrate my existing data to Portier369?`,
      answer: 'Yes, Portier369 offers white-glove data migration services to ensure a smooth transition from your old system. We handle the entire process of importing your units, owners, vendors, and financial history.'
    }
  ];

  return (
    <div className="bg-white font-sans antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqItems.map(item => ({
              "@type": "Question",
              "name": item.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": item.answer
              }
            }))
          })
        }}
      />
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-gray-950 sm:text-[44px]">
              Top-Rated HOA & Condo Management Software in {city}, {state}
            </h1>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              Discover why property managers and board members in {city} are choosing Portier369 to streamline their operations, reduce costs, and improve resident satisfaction. Our all-in-one platform provides everything your community needs.
            </p>
            <div className="mt-8">
              <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-black/30 transition hover:bg-[#162D4A]">
                Request a Free Proposal
              </Link>
            </div>
          </div>
          
          <div className="mt-16">
            <h2 className="text-3xl font-semibold text-center mb-8">Key Features for {city} Communities</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {keyFeatures.map(feature => (
                <div key={feature.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16">
            <h2 className="text-3xl font-semibold text-center mb-8">Serving Neighborhoods Across {city}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {neighborhoods.map(hood => (
                <span key={hood} className="inline-block bg-gray-100 rounded-full px-3 py-1 text-sm font-semibold text-gray-700">
                  {hood}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-16">
            <h2 className="text-3xl font-semibold text-center mb-8">Frequently Asked Questions</h2>
            <div className="space-y-4 max-w-2xl mx-auto">
              {faqItems.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg">{item.question}</h3>
                  <p className="mt-2 text-gray-600">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
