'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

type GlAccount = { id: string; number: number; name: string };
type Assoc = { id: string; name: string };
type Line = { gl: string; assoc: string; debit: string; credit: string; memo: string };

const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
const emptyLine = (): Line => ({ gl: '', assoc: '', debit: '', credit: '', memo: '' });

export function JournalEntryForm({
  glAccounts,
  associations,
  action,
}: {
  glAccounts: GlAccount[];
  associations: Assoc[];
  action: (formData: FormData) => void;
}) {
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);

  const update = (i: number, key: keyof Line, value: string) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <Label htmlFor="entry_date">Entry date <span className="text-red-500">*</span></Label>
          <Input id="entry_date" name="entry_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
          <Input id="description" name="description" required placeholder="e.g. Reclassify Q2 landscaping expense" />
        </div>
        <div>
          <Label htmlFor="reference_number">Reference #</Label>
          <Input id="reference_number" name="reference_number" placeholder="Optional" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">GL account</th>
              <th className="px-3 py-2 text-left font-medium">Association</th>
              <th className="px-3 py-2 text-right font-medium">Debit</th>
              <th className="px-3 py-2 text-right font-medium">Credit</th>
              <th className="px-3 py-2 text-left font-medium">Memo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-2">
                  <select name="line_gl" value={l.gl} onChange={(e) => update(i, 'gl', e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {glAccounts.map((g) => <option key={g.id} value={g.id}>{g.number} · {g.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select name="line_assoc" value={l.assoc} onChange={(e) => update(i, 'assoc', e.target.value)} className={inputCls}>
                    <option value="">Portfolio-wide</option>
                    {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input name="line_debit" value={l.debit} onChange={(e) => update(i, 'debit', e.target.value)} type="number" step="0.01" min="0" className={`${inputCls} text-right`} placeholder="0.00" />
                </td>
                <td className="px-3 py-2">
                  <input name="line_credit" value={l.credit} onChange={(e) => update(i, 'credit', e.target.value)} type="number" step="0.01" min="0" className={`${inputCls} text-right`} placeholder="0.00" />
                </td>
                <td className="px-3 py-2">
                  <input name="line_memo" value={l.memo} onChange={(e) => update(i, 'memo', e.target.value)} className={inputCls} placeholder="Optional" />
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 2} className="text-xs text-red-600 hover:underline disabled:opacity-30">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50/60 text-sm">
            <tr>
              <td className="px-3 py-2 font-medium text-gray-700" colSpan={2}>Totals</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-950">{fmt(totalDebit)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-950">{fmt(totalCredit)}</td>
              <td className="px-3 py-2" colSpan={2}>
                <span className={`text-xs font-medium ${balanced ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {balanced ? 'Balanced' : `Out of balance by ${fmt(Math.abs(totalDebit - totalCredit))}`}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={addLine} className="text-sm font-medium text-gray-600 hover:text-gray-950 hover:underline">+ Add line</button>
        <div>
          <Label htmlFor="memo">Entry memo</Label>
          <Input id="memo" name="memo" placeholder="Optional note for the whole entry" className="w-72" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-5">
        <a href="/journal-entries" className="text-sm text-gray-600 hover:text-gray-900">Cancel</a>
        <Button type="submit" size="lg" disabled={!balanced}>Post journal entry</Button>
      </div>
    </form>
  );
}
