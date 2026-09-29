import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { cancelPurchaseOrder, submitPurchaseOrder } from '@/lib/rpcs/purchase-orders';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';
import { ApprovalStatusChip, OrderStatusChip } from '../status-chips';

export const dynamic = 'force-dynamic';

function formatDateTime(v: string | null | undefined) {
  if (!v) return null;
  return new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireFinanceStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: po } = await db
    .from('purchase_orders')
    .select('*, vendors(id, name), associations(id, name), work_orders(id, number, title)')
    .eq('id', id)
    .maybeSingle();
  if (!po) notFound();

  const [{ data: lines }, { data: request }, { data: decisions }] = await Promise.all([
    db.from('purchase_order_line_items')
      .select('id, description, qty, unit_price, line_total, gl_accounts(number, name)')
      .eq('purchase_order_id', id)
      .order('sort_order'),
    po.approval_request_id
      ? db.from('approval_requests')
          .select('id, status, voting_scheme, required_votes, votes_for, votes_against, votes_abstain, requested_at, decision_at')
          .eq('id', po.approval_request_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    po.approval_request_id
      ? db.from('approval_decisions')
          .select('id, decision, signature_name, comment, decided_at, board_members(full_name)')
          .eq('approval_request_id', po.approval_request_id)
          .order('decided_at')
      : Promise.resolve({ data: [] }),
  ]);

  const editable = po.status !== 'cancelled' && ['draft', 'rejected'].includes(po.approval_status);
  const cancellable = po.status !== 'cancelled' && po.status !== 'billed' && Number(po.po_billed ?? 0) === 0;
  const remaining = Math.max(0, Number(po.po_total ?? 0) - Number(po.po_billed ?? 0));
  const title = `PO ${po.number ?? po.id.slice(0, 8)}`;

  const timeline = [
    { label: 'Created', at: po.created_at },
    po.submitted_at && { label: po.approval_required ? 'Submitted for board vote' : 'Submitted', at: po.submitted_at },
    po.decided_at && { label: po.decision_note ?? 'Decision recorded', at: po.decided_at },
    po.cancelled_at && { label: `Cancelled — ${po.decision_note ?? 'no reason given'}`, at: po.cancelled_at },
  ].filter(Boolean) as { label: string; at: string }[];

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={<><Link href="/purchase-orders" className="transition-colors hover:text-gray-700">Purchase orders</Link>{' · '}{po.associations?.name}</>}
          title={title}
          subtitle={<span className="inline-flex flex-wrap items-center gap-2"><ApprovalStatusChip po={po} /><OrderStatusChip status={po.status} /></span>}
          actions={
            <>
              {editable && <Link href={`/purchase-orders/${id}/edit`}><Button variant="secondary">Edit</Button></Link>}
              {editable && (
                <form action={submitPurchaseOrder}>
                  <input type="hidden" name="id" value={id} />
                  <Button type="submit">{po.approval_status === 'rejected' ? 'Resubmit' : 'Submit'}</Button>
                </form>
              )}
            </>
          }
        />
      }
    >
      {sp.error && <Alert tone="danger" title="Could not update purchase order:" className="mb-5">{sp.error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Line items">
            {(lines ?? []).length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Description</TH>
                    <TH>GL account</TH>
                    <TH className="text-right">Qty</TH>
                    <TH className="text-right">Unit price</TH>
                    <TH className="text-right">Total</TH>
                  </TR>
                </THead>
                <tbody>
                  {(lines ?? []).map((l: any) => (
                    <TR key={l.id}>
                      <TD className="text-gray-900">{l.description ?? '—'}</TD>
                      <TD className="text-gray-600">{l.gl_accounts ? `${l.gl_accounts.number ?? ''} ${l.gl_accounts.name}`.trim() : '—'}</TD>
                      <TD className="text-right tabular-nums text-gray-600">{Number(l.qty)}</TD>
                      <TD className="text-right tabular-nums text-gray-600">{money(l.unit_price)}</TD>
                      <TD className="text-right tabular-nums font-medium text-gray-950">{money(l.line_total)}</TD>
                    </TR>
                  ))}
                  <TR>
                    <TD className="font-semibold text-gray-950">Total</TD>
                    <TD />
                    <TD />
                    <TD />
                    <TD className="text-right tabular-nums font-semibold text-gray-950">{money(po.po_total)}</TD>
                  </TR>
                </tbody>
              </Table>
            ) : (
              <EmptyState title="No line items" description="Edit this purchase order to itemize the work before submitting." />
            )}
          </Section>

          {(po.description || po.notes) && (
            <Section title="Scope and notes" padded>
              {po.description && <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{po.description}</p>}
              {po.notes && (
                <p className={`whitespace-pre-wrap text-sm leading-6 text-gray-500 ${po.description ? 'mt-3 border-t border-gray-100 pt-3' : ''}`}>
                  <span className="font-medium text-gray-700">Internal: </span>{po.notes}
                </p>
              )}
            </Section>
          )}

          {request && (
            <Section title="Board vote" subtitle={`${request.votes_for} for · ${request.votes_against} against · ${request.votes_abstain} abstain — ${request.required_votes} needed`}>
              {(decisions ?? []).length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {(decisions ?? []).map((d: any) => (
                    <li key={d.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{d.board_members?.full_name ?? d.signature_name ?? 'Board member'}</div>
                        {d.comment && <div className="text-[13px] text-gray-500">{d.comment}</div>}
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusChip tone={d.decision === 'approve' ? 'success' : d.decision === 'reject' ? 'danger' : 'neutral'}>
                          {d.decision === 'approve' ? 'Approved' : d.decision === 'reject' ? 'Rejected' : 'Abstained'}
                        </StatusChip>
                        <span className="text-xs text-gray-400">{formatDateTime(d.decided_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-gray-500">Waiting on board members. They vote from the board portal under Approvals.</p>
              )}
            </Section>
          )}
        </div>

        <div>
          <Section title="Details" padded>
            <dl className="grid grid-cols-[110px_1fr] gap-y-2.5 text-sm">
              <dt className="text-gray-500">Vendor</dt>
              <dd className="text-gray-900">{po.vendors ? <Link href={`/vendors/${po.vendors.id}`} className="font-medium hover:text-gray-600">{po.vendors.name}</Link> : '—'}</dd>
              <dt className="text-gray-500">Association</dt>
              <dd className="text-gray-900">{po.associations ? <Link href={`/associations/${po.associations.id}`} className="font-medium hover:text-gray-600">{po.associations.name}</Link> : '—'}</dd>
              <dt className="text-gray-500">Work order</dt>
              <dd className="text-gray-900">{po.work_orders ? <Link href={`/work-orders/${po.work_orders.id}`} className="font-medium hover:text-gray-600">{po.work_orders.number ? `#${po.work_orders.number} · ` : ''}{po.work_orders.title}</Link> : '—'}</dd>
              <dt className="text-gray-500">Needed by</dt>
              <dd className="text-gray-900">{po.needed_by ? date(po.needed_by) : '—'}</dd>
              <dt className="text-gray-500">Board vote</dt>
              <dd className="text-gray-900">{po.approval_required ? 'Required' : 'Not required'}</dd>
            </dl>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4 text-center">
              <div><div className="text-[12px] text-gray-500">Total</div><div className="text-sm font-semibold tabular-nums text-gray-950">{money(po.po_total)}</div></div>
              <div><div className="text-[12px] text-gray-500">Billed</div><div className="text-sm font-semibold tabular-nums text-gray-950">{money(po.po_billed)}</div></div>
              <div><div className="text-[12px] text-gray-500">Remaining</div><div className="text-sm font-semibold tabular-nums text-gray-950">{money(remaining)}</div></div>
            </div>
          </Section>

          <Section title="History" padded>
            <ol className="space-y-3">
              {timeline.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                  <div>
                    <div className="text-sm text-gray-900">{t.label}</div>
                    <div className="text-xs text-gray-400">{formatDateTime(t.at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {cancellable && (
            <Section title="Cancel purchase order" padded>
              <form action={cancelPurchaseOrder} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                <Input name="reason" required maxLength={500} placeholder="Reason (required)" aria-label="Cancellation reason" />
                <Button type="submit" variant="danger" className="w-full">Cancel purchase order</Button>
              </form>
              {request?.status === 'pending' && <p className="mt-2 text-xs text-gray-400">The open board vote will be withdrawn.</p>}
            </Section>
          )}
        </div>
      </div>
    </Workspace>
  );
}
