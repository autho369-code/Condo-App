'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';

export type ScheduleStep = {
  follow_up_name: string;
  days_after_previous: number;
  fee: number;
  offers_hearing: boolean;
  delivery_methods: string[];
  letter_template_id: string | null;
  gl_account_id: string | null;
};

type Row = ScheduleStep & { key: number };
const METHODS = [
  { value: 'email', label: 'Email' },
  { value: 'portal', label: 'Owner portal' },
  { value: 'mail', label: 'Mail' },
  { value: 'certified_mail', label: 'Certified mail' },
];

export function ScheduleEditor({
  action,
  associationId,
  houseRuleId,
  initial,
  templates,
  glAccounts,
  allowEmpty,
  submitLabel = 'Save schedule',
}: {
  action: (formData: FormData) => void | Promise<void>;
  associationId: string;
  houseRuleId?: string;
  initial: ScheduleStep[];
  templates: { id: string; name: string }[];
  glAccounts: { id: string; number: string | null; name: string }[];
  allowEmpty?: boolean;
  submitLabel?: string;
}) {
  const nextKey = React.useRef(1);
  const [rows, setRows] = React.useState<Row[]>(() => initial.map((s) => ({ ...s, key: nextKey.current++ })));
  const update = (key: number, patch: Partial<ScheduleStep>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index: number, delta: number) =>
    setRows((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  let cumulative = 0;
  const serialized = JSON.stringify(rows.map(({ key: _key, ...s }) => s));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="association_id" value={associationId} />
      {houseRuleId && <input type="hidden" name="house_rule_id" value={houseRuleId} />}
      <input type="hidden" name="steps" value={serialized} />

      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
          {allowEmpty ? 'No custom steps — this rule follows the association default schedule.' : 'Add at least one step.'}
        </p>
      )}

      <ol className="space-y-3">
        {rows.map((row, i) => {
          cumulative += Number(row.days_after_previous) || 0;
          return (
            <li key={row.key} className="rounded-xl border border-gray-200/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-[12px] font-medium text-gray-500">
                  Step {i + 1} · day {cumulative}
                  {row.fee > 0 && <span className="ml-2 text-gray-700">fine ${Number(row.fee).toFixed(2)}</span>}
                  {row.offers_hearing && <span className="ml-2 text-gray-700">offers hearing</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move step up" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move step down" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))} aria-label="Remove step" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_140px]">
                <Field label="Step name">
                  <Input value={row.follow_up_name} maxLength={120} onChange={(e) => update(row.key, { follow_up_name: e.target.value })} placeholder="e.g. Second notice" />
                </Field>
                <Field label={i === 0 ? 'Days after opening' : 'Days after previous'}>
                  <Input type="number" min="0" max="365" value={row.days_after_previous} onChange={(e) => update(row.key, { days_after_previous: Number(e.target.value) })} />
                </Field>
                <Field label="Fine ($)" hint="0 for a notice only">
                  <Input type="number" min="0" step="0.01" value={row.fee} onChange={(e) => update(row.key, { fee: Number(e.target.value) })} />
                </Field>
                <Field label="Letter template">
                  <Select value={row.letter_template_id ?? ''} onChange={(e) => update(row.key, { letter_template_id: e.target.value || null })}>
                    <option value="">None</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </Field>
                <Field label="Fine GL account" className="sm:col-span-2">
                  <Select value={row.gl_account_id ?? ''} onChange={(e) => update(row.key, { gl_account_id: e.target.value || null })} disabled={!(row.fee > 0)}>
                    <option value="">Fine category default</option>
                    {glAccounts.map((g) => <option key={g.id} value={g.id}>{g.number ? `${g.number}: ` : ''}{g.name}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                {METHODS.map((m) => (
                  <label key={m.value} className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={row.delivery_methods.includes(m.value)}
                      onChange={(e) =>
                        update(row.key, {
                          delivery_methods: e.target.checked
                            ? [...row.delivery_methods, m.value]
                            : row.delivery_methods.filter((x) => x !== m.value),
                        })
                      }
                    />
                    {m.label}
                  </label>
                ))}
                <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={row.offers_hearing} onChange={(e) => update(row.key, { offers_hearing: e.target.checked })} />
                  Offer the owner a hearing
                </label>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={rows.length >= 12}
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { key: nextKey.current++, follow_up_name: '', days_after_previous: 14, fee: 0, offers_hearing: false, delivery_methods: ['email', 'portal'], letter_template_id: null, gl_account_id: null },
            ])
          }
        >
          <Plus className="h-4 w-4" /> Add step
        </Button>
        <Button type="submit" disabled={!allowEmpty && rows.length === 0}>{submitLabel}</Button>
      </div>
    </form>
  );
}
