import Link from 'next/link'

export const metadata = { title: 'Our Story — Portier369' }

export default function CompanyPage() {
  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <span className="text-sm font-semibold uppercase tracking-[0.15em] text-[#1E3A5F]">Our Story</span>
          <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-gray-900 sm:text-5xl">
            Why we built Portier369
          </h1>
          <div className="mt-10 space-y-6 text-lg text-gray-600 leading-relaxed">
            <p>
              After 29 years in condominium and HOA management — as a CAM, CMCA, and AMS — we saw the same problems everywhere. Property managers juggling five different systems. Boards frustrated by lack of visibility. Owners with no self-service options. Vendors whose compliance slipped through the cracks. And software that felt like it was designed by developers who had never actually managed a community.
            </p>
            <p>
              The existing platforms were either too complex (requiring months of training) or too simple (missing core workflows like violations, maintenance planning, and board governance). None of them combined operational depth with modern automation.
            </p>
            <p>
              So we built Portier369 — the operating system for community management. Every workflow comes from real experience: managing thousands of units, coordinating hundreds of board members, handling emergencies at 4pm on a Friday, and navigating the daily realities that property managers face.
            </p>
            <p>
              We designed Portier369 to give management companies portfolio-level visibility, to automate repetitive tasks, to give boards and owners self-service access, and to make compliance and maintenance planning part of the daily workflow — not something you scramble to catch up on.
            </p>
            <p>
              Built by property managers. For property managers. Not from a conference room.
            </p>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-100">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A5F] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-[#1E3A5F]/15 hover:bg-[#152940] transition">
              Request a Proposal
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
