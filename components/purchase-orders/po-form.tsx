'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';

type Option = { id: string; name: string };
type GlOption = { id: string; number: string | null; name: string; association_id: string | null };
type WorkOrderOption = { id: string; label: string; association_id: string | null };
export type ApprovalRule = { mode: string; threshold: number | null };

type Line = { key: number; description: string; qty: string; unit_price: string; gl_account_id: string };

export type PurchaseOrderFormValues = {
  id?: string;
  association_id?: string;
  vendor_id?: string;
  work_order_id?: string | null;
  number?: string | null;
  description?: string | null;
  needed_by?: string | null;
  notes?: string | null;
  lines?: { description: string | null; qty: number; unit_price: number; gl_account_id: string | null }[];
};

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function routingMessage(rule: ApprovalRule | undefined, total: number): { tone: 'info' | 'warning'; text: string } {
  const mode = rule?.mode ?? 'never';
  if (mode === 'always') return { tone: 'warning', text: 'This association requires a board vote on every purchase order.' };
  if (mode === 'over_threshold') {
    const t = rule?.threshold ?? 0;
    return total >= t
      ? { tone: 'warning', text: `At ${usd(total)} this order meets the ${usd(t)} board threshold — submitting sends it to the board for a vote.` }
      : { tone: 'info', text: `Under the ${usd(t)} board threshold — submitting approves it within your spending authority.` };
  }
  return { tone: 'info', text: 'No board vote is configured for this association — submitting approves it within your spending authority.' };
}

export function PurchaseOrderForm({
  action,
  associations,
  vendors,
  glAccounts,
  workOrders,
  rules,
  initial,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  associations: Option[];
  vendors: Option[];
  glAccounts: GlOption[];
  workOrders: WorkOrderOption[];
  rules: Record<string, ApprovalRule>;
  initial?: PurchaseOrderFormValues;
  error?: string;
}) {
  const nextKey = React.useRef(1);
  const makeLine = (l?: Partial<Line>): Line => ({
    key: nextKey.current++,
    description: l?.description ?? '',
    qty: l?.qty ?? '1',
    unit_price: l?.unit_price ?? '',
    gl_account_id: l?.gl_account_id ?? '',
  });

  const [associationId, setAssociationId] = React.useState(initial?.association_id ?? '');
  const [lines, setLines] = React.useState<Line[]>(() =>
    initial?.lines?.length
      ? initial.lines.map((l) => makeLine({
          description: l.description ?? '',
          qty: String(l.qty),
          unit_price: String(l.unit_price),
          gl_account_id: l.gl_account_id ?? '',
        }))
      : [makeLine()],
  );

  const lineTotal = (l: Line) => {
    const q = Number(l.qty);
    const p = Number(l.unit_price);
    return Number.isFinite(q) && Number.isFinite(p) ? Math.round(q * p * 100) / 100 : 0;
  };
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const glForAssociation = glAccounts.filter((g) => !g.association_id || g.association_id === associationId);
  const workOrdersForAssociation = workOrders.filter((w) => w.association_id === associationId);
  const routing = associationId ? routingMessage(rules[associationId], total) : null;

  const update = (key: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const serialized = JSON.stringify(
    lines
      .filter((l) => l.description.trim() || l.unit_price)
      .map((l) => ({
        description: l.description.trim(),
        qty: Number(l.qty),
        unit_price: Number(l.unit_price),
        gl_account_id: l.gl_account_id || null,
      })),
  );

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      {error && <Alert tone="danger" title="Could not save purchase order:">{error}</Alert>}
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="lines" value={serialized} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Association" htmlFor="association_id" required>
          <Select
            id="association_id"
            name="association_id"
            required
            value={associationId}
            onChange={(e) => setAssociationId(e.target.value)}
          >
            <option value="">Select association</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <Field label="Vendor" htmlFor="vendor_id" required>
          <Select id="vendor_id" name="vendor_id" required defaultValue={initial?.vendor_id ?? ''}>
            <option value="">Select vendor</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
        </Field>
        <Field label="PO number" htmlFor="number" hint="Optional — your internal reference.">
          <Input id="number" name="number" defaultValue={initial?.number ?? ''} maxLength={40} />
        </Field>
        <Field label="Needed by" htmlFor="needed_by">
          <Input id="needed_by" name="needed_by" type="date" defaultValue={initial?.needed_by ?? ''} />
        </Field>
        <Field label="Work order" htmlFor="work_order_id" hint={associationId ? undefined : 'Pick an association to link a work order.'} className="sm:col-span-2">
          <Select id="work_order_id" name="work_order_id" defaultValue={initial?.work_order_id ?? ''} disabled={!associationId}>
            <option value="">None</option>
            {workOrdersForAssociation.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
          </Select>
        </Field>
        <Field label="Scope of work" htmlFor="description" className="sm:col-span-2" hint="Shown to board members when a vote is required.">
          <Textarea id="description" name="description" rows={3} defaultValue={initial?.description ?? ''} maxLength={2000} />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Line items</h2>
          <span className="text-sm tabular-nums text-gray-600">Total <span className="font-semibold text-gray-950">{usd(total)}</span></span>
        </div>
        <div className="space-y-3">
          {lines.map((l, i) => (
            <div key={l.key} className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200/70 p-3 sm:grid-cols-[1fr_90px_120px_1fr_40px] sm:items-end">
              <Field label={i === 0 ? 'Description' : undefined} className="col-span-2 sm:col-span-1">
                <Input
                  aria-label="Line description"
                  value={l.description}
                  onChange={(e) => update(l.key, { description: e.target.value })}
                  placeholder="e.g. Replace lobby door closer"
                  maxLength={500}
                />
              </Field>
              <Field label={i === 0 ? 'Qty' : undefined}>
                <Input aria-label="Quantity" type="number" min="0.01" step="0.01" inputMode="decimal" value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} />
              </Field>
              <Field label={i === 0 ? 'Unit price' : undefined}>
                <Input aria-label="Unit price" type="number" min="0" step="0.01" inputMode="decimal" value={l.unit_price} onChange={(e) => update(l.key, { unit_price: e.target.value })} placeholder="0.00" />
              </Field>
              <Field label={i === 0 ? 'GL account' : undefined} className="col-span-2 sm:col-span-1">
                <Select aria-label="GL account" value={l.gl_account_id} onChange={(e) => update(l.key, { gl_account_id: e.target.value })}>
                  <option value="">Uncategorized</option>
                  {glForAssociation.map((g) => <option key={g.id} value={g.id}>{g.number ? `${g.number}: ` : ''}{g.name}</option>)}
                </Select>
              </Field>
              <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:justify-end">
                <span className="text-sm tabular-nums text-gray-600 sm:hidden">{usd(lineTotal(l))}</span>
                <button
                  type="button"
                  onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== l.key) : prev))}
                  disabled={lines.length === 1}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setLines((prev) => [...prev, makeLine()])} disabled={lines.length >= 100}>
          <Plus className="h-4 w-4" /> Add line
        </Button>
      </div>

      <Field label="Internal notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} defaultValue={initial?.notes ?? ''} maxLength={2000} />
      </Field>

      {routing && <Alert tone={routing.tone}>{routing.text}</Alert>}

      <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href={initial?.id ? `/purchase-orders/${initial.id}` : '/purchase-orders'} className="text-center text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" name="intent" value="draft" variant="secondary">Save draft</Button>
          <Button type="submit" name="intent" value="submit">Save and submit</Button>
        </div>
      </div>
    </form>
  );
}
