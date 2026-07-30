import { requireBoard } from '@/lib/auth/me'
import { PortfolioAssistant } from '@/components/ai/portfolio-assistant'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BOARD_STARTERS = [
  'Which owners are over 90 days delinquent?',
  'Why were expenses higher this month?',
  'What vendor bills are open right now?',
  'What needs a board vote?',
  'Summarize unresolved issues before our next meeting.',
]

export default async function BoardAssistantPage() {
  const me = await requireBoard()
  const associationIds = me.board_association_ids ?? []
  const supabase = await createClient()
  const { data: associations } = associationIds.length > 0
    ? await (supabase as any)
        .from('associations')
        .select('id, name')
        .in('id', associationIds)
        .order('name')
    : { data: [] }
  const scopeOptions = (associations ?? []).map((association: any) => ({
    value: String(association.id),
    label: String(association.name ?? 'Association'),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">AI Board Assistant</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Ask natural-language questions about your association. Answers are grounded only in your live, board-visible data.
        </p>
      </div>
      <div className="max-w-3xl">
        {scopeOptions.length > 0 ? (
          <PortfolioAssistant
            endpoint="/api/ai/board-assistant"
            title="AI Board Assistant"
            subtitle="Ask about financials, delinquencies, work orders, vendors, and votes."
            starters={BOARD_STARTERS}
            configureHint={<>AI isn&apos;t set up yet — ask your management company to configure an AI key for the portfolio.</>}
            scopeOptions={scopeOptions}
            scopeField="associationId"
            scopeLabel="Association"
          />
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No active association is linked to this board account.
          </p>
        )}
      </div>
    </div>
  )
}
