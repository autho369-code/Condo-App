import Link from 'next/link';
import { Plus, Repeat } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { PayablesTabs } from '@/components/accounting/payables-tabs';
import { Button } from '@/components/ui/button';
import { Alert, Badge, EmptyState, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';
import { archiveRecurringBill, postRecurringBills } from '@/lib/rpcs/recurring';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { todayInZone } from '@/lib/time/zoned';

export const dynamic = 'force-dynamic';

const EVERY: Record<string, [string, string]> = {
  weekly: ['Weekly', 'weeks'],
  monthly: ['Monthly', 'months'],
  quarterly: ['Quarterly', 'quarters'],
  annually: ['Annually', 'years'],
  daily: ['Daily', 'days'],
};
const cadence = (f: string, n: number | null) => (!n || n <= 1 ? EVERY[f]?.[0] ?? f : `Every ${n} ${EVERY[f]?.[1] ?? f}`);

export default async function RecurringBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; archived?: string; posted?: string; through?: string; error?: string }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const { data: rows, error } = await db
    .from('recurring_bills')
    .select('id, name, memo, amount, frequency, interval_count, next_post_date, end_date, auto_generate, last_generated_at, last_error, due_days, vendors(name), associations(name), gl_accounts(number, name)')
    .is('archived_at', null)
    .order('next_post_date', { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Could not load recurring bills: ${error.message}`);
  const list = (rows ?? []) as any[];
  const ended = (r: any) => r.end_date && r.next_post_date && r.next_post_date > r.end_date;
  const active = list.filter((r) => r.auto_generate && !ended(r));
  const monthly = active.reduce((sum, r) => {
    const n = Math.max(1, r.interval_count ?? 1);
    const perMonth = r.frequency === 'weekly' ? (52 / 12) / n : r.frequency === 'monthly' ? 1 / n
      : r.frequency === 'quarterly' ? 1 / (3 * n) : r.frequency === 'annually' ? 1 / (12 * n) : 30 / n;
    return sum + Number(r.amount) * perMonth;
  }, 0);

  return (
    <DataWorkspace
      title="Recurring bills"
      description={`${active.length} active · about ${money(monthly)} a month. Bills are created automatically each morning on their scheduled date.`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/bills"><Button variant="secondary">All bills</Button></Link>
          <Link href="/bills/recurring/new"><Button><Plus className="h-4 w-4" /> New recurring bill</Button></Link>
        </div>
      }
    >
      <div className="space-y-4">
        <PayablesTabs current="recurring" />
        {sp.saved && <Alert tone="success" title="Recurring bill saved" />}
        {sp.archived && <Alert tone="success" title="Recurring bill stopped" />}
        {sp.posted !== undefined && (
          <Alert tone="success" title={`${Number(sp.posted) || 0} bill${sp.posted === '1' ? '' : 's'} posted${sp.through ? ` through ${date(sp.through)}` : ''}`}>
            {sp.posted === '0' ? 'No recurring bills were due through that date.' : 'They are on the Bills list, approved or waiting for board approval as each association requires.'}
          </Alert>
        )}
        {sp.error && <Alert tone="danger" title="Could not update">{sp.error}</Alert>}

        {active.length > 0 && (
          <Surface>
            <form action={postRecurringBills} className="flex flex-wrap items-end gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-950">Manually post bills</h2>
                <p className="mt-0.5 text-sm text-gray-600">Enter every recurring bill scheduled on or before this date now, instead of waiting for its date.</p>
              </div>
              <label className="ml-auto flex flex-col gap-1 text-xs font-medium text-gray-600">
                Post through
                <input type="date" name="through" required defaultValue={todayInZone()} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-950" />
              </label>
              <PendingSubmit pendingLabel="Posting…">Post bills</PendingSubmit>
            </form>
          </Surface>
        )}

        {list.length === 0 ? (
          <Surface padded={false}>
            <EmptyState
              icon={Repeat}
              title="No recurring bills yet"
              description="Set up janitorial, landscaping, utilities or any other bill that repeats, and it will be entered for you."
              action={<Link href="/bills/recurring/new"><Button><Plus className="h-4 w-4" /> New recurring bill</Button></Link>}
            />
          </Surface>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Vendor</TH>
                <TH>Association</TH>
                <TH>Expense account</TH>
                <TH>Schedule</TH>
                <TH>Next bill</TH>
                <TH className="text-right">Amount</TH>
                <TH><span className="sr-only">Actions</span></TH>
              </tr>
            </THead>
            <tbody>
              {list.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/bills/recurring/${r.id}/edit`} className="font-medium text-gray-950 hover:underline">{r.name}</Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ended(r) ? <Badge tone="inactive">Ended</Badge> : !r.auto_generate && <Badge tone="inactive">Paused</Badge>}
                      {r.last_error && <Badge tone="danger">Needs attention</Badge>}
                    </div>
                    {r.last_error && <p className="mt-1 max-w-xs text-xs text-red-700">{r.last_error}</p>}
                  </TD>
                  <TD>{r.vendors?.name ?? '—'}</TD>
                  <TD>{r.associations?.name ?? '—'}</TD>
                  <TD className="text-sm text-gray-600">{r.gl_accounts ? `${r.gl_accounts.number ?? ''} ${r.gl_accounts.name}`.trim() : '—'}</TD>
                  <TD className="whitespace-nowrap">{cadence(r.frequency, r.interval_count)}{r.due_days ? <span className="block text-xs text-gray-500">due in {r.due_days} days</span> : null}</TD>
                  <TD className="whitespace-nowrap">
                    {r.auto_generate && r.next_post_date && (!r.end_date || r.next_post_date <= r.end_date) ? date(r.next_post_date) : '—'}
                    {r.end_date && <span className="block text-xs text-gray-500">ends {date(r.end_date)}</span>}
                  </TD>
                  <TD className="text-right tabular-nums">{money(r.amount)}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/bills/recurring/${r.id}/edit`}><Button variant="ghost" size="sm">Edit</Button></Link>
                      <form action={archiveRecurringBill}>
                        <input type="hidden" name="id" value={r.id} />
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
