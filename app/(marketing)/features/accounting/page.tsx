import type { Metadata } from 'next'
import { FeaturePage } from '@/components/marketing/feature-page'

export const metadata: Metadata = {
  title: 'HOA Accounting Software — Fund Accounting, AP & AR',
  description:
    'Double-entry general ledger, AR aging, bill approval workflows, budgets vs. actuals, bank reconciliation with automatic bank feeds, and a deep report library built for community associations.',
  alternates: { canonical: '/features/accounting' },
}

export default function AccountingFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Association Accounting"
      headline="Accounting built for community associations, not adapted to them."
      intro="A true double-entry general ledger underneath every transaction — assessments, payments, vendor bills, journal entries, and transfers all post to the same books. Boards get accurate financials; managers stop reconciling between systems."
      sections={[
        {
          eyebrow: 'General ledger',
          title: 'Double-entry books with a full chart of accounts.',
          body: 'Every dollar flows through journal entries and journal lines — the same rigor your CPA expects. Fund accounting separates operating from reserve, and every association rolls up into portfolio-level statements.',
          bullets: [
            'Complete chart of accounts with association- and portfolio-level views',
            'Balanced journal entries behind every charge, payment, and bill',
            'Operating and reserve bank accounts tracked separately',
            'Fixed assets, bank transfers, and ad-hoc journal entries',
            'Budgets by GL line with budget vs. actual variance reporting',
          ],
        },
        {
          eyebrow: 'Receivables',
          title: 'Assessments, delinquencies, and owner ledgers that stay current.',
          body: 'Recurring dues post automatically on schedule. Payments recorded by your team auto-apply to open charges, so AR aging and delinquency reports are always live — no month-end scramble.',
          bullets: [
            'Recurring assessment schedules per unit with automatic posting',
            'Payments auto-apply to open charges the moment they are recorded',
            'AR aging, delinquency, and owner ledger reports in real time',
            'Late fees, fines, and one-off charges with full audit trails',
            'Opening-balance and owner CSV importers for fast onboarding',
          ],
        },
        {
          eyebrow: 'Payables & banking',
          title: 'Bill approvals and bank reconciliation without the spreadsheet.',
          body: 'Vendor bills route through an approval workflow before they touch the books. Connect your bank for automatic transaction feeds and match them against the ledger during reconciliation.',
          bullets: [
            'Vendor bill entry with approval workflow and recurring payables',
            'Purchase orders linked to work and vendors',
            'Automatic bank transaction feeds via secure bank connections',
            'Guided reconciliation with auto-matching against the ledger',
            '1099-ready vendor records and complete payment history',
          ],
        },
        {
          eyebrow: 'Reporting',
          title: 'A deep report library — plus a builder for everything else.',
          body: 'Income statements, balance sheets, budget vs. actual, AR aging, delinquency, and dozens more, all scoped per association or across the portfolio. Save custom views with the report builder and schedule any report to send itself.',
          bullets: [
            '100+ reports across accounting, association, maintenance, and transactions',
            'Custom report builder with saved views and CSV export',
            'Scheduled report runs delivered automatically',
            'Board-safe financial views scoped to their association only',
          ],
        },
      ]}
      ctaHeadline="Give your boards financials they can trust."
    />
  )
}
