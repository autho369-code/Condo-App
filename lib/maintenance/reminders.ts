/**
 * Maintenance Reminder Notifications
 * Sends email/SMS to vendors and assigned staff when tasks are approaching due dates.
 *
 * Called daily via cron or edge function.
 */
import { createServiceClient } from '@/lib/supabase/server';

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
  const today = new Date().toISOString().slice(0, 10);

  const { data: tasks } = await svc
    .from('maintenance_tasks')
    .select('id, task_name, reminder_days, next_due_date, vendor_id, vendors(name, email, phone), associations(name, portfolio_id, portfolios(company_name, support_email))')
    .is('archived_at', null)
    .eq('status', 'active')
    .not('vendor_id', 'is', null)
    .gte('next_due_date', today);

  const reminders: MaintenanceReminder[] = [];

  for (const task of tasks ?? []) {
    const vendor = task.vendors;
    if (!vendor?.email) continue;

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
      vendorEmail: vendor.email,
      vendorPhone: vendor.phone ?? null,
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
