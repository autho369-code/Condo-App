import { requireOwner } from '@/lib/auth/me'
import { PortfolioAssistant } from '@/components/ai/portfolio-assistant'

export const dynamic = 'force-dynamic'

const OWNER_STARTERS = [
  'What is my account balance?',
  'When is my next payment due?',
  'Show my maintenance requests.',
  'How do I pay my assessment?',
  'When is the next community event?',
]

export default async function OwnerAssistantPage() {
  await requireOwner()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">AI Assistant</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">
          Ask about your balance, payments, requests, and community events — answers come only from your own account data.
        </p>
      </div>
      <div className="max-w-3xl">
        <PortfolioAssistant
          endpoint="/api/ai/owner-assistant"
          title="AI Assistant"
          subtitle="Ask about your account, requests, violations, and events."
          starters={OWNER_STARTERS}
          configureHint={<>AI isn&apos;t enabled for your community yet — your management company can turn it on.</>}
        />
      </div>
    </div>
  )
}
