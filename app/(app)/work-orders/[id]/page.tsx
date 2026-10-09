import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import {
  updateWorkOrderStatus, updateWorkOrder, assignVendor, unassignVendor,
  addLaborEntry, addEstimate, approveEstimate, addNote, chargeBackWorkOrder,
} from '@/lib/rpcs/work-orders';
import { postWorkOrderMessage } from '@/lib/rpcs/work-orders-messages';
import { ArcMessageThread, type ArcMessage } from '@/components/architectural/message-thread';
import { RATABLE_STATUSES, RateWorkOrderForm, Stars, summarize } from '@/components/work-orders/rating';
import { money, date } from '@/lib/utils';
import { tradeLabel } from '@/lib/vendors/options';
import { loadMaintenanceAttachments } from '@/lib/maintenance/attachments';
import { MaintenanceAttachments } from '@/components/maintenance/attachments';
import { assignWorkOrderToStaff } from '@/lib/rpcs/work-order-team';
import { todayInZone } from '@/lib/time/zoned';
import { firstVendorPhone } from '@/lib/vendors/contact';
import { VendorSelect } from '@/components/vendors/vendor-select';
import { newSubmissionToken, SUBMISSION_FIELD } from '@/lib/forms/submission';

export const dynamic = 'force-dynamic';

const STATUSES   = ['new', 'assigned', 'scheduled', 'in_progress', 'done', 'completed', 'billed', 'closed', 'cancelled'];
const PRIORITIES = ['low', 'normal', 'high', 'emergency'];
const CATEGORIES = ['plumbing', 'electrical', 'hvac', 'general_repair', 'common_area', 'appliance', 'pest_control', 'landscaping', 'other'];
const TRADES = ['hvac', 'plumbing', 'electrical', 'landscaping', 'roofing', 'general_contractor', 'handyperson', 'snow_removal', 'pest_control', 'pool_spa', 'painting', 'keys_locks', 'fireplace_chimney', 'garage_doors', 'gutter_cleaning', 'inspections', 'parking_driveways', 'preventative_maintenance', 'repairs_exterior', 'repairs_interior', 'septic', 'trash_recycling', 'utilities', 'turnover', 'other'];

function Select({ name, defaultValue, options, required }: { name: string; defaultValue?: string | null; options: Array<string | { value: string; label: string }>; required?: boolean }) {
  return (
    <select name={name} defaultValue={defaultValue ?? ''} required={required}
      className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
      {!required && <option value="">—</option>}
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o.replace(/_/g, ' ') : o.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

function priorityBadge(p: string) {
  const m: Record<string, string> = {
    emergency: 'bg-red-100 text-red-800',
    high:      'bg-orange-100 text-orange-800',
    normal:    'bg-gray-100 text-gray-700',
    low:       'bg-gray-100 text-gray-500',
  };
  return m[p] ?? m.normal;
}
function statusBadge(s: string) {
  if (s === 'completed' || s === 'closed') return 'bg-green-100 text-green-700';
  if (s === 'in_progress' || s === 'done') return 'bg-blue-50 text-blue-700 ring-blue-600/15';
  if (s === 'cancelled') return 'bg-gray-100 text-gray-500 line-through';
  if (s === 'assigned' || s === 'scheduled') return 'bg-indigo-100 text-indigo-700';
  return 'bg-amber-100 text-amber-800';
}

export default async function WorkOrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string; rating_error?: string; rating_saved?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const me = await getMe();
  // Same people the chargeback action and RPC accept.
  const canChargeBack = me.is_finance_staff || me.is_company_admin || me.is_platform_operator;

  const [
    { data: wo },
    { data: updates },
    { data: labor },
    { data: estimates },
    { data: vendors },
    { data: messages },
    { data: ratings },
    { data: authData },
    { data: privateRow },
    { data: vendorPrivateRow },
  ] = await Promise.all([
    (supabase as any).from('work_orders').select(`
      *, vendors(id, name, trade, phone_numbers, emails),
      associations(name, portfolio_id),
      units(unit_number, buildings(association_id, associations(name, portfolio_id))),
      service_requests(id, number, description, priority, source, status, homeowner_id, owners:homeowner_id(full_name, email, phone))
    `).eq('id', id).maybeSingle(),
    (supabase as any).from('work_order_updates').select('id, note, new_status, created_at, created_by').eq('work_order_id', id).order('created_at', { ascending: false }),
    (supabase as any).from('work_order_labor_entries').select('id, tech_name, date_worked, hours, hourly_rate, labor_cost, description').eq('work_order_id', id).order('date_worked', { ascending: false }),
    (supabase as any).from('work_order_estimates').select('id, amount, notes, submitted_at, approved_at, rejected_at, vendors(name)').eq('work_order_id', id).order('submitted_at', { ascending: false }),
    (supabase as any).from('vendors').select('id, name, trade, association_id, is_management_company').is('archived_at', null).order('name'),
    (supabase as any).from('work_order_messages').select('id, author_name, author_role, body, created_at').eq('work_order_id', id).order('created_at', { ascending: true }),
    (supabase as any).from('work_order_ratings').select('rated_by, rater_role, score, quality, timeliness, communication, would_hire_again, comment, created_at').eq('work_order_id', id).order('created_at', { ascending: false }),
    supabase.auth.getUser(),
    // Staff-only fields (not on the work order row, which vendors/residents can read).
    (supabase as any).from('work_order_private').select('internal_notes').eq('work_order_id', id).maybeSingle(),
    // Vendor instructions: staff and the assigned vendor only.
    (supabase as any).from('work_order_vendor_private').select('vendor_instructions').eq('work_order_id', id).maybeSingle(),
  ]);
  if (!wo) notFound();
  wo.internal_notes = privateRow?.internal_notes ?? null;
  wo.vendor_instructions = vendorPrivateRow?.vendor_instructions ?? null;
  const [attachments, { data: chargebacks }, { data: chargeCategories }, { data: staffRows }] = await Promise.all([
    loadMaintenanceAttachments({ workOrderId: wo.id, serviceRequestId: wo.service_request_id }),
    wo.unit_id
      ? (supabase as any).from('charges').select('id, description, amount, due_date, created_at').eq('work_order_id', wo.id).order('created_at')
      : Promise.resolve({ data: [] }),
    wo.unit_id
      ? (supabase as any).from('charge_categories').select('id, name, association_id, portfolio_id, active').is('archived_at', null).order('name')
      : Promise.resolve({ data: [] }),
    (supabase as any).rpc('work_order_staff', { p_work_order: wo.id }),
  ]);
  const approvedEstimate = (estimates ?? []).find((e: any) => e.approved_at);
  const staff = (staffRows ?? []) as Array<{ id: string; name: string }>;

  // Common-area work orders have no unit; take the association from the work order itself.
  const assoc = (wo.units as any)?.buildings?.associations ?? (wo as any).associations;
  const sr = wo.service_requests as any;
  const vendor = wo.vendors as any;
  // The assign pickers show the trade next to the name.
  const vendorOptions = (vendors ?? []).map((v: any) => ({ ...v, name: `${v.name} (${v.trade})` }));

  const laborTotal = (labor ?? []).reduce((s: number, l: any) => s + Number(l.labor_cost ?? 0), 0);
  const pendingEstimate = (estimates ?? []).find((e: any) => !e.approved_at && !e.rejected_at);

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/work-orders" className="transition-colors hover:text-gray-700">Work orders</Link>
              {' · '}
              <span>{assoc?.name ?? 'Common area'}</span>
              {(wo.units as any)?.unit_number && (<>{' · '}<span>Unit {(wo.units as any).unit_number}</span></>)}
            </>
          }
          title={`#${wo.number ?? wo.id.slice(0, 8)} — ${wo.title}`}
          subtitle={
            <>
              <span className={`mr-1 rounded px-2 py-0.5 text-xs ${priorityBadge(wo.priority)}`}>{wo.priority}</span>
              <span className={`mr-1 rounded px-2 py-0.5 text-xs ${statusBadge(wo.status)}`}>{wo.status}</span>
              {wo.category && <span className="mr-1 rounded bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600">{wo.category.replace(/_/g, ' ')}</span>}
              {wo.trade && <span className="mr-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tradeLabel(wo.trade)}</span>}
            </>
          }
        />
      }
      rail={
        <>
          {/* Status transitions */}
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</div>
          <div className="mb-5 space-y-1.5">
            {STATUSES.filter((s) => s !== wo.status).map((s) => {
              const isDestr = s === 'cancelled';
              const isTerm  = s === 'completed' || s === 'closed';
              return (
                <form key={s} action={updateWorkOrderStatus.bind(null, id, s, undefined) as any}>
                  <button type="submit"
                    className={`w-full rounded-lg border px-3 py-1.5 text-left text-sm transition-colors ${
                      isDestr ? 'border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50'
                      : isTerm ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100'
                      : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
                    }`}>
                    Mark as <span className="font-medium capitalize">{s.replace(/_/g, ' ')}</span>
                  </button>
                </form>
              );
            })}
          </div>

          {/* In-house assignee */}
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">In-house assignee</div>
          <form action={assignWorkOrderToStaff.bind(null, id) as any} className="mb-5 flex gap-2">
            <select name="assignee_id" defaultValue={wo.assignee_id ?? ''} aria-label="In-house assignee"
              className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              <option value="">Nobody</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button type="submit" size="sm" variant="secondary">Save</Button>
          </form>

          {/* Vendor */}
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{vendor ? 'Vendor' : 'Assign vendor'}</div>
          {vendor ? (
            <div className="rounded-xl border border-gray-200 p-3 text-sm">
              <div className="font-medium">{vendor.name}</div>
              <div className="text-xs uppercase text-gray-500">{vendor.trade}</div>
              {firstVendorPhone(vendor.phone_numbers) && (
                <a href={`tel:${firstVendorPhone(vendor.phone_numbers)}`} className="mt-1 block text-gray-600 hover:text-gray-950 hover:underline">{firstVendorPhone(vendor.phone_numbers)}</a>
              )}
              {vendor.emails?.[0] && (
                <a href={`mailto:${vendor.emails[0]}`} className="block truncate text-gray-600 hover:text-gray-950 hover:underline">{vendor.emails[0]}</a>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-950 hover:underline">Reassign</summary>
                <form action={assignVendor.bind(null, id) as any} className="mt-3 space-y-2">
                  <VendorSelect name="vendor_id" vendors={vendorOptions} associationId={wo.association_id ?? null} required className="h-9" />
                  <Input name="note" placeholder="Reassignment reason (optional)" />
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" name="bump_status" defaultChecked={wo.status === 'new'} /> set status to &quot;assigned&quot;
                  </label>
                  <Button size="sm" type="submit" className="w-full">Reassign</Button>
                </form>
              </details>
              <form action={unassignVendor.bind(null, id) as any} className="mt-2 border-t border-gray-100 pt-2">
                <button type="submit" className="text-xs text-red-600 hover:underline">Unassign vendor</button>
              </form>
            </div>
          ) : (
            <form action={assignVendor.bind(null, id) as any} className="space-y-2">
              <VendorSelect name="vendor_id" vendors={vendorOptions} associationId={wo.association_id ?? null} required className="h-9" />
              <Input name="note" placeholder="Dispatch note (optional)" />
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" name="bump_status" defaultChecked /> set status to &quot;assigned&quot;
              </label>
              <Button type="submit" className="w-full">Assign vendor</Button>
            </form>
          )}

          {pendingEstimate && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-700">Pending estimate</div>
              <div className="font-medium tabular-nums">{money(pendingEstimate.amount)}</div>
              <div className="text-xs text-gray-700">from {(pendingEstimate.vendors as any)?.name}</div>
              <form action={approveEstimate.bind(null, pendingEstimate.id, id) as any} className="mt-2">
                <Button size="sm" type="submit" className="w-full">Approve</Button>
              </form>
            </div>
          )}
        </>
      }
    >
      {sp.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Could not update work order:</span> {sp.error}
        </div>
      )}

      {sp.saved === 'chargeback' && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          Chargeback posted to the homeowner&apos;s ledger.
        </div>
      )}

      <Section title="Work details">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-sm">
          <div><dt className="text-xs uppercase tracking-wider text-gray-500">Priority</dt><dd className="mt-0.5 font-medium capitalize">{wo.priority}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-gray-500">Category</dt><dd className="mt-0.5 capitalize">{wo.category?.replace(/_/g, ' ') ?? '—'}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-gray-500">Trade</dt><dd className="mt-0.5">{wo.trade ? tradeLabel(wo.trade) : '—'}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-gray-500">Scheduled</dt><dd className="mt-0.5">{date(wo.scheduled_date)} {wo.scheduled_time ?? ''}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-gray-500">In-house assignee</dt><dd className="mt-0.5">{wo.assignee_id ? (staff.find((s) => s.id === wo.assignee_id)?.name ?? wo.assigned_to ?? 'Team member') : '—'}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-gray-500">Requested by</dt><dd className="mt-0.5">{wo.requested_by ?? '—'}</dd></div>
          <div className="col-span-2"><dt className="text-xs uppercase tracking-wider text-gray-500">Issue</dt><dd className="mt-0.5 whitespace-pre-wrap">{wo.issue ?? wo.description ?? '—'}</dd></div>
          {wo.vendor_instructions && <div className="col-span-2"><dt className="text-xs uppercase tracking-wider text-gray-500">Vendor instructions</dt><dd className="mt-0.5 whitespace-pre-wrap">{wo.vendor_instructions}</dd></div>}
          {wo.owner_availability && <div className="col-span-2"><dt className="text-xs uppercase tracking-wider text-gray-500">Access / availability</dt><dd className="mt-0.5">{wo.owner_availability}</dd></div>}
          {wo.internal_notes && <div className="col-span-2"><dt className="text-xs uppercase tracking-wider text-gray-500">Internal notes</dt><dd className="mt-0.5 whitespace-pre-wrap">{wo.internal_notes}</dd></div>}
        </dl>

        <details className="border-t border-gray-100 px-5 py-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-gray-600 hover:text-gray-950 hover:underline">Edit work order</summary>
          <form action={updateWorkOrder.bind(null, id) as any} className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label htmlFor="title">Title</Label><Input id="title" name="title" defaultValue={wo.title ?? ''} required /></div>
            <div className="md:col-span-2"><Label htmlFor="issue">Issue</Label>
              <textarea id="issue" name="issue" defaultValue={wo.issue ?? wo.description ?? ''} rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /></div>
            <div><Label>Priority</Label><Select name="priority" defaultValue={wo.priority} options={PRIORITIES} required /></div>
            <div><Label>Category</Label><Select name="category" defaultValue={wo.category} options={CATEGORIES} required /></div>
            <div><Label>Trade</Label><Select name="trade" defaultValue={wo.trade ?? ''} options={TRADES} /></div>
            <div><Label htmlFor="scheduled_date">Scheduled date</Label><Input id="scheduled_date" name="scheduled_date" type="date" defaultValue={wo.scheduled_date ?? ''} /></div>
            <div><Label htmlFor="scheduled_time">Scheduled time</Label><Input id="scheduled_time" name="scheduled_time" type="time" defaultValue={wo.scheduled_time ?? ''} /></div>
            <div><Label htmlFor="next_followup_date">Next follow-up</Label><Input id="next_followup_date" name="next_followup_date" type="date" defaultValue={wo.next_followup_date ?? ''} /></div>
            <div><Label htmlFor="requested_by">Requested by</Label><Input id="requested_by" name="requested_by" defaultValue={wo.requested_by ?? ''} /></div>
            <div className="md:col-span-2"><Label htmlFor="vendor_instructions">Vendor instructions</Label>
              <textarea id="vendor_instructions" name="vendor_instructions" defaultValue={wo.vendor_instructions ?? ''} rows={2}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /></div>
            <div className="md:col-span-2"><Label htmlFor="owner_availability">Access / availability</Label><Input id="owner_availability" name="owner_availability" defaultValue={wo.owner_availability ?? ''} /></div>
            <div className="md:col-span-2"><Label htmlFor="internal_notes">Internal notes</Label>
              <textarea id="internal_notes" name="internal_notes" defaultValue={wo.internal_notes ?? ''} rows={2}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /></div>
            <div className="md:col-span-2 flex justify-end"><Button type="submit">Save changes</Button></div>
          </form>
        </details>
      </Section>

      {sr && (
        <Section title={`Parent service request #${sr.number ?? sr.id.slice(0, 8)}`}>
          <div className="px-5 py-4">
            <p className="whitespace-pre-wrap text-sm text-gray-700">{sr.description}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><dt className="text-gray-500">Priority</dt><dd className="capitalize">{sr.priority}</dd></div>
              <div><dt className="text-gray-500">Source</dt><dd className="capitalize">{sr.source}</dd></div>
              <div><dt className="text-gray-500">Status</dt><dd className="capitalize">{sr.status}</dd></div>
              {(sr.owners as any)?.full_name && <div><dt className="text-gray-500">Submitted by</dt><dd>{(sr.owners as any).full_name} ({(sr.owners as any).email})</dd></div>}
            </dl>
          </div>
        </Section>
      )}

      <Section title="Photos & files" subtitle="Includes the resident's photos on the request. The assigned vendor sees these too.">
        <div className="px-5 py-4">
          <MaintenanceAttachments kind="work_order" parentId={wo.id} items={attachments} canUpload currentUserId={authData?.user?.id ?? null} canRemoveAny />
        </div>
      </Section>

      <Section
        title="Labor entries"
        actions={laborTotal > 0 ? <div className="text-xs text-gray-500">Total <span className="font-semibold text-gray-900">{money(laborTotal)}</span></div> : null}
      >
        {labor && labor.length > 0 ? (
          <Table>
            <THead><TR><TH>Tech</TH><TH>Date</TH><TH className="text-right">Hours</TH><TH className="text-right">Rate</TH><TH className="text-right">Cost</TH><TH>Description</TH></TR></THead>
            <tbody>
              {labor.map((l: any) => (
                <TR key={l.id}>
                  <TD>{l.tech_name}</TD>
                  <TD>{date(l.date_worked)}</TD>
                  <TD className="text-right tabular-nums">{l.hours}</TD>
                  <TD className="text-right tabular-nums">{l.hourly_rate ? money(l.hourly_rate) + '/hr' : '—'}</TD>
                  <TD className="text-right font-medium tabular-nums">{money(l.labor_cost ?? 0)}</TD>
                  <TD className="text-gray-600">{l.description}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : <p className="px-5 py-4 text-sm text-gray-500">No labor entries yet.</p>}

        <form action={addLaborEntry.bind(null, id) as any} className="grid grid-cols-1 gap-3 border-t border-gray-100 px-5 py-4 md:grid-cols-5">
          <select name="tech_id" defaultValue={wo.assignee_id ?? ''} aria-label="Team member"
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
            <option value="">Someone else (type name)…</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Input name="tech_name" placeholder="Name if not on the team" />
          <Input name="date_worked" type="date" defaultValue={todayInZone()} max={todayInZone()} required />
          <Input name="hours" type="number" step="0.25" min="0.25" placeholder="Hours" required />
          <Input name="hourly_rate" type="number" step="0.01" placeholder="$/hr (optional)" />
          <div className="flex gap-3 md:col-span-5">
            <Input name="description" placeholder="What was done" className="flex-1" />
            <Button type="submit">Add entry</Button>
          </div>
        </form>
      </Section>

      {wo.unit_id && canChargeBack ? (
        <Section title="Charge back to homeowner" subtitle="For repairs the owner caused. The charge goes on the unit ledger and posts to the GL.">
          {(chargebacks ?? []).length > 0 ? (
            <Table>
              <THead><TR><TH>Charge</TH><TH className="text-right">Amount</TH><TH>Due</TH></TR></THead>
              <tbody>
                {(chargebacks ?? []).map((c: any) => (
                  <TR key={c.id}>
                    <TD><Link href={`/units/${wo.unit_id}`} className="hover:underline">{c.description}</Link></TD>
                    <TD className="text-right font-medium tabular-nums">{money(c.amount)}</TD>
                    <TD>{date(c.due_date)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : null}
          <form action={chargeBackWorkOrder.bind(null, id) as any} className="grid grid-cols-1 gap-3 border-t border-gray-100 px-5 py-4 md:grid-cols-3">
            <input type="hidden" name={SUBMISSION_FIELD} value={newSubmissionToken()} />
            <div>
              <Label>Charge category</Label>
              <Select name="charge_category_id" required
                options={(chargeCategories ?? [])
                  // Same scope charge_back_work_order accepts: active, this company, this association or company-wide.
                  .filter((c: any) => c.active !== false
                    && c.portfolio_id === (wo.portfolio_id ?? (wo.units as any)?.buildings?.associations?.portfolio_id)
                    && (!c.association_id || c.association_id === wo.association_id))
                  .map((c: any) => ({ value: c.id, label: c.name }))} />
            </div>
            <div>
              <Label htmlFor="cb_amount">Amount</Label>
              <Input id="cb_amount" name="amount" type="number" step="0.01" min="0.01" max="100000" required
                placeholder={approvedEstimate ? String(approvedEstimate.amount) : laborTotal > 0 ? laborTotal.toFixed(2) : '0.00'} />
            </div>
            <div>
              <Label htmlFor="cb_due">Due date</Label>
              <Input id="cb_due" name="due_date" type="date" defaultValue={todayInZone()} />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="cb_description">Description on the owner&apos;s ledger</Label>
              <Input id="cb_description" name="description" maxLength={500} placeholder={`Chargeback: ${wo.title ?? 'repair'}${wo.number ? ` (work order #${wo.number})` : ''}`} />
            </div>
            <div className="flex flex-col gap-2 md:col-span-3 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-gray-500">
                Costs on this work order: labor {money(laborTotal)}{approvedEstimate ? ` · approved estimate ${money(approvedEstimate.amount)}` : ''}
              </p>
              <Button type="submit" variant="secondary">Post chargeback</Button>
            </div>
          </form>
        </Section>
      ) : null}

      <Section title="Estimates">
        {estimates && estimates.length > 0 ? (
          <Table>
            <THead><TR><TH>Vendor</TH><TH className="text-right">Amount</TH><TH>Submitted</TH><TH>Status</TH><TH></TH></TR></THead>
            <tbody>
              {estimates.map((e: any) => (
                <TR key={e.id}>
                  <TD>{(e.vendors as any)?.name ?? '—'}</TD>
                  <TD className="text-right font-medium tabular-nums">{money(e.amount)}</TD>
                  <TD>{date(e.submitted_at)}</TD>
                  <TD>{e.approved_at ? '✓ approved' : e.rejected_at ? '✗ rejected' : 'pending'}</TD>
                  <TD className="text-right">
                    {!e.approved_at && !e.rejected_at && (
                      <form action={approveEstimate.bind(null, e.id, id) as any}>
                        <button type="submit" className="text-xs text-gray-600 hover:text-gray-950 hover:underline">Approve</button>
                      </form>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : <p className="px-5 py-4 text-sm text-gray-500">No estimates yet.</p>}

        <form action={addEstimate.bind(null, id) as any} className="grid grid-cols-1 gap-3 border-t border-gray-100 px-5 py-4 md:grid-cols-3">
          <VendorSelect name="vendor_id" vendors={vendors ?? []} associationId={wo.association_id ?? null} placeholder="Choose vendor…" />
          <Input name="amount" type="number" step="0.01" min="0" placeholder="Quote $" required />
          <Button type="submit">Add estimate</Button>
          <Input name="notes" placeholder="Notes" className="md:col-span-3" />
        </form>
      </Section>

      {vendor && RATABLE_STATUSES.has(wo.status) && (() => {
        const rows = (ratings ?? []) as any[];
        const summary = summarize(rows);
        const mine = rows.find((r) => r.rated_by === authData?.user?.id) ?? null;
        return (
          <Section
            title="Vendor rating"
            subtitle={summary.count ? `${summary.average} ★ from ${summary.count} rating${summary.count === 1 ? '' : 's'}` : 'Rate how the vendor did — it feeds their scorecard.'}
          >
            {rows.length > 0 && (
              <ul className="divide-y divide-gray-100 border-b border-gray-100">
                {rows.map((r, i) => (
                  <li key={i} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2"><Stars value={r.score} /><span className="text-xs capitalize text-gray-500">{r.rater_role}{r.would_hire_again === false ? ' · would not hire again' : ''}</span></div>
                    {r.comment && <p className="mt-1 text-gray-700">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="px-5 py-4">
              <RateWorkOrderForm workOrderId={id} back={`/work-orders/${id}`} vendorName={vendor.name} mine={mine} error={sp.rating_error} saved={sp.rating_saved} />
            </div>
          </Section>
        );
      })()}

      <Section title="Discussion">
        <div className="px-5 py-4">
          <ArcMessageThread
            messages={(messages ?? []) as ArcMessage[]}
            postAction={postWorkOrderMessage.bind(null, id, '/work-orders') as any}
            placeholder="Message the homeowner, board, or vendor…"
          />
        </div>
      </Section>

      <Section title="Activity log">
        <ul className="space-y-3 border-l-2 border-gray-100 px-5 py-4 pl-8">
          {(updates ?? []).map((u: any) => (
            <li key={u.id} className="relative">
              <div className="absolute -left-5 top-1 h-2 w-2 rounded-full bg-gray-400" />
              <div className="text-sm">{u.note}</div>
              {u.new_status && <div className="text-xs text-gray-500">→ status: <span className="capitalize">{u.new_status.replace(/_/g, ' ')}</span></div>}
              <div className="text-xs text-gray-400">{date(u.created_at)}</div>
            </li>
          ))}
          {!updates?.length && <li className="text-sm text-gray-500">No activity yet.</li>}
        </ul>

        <form action={addNote.bind(null, id) as any} className="flex gap-2 border-t border-gray-100 px-5 py-4">
          <Input name="note" placeholder="Add an internal note (not shown to the vendor)…" required className="flex-1" />
          <Button type="submit">Post</Button>
        </form>
      </Section>
    </Workspace>
  );
}
