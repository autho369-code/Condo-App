import Link from 'next/link';
import { Input, Field } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { submitAccessRequest } from '@/lib/auth/actions';

export const metadata = {
  title: 'Request access — Portier',
  description:
    'Tell us about your portfolio and a Portier concierge will be in touch within one business day to schedule a private demonstration.',
};

const PORTFOLIO_SIZES = [
  '1–5 associations',
  '6–20 associations',
  '21–50 associations',
  '50+ associations',
  'Single-family / mixed portfolio',
];

const PLATFORMS = [
  'AppFolio',
  'Buildium',
  'Yardi',
  'TOPS',
  'CINC Systems',
  'QuickBooks + spreadsheets',
  'Spreadsheets only',
  'Other / new portfolio',
];

export default async function RequestAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string }>;
}) {
  const params = await searchParams;

  // Success state
  if (params.ok === '1') {
    return (
      <div className="bg-cream-50 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <header className="text-center">
            <div className="eyebrow">Request received</div>
            <h1 className="mt-3 font-display text-5xl tracking-editorial text-ink-900 md:text-6xl">
              We’ll be in touch{' '}
              <span className="italic text-champagne-700">shortly.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
              A Portier concierge will email you within one business day to
              schedule a private demonstration tailored to your portfolio.
            </p>
          </header>

          <div className="mx-auto mt-12 max-w-lg rounded-lg border border-ink-100 bg-white p-7 shadow-soft-sm">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-sage-100 text-sage-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </div>
              <div className="text-sm leading-relaxed text-ink-700">
                <p>
                  In the meantime, you’re welcome to{' '}
                  <Link href="/#features" className="underline decoration-champagne-300 decoration-1 underline-offset-4 hover:decoration-champagne-500 text-champagne-700 transition-colors">
                    review the platform overview
                  </Link>{' '}
                  or read{' '}
                  <Link href="/#faq" className="underline decoration-champagne-300 decoration-1 underline-offset-4 hover:decoration-champagne-500 text-champagne-700 transition-colors">
                    answers to common questions
                  </Link>.
                </p>
                <p className="mt-3 text-ink-500">
                  Need to reach us sooner?{' '}
                  <a href="mailto:hello@portier369.com" className="underline decoration-champagne-300 decoration-1 underline-offset-4 hover:decoration-champagne-500 text-champagne-700 transition-colors">
                    hello@portier369.com
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link href="/">
              <Button variant="outline" size="md">← Back to home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Form state
  return (
    <div className="bg-cream-50 py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Editorial intro side */}
        <div className="lg:pr-6">
          <div className="eyebrow">Request access</div>
          <h1 className="mt-3 font-display text-5xl tracking-editorial text-ink-900 md:text-6xl md:leading-[1.05]">
            A platform you{' '}
            <span className="italic text-champagne-700">interview first.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-600">
            Tell us about your portfolio. A concierge will follow up within
            one business day to schedule a private demonstration — no scripts,
            no bait-and-switch, no unrelated upsells.
          </p>

          <ul className="mt-10 space-y-5 border-t border-ink-100 pt-8 text-[15px] text-ink-700">
            <Reason
              title="Tailored to your portfolio"
              body="The demo focuses on your association count, payment volume, and the operating challenges your team raises in the call."
            />
            <Reason
              title="Concierge data import"
              body="We migrate your AppFolio, Buildium, Yardi or QuickBooks export within 48 hours, fully reconciled, before your first day on the platform."
            />
            <Reason
              title="Your own URL, day one"
              body="Each management company gets their own subdomain on portier369.com (or a vanity domain you already own). Your team and your residents see your name first, ours second."
            />
            <Reason
              title="No payment information requested"
              body="Pricing is presented after the demo. We never ask for a credit card to begin a conversation."
            />
          </ul>

          <div className="mt-10 border-t border-ink-100 pt-7 text-sm text-ink-600">
            Already a customer?{' '}
            <Link
              href="/login"
              className="font-medium text-champagne-700 underline decoration-champagne-300 decoration-1 underline-offset-4 hover:decoration-champagne-500 transition-colors"
            >
              Sign in to your workspace →
            </Link>
          </div>
        </div>

        {/* Form side */}
        <form
          action={submitAccessRequest as any}
          className="space-y-5 self-start rounded-lg border border-ink-100 bg-white p-7 shadow-soft md:p-9"
        >
          {/* UTM passthrough — invisible to the user */}
          {params.utm_source   && <input type="hidden" name="utm_source"   value={params.utm_source} />}
          {params.utm_medium   && <input type="hidden" name="utm_medium"   value={params.utm_medium} />}
          {params.utm_campaign && <input type="hidden" name="utm_campaign" value={params.utm_campaign} />}

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Your name">
              <Input name="contact_name" required autoComplete="name" placeholder="Margaret Devlin" />
            </Field>
            <Field label="Work email">
              <Input name="contact_email" type="email" required autoComplete="email" placeholder="m.devlin@beacon.co" />
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Management company">
              <Input name="company_name" required autoComplete="organization" placeholder="Beacon Hill Management" />
            </Field>
            <Field label="Phone (optional)">
              <Input name="contact_phone" type="tel" autoComplete="tel" placeholder="(617) 555-0142" />
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Portfolio size">
              <select
                name="portfolio_size"
                defaultValue=""
                className="h-10 w-full rounded-md border border-ink-200 bg-white px-3.5 text-sm text-ink-900 hover:border-ink-300 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60 transition-colors"
              >
                <option value="" disabled>Choose one…</option>
                {PORTFOLIO_SIZES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Current platform">
              <select
                name="current_platform"
                defaultValue=""
                className="h-10 w-full rounded-md border border-ink-200 bg-white px-3.5 text-sm text-ink-900 hover:border-ink-300 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60 transition-colors"
              >
                <option value="" disabled>Choose one…</option>
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Anything we should know" hint="Pain points, desired timeline, board pressure — whatever helps us tailor the call.">
            <textarea
              name="message"
              rows={4}
              placeholder="We need to be off AppFolio by year-end and the board wants tighter delinquency reporting…"
              className="w-full rounded-md border border-ink-200 bg-white px-3.5 py-3 text-sm text-ink-900 placeholder:text-ink-400 hover:border-ink-300 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60 transition-colors"
            />
          </Field>

          {params.error && (
            <div className="rounded-md border border-bordeaux-300 bg-bordeaux-50 px-3.5 py-2.5 text-sm text-bordeaux-700">
              {params.error}
            </div>
          )}

          <Button type="submit" size="lg" variant="primary" className="w-full">
            Request a private demonstration →
          </Button>

          <p className="text-[11px] leading-relaxed text-ink-500">
            By submitting, you agree to be contacted by Portier about your
            request. We never share your information. Read our{' '}
            <Link href="/legal/privacy" className="underline decoration-ink-200 hover:text-champagne-700 transition-colors">
              privacy notice
            </Link>.
          </p>
        </form>
      </div>
    </div>
  );
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span aria-hidden="true" className="mt-2 inline-block h-1.5 w-1.5 flex-none rounded-full bg-champagne-500" />
      <div>
        <div className="font-display text-base text-ink-900 tracking-editorial">{title}</div>
        <p className="mt-1 text-[14px] text-ink-600 leading-relaxed">{body}</p>
      </div>
    </li>
  );
}
