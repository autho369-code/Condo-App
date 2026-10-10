'use client';

import { useMemo, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { saveBudgetWorksheet } from '@/lib/rpcs/budget-worksheet';
import { adjustByPercent, parseWorksheetCsv, spreadEvenly, sum, worksheetToCsv } from '@/lib/budget/fiscal';
import { money } from '@/lib/utils';

export type WorksheetAccount = {
  glAccountId: string;
  number: number | null;
  name: string;
  section: 'income' | 'expense';
  amounts: number[];
  notes: string;
};

type Sources = Record<'prior_budget' | 'prior_actuals', Record<string, number[]>>;

const SOURCE_LABEL = { prior_budget: 'last year’s budget', prior_actuals: 'last year’s actuals' } as const;

export function BudgetWorksheet({
  associationId,
  associationRef,
  fiscalYear,
  labels,
  accounts,
  sources,
  readOnly,
}: {
  associationId: string;
  associationRef: string;
  fiscalYear: number;
  labels: string[];
  accounts: WorksheetAccount[];
  sources: Sources;
  readOnly: boolean;
}) {
  const [rows, setRows] = useState(accounts);
  const [dirty, setDirty] = useState(false);
  const [onlyBudgeted, setOnlyBudgeted] = useState(accounts.some((a) => sum(a.amounts) > 0));
  const [pct, setPct] = useState('3');
  const [scope, setScope] = useState<'all' | 'income' | 'expense'>('expense');
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (next: WorksheetAccount[], text?: string, tone: 'success' | 'warning' = 'success') => {
    setRows(next);
    setDirty(true);
    setMessage(text ? { tone, text } : null);
  };
  const setAmount = (id: string, i: number, v: string) =>
    update(rows.map((r) => (r.glAccountId === id ? { ...r, amounts: r.amounts.map((a, j) => (j === i ? Math.max(0, Number(v) || 0) : a)) } : r)));
  const setAnnual = (id: string, v: string) =>
    update(rows.map((r) => (r.glAccountId === id ? { ...r, amounts: spreadEvenly(Number(v) || 0) } : r)));
  const setNotes = (id: string, v: string) => update(rows.map((r) => (r.glAccountId === id ? { ...r, notes: v } : r)));

  function fill(source: keyof Sources) {
    const src = sources[source];
    const hits = rows.filter((r) => src[r.glAccountId]).length;
    if (!hits) { setMessage({ tone: 'warning', text: `There is nothing in ${SOURCE_LABEL[source]} to copy.` }); return; }
    update(rows.map((r) => (src[r.glAccountId] ? { ...r, amounts: src[r.glAccountId].map((a) => Number(a) || 0) } : { ...r, amounts: Array(12).fill(0) })),
      `Filled ${hits} account${hits === 1 ? '' : 's'} from ${SOURCE_LABEL[source]}. Review, then save.`);
    setOnlyBudgeted(true);
  }

  function adjust() {
    const p = Number(pct);
    if (!Number.isFinite(p) || p < -100 || p > 1000) { setMessage({ tone: 'warning', text: 'Enter a percentage between −100 and 1000.' }); return; }
    update(rows.map((r) => (scope === 'all' || r.section === scope ? { ...r, amounts: adjustByPercent(r.amounts, p) } : r)),
      `${p >= 0 ? 'Increased' : 'Decreased'} ${scope === 'all' ? 'every line' : `${scope} lines`} by ${Math.abs(p)}%.`);
  }

  function exportCsv() {
    const csv = worksheetToCsv(rows.filter((r) => !onlyBudgeted || sum(r.amounts) > 0 || r.notes), labels);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-FY${fiscalYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const known = new Set(rows.map((r) => r.number).filter((n): n is number => n !== null));
    const { byNumber, unknown, invalid } = parseWorksheetCsv(text, known);
    if (!byNumber.size) { setMessage({ tone: 'warning', text: 'No rows matched an account number in this chart of accounts.' }); return; }
    const next = rows.map((r) => {
      const hit = r.number !== null ? byNumber.get(r.number) : undefined;
      return hit ? { ...r, amounts: hit.amounts, notes: hit.notes || r.notes } : r;
    });
    const skipped = [...unknown.map((u) => `${u || 'blank'} (unknown account)`), ...invalid.map((n) => `${n} (bad amounts)`)];
    update(next, `Imported ${byNumber.size} line${byNumber.size === 1 ? '' : 's'}.${skipped.length ? ` Skipped: ${skipped.slice(0, 6).join(', ')}${skipped.length > 6 ? '…' : ''}` : ''}`,
      skipped.length ? 'warning' : 'success');
    setOnlyBudgeted(true);
  }

  const visible = rows.filter((r) => !onlyBudgeted || sum(r.amounts) > 0 || r.notes);
  const totals = useMemo(() => {
    const col = (section: 'income' | 'expense') =>
      Array.from({ length: 12 }, (_, i) => rows.filter((r) => r.section === section).reduce((s, r) => s + (r.amounts[i] || 0), 0));
    const income = col('income');
    const expense = col('expense');
    return { income, expense, net: income.map((v, i) => v - expense[i]) };
  }, [rows]);
  const payload = JSON.stringify(rows.map((r) => ({ gl_account_id: r.glAccountId, monthly_amounts: r.amounts, notes: r.notes })));

  const section = (key: 'income' | 'expense', title: string) => {
    const list = visible.filter((r) => r.section === key);
    return (
      <>
        <tr className="border-b border-gray-100 bg-gray-50/60">
          <td className="sticky left-0 z-10 bg-gray-50 px-4 py-2 text-[12.5px] font-semibold uppercase tracking-wide text-gray-500">{title}</td>
          <td colSpan={14} />
        </tr>
        {list.length === 0 && (
          <tr><td className="sticky left-0 bg-white px-4 py-3 text-[13px] text-gray-400" colSpan={15}>No {key} lines yet.</td></tr>
        )}
        {list.map((r) => (
          <tr key={r.glAccountId} className="border-b border-gray-50 last:border-0">
            <td className="sticky left-0 z-10 min-w-[220px] bg-white px-4 py-1.5 text-[13px] text-gray-800">
              <div className="font-medium">{r.number !== null ? `${r.number} · ` : ''}{r.name}</div>
              {!readOnly ? (
                <input
                  aria-label={`Notes for ${r.name}`}
                  value={r.notes}
                  onChange={(e) => setNotes(r.glAccountId, e.target.value)}
                  placeholder="Note"
                  maxLength={500}
                  className="mt-0.5 w-full border-0 bg-transparent p-0 text-[12px] text-gray-500 placeholder:text-gray-300 focus:outline-none focus:ring-0"
                />
              ) : r.notes ? <div className="text-[12px] text-gray-500">{r.notes}</div> : null}
            </td>
            <td className="px-2 py-1.5 text-right">
              {readOnly ? (
                <span className="font-semibold tabular-nums text-gray-950">{money(sum(r.amounts))}</span>
              ) : (
                <input
                  key={sum(r.amounts)}
                  aria-label={`Annual budget for ${r.name}`}
                  type="number" min="0" step="0.01"
                  defaultValue={sum(r.amounts) || ''}
                  onBlur={(e) => { if (Number(e.target.value || 0) !== sum(r.amounts)) setAnnual(r.glAccountId, e.target.value); }}
                  className="h-9 w-28 rounded-lg border border-gray-200 px-2 text-right text-[13px] font-semibold tabular-nums text-gray-950 focus:border-gray-400 focus:outline-none"
                />
              )}
            </td>
            <td className="px-2 py-1.5 text-right text-[12px] tabular-nums text-gray-400">
              {sources.prior_actuals[r.glAccountId] ? money(sum(sources.prior_actuals[r.glAccountId])) : '—'}
            </td>
            {r.amounts.map((a, i) => (
              <td key={i} className="px-1 py-1.5 text-right">
                {readOnly ? (
                  <span className="text-[13px] tabular-nums text-gray-700">{a ? a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span>
                ) : (
                  <input
                    aria-label={`${r.name} ${labels[i]}`}
                    type="number" min="0" step="0.01"
                    value={a || ''}
                    onChange={(e) => setAmount(r.glAccountId, i, e.target.value)}
                    className="h-9 w-24 rounded-lg border border-transparent px-2 text-right text-[13px] tabular-nums text-gray-800 hover:border-gray-200 focus:border-gray-400 focus:outline-none"
                  />
                )}
              </td>
            ))}
          </tr>
        ))}
      </>
    );
  };

  const totalRow = (label: string, vals: number[], strong = false) => (
    <tr className={`border-t border-gray-200 ${strong ? 'bg-gray-50' : ''}`}>
      <td className="sticky left-0 z-10 bg-gray-50 px-4 py-2 text-[13px] font-semibold text-gray-900">{label}</td>
      <td className="px-2 py-2 text-right text-[13px] font-semibold tabular-nums text-gray-950">{money(sum(vals))}</td>
      <td />
      {vals.map((v, i) => <td key={i} className="px-3 py-2 text-right text-[12px] font-medium tabular-nums text-gray-700">{Math.round(v).toLocaleString('en-US')}</td>)}
    </tr>
  );

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-gray-500">Start from</span>
            <Button type="button" size="sm" variant="secondary" onClick={() => fill('prior_budget')}>FY{fiscalYear - 1} budget</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => fill('prior_actuals')}>FY{fiscalYear - 1} actuals</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-gray-500">Adjust</span>
            <Select aria-label="Lines to adjust" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="h-9 w-32">
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="all">All lines</option>
            </Select>
            <span className="text-[12px] text-gray-500">by</span>
            <Input aria-label="Percent" type="number" step="0.1" value={pct} onChange={(e) => setPct(e.target.value)} className="h-9 w-20 text-right" />
            <span className="text-[12px] text-gray-500">%</span>
            <Button type="button" size="sm" variant="secondary" onClick={adjust}>Apply</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Button type="button" size="sm" variant="ghost" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Import CSV</Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ''; }} />
          </div>
        </div>
      )}

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-h-10 items-center gap-2 text-[13px] text-gray-600">
          <input type="checkbox" checked={onlyBudgeted} onChange={(e) => setOnlyBudgeted(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Show only budgeted accounts
        </label>
        {readOnly ? null : (
          <p className="text-[12px] text-gray-500">Type an annual amount to spread it evenly across the year, or edit any month.</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm" style={{ minWidth: 1500 }}>
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[12.5px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2.5 text-left font-medium">GL account</th>
              <th className="px-2 py-2.5 text-right font-medium">FY{fiscalYear}</th>
              <th className="px-2 py-2.5 text-right font-medium">FY{fiscalYear - 1} actual</th>
              {labels.map((m) => <th key={m} className="px-3 py-2.5 text-right font-medium">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {section('income', 'Income')}
            {totalRow('Total income', totals.income)}
            {section('expense', 'Expense')}
            {totalRow('Total expense', totals.expense)}
            {totalRow('Net (income − expense)', totals.net, true)}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <form action={saveBudgetWorksheet} className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200/70 bg-white/95 p-3 backdrop-blur">
          <input type="hidden" name="association_id" value={associationId} />
          <input type="hidden" name="association_ref" value={associationRef} />
          <input type="hidden" name="fiscal_year" value={fiscalYear} />
          <input type="hidden" name="lines" value={payload} />
          <Button type="submit">Save worksheet</Button>
          <span className="text-[13px] text-gray-500">
            {dirty ? 'Unsaved changes.' : 'All changes saved.'} Net budget {money(sum(totals.net))}.
          </span>
        </form>
      )}
    </div>
  );
}
