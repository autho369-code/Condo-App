import { createClient } from '@/lib/supabase/server';
import { requireStaff, requireWorkspaceStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Alert, EmptyState, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Wrench } from 'lucide-react';
import { nextRecurringDate } from '@/lib/time/recurrence';
import { addDaysToDate, todayInZone, wallDateTimeToIso } from '@/lib/time/zoned';
import { DEFAULT_TIME_ZONE, isValidTimeZone } from '@/lib/time/display-zone';
import { associationZone, MAINTENANCE_CATEGORY_EVENT_TYPE, syncMaintenanceCalendarEvent } from '@/lib/maintenance/calendar';
import { mergePrivateFields, mergePrivateFieldsOne, savePrivateFields } from '@/lib/private-fields';
import { PendingSubmit } from '@/components/ui/pending-submit';

export const dynamic = 'force-dynamic';

const FREQ: Record<string,string> = { weekly:'Weekly',monthly:'Monthly',bimonthly:'Every 2mo',quarterly:'Quarterly',semiannual:'Semi-annual',annual:'Annual',custom:'Custom' };
const CATS = ['Safety','Plumbing','Exterior','Interior','Grounds','HVAC','Mechanical','Electrical','Operations','Other'];
const FREQS = ['weekly','monthly','bimonthly','quarterly','semiannual','annual','custom'];
const REMINDERS = [30,14,10,7,5,3,1];

// Server actions must fail loudly: redirect back with ?error= (CLAUDE.md rule 3).
function maintenanceFail(message: string, tab = 'tasks'): never {
  redirect(`/maintenance?tab=${tab}&error=${encodeURIComponent(message)}`);
}

async function addTask(formData: FormData) {'use server';
  const supabase = await createClient(); const db = supabase as any;
  const me = await requireStaff();
  const freq = formData.get('frequency') as string;
  // A blank start date means today in the selected association's own zone.
  const startDate = (formData.get('start_date') as string)
    || todayInZone(await associationZone(db, (formData.get('association_id') as string) || null));
  const { data: task, error: taskError } = await db.from('maintenance_tasks').insert({
    association_id: formData.get('association_id'), task_name: formData.get('task_name'),
    category: formData.get('category'), frequency: freq,
    custom_interval_days: freq==='custom' ? parseInt(formData.get('custom_days') as string)||null : null,
    vendor_id: (formData.get('vendor_id') as string)||null,
    assigned_staff_id: (formData.get('staff_id') as string)||null,
    reminder_days: formData.getAll('reminders').map(Number).filter(n=>n>0),
    priority: formData.get('priority')||'normal',
    start_date: startDate, end_date: (formData.get('end_date') as string)||null,
    next_due_date: startDate, notes: (formData.get('notes') as string)||null,
  }).select('id').single();
  if (taskError || !task) maintenanceFail(`Task not added: ${taskError?.message ?? 'unknown error'}`);

  if (task && me.portfolio?.id) {
    await syncMaintenanceCalendarEvent(
      db, me.portfolio.id, task.id,
      formData.get('association_id') as string,
      formData.get('vendor_id') as string|null,
      formData.get('task_name') as string,
      formData.get('category') as string,
      startDate,
      formData.get('end_date') as string|null,
      formData.get('notes') as string|null,
      me.auth_user_id
    );
  }
  revalidatePath('/maintenance');
  revalidatePath('/calendar');
}

async function updateTask(formData: FormData) {'use server';
  await (await import('@/lib/auth/me')).requireStaff();  // in-action guard
  const supabase = await createClient(); const db = supabase as any;
  const freq = formData.get('frequency') as string;
  const id = formData.get('id') as string;
  const { data: updatedRows, error: updateError } = await db.from('maintenance_tasks').update({
    task_name: formData.get('task_name'), category: formData.get('category'),
    frequency: freq, custom_interval_days: freq==='custom' ? parseInt(formData.get('custom_days') as string)||null : null,
    vendor_id: (formData.get('vendor_id') as string)||null,
    assigned_staff_id: (formData.get('staff_id') as string)||null,
    reminder_days: formData.getAll('reminders').map(Number).filter(n=>n>0),
    priority: formData.get('priority')||'normal',
    start_date: formData.get('start_date'), end_date: (formData.get('end_date') as string)||null,
  }).eq('id', id).select('id');
  if (updateError) maintenanceFail(`Task not updated: ${updateError.message}`);
  if (!updatedRows?.length) maintenanceFail('Task not updated: it was not found or you do not have access to it.');
  // Notes are staff-only (maintenance_task_private), written there directly so
  // clearing them works.
  const notes = ((formData.get('notes') as string) ?? '').trim() || null;
  const notesError = await savePrivateFields(db, 'maintenance_task_private', 'maintenance_task_id', id, { notes });
  if (notesError) maintenanceFail(`Task updated, but its notes were not: ${notesError.message}`);
  // Update the linked upcoming event. It belongs on the task's NEXT due date
  // (the start date would move an advanced recurrence back to its first one).
  const eventType = MAINTENANCE_CATEGORY_EVENT_TYPE[formData.get('category') as string] || 'custom_event';
  const { data: saved } = await db.from('maintenance_tasks').select('association_id, next_due_date, start_date').eq('id', id).maybeSingle();
  const zone = await associationZone(db, saved?.association_id ?? null);
  const due = String(saved?.next_due_date ?? saved?.start_date ?? '').slice(0, 10);
  const { error: eventError } = await db.from('calendar_events').update({
    title: `🔧 ${formData.get('task_name')}`,
    event_type: eventType,
    start_datetime: due ? (wallDateTimeToIso(`${due}T09:00`, zone) ?? undefined) : undefined,
    // Same-day 9-5 occurrence; the task end date only bounds the recurrence.
    end_datetime: due ? wallDateTimeToIso(`${due}T17:00`, zone) : null,
    vendor_id: (formData.get('vendor_id') as string)||null,
    // Staff-only notes: internal_notes (calendar_event_private), not the
    // description non-staff can read. '' clears the stored copy.
    internal_notes: notes?.slice(0,200) ?? '',
  }).eq('maintenance_task_id', id).is('archived_at', null).eq('operations_status', 'scheduled');
  if (eventError) maintenanceFail(`Task updated, but its calendar event was not: ${eventError.message}`);
  revalidatePath('/maintenance');
  revalidatePath('/calendar');
}

async function deleteTask(formData: FormData) {'use server';
  await (await import('@/lib/auth/me')).requireStaff();  // in-action guard
  const supabase = await createClient();
  const id = formData.get('id') as string;
  const { data: archivedRows, error: archiveError } = await (supabase as any).from('maintenance_tasks').update({ archived_at: new Date().toISOString() }).eq('id', id).is('archived_at', null).select('id');
  if (archiveError) maintenanceFail(`Task not removed: ${archiveError.message}`);
  if (!archivedRows?.length) maintenanceFail('Task not removed: it was not found, was already removed, or you do not have access to it.');
  // Cancel linked calendar events
  const { error: cancelError } = await (supabase as any).from('calendar_events').update({ operations_status: 'canceled' }).eq('maintenance_task_id', id).is('archived_at', null);
  if (cancelError) maintenanceFail(`Task removed, but its calendar events were not cancelled: ${cancelError.message}`);
  revalidatePath('/maintenance');
  revalidatePath('/calendar');
}

async function completeTask(formData: FormData) {'use server';
  const supabase = await createClient(); const db = supabase as any;
  const me = await requireStaff();
  const id = formData.get('id') as string;
  const { data: task } = await db.from('maintenance_tasks').select('*').eq('id',id).single();
  if(!task) maintenanceFail('That task was not found.');
  await mergePrivateFieldsOne(db, 'maintenance_task_private', 'maintenance_task_id', ['notes'], task);

  const now = new Date().toISOString();
  // Record completion in history
  const { error: historyError } = await db.from('maintenance_task_history').insert({
    task_id: id,
    completed_at: now,
    completed_by: me.auth_user_id,
    notes: task.notes,
    vendor_id: task.vendor_id,
  });
  if (historyError) maintenanceFail(`Completion not recorded: ${historyError.message}`);

  // Mark existing calendar event as completed
  const { error: doneError } = await db.from('calendar_events').update({ operations_status: 'completed' }).eq('maintenance_task_id', id).is('archived_at', null).eq('operations_status', 'scheduled');
  if (doneError) maintenanceFail(`Completion recorded, but the calendar event was not closed: ${doneError.message}`);

  // Calculate next due date for auto-recurring
  if(task.next_due_date && task.frequency){
    // Month steps clamp to the month's length (Jan 31 -> Feb 28 -> Mar 31)
    // instead of overflowing into the next month.
    const freq = task.frequency; const cd = Number(task.custom_interval_days) || 0;
    const due = String(task.next_due_date).slice(0, 10);
    // Anchor on the task's start day so Jan 30 -> Feb 28 -> Mar 30.
    const anchorDay = Number(String(task.start_date ?? '').slice(8, 10)) || null;
    const monthSteps: Record<string, number> = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 };
    const nd = (freq === 'weekly' ? nextRecurringDate(due, 'weekly', 1)
      : freq === 'custom' && cd > 0 ? nextRecurringDate(due, 'daily', cd)
      : monthSteps[freq] ? nextRecurringDate(due, 'monthly', monthSteps[freq], anchorDay)
      : null) ?? due;
    const { error: nextError } = await db.from('maintenance_tasks').update({
      last_completed_at: now,
      next_due_date: nd,
      status: 'active',
    }).eq('id',id);
    if (nextError) maintenanceFail(`Completion recorded, but the next due date was not set: ${nextError.message}`);

    // Create calendar event for the next occurrence
    if (me.portfolio?.id) {
      await syncMaintenanceCalendarEvent(
        db, me.portfolio.id, id, task.association_id, task.vendor_id,
        task.task_name, task.category, nd, task.end_date,
        task.notes, me.auth_user_id
      );
    }
  } else {
    // No frequency — mark task completed
    const { error: closeError } = await db.from('maintenance_tasks').update({
      last_completed_at: now,
      status: 'completed',
    }).eq('id',id);
    if (closeError) maintenanceFail(`Completion recorded, but the task was not closed: ${closeError.message}`);
  }
  revalidatePath('/maintenance');
  revalidatePath('/calendar');
}

async function cloneGroup(formData: FormData) {'use server';
  const supabase = await createClient(); const db = supabase as any;
  const me = await requireStaff();
  const assocId = formData.get('association_id') as string;
  if (!assocId) maintenanceFail('Choose the association to add these tasks to.', 'templates');
  const { data: templates, error: templatesError } = await db.from('maintenance_templates').select('*').eq('group_id', formData.get('group_id') as string);
  if (templatesError) maintenanceFail(`Templates could not be loaded: ${templatesError.message}`, 'templates');
  if(templates){
    // Today in the association's own time zone (a UTC date is tomorrow on a US evening).
    const today = todayInZone(await associationZone(db, assocId));
    const tasks = templates.map((t:any)=>({
      association_id: assocId, template_id: t.id,
      task_name: t.name, category: t.category,
      frequency: 'monthly',
      priority: 'normal',
      start_date: today, next_due_date: today, notes: t.description,
    }));
    const { data: created, error: cloneError } = await db.from('maintenance_tasks').insert(tasks).select('id,category,task_name');
    if (cloneError) maintenanceFail(`Tasks not added: ${cloneError.message}`, 'templates');
    // Create calendar events for each cloned task
    if (created && me.portfolio?.id) {
      for (const [i, t] of (created as any[]).entries()) {
        await syncMaintenanceCalendarEvent(
          db, me.portfolio.id, t.id, assocId, null,
          t.task_name, t.category, today, null,
          tasks[i]?.notes ?? null, me.auth_user_id
        );
      }
    }
  }
  revalidatePath('/maintenance');
  revalidatePath('/calendar');
}

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ assoc?: string; tab?: string; edit?: string; add?: string; error?: string }> }) {
  await requireWorkspaceStaff(); // company admins land here from their portal
  const supabase = await createClient(); const db = supabase as any;
  const sp = await searchParams;

  const [{ data: tasks, error: tasksError }, { data: associations }, { data: groups }, { data: vendors }, { data: staff }] = await Promise.all([
    db.from('maintenance_tasks').select('*, associations!inner(name, timezone), vendors(name), profiles(full_name)').is('archived_at',null).order('next_due_date',{ascending:true,nullsFirst:false}),
    db.from('associations').select('id,name').is('archived_at',null).order('name'),
    db.from('maintenance_template_groups').select('*, templates:maintenance_templates(*)').order('sort_order'),
    db.from('vendors').select('id,name,trade,emails').is('archived_at',null).order('name'),
    // Only active staff can be assigned a task.
    db.from('profiles').select('id,full_name,email').eq('hoa_role','manager').is('disabled_at', null).order('full_name'),
  ]);

  let rows = (tasks??[]) as any[];
  // Task notes are staff-only (maintenance_task_private).
  await mergePrivateFields(db, 'maintenance_task_private', 'maintenance_task_id', ['notes'], rows);
  if(sp.assoc) rows = rows.filter((t:any)=>t.association_id===sp.assoc);
  // Compare calendar dates (a date-only value parsed as a UTC instant counted
  // tasks due today as overdue for most of the US day).
  // Each task is judged against its own association's local date.
  const todayByZone = new Map<string, string>();
  const todayFor = (t: any) => {
    const tz = t.associations?.timezone;
    const zone = tz && isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
    if (!todayByZone.has(zone)) todayByZone.set(zone, todayInZone(zone));
    return todayByZone.get(zone)!;
  };
  const dueOn = (t: any) => String(t.next_due_date ?? '').slice(0, 10);
  const isOverdue = (t: any) => !!t.next_due_date && dueOn(t) < todayFor(t);
  const overdue = rows.filter(isOverdue).length;
  const soon = rows.filter((t:any)=>t.next_due_date&&dueOn(t)>=todayFor(t)&&dueOn(t)<=addDaysToDate(todayFor(t), 14)).length;
  const editTask = sp.edit ? rows.find((t:any)=>t.id===sp.edit) : null;
  const tab = sp.tab||'tasks';

  return (
    <DataWorkspace
      title="Preventive maintenance"
      description="Template-driven. Fully editable. Auto-recurring."
    >
      <div className="space-y-6">
        {sp.error && <Alert tone="danger" title="That didn't save.">{sp.error}</Alert>}
        {tasksError && <Alert tone="danger" title="Could not load maintenance tasks">{tasksError.message}</Alert>}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          <a
            href="/maintenance?tab=tasks"
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === 'tasks' ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Tasks ({rows.length})
          </a>
          <a
            href="/maintenance?tab=templates"
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === 'templates' ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Templates ({(groups ?? []).reduce((s: number, g: any) => s + (g.templates?.length || 0), 0)})
          </a>
        </nav>

        {tab === 'tasks' && (
          <>
            <MetricStrip
              metrics={[
                { label: 'Active', value: rows.filter((t: any) => t.status === 'active').length },
                { label: 'Due soon', value: soon },
                { label: 'Overdue', value: overdue },
                { label: 'Paused', value: rows.filter((t: any) => t.status === 'paused').length },
              ]}
            />

            <div className="flex flex-wrap items-end gap-3">
              <form action="/maintenance" method="get" className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="tab" value="tasks" />
                <label className="text-[12px] font-medium text-gray-500">
                  Association
                  <Select name="assoc" defaultValue={sp.assoc ?? ''} className="mt-1 min-w-48">
                    <option value="">All associations</option>
                    {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                </label>
                <Button type="submit" variant="secondary">Filter</Button>
                {sp.assoc && <a href="/maintenance?tab=tasks" className="self-center text-sm font-medium text-gray-500 hover:text-gray-900">Clear</a>}
              </form>
              <div className="flex-1" />
              <a href={sp.assoc ? `/maintenance?tab=tasks&assoc=${sp.assoc}&add=1` : '/maintenance?tab=tasks&add=1'}><Button>+ Add task</Button></a>
            </div>

            {(sp.edit || sp.add) && (
              <Surface className="space-y-4">
                <SectionTitle title={sp.edit ? 'Edit task' : 'Add task'} className="mb-0" />
                <form action={sp.edit ? updateTask : addTask} className="space-y-4">
                  {sp.edit && <input type="hidden" name="id" value={sp.edit} />}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2"><Label htmlFor="task_name">Task name *</Label><Input id="task_name" name="task_name" required defaultValue={editTask?.task_name} /></div>
                    <div><Label htmlFor="category">Category</Label><Select id="category" name="category" defaultValue={editTask?.category || 'Safety'}>{CATS.map(c => <option key={c}>{c}</option>)}</Select></div>
                    <div><Label htmlFor="association_id">Association *</Label><Select id="association_id" name="association_id" required defaultValue={editTask?.association_id || sp.assoc || ''}><option value="">Select</option>{(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></div>
                    <div><Label htmlFor="frequency">Frequency</Label><Select id="frequency" name="frequency" defaultValue={editTask?.frequency || 'annual'}>{FREQS.map(f => <option key={f} value={f}>{FREQ[f]}</option>)}</Select></div>
                    <div><Label htmlFor="custom_days">Custom days</Label><Input id="custom_days" name="custom_days" type="number" defaultValue={editTask?.custom_interval_days} placeholder="For custom freq" /></div>
                    <div><Label htmlFor="priority">Priority</Label><Select id="priority" name="priority" defaultValue={editTask?.priority || 'normal'}><option>low</option><option>normal</option><option>high</option><option>critical</option></Select></div>
                    <div><Label htmlFor="vendor_id">Vendor</Label><Select id="vendor_id" name="vendor_id" defaultValue={editTask?.vendor_id || ''}><option value="">None</option>{(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name} ({v.trade})</option>)}</Select></div>
                    <div><Label htmlFor="staff_id">Manager</Label><Select id="staff_id" name="staff_id" defaultValue={editTask?.assigned_staff_id || ''}><option value="">None</option>{(staff ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}</Select></div>
                    <div><Label htmlFor="start_date">{editTask ? 'Start *' : 'Start'}</Label><Input id="start_date" name="start_date" type="date" required={!!editTask} defaultValue={editTask?.start_date || ''} placeholder="Today" />{!editTask && <p className="mt-1 text-xs text-gray-500">Blank starts today in the association&rsquo;s time zone.</p>}</div>
                    <div><Label htmlFor="end_date">End</Label><Input id="end_date" name="end_date" type="date" defaultValue={editTask?.end_date} /></div>
                    <div className="sm:col-span-3"><Label>Reminders</Label><div className="mt-1 flex flex-wrap gap-3">{REMINDERS.map(d => (<label key={d} className="flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" name="reminders" value={d} defaultChecked={(editTask?.reminder_days || [30, 14, 7]).includes(d)} />{d}d</label>))}</div></div>
                    <div className="sm:col-span-3"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" rows={2} defaultValue={editTask?.notes} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">{sp.edit ? 'Save' : 'Add task'}</Button>
                    <a href={`/maintenance?tab=tasks${sp.assoc ? `&assoc=${sp.assoc}` : ''}`} className="self-center text-sm font-medium text-gray-500 hover:text-gray-900">Cancel</a>
                  </div>
                </form>
              </Surface>
            )}

            {rows.length === 0 ? (
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={Wrench}
                  title="No tasks yet"
                  description="Clone a template group or add your first preventive maintenance task."
                  action={
                    <div className="flex justify-center gap-2">
                      <a href="/maintenance?tab=templates"><Button variant="secondary">Browse templates</Button></a>
                      <a href="/maintenance?tab=tasks&add=1"><Button>Add first task</Button></a>
                    </div>
                  }
                />
              </div>
            ) : (
              <Table>
                <THead>
                  <tr><TH>Task</TH><TH>Association</TH><TH>Frequency</TH><TH>Vendor</TH><TH>Due</TH><TH>Actions</TH></tr>
                </THead>
                <tbody>
                  {rows.map((t: any) => {
                    const over = isOverdue(t);
                    return (
                      <TR key={t.id}>
                        <TD><div className="font-medium text-gray-900">{t.task_name}</div><div className="text-xs text-gray-500">{t.category} · {t.priority}</div></TD>
                        <TD>{t.associations?.name}</TD>
                        <TD className="text-xs">{FREQ[t.frequency] || t.frequency}</TD>
                        <TD>{t.vendors?.name || '—'}</TD>
                        <TD>{t.next_due_date ? <span className={over ? 'font-medium text-red-700' : 'text-gray-700'}>{date(t.next_due_date)}</span> : <span className="text-gray-400">—</span>}</TD>
                        <TD>
                          <div className="flex gap-1">
                            <a href={`/maintenance?tab=tasks&edit=${t.id}${sp.assoc ? `&assoc=${sp.assoc}` : ''}`} className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">Edit</a>
                            <form action={completeTask} className="inline"><input type="hidden" name="id" value={t.id} /><button className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50">Done</button></form>
                            <form action={deleteTask} className="inline"><input type="hidden" name="id" value={t.id} /><PendingSubmit variant="ghost" size="sm" pendingLabel="Deleting…" confirm="Delete this maintenance task?">Delete</PendingSubmit></form>
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </>
        )}

        {tab === 'templates' && (
          <div className="space-y-6">
            <Surface>
              <SectionTitle title="Clone template group to association" />
              <form action={cloneGroup} className="flex flex-wrap items-end gap-3">
                <div><Label htmlFor="group_id">Template group</Label><Select id="group_id" name="group_id" required className="min-w-48"><option value="">Select</option>{(groups ?? []).map((g: any) => <option key={g.id} value={g.id}>{g.name} ({(g.templates ?? []).length})</option>)}</Select></div>
                <div><Label htmlFor="association_id">Target association</Label><Select id="association_id" name="association_id" required className="min-w-48"><option value="">Select</option>{(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></div>
                <Button type="submit">Clone all tasks</Button>
              </form>
            </Surface>
            {(groups ?? []).map((g: any) => (
              <Surface key={g.id}>
                <SectionTitle title={g.name} description={`${g.description ?? ''}${g.description ? ' · ' : ''}${(g.templates ?? []).length} tasks`} />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(g.templates ?? []).map((t: any) => (
                    <div key={t.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                      <div className="font-medium text-gray-900">{t.name}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        <span>{t.category}</span>
                        {t.description && <><span> · </span><span>{t.description.slice(0, 60)}{t.description.length > 60 ? '…' : ''}</span></>}
                      </div>
                    </div>
                  ))}
                </div>
              </Surface>
            ))}
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
