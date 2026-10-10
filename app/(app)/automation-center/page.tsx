import { formatInZone } from '@/lib/time/zoned';
import Link from 'next/link';
import { BellRing, ListChecks, Plus, Workflow } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Alert, Badge, EmptyState, SectionTitle } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '—';
  return formatInZone(value, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Follow-up tasks had no way to be completed, so "Completed tasks" was always 0.
async function completeTask(formData: FormData) {
  'use server';
  const me = await requireStaff();
  const id = String(formData.get('task_id') ?? '');
  const supabase = await createClient();
  const { data: done, error } = await (supabase as any)
    .from('automation_tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('portfolio_id', me.portfolio?.id)
    .eq('status', 'open')
    .select('id');
  if (error) redirect(`/automation-center?error=${encodeURIComponent(error.message)}`);
  if (!done || done.length === 0) redirect(`/automation-center?error=${encodeURIComponent('That task is already done or is not in your portfolio.')}`);
  revalidatePath('/automation-center');
  redirect('/automation-center?completed=1');
}

export default async function AutomationCenterPage({ searchParams }: { searchParams: Promise<{ error?: string; completed?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date().toISOString();

  const reminderCols = 'id, remind_at, recipient_group, action, status, calendar_events(title, event_type), associations(name)';
  const taskCols = 'id, task_type, title, description, due_at, status, associations(name), calendar_events(title)';
  const headCount = (table: string) => db.from(table).select('id', { count: 'exact', head: true });
  const results = await Promise.all([
    // Pending reminders first (soonest / overdue at the top), then recent history.
    db.from('calendar_event_reminders').select(reminderCols).eq('status', 'scheduled')
      .order('remind_at', { ascending: true }).order('id').limit(100),
    db.from('calendar_event_reminders').select(reminderCols).neq('status', 'scheduled')
      .order('remind_at', { ascending: false }).order('id').limit(50),
    db.from('automation_tasks').select(taskCols).eq('status', 'open')
      .order('due_at', { ascending: true, nullsFirst: false }).order('id').limit(100),
    db.from('automation_tasks').select(taskCols).neq('status', 'open')
      .order('due_at', { ascending: false, nullsFirst: false }).order('id').limit(50),
    headCount('calendar_event_reminders').eq('status', 'scheduled'),
    headCount('calendar_event_reminders').eq('status', 'scheduled').lte('remind_at', now),
    headCount('automation_tasks').eq('status', 'open'),
    headCount('automation_tasks').eq('status', 'completed'),
    headCount('automation_flows').eq('enabled', true),
  ]);
  const [pendingReminders, pastReminders, openTasks, closedTasks, scheduledCount, dueCount, openCount, completedCount, flowCount] = results;
  const loadErrors = results.map((r: any) => r.error?.message).filter(Boolean) as string[];

  const reminderRows = [...(pendingReminders.data ?? []), ...(pastReminders.data ?? [])];
  const taskRows = [...(openTasks.data ?? []), ...(closedTasks.data ?? [])];
  const metric = (r: any) => (r.error ? '—' : (r.count ?? 0));

  return (
    <DataWorkspace
      title="Automation Center"
      description="Review what the system is scheduled to do for association events, vendor confirmations, resident notices, and after-event follow-ups."
      actions={
        <>
          <Link href="/automation-center/flows">
            <Button variant="secondary"><Workflow className="h-4 w-4" /> Flows</Button>
          </Link>
          <Link href="/calendar/new">
            <Button><Plus className="h-4 w-4" /> Create event automation</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {sp.error && <Alert tone="danger" title="Could not update the task">{sp.error}</Alert>}
        {sp.completed && <Alert tone="success" title="Task marked done" />}
        {loadErrors.length > 0 && (
          <Alert tone="danger" title="Some automation data could not be loaded.">{[...new Set(loadErrors)].join(' · ')}</Alert>
        )}
        <MetricStrip
          metrics={[
            { label: 'Scheduled reminders', value: metric(scheduledCount) },
            { label: 'Due now', value: metric(dueCount) },
            { label: 'Open follow-ups', value: metric(openCount) },
            { label: 'Completed tasks', value: metric(completedCount) },
            { label: 'Active flows', value: metric(flowCount) },
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
                        <div className="text-[13px] text-gray-500">{reminder.associations?.name ?? 'Portfolio-wide'}</div>
                      </TD>
                      <TD className="capitalize">{String(reminder.recipient_group).replaceAll('_', ' ')}</TD>
                      <TD className="max-w-xs text-gray-600">{String(reminder.action).replaceAll(',', ', ')}</TD>
                      <TD><Badge status={reminder.status} /></TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
                    <TH className="w-28" />
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
                      <TD>
                        {task.status === 'open' && (
                          <form action={completeTask}>
                            <input type="hidden" name="task_id" value={task.id} />
                            <Button type="submit" size="sm" variant="secondary">Mark done</Button>
                          </form>
                        )}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
