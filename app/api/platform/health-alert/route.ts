/**
 * GET /api/platform/health-alert
 * Called daily by cron. Reads platform_health_summary for the last 24 hours
 * and, when anything failed (scheduled database jobs, email, webhooks,
 * reports, automations, Stripe), emails each active platform operator one
 * alert linking to the System Monitor. Nothing is sent on a healthy day.
 *
 * Platform mail (sent as Portier369, never held for a suspended company). One
 * email per operator per day under a fixed key, so a retried run sends
 * nothing twice (email_queue ignores a repeated key). If the email provider
 * itself is down the alert can't arrive; the System Monitor still shows it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { healthAlertEmail, healthProblems, type PlatformHealthSummary } from '@/lib/platform/health';

export const dynamic = 'force-dynamic';

const FROM_ADDRESS = 'hello@portier369.com';
const FROM_NAME = 'Portier369';

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const svc = createServiceClient() as any;
  const { data, error } = await svc.rpc('platform_health_summary', { p_hours: 24 });
  if (error || !data) {
    console.error('[health-alert] failed to read the health summary:', error?.message);
    return NextResponse.json({ error: error?.message ?? 'no summary' }, { status: 500 });
  }

  const problems = healthProblems(data as PlatformHealthSummary);
  if (!problems.length) return NextResponse.json({ problems: 0, emailed: 0 });

  const { data: operators, error: operatorsError } = await svc
    .from('platform_operators')
    .select('id, email, full_name')
    .eq('active', true);
  if (operatorsError) {
    console.error('[health-alert] failed to read operators:', operatorsError.message);
    return NextResponse.json({ error: operatorsError.message }, { status: 500 });
  }

  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://portier369.com').replace(/\/$/, '');
  const { subject, body } = healthAlertEmail(problems, `${site}/platform-operator/system`);
  const day = new Date().toISOString().slice(0, 10);
  const rows = ((operators ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>)
    .filter((o) => o.email)
    .map((o) => ({
      to_email: o.email,
      to_name: o.full_name,
      subject,
      body,
      status: 'pending',
      from_address: FROM_ADDRESS,
      from_name: FROM_NAME,
      platform_mail: true,
      idempotency_key: `platform-health:${day}:${o.id}`,
    }));
  if (!rows.length) {
    console.error('[health-alert] problems found but no active operator has an email address');
    return NextResponse.json({ problems: problems.length, emailed: 0 });
  }

  const { error: queueError } = await svc
    .from('email_queue')
    .upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true });
  if (queueError) {
    console.error('[health-alert] failed to queue the alert:', queueError.message);
    return NextResponse.json({ error: queueError.message }, { status: 500 });
  }
  return NextResponse.json({ problems: problems.length, emailed: rows.length });
}
