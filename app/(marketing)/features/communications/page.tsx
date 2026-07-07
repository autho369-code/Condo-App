import type { Metadata } from 'next'
import { FeaturePage } from '@/components/marketing/feature-page'

export const metadata: Metadata = {
  title: 'HOA Communication Software — Notices, Email & SMS',
  description:
    'Centralized owner and board communications: email campaigns, SMS notifications, AI-drafted letters and notices, document templates with merge variables, and threaded request messaging.',
  alternates: { canonical: '/features/communications' },
}

export default function CommunicationsFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Communications"
      headline="Every owner touchpoint, out of one hub — with an audit trail."
      intro="Email, SMS, letters, and portal messages all originate from the same communication center, so your team always knows what was sent, to whom, and when. AI drafting is built in — on your own API key."
      sections={[
        {
          eyebrow: 'Communication center',
          title: 'One hub for email, SMS, and announcements.',
          body: 'Send to owners, tenants, boards, or vendors — filtered by association, building, or role. Every message is logged against the recipient, so "did we notify them?" always has an answer.',
          bullets: [
            'Email campaigns to owners, tenants, boards, and vendors',
            'SMS notifications with tenant and owner recipient targeting',
            'Association-scoped recipient filtering',
            'Complete send history logged per recipient',
            'Approval step before campaigns go out',
          ],
        },
        {
          eyebrow: 'Documents & letters',
          title: 'Templates with merge variables for every recurring letter.',
          body: 'Violation notices, welcome letters, assessment letters, and board packets — built once as templates with merge fields, generated in seconds with real owner and association data.',
          bullets: [
            'Document templates with {{merge_variable}} support',
            'One-click generation with live owner, unit, and association data',
            'Violation notices tied directly to violation cases',
            'Shared document library per association with secure access',
          ],
        },
        {
          eyebrow: 'AI assistance',
          title: 'AI drafting on your own key — your data stays yours.',
          body: 'Connect your own OpenAI, Anthropic, or Gemini API key and let the platform draft violation letters, owner communications, and board updates grounded in your actual portfolio data. No key, no AI — it is always your choice.',
          bullets: [
            'AI-drafted violation letters from case details',
            'Communication copilot for owner and board emails',
            'Conversational portfolio assistant grounded in your real data',
            'Bring-your-own-key: AI runs on your credentials, under your control',
          ],
        },
        {
          eyebrow: 'Requests & threads',
          title: 'Threaded messaging where decisions actually happen.',
          body: 'Architectural requests carry their own message threads between owners and managers, so context never lives in someone’s inbox. Boards approve with digital sign-off — majority, unanimous, or custom voting rules.',
          bullets: [
            'Threaded in-app messaging on architectural requests',
            'Board approval queue with per-member digital sign-off',
            'Voting schemes: majority, unanimous, any-one, or percentage',
            'Owner portal requests with status visibility end to end',
          ],
        },
      ]}
      ctaHeadline="Answer 'did we tell the owners?' in one click."
    />
  )
}
