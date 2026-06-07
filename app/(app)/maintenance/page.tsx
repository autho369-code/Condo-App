import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { date } from '@/lib/utils';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const FREQ = { weekly:'Weekly', monthly:'Monthly', bimonthly:'Every 2mo', quarterly:'Quarterly', semiannual:'Semi-annual', annual:'Annual', custom:'Custom' };
const CATS = ['Safety','Plumbing','Exterior','Interior','Grounds','HVAC','Mechanical','Electrical','Operations','Other'];
const FREQS = ['weekly','monthly','bimonthly','quarterly','semiannual','annual','custom'];
const REMINDERS = [30,14,10,7,5,3,1];
const PRIORITIES = ['low','normal','high','critical'];

// Server actions
async function addTask(formData: FormData) {'use server';
  const supabase = await createClient(); const db = supabase as any;
  const freq = formData.get('frequency') as string;
  await db.from('maintenance_tasks').insert({
    association_id: formData.get('association_id'),
    task_name: formData.get('task_name'), category: formData.get('category'),
    frequency: freq, custom_interval_days: freq==='custom' ? parseInt(formData.get('custom_days') as string)||null : null,
    vendor_id: (formData.get('vendor_id') as string)||null,
    assigned_staff_id: (formData.get('staff_id') as string)||null,
    reminder_days: formData.getAll('reminders').map(Number).filter(n=>n>0),
    priority: formData.get('priority')||'normal',
    start_date: formData.get('start_date'), end_date: (formData.get('end_date') as string)||null,
    next_due_date: formData.get('start_date'), notes: (formData.get('notes') as string)||null,
  });
  revalidatePath('/maintenance');
}

async function updateTask(formData: FormData) {'use server';
  const supabase = await createClient(); const db = supabase as any;
  const id = formData.get('id') as string; const freq = formData.get('frequency') as string;
  await db.from('maintenance_tasks').update({
    task_name: formData.get('task_name'), category: formData.get('category'),
    frequency: freq, custom_interval_days: freq==='custom' ? parseInt(formData.get('custom_days') as string)||null : null,
    vendor_id: (formData.get('vendor_id') as string)||null,
    assigned_staff_id: (formData.get('staff_id') as string)||null,
    reminder_days: formData.getAll('reminders').map(Number).filter(n=>n>0),
    priority: formData.get('priority')||'normal',
    start_date: formData.get('start_date'), end_date: (formData.get('end_date') as string)||null,
    notes: (formData.get('notes') as string)||null,
    next_due_date: formData.get('start_date'),
  }).eq('id', id);
  revalidatePath('/maintenance');
}

async function deleteTask(formData: FormData) {'use server';
  const supabase = await createClient(); const db = supabase as any;
  await db.from('maintenance_tasks').update({ archived_at: new Date().toISOString() }).eq('id', formData.get('id') as string);
  revalidatePath('/maintenance');
}

async function completeTask(formData: FormData) {'use server';
  const supabase = await createClient(); const db = supabase as any;
  const id = formData.get('id') as string;
  const { data: task } = await db.from('maintenance_tasks').select('frequency,custom_interval_days,next_due_date').eq('id', id).single();
  if (task) {
    const nextDate = task.next_due_date ? new Date(task.next_due_date) : new Date();
    const next = calcNext(task.frequency, task.custom_interval_days, nextDate);
    await db.from('maintenance_task_history').insert({ task_id: id, next_due_date: next.toISOString().slice(0,10) });
    await db.from('maintenance_tasks').update({ last_completed_at: new Date().toISOString(), next_due_date: next.toISOString().slice(0,10) }).eq('id', id);
  }
  revalidatePath('/maintenance');
}

async function cloneFromTemplate(formData: FormData) {'use server';
  const supabase = await createClient(); const db = supabase as any;
  const groupId = formData.get('group_id') as string;
  const assocId = formData.get('association_id') as string;
  const { data: templates } = await db.from('maintenance_templates').select('*').eq('group_id', groupId).order('sort_order');
  if (templates) {
    const today = new Date().toISOString().slice(0,10);
    const tasks = templates.map((t: any) => ({
      association_id: assocId, template_id: t.id,
      task_name: t.task_name, category: t.category,
      frequency: t.frequency, custom_interval_days: t.custom_interval_days,
      reminder_days: t.reminder_days, priority: t.priority,
      start_date: today, next_due_date: today, notes: t.notes,
    }));
    await db.from('maintenance_tasks').insert(tasks);
  }
  revalidatePath('/maintenance');
}

function calcNext(freq: string, customDays: number|null, from: Date): Date {
  const d = new Date(from);
  switch(freq) {
    case 'weekly': d.setDate(d.getDate()+7); break;
    case 'monthly': d.setMonth(d.getMonth()+1); break;
    case 'bimonthly': d.setMonth(d.getMonth()+2); break;
    case 'quarterly': d.setMonth(d.getMonth()+3); break;
    case 'semiannual': d.setMonth(d.getMonth()+6); break;
    case 'annual': d.setFullYear(d.getFullYear()+1); break;
    case 'custom': if(customDays) d.setDate(d.getDate()+customDays); break;
  }
  return d;
}

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ assoc?: string; edit?: string; tab?: string }> }) {
  await requireStaff();
  const supabase = await createClient(); const db = supabase as any;
  const sp = await searchParams;

  const [{ data: tasks }, { data: associations }, { data: groups }, { data: vendors }, { data: staff }] = await Promise.all([
    db.from('maintenance_tasks').select('*, associations(name), vendors(name,email), profiles(full_name)').is('archived_at', null).order('next_due_date', { ascending: true, nullsFirst: false }),
    db.from('associations').select('id,name').is('archived_at', null).order('name'),
    db.from('maintenance_template_groups').select('*, templates:maintenance_templates(*)').order('sort_order'),
    db.from('vendors').select('id,name,trade,email').is('archived_at', null).order('name'),
    db.from('profiles').select('id,full_name,email').eq('hoa_role','manager').order('full_name'),
  ]);

  let rows = (tasks ?? []) as any[];
  if (sp.assoc) rows = rows.filter((t: any) => t.association_id === sp.assoc);

  const overdue = rows.filter((t: any) => t.next_due_date && new Date(t.next_due_date) < new Date()).length;
  const upcoming = rows.filter((t: any) => t.next_due_date && (new Date(t.next_due_date).getTime() - Date.now()) / 86400000 <= 14 && (new Date(t.next_due_date).getTime() - Date.now()) / 86400000 >= 0).length;

  const editTask = sp.edit ? rows.find((t: any) => t.id === sp.edit) : null;
  const tab = sp.tab || 'tasks';

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Preventive maintenance</h1>
          <p className="mt-1 text-sm text-ink-500">Template-driven. Fully editable. Auto-recurring.</p>
        </div>
      </div>

      {/* Tabs */}
      <nav className="mb-6 flex gap-6 border-b border-ink-100">
        <a href="/maintenance?tab=tasks" className={`pb-2 text-sm font-medium border-b-2 ${tab==='tasks'?'border-brand-600 text-brand-700':'border-transparent text-ink-500'}`}>Tasks ({rows.length})</a>
        <a href="/maintenance?tab=templates" className={`pb-2 text-sm font-medium border-b-2 ${tab==='templates'?'border-brand-600 text-brand-700':'border-transparent text-ink-500'}`}>Templates ({(groups??[]).reduce((s:number,g:any)=>s+(g.templates?.length||0),0)})</a>
      </nav>

      {tab === 'tasks' && (
        <>
          {/* Metrics */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Metric label="Active" value={rows.filter((t:any)=>t.status==='active').length} tone="text-ink-700" />
            <Metric label="Due soon (14d)" value={upcoming} tone="text-amber-700" />
            <Metric label="Overdue" value={overdue} tone="text-bordeaux-700" />
            <Metric label="Paused" value={rows.filter((t:any)=>t.status==='paused').length} tone="text-slate-500" />
          </div>

          {/* Filters + Add */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <form action="/maintenance" method="get" className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="tab" value="tasks" />
              <select name="assoc" defaultValue={sp.assoc??''} className="h-9 rounded border border-ink-200 bg-white px-3 text-sm">
                <option value="">All associations</option>
                {(associations??[]).map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <Button type="submit" size="sm" variant="secondary">Filter</Button>
              {sp.assoc && <a href="/maintenance?tab=tasks" className="text-sm text-ink-500 hover:text-ink-900">Clear</a>}
            </form>
            <div className="flex-1" />
            {/* Add task button opens inline form */}
            <a href={sp.assoc ? `/maintenance?tab=tasks&assoc=${sp.assoc}&add=1` : '/maintenance?tab=tasks&add=1'}>
              <Button>+ Add task</Button>
            </a>
          </div>

          {/* Add/Edit form */}
          {(sp.edit || (sp as any).add) && (
            <MaintenanceForm
              task={editTask}
              associations={associations??[]}
              vendors={vendors??[]}
              staff={staff??[]}
              defaultAssoc={sp.assoc}
              action={sp.edit ? updateTask : addTask}
            />
          )}

          {/* Task table */}
          {rows.length === 0 ? (
            <EmptyState assoc={!!sp.assoc} />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-ink-100 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-100 bg-cream-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-ink-600">Task</th>
                    <th className="px-4 py-2.5 text-left font-medium text-ink-600">Association</th>
                    <th className="px-4 py-2.5 text-left font-medium text-ink-600">Freq</th>
                    <th className="px-4 py-2.5 text-left font-medium text-ink-600">Vendor</th>
                    <th className="px-4 py-2.5 text-left font-medium text-ink-600">Due</th>
                    <th className="px-4 py-2.5 text-left font-medium text-ink-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((t: any) => {
                    const isOverdue = t.next_due_date && new Date(t.next_due_date) < new Date();
                    return (
                    <tr key={t.id} className="hover:bg-cream-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-900">{t.task_name}</div>
                        <div className="text-xs text-ink-500">{t.category} · {t.priority}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{t.associations?.name}</td>
                      <td className="px-4 py-3 text-ink-600 text-xs">{FREQ[t.frequency]||t.frequency}</td>
                      <td className="px-4 py-3 text-ink-600">{t.vendors?.name||'—'}</td>
                      <td className="px-4 py-3">
                        {t.next_due_date ? (
                          <span className={isOverdue ? 'text-bordeaux-700 font-medium' : 'text-ink-700'}>
                            {date(t.next_due_date)}
                          </span>
                        ) : <span className="text-ink-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <a href={`/maintenance?tab=tasks&edit=${t.id}${sp.assoc?`&assoc=${sp.assoc}`:''}`} className="rounded border border-ink-200 px-2 py-1 text-xs hover:bg-cream-50">Edit</a>
                          <form action={completeTask}><input type="hidden" name="id" value={t.id} /><button className="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50">Done</button></form>
                          <form action={deleteTask}><input type="hidden" name="id" value={t.id} /><button className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">Del</button></form>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Templates tab */}
      {tab === 'templates' && (
        <div className="space-y-8">
          <CloneForm associations={associations??[]} groups={groups??[]} />
          {(groups??[]).map((g: any) => (
            <section key={g.id} className="rounded-lg border border-ink-100 bg-white p-6">
              <h2 className="text-lg font-semibold text-ink-900 mb-1">{g.name}</h2>
              <p className="text-sm text-ink-500 mb-4">{g.description} · {(g.templates??[]).length} tasks</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {(g.templates??[]).map((t: any) => (
                  <div key={t.id} className="rounded border border-ink-100 p-3 text-sm">
                    <div className="font-medium text-ink-900">{t.task_name}</div>
                    <div className="mt-1 flex gap-2 text-xs text-ink-500">
                      <span>{t.category}</span>
                      <span>·</span>
                      <span>{FREQ[t.frequency]||t.frequency}</span>
                      <span>·</span>
                      <span>{t.priority}</span>
                    </div>
                    {t.notes && <div className="mt-1 text-xs text-ink-400">{t.notes}</div>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-lg border border-ink-100 bg-white px-4 py-3"><div className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</div><div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div></div>;
}

function EmptyState({ assoc }: { assoc: boolean }) {
  return <div className="rounded-lg border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
    <h2 className="text-base font-semibold text-ink-900">No tasks yet</h2>
    <p className="mt-1 text-sm text-ink-500">{assoc ? 'Add a task or clone from a template.' : 'Select an association or clone from a template group.'}</p>
    <div className="mt-4 flex justify-center gap-3">
      <a href="/maintenance?tab=templates"><Button variant="secondary">Browse templates</Button></a>
      <a href="/maintenance?tab=tasks&add=1"><Button>Add first task</Button></a>
    </div>
  </div>;
}

function MaintenanceForm({ task, associations, vendors, staff, defaultAssoc, action }: any) {
  return (
    <form action={action} className="mb-6 rounded-lg border border-brand-200 bg-brand-50/30 p-5 space-y-4">
      <h3 className="font-semibold text-ink-900">{task ? 'Edit task' : 'Add task'}</h3>
      {task && <input type="hidden" name="id" value={task.id} />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2"><Label htmlFor="task_name">Task name *</Label><Input id="task_name" name="task_name" required defaultValue={task?.task_name} /></div>
        <div><Label htmlFor="category">Category</Label>
          <select id="category" name="category" defaultValue={task?.category||'Safety'} className="h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm">
            {CATS.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div><Label htmlFor="association_id">Association *</Label>
          <select id="association_id" name="association_id" required defaultValue={task?.association_id||defaultAssoc||''} className="h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm">
            <option value="">Select</option>
            {associations.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div><Label htmlFor="frequency">Frequency</Label>
          <select id="frequency" name="frequency" defaultValue={task?.frequency||'annual'} className="h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm">
            {FREQS.map(f=><option key={f} value={f}>{FREQ[f]}</option>)}
          </select>
        </div>
        <div><Label htmlFor="custom_days">Custom days</Label><Input id="custom_days" name="custom_days" type="number" defaultValue={task?.custom_interval_days} placeholder="Only for custom freq" /></div>
        <div><Label htmlFor="priority">Priority</Label>
          <select id="priority" name="priority" defaultValue={task?.priority||'normal'} className="h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm">
            {PRIORITIES.map(p=><option key={p}>{p}</option>)}
          </select>
        </div>
        <div><Label htmlFor="vendor_id">Vendor</Label>
          <select id="vendor_id" name="vendor_id" defaultValue={task?.vendor_id||''} className="h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm">
            <option value="">None</option>
            {vendors.map((v:any)=><option key={v.id} value={v.id}>{v.name} ({v.trade})</option>)}
          </select>
        </div>
        <div><Label htmlFor="staff_id">Manager</Label>
          <select id="staff_id" name="staff_id" defaultValue={task?.assigned_staff_id||''} className="h-10 w-full rounded border border-ink-200 bg-white px-3 text-sm">
            <option value="">None</option>
            {staff.map((s:any)=><option key={s.id} value={s.id}>{s.full_name||s.email}</option>)}
          </select>
        </div>
        <div><Label htmlFor="start_date">Start date</Label><Input id="start_date" name="start_date" type="date" defaultValue={task?.start_date||new Date().toISOString().slice(0,10)} /></div>
        <div><Label htmlFor="end_date">End date</Label><Input id="end_date" name="end_date" type="date" defaultValue={task?.end_date} /></div>
        <div className="md:col-span-3">
          <Label>Reminders</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {REMINDERS.map(d=>(
              <label key={d} className="flex items-center gap-1 text-xs"><input type="checkbox" name="reminders" value={d} defaultChecked={(task?.reminder_days||[30,14,7]).includes(d)} />{d}d</label>
            ))}
          </div>
        </div>
        <div className="md:col-span-3"><Label htmlFor="notes">Notes</Label><textarea id="notes" name="notes" rows={2} defaultValue={task?.notes} className="w-full rounded border border-ink-200 px-3 py-2 text-sm" /></div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">{task ? 'Save changes' : 'Add task'}</Button>
        <a href={`/maintenance?tab=tasks${defaultAssoc?`&assoc=${defaultAssoc}`:''}`} className="text-sm text-ink-500 self-center hover:text-ink-900">Cancel</a>
      </div>
    </form>
  );
}

function CloneForm({ associations, groups }: any) {
  return (
    <form action={cloneFromTemplate} className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <h3 className="font-semibold text-blue-900 mb-3">Clone template group to association</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="group_id">Template group</Label>
          <select id="group_id" name="group_id" required className="h-10 rounded border border-ink-200 bg-white px-3 text-sm">
            <option value="">Select group</option>
            {groups.map((g:any)=><option key={g.id} value={g.id}>{g.name} ({(g.templates??[]).length} tasks)</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="association_id">Target association</Label>
          <select id="association_id" name="association_id" required className="h-10 rounded border border-ink-200 bg-white px-3 text-sm">
            <option value="">Select association</option>
            {associations.map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <Button type="submit" size="sm">Clone all tasks</Button>
      </div>
    </form>
  );
}
