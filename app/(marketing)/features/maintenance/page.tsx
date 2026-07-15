import type { Metadata } from 'next'
import { FeaturePage } from '@/components/marketing/feature-page'

export const metadata: Metadata = {
  title: 'HOA Work Order, Maintenance & Violation Software',
  description:
    'Work orders, preventive maintenance calendars, inspections, violations with the full notice-to-hearing lifecycle, architectural reviews, vendor compliance, and inventory for community associations.',
  alternates: { canonical: '/features/maintenance' },
}

export default function MaintenanceFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Maintenance & Operations"
      headline="Nothing falls through the cracks — from work orders to elevator certs."
      intro="The operational core of the platform: every work order, inspection, seasonal task, violation, and architectural request tracked in one place, with vendors and boards looped in automatically."
      sections={[
        {
          eyebrow: 'Work orders',
          title: 'From request to completion, with vendors in the loop.',
          body: 'Create work orders from owner requests, inspections, or preventive schedules. Assign vendors, track status and scheduled dates, and let vendors update progress from their own portal — no phone tag.',
          bullets: [
            'Work orders linked to associations, units, and owners',
            'Recurring work orders for repeat services',
            'Vendor assignment with status updates from the vendor portal',
            'Photo documentation and full activity history',
            'Overdue tracking surfaced on the manager dashboard',
          ],
        },
        {
          eyebrow: 'Preventive maintenance',
          title: 'An annual maintenance calendar for every association.',
          body: 'HVAC seasonal service, gutter cleaning, pool opening, fire inspections, elevator certifications — templated tasks with automated reminders before every deadline, across the whole portfolio.',
          bullets: [
            'Maintenance task templates with custom frequencies',
            'Automated reminders ahead of every due date',
            'Vendor and staff assignment per task',
            'Inspections with findings that convert to work orders',
            'Inventory tracking for parts, supplies, and consumables',
          ],
        },
        {
          eyebrow: 'Violations',
          title: 'The violation workflow, without the paper chase.',
          body: 'Photo capture, notice generation from templates, cure deadlines, hearing scheduling, and fine assessment — the administrative workflow is automated while management and board approvals stay in control of every decision. Boards see violation status without calling the office.',
          bullets: [
            'Violation cases with photos, types, and cure deadlines',
            'Notice letters generated from templates — AI-drafted if you want',
            'Hearing scheduling and fine assessment posting to the ledger',
            'Owner-facing violation reporting and status visibility',
            'Board oversight views scoped to their association',
          ],
        },
        {
          eyebrow: 'Architectural reviews',
          title: 'ARC requests with a real approval workflow.',
          body: 'Owners submit modification requests from their portal with categories and details. Managers review, request more info, and approve or deny — with a threaded message history on every request that keeps everyone honest.',
          bullets: [
            'Owner-submitted requests with categories and supporting detail',
            'Manager review queue: approve, deny, or request more info',
            'Threaded in-app messaging on every request',
            'Board and company-admin oversight of every decision',
          ],
        },
      ]}
      ctaHeadline="Run maintenance proactively, not reactively."
    />
  )
}
