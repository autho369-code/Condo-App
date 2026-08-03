import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { deliverWebhook } from '@/lib/webhooks/deliver';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  if (process.env.WEBHOOK_DELIVERY_ENABLED !== 'true') {
    return NextResponse.json({
      skipped: true,
      reason: 'Webhook delivery is not enabled',
    });
  }
  const db = createServiceClient() as any;
  const { data: claimed, error } = await db.rpc('claim_webhook_deliveries', { p_limit: 20 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let succeeded = 0;
  let failed = 0;
  for (const delivery of claimed ?? []) {
    try {
      const result = await deliverWebhook({
        deliveryId: delivery.delivery_id,
        endpointUrl: delivery.endpoint_url,
        eventType: delivery.event_type,
        payload: delivery.payload,
        signingSecret: delivery.signing_secret,
      });
      const { error: finishError } = await db.rpc('finish_webhook_delivery', { p_delivery_id: delivery.delivery_id, p_success: true, p_response_code: result.status, p_response_body: result.body, p_error_message: null });
      if (finishError) throw new Error(finishError.message);
      succeeded += 1;
    } catch (deliveryError: any) {
      failed += 1;
      const { error: finishError } = await db.rpc('finish_webhook_delivery', { p_delivery_id: delivery.delivery_id, p_success: false, p_response_code: deliveryError?.status ?? null, p_response_body: deliveryError?.responseBody ?? null, p_error_message: deliveryError?.message ?? 'Webhook delivery failed' });
      if (finishError) console.error('Could not record webhook failure:', finishError.message);
    }
  }
  return NextResponse.json({ claimed: claimed?.length ?? 0, succeeded, failed });
}
