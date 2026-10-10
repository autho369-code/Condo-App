import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { newSubmissionToken, SUBMISSION_FIELD } from '@/lib/forms/submission';
import { Field, Input, Select } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { billPurchaseOrder, cancelPurchaseOrder, submitPurchaseOrder } from '@/lib/rpcs/purchase-orders';
import { saveRecurringPurchaseOrder } from '@/lib/rpcs/recurring-purchase-orders';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';
import { mergePrivateFieldsOne } from '@/lib/private-fields';
import { ApprovalStatusChip, OrderStatusChip } from '../status-chips';
import { todayInZone } from '@/lib/time/zoned';

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
  // Internal PO notes are staff-only (purchase_order_private); the vendor reads approved POs.
  await mergePrivateFieldsOne(db, 'purchase_order_private', 'purchase_order_id', ['notes'], po);

  const [{ data: lines }, { data: request }, { data: decisions }, { data: bills }] = await Promise.all([
    db.from('purchase_order_line_items')
      .select('id, description, qty, unit_price, line_total, gl_account_id, gl_accounts(number, name, account_type, active)')
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
    db.from('payable_bills')
      .select('id, bill_number, bill_date, amount, status')
      .eq('purchase_order_id', id)
      .is('archived_at', null)
      .order('bill_date', { ascending: false }),
  ]);

  const editable = po.status !== 'cancelled' && ['draft', 'rejected'].includes(po.approval_status);
  const cancellable = po.status !== 'cancelled' && po.status !== 'billed' && Number(po.po_billed ?? 0) === 0;
  const remaining = Math.max(0, Number(po.po_total ?? 0) - Number(po.po_billed ?? 0));
  const billable = po.approval_status === 'approved' && po.status !== 'cancelled' && remaining > 0 && !!po.vendor_id;
  // One GL per bill: offer a choice only when the PO's lines use more than one account.
  const lineGls = new Map<string, string>();
  for (const l of (lines ?? []) as any[]) {
    if (l.gl_account_id) lineGls.set(l.gl_account_id, l.gl_accounts ? `${l.gl_accounts.number ?? ''} ${l.gl_accounts.name}`.trim() : 'GL account');
  }
  // Same rule as bill_purchase_order: infer the account only when every line uses one and the same.
  const EXPENSE_TYPES = ['expense', 'other_expense', 'cost_of_goods_sold'];
  const hasUncategorized = ((lines ?? []) as any[]).some((l) => !l.gl_account_id);
  // An inferred account must still be an active expense account (same rule as the RPC).
  const soleAccountUsable = ((lines ?? []) as any[]).every(
    (l) => l.gl_accounts && l.gl_accounts.active !== false && EXPENSE_TYPES.includes(String(l.gl_accounts.account_type)),
  );
  const needsGlChoice = hasUncategorized || lineGls.size !== 1 || !soleAccountUsable;
  const { data: glChoices } = billable && needsGlChoice
    ? await db.from('gl_accounts').select('id, number, name, association_id').eq('portfolio_id', po.portfolio_id).eq('active', true)
        .in('account_type', ['expense', 'other_expense', 'cost_of_goods_sold']).order('number')
    : { data: [] };
  const glOptions = ((glChoices ?? []) as any[]).filter((g) => !g.association_id || g.association_id === po.association_id);
  const today = todayInZone();
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

          <Section title="Bills" subtitle={`${money(po.po_billed)} billed of ${money(po.po_total)}`}>
            {(bills ?? []).length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Bill</TH>
                    <TH>Date</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Amount</TH>
                  </TR>
                </THead>
                <tbody>
                  {(bills ?? []).map((b: any) => (
                    <TR key={b.id}>
                      <TD><Link href={`/bills/${b.id}`} className="font-medium text-gray-950 hover:underline">{b.bill_number ?? 'Bill'}</Link></TD>
                      <TD className="text-gray-600">{date(b.bill_date)}</TD>
                      <TD><StatusChip tone={b.status === 'paid' ? 'success' : b.status === 'void' ? 'neutral' : b.status === 'approved' ? 'info' : 'warning'}>{String(b.status).replace(/_/g, ' ')}</StatusChip></TD>
                      <TD className={`text-right tabular-nums ${b.status === 'void' ? 'text-gray-400 line-through' : 'text-gray-950'}`}>{money(b.amount)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="px-5 py-4 text-sm text-gray-500">No bills against this purchase order yet.</p>
            )}
            {billable && (
              <form action={billPurchaseOrder} className="grid gap-4 border-t border-gray-100 px-5 py-5 sm:grid-cols-2">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name={SUBMISSION_FIELD} value={newSubmissionToken()} />
                <div className="sm:col-span-2">
                  <div className="text-sm font-semibold text-gray-950">Bill this purchase order</div>
                  <p className="mt-0.5 text-[13px] text-gray-500">Creates a bill for {po.vendors?.name ?? 'the vendor'} linked to this PO. Bills can never add up to more than the PO total.</p>
                </div>
                <Field label="Invoice number">
                  <Input name="bill_number" maxLength={100} placeholder="Vendor's invoice #" />
                </Field>
                <Field label="Amount" hint={`Up to ${money(remaining)} remaining`}>
                  <Input name="amount" type="number" step="0.01" min="0.01" max={remaining.toFixed(2)} required defaultValue={remaining.toFixed(2)} />
                </Field>
                <Field label="Invoice date">
                  <Input name="bill_date" type="date" required defaultValue={today} />
                </Field>
                <Field label="Due date (optional)">
                  <Input name="due_date" type="date" />
                </Field>
                {needsGlChoice && (
                  <Field label="GL account" className="sm:col-span-2" hint={hasUncategorized ? 'Some line items have no GL account, so choose where this bill posts.' : lineGls.size > 1 ? 'The line items use several accounts — choose where this bill posts.' : 'The purchase order\'s account is inactive or not an expense account — choose an expense account.'}>
                    <Select name="gl_account_id" required defaultValue="">
                      <option value="">Choose the account this bill goes to</option>
                      {[...lineGls.entries()].filter(([glId]) => glOptions.some((g) => g.id === glId)).map(([glId, label]) => <option key={glId} value={glId}>{label} (on this PO)</option>)}
                      {glOptions.filter((g) => !lineGls.has(g.id)).map((g) => <option key={g.id} value={g.id}>{g.number} {g.name}</option>)}
                    </Select>
                  </Field>
                )}
                <label className="flex items-center gap-2 text-[13px] text-gray-700 sm:col-span-2">
                  <input type="checkbox" name="submit_for_approval" /> Submit the bill for approval now
                </label>
                <div className="sm:col-span-2"><PendingSubmit pendingLabel="Creating bill…">Create bill</PendingSubmit></div>
              </form>
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
                <ul className="divide-y divide-line">
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
                        <span className="text-[13px] text-gray-500">{formatDateTime(d.decided_at)}</span>
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
                    <div className="text-[13px] text-gray-500">{formatDateTime(t.at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {po.vendor_id && (lines ?? []).length > 0 && (
            <Section title="Repeat this order" padded>
              <form action={saveRecurringPurchaseOrder} className="space-y-3">
                <input type="hidden" name="purchase_order_id" value={id} />
                <p className="text-[13px] text-gray-500">Creates a draft copy of this order on a schedule for you to review and submit.</p>
                <Field label="Name"><Input name="name" required maxLength={200} defaultValue={po.description ?? `${po.vendors?.name ?? 'Vendor'} order`} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Repeats">
                    <Select name="frequency" required defaultValue="monthly">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annually">Annually</option>
                    </Select>
                  </Field>
                  <Field label="Every"><Input name="interval_count" type="number" min="1" max="60" defaultValue="1" /></Field>
                  <Field label="First order"><Input name="start_date" type="date" required defaultValue={today} /></Field>
                  <Field label="End (optional)"><Input name="end_date" type="date" /></Field>
                </div>
                <Field label="Needed by (days after order)"><Input name="needed_by_days" type="number" min="0" max="365" defaultValue="0" /></Field>
                <Button type="submit" variant="secondary" className="w-full">Save as recurring</Button>
              </form>
            </Section>
          )}

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
