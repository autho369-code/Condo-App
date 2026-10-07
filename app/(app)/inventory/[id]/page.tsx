import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { archiveInventoryItem, recordInventoryMovement, updateInventoryItem } from '@/lib/rpcs/inventory';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/utils';
import { displayTimeZone } from '@/lib/time/display-zone';
import { PendingSubmit } from '@/components/ui/pending-submit';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  opening: 'Opening quantity',
  received: 'Received',
  used: 'Used',
  adjusted: 'Adjusted',
};

const MOVED_LABEL: Record<string, string> = {
  received: 'Stock received.',
  used: 'Usage recorded.',
  adjusted: 'Stock adjusted.',
};

// Jobs still in progress; any other work order can be entered by number.
const OPEN_WORK_ORDER_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress'];
const PAGE_SIZE = 100;

export default async function InventoryItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; moved?: string; page?: string }>;
}) {
  const me = await requireStaff();
  // Platform operators can look at a company's inventory but not change it.
  let canEdit = me.is_staff;
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createClient()) as any;

  const { data: item } = await db
    .from('inventory_items')
    .select('id, name, sku, category, location, unit_of_measure, quantity_on_hand, reorder_point, unit_cost, archived_at')
    .eq('id', id)
    .maybeSingle();
  if (!item) notFound();
  // Removed items stay viewable (read-only) so their full history is reachable.
  const removed = !!item.archived_at;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  if (removed) canEdit = false;

  const [{ data: movements, count: movementCount }, { data: workOrders }] = await Promise.all([
    db.from('inventory_movements')
      .select('id, kind, quantity_change, quantity_after, unit_cost, note, created_at, work_order_id, created_by, work_orders(number, title), associations(name)', { count: 'exact' })
      .eq('item_id', id)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from('work_orders')
      .select('id, number, title, associations(name)')
      .in('status', OPEN_WORK_ORDER_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);
  const totalPages = Math.max(1, Math.ceil((movementCount ?? 0) / PAGE_SIZE));

  // created_by references auth.users, so names come from profiles separately.
  const userIds = [...new Set(((movements ?? []) as any[]).map((m) => m.created_by).filter(Boolean))];
  const { data: people } = userIds.length
    ? await db.from('profiles').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const nameById = new Map<string, string>(((people ?? []) as any[]).map((p) => [p.id, p.full_name ?? p.email ?? '—']));

  const qty = Number(item.quantity_on_hand ?? 0);
  const reorder = item.reorder_point != null ? Number(item.reorder_point) : null;
  const unit = item.unit_of_measure ?? '';
  const status = qty <= 0 ? 'Out of stock' : reorder != null && qty <= reorder ? 'Reorder' : 'In stock';

  return (
    <DataWorkspace
      title={item.name}
      description={[item.category, item.location].filter(Boolean).join(' · ') || 'Inventory item'}
      actions={<Link href="/inventory"><Button variant="secondary">Back to inventory</Button></Link>}
    >
      <div className="space-y-4">
        {removed && <Alert tone="info" title="Removed from inventory">This item is no longer stocked. Its history is kept here for reference.</Alert>}
        {sp.error && <Alert tone="danger" title="Could not save">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">Item details saved.</Alert>}
        {sp.moved && MOVED_LABEL[sp.moved] && <Alert tone="success">{MOVED_LABEL[sp.moved]}</Alert>}

        <MetricStrip
          metrics={[
            { label: 'On hand', value: `${qty}${unit ? ` ${unit}` : ''}`, sublabel: status },
            { label: 'Reorder point', value: reorder ?? '—' },
            { label: 'Unit cost', value: item.unit_cost != null ? money(item.unit_cost) : '—' },
            { label: 'Value on hand', value: item.unit_cost != null ? money(qty * Number(item.unit_cost)) : '—' },
          ]}
        />

        {canEdit && <Surface>
          <SectionTitle title="Update stock" description="Receive new stock, record what was used (optionally on a work order), or correct the count." />
          <form action={recordInventoryMovement} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <input type="hidden" name="item_id" value={item.id} />
            <Field label="What happened" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue="used" required>
                <option value="used">Used</option>
                <option value="received">Received</option>
                <option value="adjusted">Count correction</option>
              </Select>
            </Field>
            <Field label={`Quantity${unit ? ` (${unit})` : ''}`} htmlFor="quantity">
              <Input id="quantity" name="quantity" type="number" min="0.01" step="0.01" required />
            </Field>
            <Field label="Correction direction" htmlFor="direction" hint="Only for count corrections.">
              <Select id="direction" name="direction" defaultValue="">
                <option value="">—</option>
                <option value="add">Add to stock</option>
                <option value="remove">Remove from stock</option>
              </Select>
            </Field>
            <Field label="Open work order (optional)" htmlFor="work_order_id" hint="For stock used on a job.">
              <Select id="work_order_id" name="work_order_id" defaultValue="">
                <option value="">None</option>
                {(workOrders ?? []).map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.number ? `#${w.number} ` : ''}{w.title}{w.associations?.name ? ` · ${w.associations.name}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Or work order # (optional)" htmlFor="work_order_number" hint="Any work order, e.g. 2671-1.">
              <Input id="work_order_number" name="work_order_number" placeholder="2671-1" />
            </Field>
            <Field label="Unit cost (optional)" htmlFor="unit_cost" hint="For stock received.">
              <Input id="unit_cost" name="unit_cost" type="number" min="0" step="0.01" />
            </Field>
            <Field label="Note (optional)" htmlFor="note">
              <Input id="note" name="note" placeholder="e.g. PO 1042, lobby filters" />
            </Field>
            <div className="sm:col-span-3">
              <Button type="submit">Record</Button>
            </div>
          </form>
        </Surface>}

        <Surface padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
            <SectionTitle title="History" description={`${movementCount ?? 0} movement${movementCount === 1 ? '' : 's'}`} />
            {totalPages > 1 && (
              <div className="flex items-center gap-3 text-sm">
                {page > 1 ? <Link href={`/inventory/${item.id}?page=${page - 1}`} className="text-gray-900 underline underline-offset-4">Newer</Link> : <span className="text-gray-300">Newer</span>}
                <span className="text-gray-500">Page {page} of {totalPages}</span>
                {page < totalPages ? <Link href={`/inventory/${item.id}?page=${page + 1}`} className="text-gray-900 underline underline-offset-4">Older</Link> : <span className="text-gray-300">Older</span>}
              </div>
            )}
          </div>
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Movement</TH>
                <TH className="text-right">Change</TH>
                <TH className="text-right">On hand after</TH>
                <TH>Work order</TH>
                <TH>Note</TH>
                <TH>By</TH>
              </tr>
            </THead>
            <tbody>
              {(movements ?? []).length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-gray-500">No stock movements yet.</TD></TR>
              ) : (movements ?? []).map((m: any) => (
                <TR key={m.id}>
                  <TD className="whitespace-nowrap text-gray-700">{new Date(m.created_at).toLocaleDateString('en-US', { timeZone: displayTimeZone(), month: 'short', day: 'numeric', year: 'numeric' })}</TD>
                  <TD>
                    <StatusChip tone={m.kind === 'used' ? 'warning' : m.kind === 'received' ? 'success' : 'neutral'}>
                      {KIND_LABEL[m.kind] ?? m.kind}
                    </StatusChip>
                  </TD>
                  <TD className="text-right tabular-nums">{Number(m.quantity_change) > 0 ? `+${Number(m.quantity_change)}` : Number(m.quantity_change)}</TD>
                  <TD className="text-right tabular-nums">{Number(m.quantity_after)}</TD>
                  <TD className="text-sm">
                    {m.work_order_id ? (
                      <Link href={`/work-orders/${m.work_order_id}`} className="text-gray-900 underline decoration-gray-300 underline-offset-4">
                        {m.work_orders?.number ? `#${m.work_orders.number}` : 'Work order'}
                      </Link>
                    ) : '—'}
                    {m.associations?.name && <div className="text-xs text-gray-500">{m.associations.name}</div>}
                  </TD>
                  <TD className="text-sm text-gray-600">{m.note ?? '—'}</TD>
                  <TD className="text-sm text-gray-600">{nameById.get(m.created_by) ?? '—'}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Surface>

        {canEdit && <Surface>
          <SectionTitle title="Item details" description="The quantity changes only through stock movements, so the history always adds up." />
          <form action={updateInventoryItem} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input type="hidden" name="item_id" value={item.id} />
            <Field label="Item name" htmlFor="name"><Input id="name" name="name" required defaultValue={item.name} /></Field>
            <Field label="SKU" htmlFor="sku"><Input id="sku" name="sku" defaultValue={item.sku ?? ''} /></Field>
            <Field label="Category" htmlFor="category"><Input id="category" name="category" defaultValue={item.category ?? ''} /></Field>
            <Field label="Storage location" htmlFor="location"><Input id="location" name="location" defaultValue={item.location ?? ''} /></Field>
            <Field label="Unit of measure" htmlFor="unit_of_measure"><Input id="unit_of_measure" name="unit_of_measure" defaultValue={item.unit_of_measure ?? ''} /></Field>
            <Field label="Reorder point" htmlFor="reorder_point"><Input id="reorder_point" name="reorder_point" type="number" min="0" step="any" defaultValue={reorder ?? ''} /></Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit">Save details</Button>
            </div>
          </form>
          <form action={archiveInventoryItem} className="mt-4 border-t border-gray-100 pt-4">
            <input type="hidden" name="item_id" value={item.id} />
            <PendingSubmit variant="secondary" pendingLabel="Removing…" confirm="Remove this item from inventory?">Remove from inventory</PendingSubmit>
            <span className="ml-3 text-xs text-gray-500">Its history stays in the Inventory Usage report.</span>
          </form>
        </Surface>}
      </div>
    </DataWorkspace>
  );
}
