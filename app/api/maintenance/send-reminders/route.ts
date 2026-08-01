/**
 * GET /api/maintenance/send-reminders
 * Called daily by cron. Sends email/SMS reminders to vendors for upcoming maintenance tasks.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDueReminders, buildReminderContent } from '@/lib/maintenance/reminders';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { queueEmails } from '@/lib/email/queue';
import { createServiceClient } from '@/lib/supabase/server';

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
      const vendorEmail = reminder.vendorEmail;
      if (!vendorEmail) {
        results.push({ task: reminder.taskName, vendor: null, status: 'skipped', error: 'Vendor email is missing' });
        continue;
      }
      const { subject, body } = buildReminderContent(reminder);

      try {
        // Queue email via the existing email pipeline. Cron has no user
        // session, so use the service client (email_queue is RLS-locked),
        // and the column is `body` — inserting `body_html` fails outright.
        const svc = createServiceClient();
        // White-label: the vendor sees the management company as the sender
        // and replies go to the company office, not the platform.
        const { error: queueError, count } = await queueEmails(svc as any, [{
          to: vendorEmail,
          subject,
          text: body,
          fromName: reminder.companyName ?? reminder.associationName ?? 'Portier369',
          replyTo: reminder.supportEmail ?? null,
          portfolioId: reminder.portfolioId ?? null,
          idempotencyKey: `maintenance-reminder:${reminder.taskId}:${reminder.dueDate}:${reminder.daysUntilDue}:${vendorEmail.toLowerCase()}`,
        }]);
        if (queueError) throw new Error(queueError);

        results.push({ task: reminder.taskName, vendor: vendorEmail, status: count ? 'queued' : 'already_queued' });
      } catch (e: any) {
        results.push({ task: reminder.taskName, vendor: reminder.vendorEmail, status: 'failed', error: e.message });
      }
    }

    return NextResponse.json({ queued: results.filter(r => r.status === 'queued').length, total: results.length, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
