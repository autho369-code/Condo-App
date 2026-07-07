import type { Metadata } from 'next'
import { FeaturePage } from '@/components/marketing/feature-page'

export const metadata: Metadata = {
  title: 'Board Portal, Owner Portal & Vendor Portal Software',
  description:
    'Six purpose-built workspaces: platform operator, company admin, manager, board, owner, and vendor — each scoped to exactly the data that role should see, enforced at the database level.',
  alternates: { canonical: '/features/portals' },
}

export default function PortalsFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Portals for Every Role"
      headline="Six workspaces. One platform. Zero data bleed."
      intro="Every stakeholder gets a purpose-built portal scoped to exactly what they should see — enforced with row-level security at the database, not just hidden menus. Invitations flow down the chain: operator to company, company to managers, managers to owners and vendors."
      sections={[
        {
          eyebrow: 'Board portal',
          title: 'Governance visibility without operational risk.',
          body: 'Board members see their association’s financials, delinquencies, budget vs. actual, violations, documents, and meeting materials — and formally sign off on approvals — without any access to other associations or company operations.',
          bullets: [
            'Live financials: income, expenses, NOI, bank and reserve balances',
            'Delinquency visibility with owner-level detail',
            'Approval queue with digital sign-off and voting rules',
            'Meeting minutes, agendas, and document library',
            'Architectural review oversight',
          ],
        },
        {
          eyebrow: 'Owner portal',
          title: 'Self-service that actually reduces office calls.',
          body: 'Owners check their balance and payment instructions, submit maintenance and architectural requests, book amenities, upload insurance, and see association documents — all scoped to their own unit.',
          bullets: [
            'Current balance with per-association payment instructions',
            'Maintenance requests with status tracking',
            'Architectural request submission with threaded messaging',
            'Amenity reservations with manager approval',
            'Insurance uploads and document access',
          ],
        },
        {
          eyebrow: 'Vendor portal',
          title: 'Vendors update their own work orders.',
          body: 'Invited vendors see the work assigned to them, post status updates, and keep their compliance documents current — so your team stops chasing updates by phone and email.',
          bullets: [
            'Assigned work orders with live status updates',
            'Compliance document uploads with expiration tracking',
            'Vendor profile and trade management',
            'Invitation-based access controlled by your team',
          ],
        },
        {
          eyebrow: 'Management workspaces',
          title: 'Operator, company admin, and manager — each at the right altitude.',
          body: 'Platform operators provision and bill companies. Company admins oversee the whole portfolio, invite managers, and control property access per manager. Managers run the day-to-day with dashboards tuned to their assigned associations.',
          bullets: [
            'Per-manager property scoping controlled by the company admin',
            'Company-wide oversight: health scores, workload, violations, ARC',
            'Association health scores that flag problems early',
            'Row-level security on every table — enforced in the database',
            'Invitation-only access down the whole chain',
          ],
        },
      ]}
      ctaHeadline="Give every stakeholder exactly what they need — and nothing more."
    />
  )
}
