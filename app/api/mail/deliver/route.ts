import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { fetchLobLetterStatus, submitLobLetter } from '@/lib/mail/lob';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  if (process.env.PHYSICAL_MAIL_DELIVERY_ENABLED !== 'true') return NextResponse.json({ error: 'Physical-mail delivery is not enabled' }, { status: 503 });
  const db = createServiceClient() as any;
  const { data: claimed, error } = await db.rpc('claim_physical_mail', { p_limit: 10 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let submitted = 0;
  let failed = 0;
  for (const piece of claimed ?? []) {
    try {
      const result = await submitLobLetter(piece);
      const { error: completeError } = await db.rpc('complete_physical_mail', { p_id: piece.id, p_provider_piece_id: result.id, p_provider_url: result.url, p_expected_delivery_date: result.expectedDeliveryDate });
      if (completeError) throw new Error(completeError.message);
      submitted += 1;
    } catch (deliveryError: any) {
      failed += 1;
      const { error: failError } = await db.rpc('fail_physical_mail', { p_id: piece.id, p_error: deliveryError?.message ?? 'Physical-mail submission failed' });
      if (failError) console.error('Could not record physical-mail failure:', failError.message);
    }
  }
  let tracked = 0;
  const stale = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: trackable } = await db.from('physical_mail_deliveries').select('id, provider_piece_id, status').eq('provider', 'lob').in('status', ['submitted', 'in_transit']).or(`last_status_at.is.null,last_status_at.lt.${stale}`).limit(20);
  for (const piece of trackable ?? []) {
    try {
      const result = await fetchLobLetterStatus(piece.provider_piece_id);
      await db.from('physical_mail_deliveries').update({
        status: result.status,
        expected_delivery_date: result.expectedDeliveryDate,
        last_status_at: new Date().toISOString(),
        delivered_at: result.status === 'delivered' ? new Date().toISOString() : null,
      }).eq('id', piece.id);
      tracked += 1;
    } catch (trackingError: any) {
      console.error('Could not refresh physical-mail tracking:', trackingError?.message ?? trackingError);
    }
  }
  return NextResponse.json({ claimed: claimed?.length ?? 0, submitted, failed, tracked });
}
