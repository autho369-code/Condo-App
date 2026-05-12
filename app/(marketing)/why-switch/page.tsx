import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Why teams switch from AppFolio and Buildium · Portier',
  description:
    'A side-by-side look at how Portier handles the operational pain points AppFolio and Buildium customers cite most often.',
};

type ComparisonRow = {
  topic: string;
  appfolioBuildium: string;
  portier: string;
};

const ROWS: ComparisonRow[] = [
  {
    topic: 'Onboarding timeline',
    appfolioBuildium:
      '60–120 days. Generic onboarding paths. You assemble the project; their team checks in weekly.',
    portier:
      '14 days, guaranteed in writing. A named concierge owns the migration. If we miss it, full refund.',
  },
  {
    topic: 'Support response',
    appfolioBuildium:
      'Ticket queues. Multi-day response times. Phone support is gated by tier.',
    portier:
      'Same-business-day on Growth. 1-hour SLA on Enterprise. Direct Slack / email channel — real people, no bots.',
  },
  {
    topic: 'Migration cost transparency',
    appfolioBuildium:
      'Implementation fees range $5k–$25k+ and are quoted late in the sales cycle. Most extras billed à la carte.',
    portier:
      'Migration scope and price quoted in writing within two business days. No add-ons hidden in renewals.',
  },
  {
    topic: 'Per-user vs per-unit pricing',
    appfolioBuildium:
      'Per-unit minimums ($400+) plus monthly per-feature surcharges. Hard to model as your portfolio scales.',
    portier:
      'Three tiers, units included by plan, $1–$1.50 per overage. No per-feature pricing. Annual saves 17%.',
  },
  {
    topic: 'Data export & portability',
    appfolioBuildium:
      'CSV exports limited to specific reports. Full data extraction is a paid implementation request.',
    portier:
      'Full JSON / CSV export anytime, every tier. Your data is yours, always.',
  },
  {
    topic: 'User interface',
    appfolioBuildium:
      'Designed for early-2000s desktop workflows. Mobile experience is an afterthought.',
    portier:
      'Editorial design language built for operators who notice details. Mobile-first resident portal. AI Copilot embedded.',
  },
  {
    topic: 'Accounting controls',
    appfolioBuildium:
      'Strong general ledger; weak per-role permissions. Difficult to scope GL access to a single accountant.',
    portier:
      'Per-role GL account permissions on Enterprise. Approval workflows for bills + POs across every tier from Growth up.',
  },
  {
    topic: 'API + integrations',
    appfolioBuildium:
      'AppFolio public API is limited; Buildium offers more but rate-limited. Webhook coverage is sparse.',
    portier:
      'Scoped API keys with twenty-plus webhook events. Direct integrations with QuickBooks, Mailchimp, lockbox feeds.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'We migrated three associations from AppFolio in one weekend. Our board chair noticed the dashboards first — they read like an annual report.',
    name: 'Margaret Devlin',
    role: 'Operations Director, Beacon Hill Management',
  },
  {
    quote: 'The migration concierge knew our portfolio better than I did by day three. We went live on day twelve.',
    name: 'Daniel Choi',
    role: 'Managing Partner, Cedar Grove Properties',
  },
];

export default function WhySwitchPage() {
  return (
    <>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 60% at 50% 0%, rgba(212, 189, 134, 0.18) 0%, rgba(251, 249, 244, 0) 60%), linear-gradient(180deg, #FBF9F4 0%, #F8F4EC 100%)',
          }}
        />
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="eyebrow">For teams considering a switch</div>
            <h1 className="mt-5 font-display text-[2.5rem] leading-[1.1] tracking-tightest text-ink-900 sm:text-5xl md:text-6xl md:leading-[1.05]">
              Why teams switch from<br />
              <span className="italic text-champagne-700">AppFolio and Buildium.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg text-ink-600 leading-relaxed md:text-xl">
              Eight comparisons across the operational pain points current
              customers cite most often. No marketing varnish — just where
              we&apos;ve made deliberate decisions to do it differently.
            </p>
          </div>
        </div>
      </section>

      {/* ============ COMPARISON TABLE ============ */}
      <section className="border-t border-ink-100 bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="overflow-hidden rounded-lg border border-ink-100 shadow-soft-sm">
            {/* Header */}
            <div className="hidden grid-cols-[1fr_1.3fr_1.3fr] gap-px bg-ink-100 md:grid">
              <div className="bg-cream-100 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-600">
                The pain point
              </div>
              <div className="bg-cream-100 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-600">
                AppFolio · Buildium
              </div>
              <div className="bg-ink-900 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-champagne-200">
                Portier
              </div>
            </div>
            {ROWS.map((row, idx) => (
              <div
                key={row.topic}
                className="grid grid-cols-1 gap-px bg-ink-100 md:grid-cols-[1fr_1.3fr_1.3fr]"
              >
                <div className="bg-cream-50 px-6 py-5">
                  <div className="font-display text-base tracking-editorial text-ink-900">{row.topic}</div>
                </div>
                <div className="bg-white px-6 py-5 text-[14px] leading-relaxed text-ink-600">
                  {row.appfolioBuildium}
                </div>
                <div className="bg-cream-100/60 px-6 py-5 text-[14px] leading-relaxed text-ink-900">
                  {row.portier}
                </div>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-ink-500 leading-relaxed">
            Comparisons reflect publicly documented behaviour and the most-cited
            feedback we hear in discovery calls. We&apos;ll happily revise any item
            that&apos;s out of date — write us at{' '}
            <a href="mailto:hello@portier369.com" className="text-champagne-700 underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500">
              hello@portier369.com
            </a>.
          </p>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className="border-t border-ink-100 bg-cream-100 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">From operators who switched</div>
            <h2 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
              Said in their own words.
            </h2>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-2">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="rounded-lg border border-ink-100 bg-white p-8 shadow-soft-sm">
                <blockquote className="font-display text-xl italic leading-relaxed text-ink-900">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 border-t border-ink-100 pt-4">
                  <div className="font-medium text-ink-900">{t.name}</div>
                  <div className="text-sm text-ink-500">{t.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="bg-ink-gradient text-cream-100">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-champagne-200">Begin</div>
          <h2 className="mt-4 font-display text-4xl tracking-editorial text-cream-50 md:text-6xl md:leading-[1.05]">
            Plan your migration.<br />
            <span className="italic text-champagne-300">In writing, in two days.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-cream-300 leading-relaxed">
            Send us your portfolio details — we&apos;ll return a fixed-scope
            migration proposal within two business days. No obligation.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/request-access?intent=quote">
              <Button size="lg" variant="accent">Get a migration quote</Button>
            </Link>
            <Link href="/services">
              <Button
                size="lg"
                variant="outline"
                className="border-cream-300/40 text-cream-100 hover:bg-white/5 hover:border-cream-200"
              >
                See implementation packages
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
