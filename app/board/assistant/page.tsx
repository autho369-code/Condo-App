import { requireBoard } from '@/lib/auth/me'
import { PortfolioAssistant } from '@/components/ai/portfolio-assistant'

export const dynamic = 'force-dynamic'

const BOARD_STARTERS = [
  'Which owners are over 90 days delinquent?',
  'Why were expenses higher this month?',
  'What vendor bills are open right now?',
  'What needs a board vote?',
  'Summarize unresolved issues before our next meeting.',
]

export default async function BoardAssistantPage() {
  await requireBoard()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">AI Board Assistant</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Ask natural-language questions about your association. Answers are grounded only in your live, board-visible data.
        </p>
      </div>
      <div className="max-w-3xl">
        <PortfolioAssistant
          endpoint="/api/ai/board-assistant"
          title="AI Board Assistant"
          subtitle="Ask about financials, delinquencies, work orders, vendors, and votes."
          starters={BOARD_STARTERS}
          configureHint={<>AI isn&apos;t set up yet — ask your management company to configure an AI key for the portfolio.</>}
        />
      </div>
    </div>
  )
}
