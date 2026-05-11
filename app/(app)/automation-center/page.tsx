import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function AutomationCenterPage() {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date().toISOString();

  const [{ data: reminders }, { data: tasks }] = await Promise.all([
    db
      .from('calendar_event_reminders')
      .select('id, remind_at, recipient_group, action, status, calendar_events(title, event_type), associations(name)')
      .order('remind_at', { ascending: true })
      .limit(150),
    db
      .from('automation_tasks')
      .select('id, task_type, title, description, due_at, status, associations(name), calendar_events(title)')
      .order('due_at', { ascending: true })
      .limit(150),
  ]);

  const reminderRows = reminders ?? [];
  const taskRows = tasks ?? [];
  const dueSoon = reminderRows.filter((row: any) => row.status === 'scheduled' && row.remind_at <= now).length;

  return (
    <div className="h-full overflow-y-auto bg-cream-50 px-8 py-6">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Automation Center</div>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">Reminders, drafts, and follow-up work</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-500">
            Review what the system is scheduled to do for association events, vendor confirmations, resident notices, and after-event follow-ups.
          </p>
        </div>
        <Link href="/calendar/new">
          <Button>Create event automation</Button>
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric label="Scheduled reminders" value={reminderRows.length} />
        <Metric label="Due now" value={dueSoon} tone="text-bordeaux-700" />
        <Metric label="Open follow-ups" value={taskRows.filter((task: any) => task.status === 'open').length} tone="text-champagne-700" />
        <Metric label="Completed tasks" value={taskRows.filter((task: any) => task.status === 'completed').length} tone="text-green-700" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Reminder queue</h2>
          {reminderRows.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Event</TH>
                  <TH>Recipients</TH>
                  <TH>Action</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {reminderRows.map((reminder: any) => (
                  <TR key={reminder.id}>
                    <TD className="whitespace-nowrap text-sm">{formatDate(reminder.remind_at)}</TD>
                    <TD>
                      <div className="font-medium text-ink-900">{reminder.calendar_events?.title ?? 'Calendar event'}</div>
                      <div className="text-xs text-ink-500">{reminder.associations?.name ?? 'Portfolio-wide'}</div>
                    </TD>
                    <TD className="text-sm capitalize">{String(reminder.recipient_group).replaceAll('_', ' ')}</TD>
                    <TD className="max-w-xs text-sm text-ink-600">{String(reminder.action).replaceAll(',', ', ')}</TD>
                    <TD><span className="rounded bg-blue-100 px-2 py-0.5 text-xs capitalize text-champagne-700">{reminder.status}</span></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty title="No reminders scheduled" body="Create a calendar event with reminders to populate this queue." />
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Follow-up tasks</h2>
          {taskRows.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>Due</TH>
                  <TH>Task</TH>
                  <TH>Association</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {taskRows.map((task: any) => (
                  <TR key={task.id}>
                    <TD className="whitespace-nowrap text-sm">{formatDate(task.due_at)}</TD>
                    <TD>
                      <div className="font-medium text-ink-900">{task.title}</div>
                      <div className="line-clamp-2 text-xs text-ink-500">{task.description}</div>
                    </TD>
                    <TD className="text-sm text-ink-700">{task.associations?.name ?? 'Portfolio-wide'}</TD>
                    <TD><span className="rounded bg-amber-100 px-2 py-0.5 text-xs capitalize text-champagne-700">{task.status}</span></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty title="No follow-up tasks" body="Event automations can create completion checks after water shutoffs, vendor visits, and meetings." />
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = 'text-ink-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-ink-500">{body}</p>
    </div>
  );
}
