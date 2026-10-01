import Link from 'next/link';
import { Repeat } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Alert, Badge, EmptyState, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createPurchaseOrderNow, setRecurringPurchaseOrderState } from '@/lib/rpcs/recurring-purchase-orders';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const EVERY: Record<string, [string, string]> = {
  weekly: ['Weekly', 'weeks'],
  monthly: ['Monthly', 'months'],
  quarterly: ['Quarterly', 'quarters'],
  annually: ['Annually', 'years'],
};
const cadence = (f: string, n: number | null) => (!n || n <= 1 ? EVERY[f]?.[0] ?? f : `Every ${n} ${EVERY[f]?.[1] ?? f}`);
const total = (lines: any[]) => (lines ?? []).reduce((s, l) => s + Math.round(Number(l.qty) * Number(l.unit_price) * 100) / 100, 0);

export default async function RecurringPurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const { data: rows, error } = await db
    .from('recurring_purchase_orders')
    .select('id, name, lines, frequency, interval_count, next_post_date, end_date, needed_by_days, auto_generate, last_generated_at, last_error, vendors(name), associations(name)')
    .is('archived_at', null)
    .order('next_post_date', { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Could not load recurring purchase orders: ${error.message}`);
  const list = (rows ?? []) as any[];
  const ended = (r: any) => r.end_date && r.next_post_date && r.next_post_date > r.end_date;

  return (
    <DataWorkspace
      title="Recurring purchase orders"
      description="A draft purchase order is created on each scheduled date for you to review and submit — board approval rules still apply. Pause one to keep it as a reusable template."
      actions={<Link href="/purchase-orders"><Button variant="secondary">All purchase orders</Button></Link>}
    >
      <div className="space-y-4">
        {sp.saved && <Alert tone="success" title="Recurring purchase order saved" />}
        {sp.error && <Alert tone="danger" title="Could not update">{sp.error}</Alert>}

        {list.length === 0 ? (
          <Surface padded={false}>
            <EmptyState
              icon={Repeat}
              title="No recurring purchase orders yet"
              description="Open any purchase order and choose “Repeat this order” to schedule it — pool supplies, janitorial, seasonal work."
              action={<Link href="/purchase-orders"><Button>Go to purchase orders</Button></Link>}
            />
          </Surface>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Vendor</TH>
                <TH>Association</TH>
                <TH>Schedule</TH>
                <TH>Next order</TH>
                <TH className="text-right">Amount</TH>
                <TH><span className="sr-only">Actions</span></TH>
              </tr>
            </THead>
            <tbody>
              {list.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <div className="font-medium text-gray-950">{r.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ended(r) ? <Badge tone="inactive">Ended</Badge> : !r.auto_generate && <Badge tone="inactive">Paused</Badge>}
                      {r.last_error && <Badge tone="danger">Needs attention</Badge>}
                    </div>
                    {r.last_error && <p className="mt-1 max-w-xs text-xs text-red-700">{r.last_error}</p>}
                  </TD>
                  <TD>{r.vendors?.name ?? '—'}</TD>
                  <TD>{r.associations?.name ?? '—'}</TD>
                  <TD className="whitespace-nowrap">
                    {cadence(r.frequency, r.interval_count)}
                    {r.needed_by_days ? <span className="block text-xs text-gray-500">needed {r.needed_by_days} days later</span> : null}
                  </TD>
                  <TD className="whitespace-nowrap">
                    {r.auto_generate && !ended(r) && r.next_post_date ? date(r.next_post_date) : '—'}
                    {r.end_date && <span className="block text-xs text-gray-500">ends {date(r.end_date)}</span>}
                  </TD>
                  <TD className="text-right tabular-nums">{money(total(r.lines))}</TD>
                  <TD className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <form action={createPurchaseOrderNow}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button type="submit" variant="secondary" size="sm">Create now</Button>
                      </form>
                      <form action={setRecurringPurchaseOrderState}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="state" value={r.auto_generate ? 'pause' : 'resume'} />
                        <Button type="submit" variant="ghost" size="sm">{r.auto_generate ? 'Pause' : 'Resume'}</Button>
                      </form>
                      <form action={setRecurringPurchaseOrderState}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="state" value="stop" />
                        <Button type="submit" variant="ghost" size="sm">Stop</Button>
                      </form>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}
