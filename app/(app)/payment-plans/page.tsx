import Link from 'next/link';
import { HandCoins } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Plan = {
  id: string; status: string; total_amount: number; installment_count: number; frequency: string; start_date: string; unit_id: string;
  associations: { name: string } | null; units: { unit_number: string } | null; owners: { full_name: string } | null;
};

function tone(status: string): Tone {
  return status === 'Paid off' ? 'success' : status === 'Behind' ? 'danger' : status === 'Cancelled' ? 'neutral' : 'info';
}

export default async function PaymentPlansPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const showAll = sp.show === 'all';
  const db = (await createClient()) as any;

  let query = db
    .from('payment_plans')
    .select('id, status, total_amount, installment_count, frequency, start_date, unit_id, associations(name), units(unit_number), owners(full_name)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (!showAll) query = query.eq('status', 'active');
  const { data: plans } = await query;
  const rows = (plans ?? []) as Plan[];

  // Progress per plan (paid to date, next due, status) from the schedule.
  const progress = await Promise.all(rows.map(async (p) => {
    const { data: sched } = await db.rpc('payment_plan_schedule', { p_plan_id: p.id });
    const s = (sched ?? []) as { due_date: string; amount: number; covered: number; status: string }[];
    const paid = s.reduce((sum, i) => sum + Number(i.covered), 0);
    const next = s.find((i) => i.status !== 'paid');
    const status = p.status === 'cancelled' ? 'Cancelled'
      : !next ? 'Paid off'
      : s.some((i) => i.status === 'behind') ? 'Behind' : 'Current';
    return { paid, nextDue: next?.due_date ?? null, status };
  }));

  const active = rows.filter((p) => p.status === 'active');
  const behind = progress.filter((p, i) => rows[i].status === 'active' && p.status === 'Behind').length;
  const outstanding = rows.reduce((s, p, i) => s + (p.status === 'active' ? Math.max(Number(p.total_amount) - progress[i].paid, 0) : 0), 0);

  return (
    <DataWorkspace
      title="Payment plans"
      description="Installment agreements with homeowners who are behind. Collections pause while a plan is current."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/reports/payment_plans"><Button variant="secondary">Payment Plans report</Button></Link>
          <Link href="/payment-plans/new"><Button>New payment plan</Button></Link>
        </div>
      }
    >
      <div className="space-y-4">
        <MetricStrip
          metrics={[
            { label: 'Active plans', value: active.length },
            { label: 'Behind schedule', value: behind },
            { label: 'Still to collect', value: money(outstanding) },
          ]}
        />
        <div className="flex gap-3 text-sm">
          <Link href="/payment-plans" className={showAll ? 'text-gray-500 hover:text-gray-900' : 'font-medium text-gray-950 underline underline-offset-4'}>Active</Link>
          <Link href="/payment-plans?show=all" className={showAll ? 'font-medium text-gray-950 underline underline-offset-4' : 'text-gray-500 hover:text-gray-900'}>All plans</Link>
        </div>
        {rows.length === 0 ? (
          <Surface padded={false}>
            <EmptyState
              icon={HandCoins}
              title={showAll ? 'No payment plans yet' : 'No active payment plans'}
              description="Set up an installment plan when a homeowner agrees to pay down a past-due balance."
              action={<Link href="/payment-plans/new"><Button>New payment plan</Button></Link>}
            />
          </Surface>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Homeowner</TH>
                <TH>Association · Unit</TH>
                <TH className="text-right">Plan</TH>
                <TH className="text-right">Paid</TH>
                <TH className="text-right">Remaining</TH>
                <TH>Next due</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((p, i) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/payment-plans/${p.id}`} className="font-medium text-gray-950 hover:underline">{p.owners?.full_name ?? 'Homeowner'}</Link>
                    <div className="text-xs text-gray-500">{p.installment_count} {p.frequency === 'biweekly' ? 'every-two-week' : p.frequency} installments from {date(p.start_date)}</div>
                  </TD>
                  <TD className="text-sm text-gray-700">{p.associations?.name ?? '—'} · {p.units?.unit_number ?? '—'}</TD>
                  <TD className="text-right tabular-nums">{money(p.total_amount)}</TD>
                  <TD className="text-right tabular-nums">{money(progress[i].paid)}</TD>
                  <TD className="text-right tabular-nums">{money(Math.max(Number(p.total_amount) - progress[i].paid, 0))}</TD>
                  <TD className="text-sm text-gray-700">{progress[i].nextDue && p.status === 'active' ? date(progress[i].nextDue!) : '—'}</TD>
                  <TD><StatusChip tone={tone(progress[i].status)}>{progress[i].status}</StatusChip></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}
