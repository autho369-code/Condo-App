import { requireVendor } from '@/lib/auth/me'
import { PageHeader } from '@/components/ui/shell'
import { PortfolioAssistant } from '@/components/ai/portfolio-assistant'

export const dynamic = 'force-dynamic'

const VENDOR_STARTERS = [
  "Show today's schedule.",
  'Which jobs are overdue?',
  'When will my open invoices be paid?',
  'Show my emergency jobs.',
  'Is my insurance up to date?',
]

export default async function VendorAssistantPage() {
  await requireVendor()

  return (
    <div>
      <PageHeader
        title="AI Assistant"
        description="Ask about your jobs, schedule, invoices, and compliance — answers come only from your own assignments."
      />
      <div className="max-w-3xl">
        <PortfolioAssistant
          endpoint="/api/ai/vendor-assistant"
          title="AI Assistant"
          subtitle="Ask about your work orders, payments, and compliance dates."
          starters={VENDOR_STARTERS}
          configureHint={<>AI isn&apos;t enabled by the management company yet.</>}
        />
      </div>
    </div>
  )
}
