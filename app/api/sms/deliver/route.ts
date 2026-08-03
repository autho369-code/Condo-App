import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { sendTwilioSms, smsDeliveryConfigured } from '@/lib/sms/twilio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  if (!smsDeliveryConfigured()) {
    return NextResponse.json({
      skipped: true,
      reason: 'SMS delivery is not fully configured',
    });
  }
  const db = createServiceClient() as any;
  const { data: claimed, error } = await db.rpc('claim_sms_messages', { p_limit: 20 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let sent = 0;
  let failed = 0;
  for (const message of claimed ?? []) {
    let providerMessageId: string | null = null;
    try {
      const delivered = await sendTwilioSms({ to: message.to_number, from: message.from_number, body: String(message.body ?? '') });
      providerMessageId = delivered.id;
      const { error: completeError } = await db.rpc('complete_sms_delivery', { p_message_id: message.id, p_provider_message_id: delivered.id });
      if (completeError) throw new Error(completeError.message);
      sent += 1;
    } catch (deliveryError: any) {
      failed += 1;
      const outcomeUnknown = Boolean(providerMessageId || deliveryError?.deliveryOutcomeUnknown);
      const { error: failError } = outcomeUnknown
        ? await db.rpc('quarantine_sms_delivery', { p_message_id: message.id, p_provider_message_id: providerMessageId, p_error_message: deliveryError?.message ?? 'Provider outcome is unknown; manual review required' })
        : await db.rpc('fail_sms_delivery', { p_message_id: message.id, p_error_code: deliveryError?.code ?? 'provider_error', p_error_message: deliveryError?.message ?? 'SMS delivery failed' });
      if (failError) console.error('Could not record SMS failure:', failError.message);
    }
  }
  return NextResponse.json({ claimed: claimed?.length ?? 0, sent, failed });
}
