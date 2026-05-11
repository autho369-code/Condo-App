import Link from 'next/link';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardSubtitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cancelPendingPaymentIntent } from '@/lib/rpcs/checkout';

export const dynamic = 'force-dynamic';

export default async function PayCancel({
  searchParams,
}: {
  searchParams: Promise<{ pi?: string }>;
}) {
  await requireAuth();
  const { pi } = await searchParams;
  if (pi) await cancelPendingPaymentIntent(pi);

  return (
    <div className="space-y-9">
      <header className="border-b border-ink-100 pb-7">
        <div className="eyebrow">Payment cancelled</div>
        <h1 className="mt-2 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
          No charge made.{' '}
          <span className="italic text-champagne-700">Try whenever.</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-500">
          You closed the secure checkout before authorising the payment. Your
          balance is unchanged. You’re welcome to try a different method or come
          back later.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>What would you like to do?</CardTitle>
          <CardSubtitle>Pick up where you left off, or step back into the portal.</CardSubtitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Link href="/portal/pay">
              <Button size="md" variant="primary">Try again</Button>
            </Link>
            <Link href="/portal">
              <Button size="md" variant="outline">Back to portal</Button>
            </Link>
            <Link href="/portal/ledger">
              <Button size="md" variant="outline">View ledger</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
