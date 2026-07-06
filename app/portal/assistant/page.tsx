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
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">AI Assistant</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
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
