/**
 * GET /api/maintenance/send-reminders
 * Called daily by cron. Sends email/SMS reminders to vendors for upcoming maintenance tasks.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDueReminders, buildReminderContent } from '@/lib/maintenance/reminders';
import { requireCronSecret } from '@/lib/server/cron-auth';

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const reminders = await getDueReminders();

    if (reminders.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No reminders due today' });
    }

    const results = [];
    for (const reminder of reminders) {
      const { subject, body } = buildReminderContent(reminder);

      try {
        // Queue email via the existing email pipeline. Cron has no user
        // session, so use the service client (email_queue is RLS-locked),
        // and the column is `body` — inserting `body_html` fails outright.
        const { createServiceClient } = await import('@/lib/supabase/server');
        const svc = createServiceClient();
        // White-label: the vendor sees the management company as the sender
        // and replies go to the company office, not the platform.
        const { error: insertErr } = await (svc as any).from('email_queue').insert({
          to_email: reminder.vendorEmail,
          subject,
          body: body.replace(/\n/g, '<br>'),
          status: 'pending',
          from_address: 'hello@portier369.com',
          from_name: reminder.companyName ?? reminder.associationName ?? 'Portier369',
          reply_to: reminder.supportEmail ?? null,
          portfolio_id: reminder.portfolioId ?? null,
        });
        if (insertErr) throw new Error(insertErr.message);

        results.push({ task: reminder.taskName, vendor: reminder.vendorEmail, status: 'queued' });
      } catch (e: any) {
        results.push({ task: reminder.taskName, vendor: reminder.vendorEmail, status: 'failed', error: e.message });
      }
    }

    return NextResponse.json({ sent: results.filter(r => r.status === 'queued').length, total: results.length, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
