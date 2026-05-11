import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <div className="rounded-lg border border-champagne-200 bg-white p-8 shadow-soft">
        <div className="eyebrow text-champagne-700">Placeholder</div>
        <h1 className="mt-3 font-display text-4xl tracking-editorial text-ink-900">Privacy Policy</h1>
        <p className="mt-4 text-sm leading-6 text-ink-600">
          This legal page is intentionally marked as a placeholder until the final Portier privacy policy is approved.
          The link works so users do not hit a 404, but this copy should be replaced before public launch.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button variant="secondary">Back to Portier</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
