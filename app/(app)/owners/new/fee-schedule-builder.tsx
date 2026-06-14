'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input, Label } from '@/components/ui/input';

export type FeeCategory = {
  id: string;
  name: string;
  default_amount: number | string | null;
  default_frequency: string | null;
  charge_type: string | null;
};

const FREQUENCIES = ['monthly', 'quarterly', 'annually', 'weekly', 'daily'];

// Charge types whose fee usually has a physical asset identifier (space/locker #).
const IDENTIFIER_TYPES = new Set(['amenity_fee']);

let rowSeq = 0;
type Row = { key: number; categoryId: string; amount: string; frequency: string; identifier: string; memo: string };

function newRow(): Row {
  return { key: rowSeq++, categoryId: '', amount: '', frequency: 'monthly', identifier: '', memo: '' };
}

export function FeeScheduleBuilder({ categories }: { categories: FeeCategory[] }) {
  const [rows, setRows] = useState<Row[]>([]);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const onCategory = (key: number, categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    update(key, {
      categoryId,
      amount: cat && cat.default_amount != null && Number(cat.default_amount) > 0 ? String(cat.default_amount) : '',
      frequency: cat?.default_frequency ?? 'monthly',
    });
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-sm text-gray-500">
          No recurring fees yet. Add parking, storage/locker, internet, or any custom fee. The regular monthly assessment is set above as “Monthly dues”.
        </p>
      )}

      {rows.map((row) => {
        const cat = categories.find((c) => c.id === row.categoryId);
        const showIdentifier = cat ? IDENTIFIER_TYPES.has(cat.charge_type ?? '') : true;
        return (
          <div key={row.key} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <Label htmlFor={`cat-${row.key}`}>Fee</Label>
              <select
                id={`cat-${row.key}`}
                name="fee_category_id"
                required
                value={row.categoryId}
                onChange={(e) => onCategory(row.key, e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select fee…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor={`amt-${row.key}`}>Amount</Label>
              <Input id={`amt-${row.key}`} name="fee_amount" type="number" min="0" step="0.01" required
                value={row.amount} onChange={(e) => update(row.key, { amount: e.target.value })} placeholder="0.00" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor={`freq-${row.key}`}>Frequency</Label>
              <select id={`freq-${row.key}`} name="fee_frequency" value={row.frequency}
                onChange={(e) => update(row.key, { frequency: e.target.value })}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm capitalize text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor={`id-${row.key}`}>Space / locker #</Label>
              <Input id={`id-${row.key}`} name="fee_identifier" value={row.identifier}
                onChange={(e) => update(row.key, { identifier: e.target.value })}
                placeholder={showIdentifier ? 'e.g. 14' : '—'} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor={`memo-${row.key}`}>Note</Label>
              <Input id={`memo-${row.key}`} name="fee_memo" value={row.memo}
                onChange={(e) => update(row.key, { memo: e.target.value })} placeholder="Optional" />
            </div>
            <div className="flex items-end md:col-span-1">
              <button type="button" onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-gray-300 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600" aria-label="Remove fee">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}

      <button type="button" onClick={() => setRows((rs) => [...rs, newRow()])}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
        <Plus className="h-4 w-4" /> Add fee
      </button>
    </div>
  );
}
