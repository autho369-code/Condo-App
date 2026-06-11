import Link from 'next/link';
import { BellRing, ListChecks, Plus } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, SectionTitle } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '—';
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
    <DataWorkspace
      title="Automation Center"
      description="Review what the system is scheduled to do for association events, vendor confirmations, resident notices, and after-event follow-ups."
      actions={
        <Link href="/calendar/new">
          <Button><Plus className="h-4 w-4" /> Create event automation</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            { label: 'Scheduled reminders', value: reminderRows.length },
            { label: 'Due now', value: dueSoon },
            { label: 'Open follow-ups', value: taskRows.filter((task: any) => task.status === 'open').length },
            { label: 'Completed tasks', value: taskRows.filter((task: any) => task.status === 'completed').length },
          ]}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section>
            <SectionTitle title="Reminder queue" />
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
                      <TD className="whitespace-nowrap">{formatDate(reminder.remind_at)}</TD>
                      <TD>
                        <div className="font-medium text-gray-900">{reminder.calendar_events?.title ?? 'Calendar event'}</div>
                        <div className="text-xs text-gray-500">{reminder.associations?.name ?? 'Portfolio-wide'}</div>
                      </TD>
                      <TD className="capitalize">{String(reminder.recipient_group).replaceAll('_', ' ')}</TD>
                      <TD className="max-w-xs text-gray-600">{String(reminder.action).replaceAll(',', ', ')}</TD>
                      <TD><Badge status={reminder.status} /></TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={BellRing}
                  title="No reminders scheduled"
                  description="Create a calendar event with reminders to populate this queue."
                />
              </div>
            )}
          </section>

          <section>
            <SectionTitle title="Follow-up tasks" />
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
                      <TD className="whitespace-nowrap">{formatDate(task.due_at)}</TD>
                      <TD>
                        <div className="font-medium text-gray-900">{task.title}</div>
                        <div className="line-clamp-2 text-xs text-gray-500">{task.description}</div>
                      </TD>
                      <TD>{task.associations?.name ?? 'Portfolio-wide'}</TD>
                      <TD><Badge status={task.status} /></TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={ListChecks}
                  title="No follow-up tasks"
                  description="Event automations can create completion checks after water shutoffs, vendor visits, and meetings."
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </DataWorkspace>
  );
}
