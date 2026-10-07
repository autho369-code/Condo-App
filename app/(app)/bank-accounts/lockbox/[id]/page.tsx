import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Alert, Badge } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { matchLockboxItem, postLockboxBatch, rejectLockboxItem } from '@/lib/rpcs/lockbox';
import { date, money } from '@/lib/utils';
import { PendingSubmit } from '@/components/ui/pending-submit';

export const dynamic = 'force-dynamic';

function confidence(c: number | null, reason: string | null) {
  if (c == null) return <Badge tone="pending">Not matched</Badge>;
  const tone = c >= 0.9 ? 'complete' : c >= 0.75 ? 'info' : 'pending';
  return <Badge tone={tone}>{reason ?? 'Matched'} · {Math.round(c * 100)}%</Badge>;
}

export default async function LockboxBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; posted?: string; failed?: string }>;
}) {
  await requireFinanceStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const { data: batch } = await db.from('lockbox_batches')
    .select('id, batch_date, deposit_reference, status, association_id, bank_accounts(name)').eq('id', id).maybeSingle();
  if (!batch) notFound();
  const [{ data: items }, { data: units }] = await Promise.all([
    db.from('lockbox_items')
      .select('id, row_no, check_number, check_amount_cents, payer_name, memo, unit_id, matched_confidence, match_reason, rejected, rejection_reason, payment_id, post_error, units(unit_number), owners(full_name)')
      .eq('batch_id', id).order('row_no', { ascending: true }),
    db.from('units').select('id, unit_number, buildings!inner(association_id), occupancies(status, occupancy_type, owners(full_name))')
      .eq('buildings.association_id', batch.association_id).is('archived_at', null).order('unit_number'),
  ]);
  const list = (items ?? []) as any[];
  const unitOptions = ((units ?? []) as any[]).map((u) => {
    const owner = (u.occupancies ?? []).find((o: any) => o.status === 'current' && o.occupancy_type === 'owner')?.owners?.full_name;
    return { id: u.id, label: `Unit ${u.unit_number}${owner ? ` · ${owner}` : ''}` };
  });
  const posted = list.filter((i) => i.payment_id);
  const ready = list.filter((i) => !i.payment_id && !i.rejected && i.unit_id);
  const unmatched = list.filter((i) => !i.payment_id && !i.rejected && !i.unit_id);
  const cents = (arr: any[]) => arr.reduce((s, i) => s + Number(i.check_amount_cents), 0) / 100;

  return (
    <DataWorkspace
      title={`Lockbox · ${date(batch.batch_date)}`}
      description={`${batch.bank_accounts?.name ?? ''}${batch.deposit_reference ? ` · ${batch.deposit_reference}` : ''}`}
      actions={<Link href="/bank-accounts/lockbox"><Button variant="secondary">All batches</Button></Link>}
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Could not update">{sp.error}</Alert>}
        {sp.posted && (
          <Alert tone={sp.failed && sp.failed !== '0' ? 'danger' : 'success'} title={`${sp.posted} check${sp.posted === '1' ? '' : 's'} posted as receipts${sp.failed && sp.failed !== '0' ? ` · ${sp.failed} could not be posted` : ''}`}>
            {sp.failed && sp.failed !== '0' ? 'See the reason on each row below.' : 'They are applied to each unit’s charges and posted to the ledger.'}
          </Alert>
        )}

        <MetricStrip
          metrics={[
            { label: 'Ready to post', value: money(cents(ready)), sublabel: `${ready.length} check${ready.length === 1 ? '' : 's'}` },
            { label: 'Needs a unit', value: unmatched.length, sublabel: money(cents(unmatched)) },
            { label: 'Posted', value: money(cents(posted)), sublabel: `${posted.length} check${posted.length === 1 ? '' : 's'}` },
          ]}
        />

        {ready.length > 0 && (
          <form action={postLockboxBatch} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/70 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <input type="hidden" name="batch_id" value={id} />
            <p className="text-sm text-gray-600">Check the matches below, then post. Unmatched and rejected checks are left for later.</p>
            <Button type="submit">Post {ready.length} matched check{ready.length === 1 ? '' : 's'}</Button>
          </form>
        )}

        <Table>
          <THead>
            <tr><TH>Check</TH><TH>Payer</TH><TH className="text-right">Amount</TH><TH>Match</TH><TH>Unit</TH><TH><span className="sr-only">Actions</span></TH></tr>
          </THead>
          <tbody>
            {list.map((i) => (
              <TR key={i.id}>
                <TD className="whitespace-nowrap text-sm">{i.check_number ? `#${i.check_number}` : '—'}<span className="block text-xs text-gray-400">row {i.row_no ?? '—'}</span></TD>
                <TD className="text-sm">{i.payer_name ?? '—'}{i.memo && <span className="block text-xs text-gray-500">{i.memo}</span>}</TD>
                <TD className="text-right tabular-nums">{money(i.check_amount_cents / 100)}</TD>
                <TD>
                  {i.payment_id ? <Badge tone="complete">Posted</Badge>
                    : i.rejected ? <Badge tone="danger">Rejected</Badge>
                    : confidence(i.matched_confidence, i.match_reason)}
                  {i.rejected && i.rejection_reason && <span className="mt-1 block text-xs text-red-700">{i.rejection_reason}</span>}
                  {i.post_error && <span className="mt-1 block max-w-xs text-xs text-red-700">{i.post_error}</span>}
                </TD>
                <TD className="min-w-[220px]">
                  {i.payment_id ? (
                    <Link href={`/payments/${i.payment_id}/receipt`} className="text-sm text-gray-900 hover:underline">
                      Unit {i.units?.unit_number}{i.owners?.full_name ? ` · ${i.owners.full_name}` : ''}
                    </Link>
                  ) : (
                    <form action={matchLockboxItem} className="flex items-center gap-2">
                      <input type="hidden" name="batch_id" value={id} />
                      <input type="hidden" name="item_id" value={i.id} />
                      <Select name="unit_id" defaultValue={i.unit_id ?? ''} aria-label={`Unit for check ${i.check_number ?? i.row_no}`}>
                        <option value="">Choose a unit…</option>
                        {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                      </Select>
                      <Button type="submit" variant="secondary" size="sm">Save</Button>
                    </form>
                  )}
                </TD>
                <TD className="text-right">
                  {!i.payment_id && !i.rejected && (
                    <form action={rejectLockboxItem}>
                      <input type="hidden" name="batch_id" value={id} />
                      <input type="hidden" name="item_id" value={i.id} />
                      <PendingSubmit variant="ghost" size="sm" pendingLabel="Rejecting…" confirm="Reject this lockbox item?">Reject</PendingSubmit>
                    </form>
                  )}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
