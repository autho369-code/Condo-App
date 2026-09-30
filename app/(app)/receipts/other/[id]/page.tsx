import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { voidOtherReceipt } from '@/lib/rpcs/other-receipts';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OtherReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; recorded?: string; voided?: string }>;
}) {
  await requireFinanceStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const db = (await createClient()) as any;

  const { data: r } = await db
    .from('other_receipts')
    .select('*, associations(name), bank_accounts(name), vendors(name), other_receipt_lines(id, amount, memo, sort_order, gl_accounts(number, name))')
    .eq('id', id)
    .maybeSingle();
  if (!r) notFound();
  const lines = [...(r.other_receipt_lines ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
  const userIds = [r.created_by, r.voided_by].filter(Boolean);
  const { data: people } = userIds.length
    ? await db.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] };
  const nameOf = (uid: string | null) => (people ?? []).find((p: any) => p.id === uid)?.full_name ?? '—';

  return (
    <DataWorkspace
      title={`Receipt from ${r.payer_name}`}
      description={`${r.associations?.name ?? ''} · ${date(r.receipt_date)} · ${money(r.amount)}`}
      actions={<Link href="/receipts/other"><Button variant="secondary">All other receipts</Button></Link>}
    >
      <div className="max-w-4xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not complete that">{sp.error}</Alert>}
        {sp.recorded && <Alert tone="success" title="Receipt recorded">Posted to the general ledger.</Alert>}
        {sp.voided && <Alert tone="success" title="Receipt voided">A reversing journal entry was posted today.</Alert>}

        <Surface>
          <SectionTitle title="Details" actions={r.voided_at ? <StatusChip tone="neutral">Void</StatusChip> : <StatusChip tone="success">Posted</StatusChip>} />
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {([
              ['Received from', r.payer_type === 'vendor' && r.vendor_id
                ? <Link key="v" href={`/vendors/${r.vendor_id}`} className="hover:underline">{r.vendors?.name ?? r.payer_name}</Link>
                : r.payer_name],
              ['Payer type', r.payer_type === 'vendor' ? 'Vendor' : 'Other payer'],
              ['Association', r.associations?.name ?? '—'],
              ['Deposited to', r.bank_accounts?.name ?? '—'],
              ['Receipt date', date(r.receipt_date)],
              ['Reference', r.reference ?? '—'],
              ['Recorded by', `${nameOf(r.created_by)} · ${date(r.created_at)}`],
              ['Memo', r.memo ?? '—'],
            ] as const).map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-32 shrink-0 text-gray-500">{k}</dt>
                <dd className="min-w-0 break-words text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
          {r.voided_at && (
            <p className="mt-4 text-sm text-gray-600">
              Voided {date(r.voided_at)} by {nameOf(r.voided_by)} — {r.void_reason}
            </p>
          )}
        </Surface>

        <Surface padded={false}>
          <div className="px-5 pt-5"><SectionTitle title="Split" /></div>
          <Table>
            <THead>
              <tr>
                <TH>GL account</TH>
                <TH>Memo</TH>
                <TH className="text-right">Amount</TH>
              </tr>
            </THead>
            <tbody>
              {lines.map((l: any) => (
                <TR key={l.id}>
                  <TD>{l.gl_accounts ? `${l.gl_accounts.number} — ${l.gl_accounts.name}` : '—'}</TD>
                  <TD className="text-sm text-gray-600">{l.memo ?? '—'}</TD>
                  <TD className="text-right tabular-nums">{money(l.amount)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Surface>

        {!r.voided_at && (
          <Surface>
            <SectionTitle
              title="Void receipt"
              description="Posts a reversing journal entry dated today, so closed months stay closed. The receipt stays in history, marked void."
            />
            <form action={voidOtherReceipt} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="receipt_id" value={r.id} />
              <Field label="Reason" className="flex-1">
                <Input name="reason" required maxLength={500} placeholder="e.g. Check returned, entered twice" />
              </Field>
              <Button type="submit" variant="secondary">Void receipt</Button>
            </form>
          </Surface>
        )}
      </div>
    </DataWorkspace>
  );
}
