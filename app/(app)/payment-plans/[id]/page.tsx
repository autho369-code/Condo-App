import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { cancelPaymentPlan } from '@/lib/rpcs/payment-plans';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const INSTALLMENT_LABEL: Record<string, { label: string; tone: Tone }> = {
  paid: { label: 'Paid', tone: 'success' },
  behind: { label: 'Behind', tone: 'danger' },
  due: { label: 'Due soon', tone: 'warning' },
  upcoming: { label: 'Upcoming', tone: 'neutral' },
};

export default async function PaymentPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; cancelled?: string; error?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createClient()) as any;

  const { data: plan } = await db
    .from('payment_plans')
    .select('id, status, total_amount, installment_count, frequency, first_due_date, start_date, notes, cancel_reason, cancelled_at, owner_id, unit_id, associations(name), units(unit_number), owners(full_name)')
    .eq('id', id)
    .maybeSingle();
  if (!plan) notFound();

  const { data: schedule } = await db.rpc('payment_plan_schedule', { p_plan_id: id });
  const rows = (schedule ?? []) as { installment_number: number; due_date: string; amount: number; covered: number; status: string }[];
  const paid = rows.reduce((s, r) => s + Number(r.covered), 0);
  const next = rows.find((r) => r.status !== 'paid');
  const behind = rows.some((r) => r.status === 'behind');
  const overall = plan.status === 'cancelled' ? 'Cancelled' : plan.status === 'completed' || !next ? 'Paid off' : behind ? 'Behind' : 'Current';
  const frequencyLabel = plan.frequency === 'biweekly' ? 'every two weeks' : plan.frequency;

  return (
    <DataWorkspace
      title={`Payment plan · ${plan.owners?.full_name ?? 'Homeowner'}`}
      description={`${plan.associations?.name ?? 'Association'} · Unit ${plan.units?.unit_number ?? '—'} · ${plan.installment_count} installments, ${frequencyLabel}, from ${date(plan.start_date)}`}
      actions={
        <div className="flex flex-wrap gap-2">
          {plan.owner_id && <Link href={`/owners/${plan.owner_id}`}><Button variant="secondary">Homeowner</Button></Link>}
          <Link href="/payment-plans"><Button variant="secondary">All payment plans</Button></Link>
        </div>
      }
    >
      <div className="space-y-4">
        {sp.created && <Alert tone="success" title="Payment plan created">The homeowner&rsquo;s collection case, if any, is on hold while the plan is current.</Alert>}
        {sp.cancelled && <Alert tone="info" title="Payment plan cancelled">A collections hold the plan placed has been released.</Alert>}
        {sp.error && <Alert tone="danger" title="Could not update the plan">{sp.error}</Alert>}

        <MetricStrip
          metrics={[
            { label: 'Plan amount', value: money(plan.total_amount) },
            { label: 'Paid toward plan', value: money(paid) },
            { label: 'Remaining', value: money(Math.max(Number(plan.total_amount) - paid, 0)) },
            { label: 'Status', value: overall, sublabel: next && plan.status === 'active' ? `Next due ${date(next.due_date)}` : undefined },
          ]}
        />

        <Surface padded={false}>
          <div className="px-5 pt-5">
            <SectionTitle title="Installments" description="Payments made since the plan started count toward installments oldest first. Homeowner credits don't count." />
          </div>
          <Table>
            <THead>
              <tr>
                <TH>#</TH>
                <TH>Due</TH>
                <TH className="text-right">Amount</TH>
                <TH className="text-right">Paid</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => {
                const meta = plan.status === 'cancelled' && r.status !== 'paid'
                  ? { label: 'Cancelled', tone: 'neutral' as Tone }
                  : INSTALLMENT_LABEL[r.status] ?? { label: r.status, tone: 'neutral' as Tone };
                return (
                  <TR key={r.installment_number}>
                    <TD className="tabular-nums text-gray-700">{r.installment_number}</TD>
                    <TD className="text-gray-700">{date(r.due_date)}</TD>
                    <TD className="text-right tabular-nums">{money(r.amount)}</TD>
                    <TD className="text-right tabular-nums">{money(r.covered)}</TD>
                    <TD><StatusChip tone={meta.tone}>{meta.label}</StatusChip></TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </Surface>

        {plan.notes && (
          <Surface>
            <SectionTitle title="Notes" />
            <p className="whitespace-pre-line text-sm text-gray-700">{plan.notes}</p>
          </Surface>
        )}

        {plan.status === 'completed' ? (
          <Surface>
            <SectionTitle title="Paid off" description="Every installment is covered. Any collections hold the plan placed was released." />
          </Surface>
        ) : plan.status === 'cancelled' ? (
          <Surface>
            <SectionTitle title="Cancelled" description={plan.cancelled_at ? date(plan.cancelled_at) : undefined} />
            <p className="text-sm text-gray-700">{plan.cancel_reason}</p>
          </Surface>
        ) : (
          <Surface>
            <SectionTitle title="Cancel this plan" description="Use this if the homeowner stops paying or the plan is replaced. Collections resume for the unit." />
            <form action={cancelPaymentPlan} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="plan_id" value={plan.id} />
              <Field label="Reason" htmlFor="reason" className="min-w-[260px] flex-1">
                <Input id="reason" name="reason" required minLength={5} placeholder="e.g. Two installments missed" />
              </Field>
              <Button type="submit" variant="secondary">Cancel plan</Button>
            </form>
          </Surface>
        )}
      </div>
    </DataWorkspace>
  );
}
