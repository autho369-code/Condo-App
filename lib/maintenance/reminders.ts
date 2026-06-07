/**
 * Maintenance Reminder Notifications
 * Sends email/SMS to vendors and assigned staff when tasks are approaching due dates.
 * 
 * Called daily via cron or edge function.
 */
import { createClient } from '@/lib/supabase/server';

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
}

/**
 * Find all maintenance tasks with reminders due today.
 * A reminder is "due" when (next_due_date - reminder_days) = today.
 */
export async function getDueReminders(): Promise<MaintenanceReminder[]> {
  const supabase = await createClient();
  const db = supabase as any;
  const today = new Date().toISOString().slice(0, 10);

  const { data: tasks } = await db
    .from('v_upcoming_maintenance')
    .select('*')
    .not('vendor_id', 'is', null)
    .gte('days_until_due', 0);

  const reminders: MaintenanceReminder[] = [];

  for (const task of tasks ?? []) {
    const { data: vendor } = await db
      .from('vendors')
      .select('name, email, phone')
      .eq('id', task.vendor_id)
      .single();

    if (!vendor?.email) continue;

    // Check if any reminder day matches today
    const reminderMatch = (task.reminder_days ?? []).some((days: number) => task.days_until_due === days);

    if (reminderMatch) {
      reminders.push({
        taskId: task.id,
        taskName: task.task_name,
        associationName: task.association_name,
        dueDate: task.next_due_date,
        daysUntilDue: task.days_until_due,
        vendorEmail: vendor.email,
        vendorPhone: vendor.phone ?? null,
        vendorName: vendor.name ?? null,
        staffEmail: null,
      });
    }
  }

  return reminders;
}

/**
 * Build notification content for a maintenance reminder.
 */
export function buildReminderContent(reminder: MaintenanceReminder): { subject: string; body: string; sms: string } {
  const subject = `Maintenance reminder: ${reminder.taskName} — ${reminder.associationName}`;

  const body = `
Hello ${reminder.vendorName ?? 'Vendor'},

This is an automated reminder that the following maintenance task is due in ${reminder.daysUntilDue} day${reminder.daysUntilDue === 1 ? '' : 's'}:

Task: ${reminder.taskName}
Association: ${reminder.associationName}
Due date: ${reminder.dueDate}

Please confirm your availability or contact the management office if you have questions.

— Portier369 Maintenance System
`.trim();

  const sms = `Reminder: ${reminder.taskName} at ${reminder.associationName} due in ${reminder.daysUntilDue}d. Reply to confirm or call the office.`;

  return { subject, body, sms };
}
