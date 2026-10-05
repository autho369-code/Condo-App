/**
 * Maintenance Reminder Notifications
 * Sends email/SMS to vendors and assigned staff when tasks are approaching due dates.
 *
 * Called daily via cron or edge function.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { firstVendorEmail } from '@/lib/vendors/document-requests';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { isValidTimeZone } from '@/lib/time/display-zone';
import { DEFAULT_TIME_ZONE, todayInZone } from '@/lib/time/zoned';

function firstPhone(list: unknown): string | null {
  for (const p of Array.isArray(list) ? list : []) {
    const v = typeof p === 'string' ? p : (p as any)?.number ?? (p as any)?.phone;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

export interface MaintenanceReminder {
  taskId: string;
  taskName: string;
  associationName: string;
  dueDate: string;
  daysUntilDue: number;
  vendorEmail: string | null;
  vendorPhone: string | null;
  vendorName: string | null;
  staffEmail: string | null;
  // White-label branding — vendor emails present as the management company
  portfolioId: string | null;
  companyName: string | null;
  supportEmail: string | null;
}

/**
 * Find all maintenance tasks with reminders due today.
 * A reminder is "due" when (next_due_date - reminder_days) = today.
 *
 * Queries base tables with the service client: cron runs have no user
 * session, and v_upcoming_maintenance filters by can_access_portfolio()
 * which is always false for anon — the view returns zero rows to cron.
 */
export async function getDueReminders(): Promise<MaintenanceReminder[]> {
  const svc = createServiceClient() as any;
  // The earliest "today" anywhere (UTC-12) bounds the query; each task is then
  // measured against today in its own association's time zone (a UTC date is
  // already tomorrow on a US evening).
  const earliestToday = todayInZone('Etc/GMT+12');

  // vendors store contact details as jsonb lists (emails, phone_numbers).
  // Every task: one request stops at 1,000 rows, which silently dropped the rest.
  const { rows: tasks, error, truncated } = await fetchAllRows<any>(() => svc
    .from('maintenance_tasks')
    .select('id, task_name, reminder_days, next_due_date, vendor_id, vendors(name, emails, phone_numbers), associations(name, timezone, portfolio_id, portfolios(company_name, support_email))')
    .is('archived_at', null)
    .eq('status', 'active')
    .not('vendor_id', 'is', null)
    .gte('next_due_date', earliestToday)
    .order('id'));
  // Fail loudly: a query error must not look like "no reminders due".
  if (error) throw new Error(`maintenance reminder lookup failed: ${error}`);
  if (truncated) throw new Error('maintenance reminder lookup hit the row limit; some reminders would be skipped');

  const reminders: MaintenanceReminder[] = [];

  for (const task of tasks ?? []) {
    const vendor = task.vendors;
    const vendorEmail = firstVendorEmail(vendor?.emails);
    if (!vendorEmail) continue;

    const zone = typeof task.associations?.timezone === 'string' && isValidTimeZone(task.associations.timezone)
      ? task.associations.timezone
      : DEFAULT_TIME_ZONE;
    const today = todayInZone(zone);
    const daysUntilDue = Math.round(
      (new Date(task.next_due_date + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000,
    );
    if (daysUntilDue < 0) continue;

    // Check if any reminder day matches today
    const reminderMatch = (task.reminder_days ?? []).some((days: number) => daysUntilDue === days);
    if (!reminderMatch) continue;

    const assoc = task.associations;
    reminders.push({
      taskId: task.id,
      taskName: task.task_name,
      associationName: assoc?.name ?? 'Association',
      dueDate: task.next_due_date,
      daysUntilDue,
      vendorEmail,
      vendorPhone: firstPhone(vendor?.phone_numbers),
      vendorName: vendor.name ?? null,
      staffEmail: null,
      portfolioId: assoc?.portfolio_id ?? null,
      companyName: assoc?.portfolios?.company_name ?? null,
      supportEmail: assoc?.portfolios?.support_email ?? null,
    });
  }

  return reminders;
}

/**
 * Build notification content for a maintenance reminder.
 */
export function buildReminderContent(reminder: MaintenanceReminder): { subject: string; body: string; sms: string } {
  const company = reminder.companyName ?? reminder.associationName;
  const subject = `Maintenance reminder: ${reminder.taskName} — ${reminder.associationName}`;

  const body = `
Hello ${reminder.vendorName ?? 'Vendor'},

This is an automated reminder that the following maintenance task is due in ${reminder.daysUntilDue} day${reminder.daysUntilDue === 1 ? '' : 's'}:

Task: ${reminder.taskName}
Association: ${reminder.associationName}
Due date: ${reminder.dueDate}

Please confirm your availability or contact the ${company} office if you have questions.

— ${company}
`.trim();

  const sms = `Reminder: ${reminder.taskName} at ${reminder.associationName} due in ${reminder.daysUntilDue}d. Reply to confirm or call the office.`;

  return { subject, body, sms };
}
