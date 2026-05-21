import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cancelPendingPaymentIntent } from '@/lib/rpcs/checkout';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PayCancel({ searchParams }: { searchParams: Promise<{ pi?: string }> }) {
  await requireAuth();
  const { pi } = await searchParams;
  if (pi) await cancelPendingPaymentIntent(pi);

  return (
    <Card>
      <CardHeader><CardTitle>Payment canceled</CardTitle></CardHeader>
      <CardBody>
        <p className="text-sm text-gray-600">No charge was made. You can try again at any time.</p>
        <div className="mt-4 flex gap-2">
          <Link href="/portal/pay"><Button>Try again</Button></Link>
          <Link href="/portal"><Button variant="secondary">Back to portal</Button></Link>
        </div>
      </CardBody>
    </Card>
  );
}
