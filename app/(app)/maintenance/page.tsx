import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { EmptyState, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { Wrench } from 'lucide-react';
import type { CalendarEventType } from '@/lib/operations/calendar';

export const dynamic = 'force-dynamic';

const FREQ: Record<string,string> = { weekly:'Weekly',monthly:'Monthly',bimonthly:'Every 2mo',quarterly:'Quarterly',semiannual:'Semi-annual',annual:'Annual',custom:'Custom' };
const CATS = ['Safety','Plumbing','Exterior','Interior','Grounds','HVAC','Mechanical','Electrical','Operations','Other'];
const FREQS = ['weekly','monthly','bimonthly','quarterly','semiannual','annual','custom'];
const REMINDERS = [30,14,10,7,5,3,1];

// Map maintenance categories to calendar event types
const CATEGORY_EVENT_TYPE: Record<string, CalendarEventType> = {
  Safety: 'inspection', Plumbing: 'vendor_service', Exterior: 'landscaping',
  Interior: 'vendor_service', Grounds: 'landscaping', HVAC: 'vendor_service',
  Mechanical: 'vendor_service', Electrical: 'vendor_service',
  Operations: 'custom_event', Other: 'custom_event',
};

async function syncCalendarEvent(
  db: any, portfolioId: string, taskId: string, assocId: string | null, vendorId: string | null,
  title: string, category: string, dueDate: string, endDate: string | null,
  notes: string | null, createdBy: string | null
) {
  const eventType = CATEGORY_EVENT_TYPE[category] || 'custom_event';
  const start = dueDate ? `${dueDate}T09:00:00` : new Date().toISOString();
  const end = endDate ? `${endDate}T17:00:00` : null;
  await db.from('calendar_events').insert({
    portfolio_id: portfolioId,
    association_id: assocId, vendor_id: vendorId,
    maintenance_task_id: taskId,
    title: `🔧 ${title}`, event_type: eventType,
    calendar_scope: 'daily',
    start_datetime: start, end_datetime: end,
    location: null, description: notes?.slice(0,200) || null,
    operations_status: 'scheduled',
    notification_recipients: ['management_office'],
    reminder_rules: [{ minutes_before: 10080, actions: ['notify_management_office'] }],
    created_by: createdBy,
  });
}

async function addTask(formData: FormData) {'use server';
  const supabase = await createClient(); const db = supabase as any;
  const me = await requireStaff();
  const freq = formData.get('frequency') as string;
  const { data: task } = await db.from('maintenance_tasks').insert({
    association_id: formData.get('association_id'), task_name: formData.get('task_name'),
    category: formData.get('category'), frequency: freq,
    custom_interval_days: freq==='custom' ? parseInt(formData.get('custom_days') as string)||null : null,
    vendor_id: (formData.get('vendor_id') as string)||null,
    assigned_staff_id: (formData.get('staff_id') as string)||null,
    reminder_days: formData.getAll('reminders').map(Number).filter(n=>n>0),
    priority: formData.get('priority')||'normal',
    start_date: formData.get('start_date'), end_date: (formData.get('end_date') as string)||null,
    next_due_date: formData.get('start_date'), notes: (formData.get('notes') as string)||null,
  }).select('id').single();

  if (task && me.portfolio?.id) {
    await syncCalendarEvent(
      db, me.portfolio.id, task.id,
      formData.get('association_id') as string,
      formData.get('vendor_id') as string|null,
      formData.get('task_name') as string,
      formData.get('category') as string,
      formData.get('start_date') as string,
      formData.get('end_date') as string|null,
      formData.get('notes') as string|null,
      me.auth_user_id
    );
  }
  revalidatePath('/maintenance');
  revalidatePath('/calendar');
}

async function updateTask(formData: FormData) {'use server';
  const supabase = await createClient(); const db = supabase as any;
  const freq = formData.get('frequency') as string;
  const id = formData.get('id') as string;
  await db.from('maintenance_tasks').update({
    task_name: formData.get('task_name'), category: formData.get('category'),
    frequency: freq, custom_interval_days: freq==='custom' ? parseInt(formData.get('custom_days') as string)||null : null,
    vendor_id: (formData.get('vendor_id') as string)||null,
    assigned_staff_id: (formData.get('staff_id') as string)||null,
    reminder_days: formData.getAll('reminders').map(Number).filter(n=>n>0),
    priority: formData.get('priority')||'normal',
    start_date: formData.get('start_date'), end_date: (formData.get('end_date') as string)||null,
    notes: (formData.get('notes') as string)||null,
  }).eq('id', id);
  // Update linked calendar event
  const eventType = CATEGORY_EVENT_TYPE[formData.get('category') as string] || 'custom_event';
  const start = formData.get('start_date') as string;
  await db.from('calendar_events').update({
    title: `🔧 ${formData.get('task_name')}`,
    event_type: eventType,
    start_datetime: start ? `${start}T09:00:00` : undefined,
    end_datetime: formData.get('end_date') ? `${formData.get('end_date')}T17:00:00` : null,
    vendor_id: (formData.get('vendor_id') as string)||null,
    description: (formData.get('notes') as string)?.slice(0,200)||null,
  }).eq('maintenance_task_id', id).is('archived_at', null).is('operations_status', 'scheduled');
  revalidatePath('/maintenance');
  revalidatePath('/calendar');
}

async function deleteTask(formData: FormData) {'use server';
  const supabase = await createClient();
  const id = formData.get('id') as string;
  await (supabase as any).from('maintenance_tasks').update({ archived_at: new Date().toISOString() }).eq('id', id);
  // Cancel linked calendar events
  await (supabase as any).from('calendar_events').update({ operations_status: 'canceled' }).eq('maintenance_task_id', id).is('archived_at', null);
  revalidatePath('/maintenance');
  revalidatePath('/calendar');
}

async function completeTask(formData: FormData) {'use server';
  const supabase = await createClient(); const db = supabase as any;
  const me = await requireStaff();
  const id = formData.get('id') as string;
  const { data: task } = await db.from('maintenance_tasks').select('*').eq('id',id).single();
  if(!task) { revalidatePath('/maintenance'); return; }

  const now = new Date().toISOString();
  // Record completion in history
  await db.from('maintenance_task_history').insert({
    task_id: id,
    status: 'completed',
    completed_date: now,
    notes: task.notes,
    vendor_id: task.vendor_id,
  });

  // Mark existing calendar event as completed
  await db.from('calendar_events').update({ operations_status: 'completed' }).eq('maintenance_task_id', id).is('archived_at', null).is('operations_status', 'scheduled');

  // Calculate next due date for auto-recurring
  if(task.next_due_date && task.frequency){
    const d = new Date(task.next_due_date);
    const freq = task.frequency; const cd = task.custom_interval_days;
    if(freq==='weekly') d.setDate(d.getDate()+7);
    else if(freq==='monthly') d.setMonth(d.getMonth()+1);
    else if(freq==='bimonthly') d.setMonth(d.getMonth()+2);
    else if(freq==='quarterly') d.setMonth(d.getMonth()+3);
    else if(freq==='semiannual') d.setMonth(d.getMonth()+6);
    else if(freq==='annual') d.setFullYear(d.getFullYear()+1);
    else if(freq==='custom'&&cd) d.setDate(d.getDate()+cd);
    const nd = d.toISOString().slice(0,10);
    await db.from('maintenance_tasks').update({
      last_completed_at: now,
      next_due_date: nd,
      status: 'active',
    }).eq('id',id);

    // Create calendar event for the next occurrence
    if (me.portfolio?.id) {
      await syncCalendarEvent(
        db, me.portfolio.id, id, task.association_id, task.vendor_id,
        task.task_name, task.category, nd, task.end_date,
        task.notes, me.auth_user_id
      );
    }
  } else {
    // No frequency — mark task completed
    await db.from('maintenance_tasks').update({
      last_completed_at: now,
      status: 'completed',
    }).eq('id',id);
  }
  revalidatePath('/maintenance');
  revalidatePath('/calendar');
}

async function cloneGroup(formData: FormData) {'use server';
  const supabase = await createClient(); const db = supabase as any;
  const me = await requireStaff();
  const assocId = formData.get('association_id') as string;
  const { data: templates } = await db.from('maintenance_templates').select('*').eq('group_id', formData.get('group_id') as string);
  if(templates){
    const today = new Date().toISOString().slice(0,10);
    const tasks = templates.map((t:any)=>({
      association_id: assocId, template_id: t.id,
      task_name: t.name, category: t.category,
      frequency: 'monthly',
      priority: 'normal',
      start_date: today, next_due_date: today, notes: t.description,
    }));
    const { data: created } = await db.from('maintenance_tasks').insert(tasks).select('id,category,task_name,notes');
    // Create calendar events for each cloned task
    if (created && me.portfolio?.id) {
      for (const t of created) {
        await syncCalendarEvent(
          db, me.portfolio.id, t.id, assocId, null,
          t.task_name, t.category, today, null,
          t.notes, me.auth_user_id
        );
      }
    }
  }
  revalidatePath('/maintenance');
  revalidatePath('/calendar');
}

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ assoc?: string; tab?: string; edit?: string; add?: string }> }) {
  await requireStaff();
  const supabase = await createClient(); const db = supabase as any;
  const sp = await searchParams;

  const [{ data: tasks }, { data: associations }, { data: groups }, { data: vendors }, { data: staff }] = await Promise.all([
    db.from('maintenance_tasks').select('*, associations!inner(name), vendors(name), profiles(full_name)').is('archived_at',null).order('next_due_date',{ascending:true,nullsFirst:false}),
    db.from('associations').select('id,name').is('archived_at',null).order('name'),
    db.from('maintenance_template_groups').select('*, templates:maintenance_templates(*)').order('sort_order'),
    db.from('vendors').select('id,name,trade,emails').is('archived_at',null).order('name'),
    db.from('profiles').select('id,full_name,email').order('full_name'),
  ]);

  let rows = (tasks??[]) as any[];
  if(sp.assoc) rows = rows.filter((t:any)=>t.association_id===sp.assoc);
  const overdue = rows.filter((t:any)=>t.next_due_date&&new Date(t.next_due_date)<new Date()).length;
  const soon = rows.filter((t:any)=>t.next_due_date&&(new Date(t.next_due_date).getTime()-Date.now())/86400000<=14&&(new Date(t.next_due_date).getTime()-Date.now())/86400000>=0).length;
  const editTask = sp.edit ? rows.find((t:any)=>t.id===sp.edit) : null;
  const tab = sp.tab||'tasks';

  return (
    <DataWorkspace
      title="Preventive maintenance"
      description="Template-driven. Fully editable. Auto-recurring."
    >
      <div className="space-y-6">
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
                    <div><Label htmlFor="start_date">Start *</Label><Input id="start_date" name="start_date" type="date" required defaultValue={editTask?.start_date || new Date().toISOString().slice(0, 10)} /></div>
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
                    const over = t.next_due_date && new Date(t.next_due_date) < new Date();
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
                            <form action={deleteTask} className="inline"><input type="hidden" name="id" value={t.id} /><button className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50">Delete</button></form>
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
