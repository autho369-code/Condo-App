'use client';

import { useState, useMemo } from 'react';
import { createBulkRecurringCharges } from '@/lib/rpcs/bulk-operations';
import { money } from '@/lib/utils';

interface Association { id: string; name: string; }
interface Category { id: string; name: string; code: string; charge_type: string; default_amount: number; default_frequency: string; }
interface UnitInfo { unit_id: string; unit_number: string; owner_name: string | null; current_dues: number; }

export function BulkRecurringForm({
  associations,
  categories,
}: {
  associations: Association[];
  categories: Category[];
}) {
  const [selectedAssoc, setSelectedAssoc] = useState<string>('');
  const [units, setUnits] = useState<UnitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [categoryId, setCategoryId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [startDate, setStartDate] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const assessmentCategories = categories.filter((c) => c.is_assessment);

  async function loadUnits(assocId: string) {
    setSelectedAssoc(assocId);
    setSelectedUnits(new Set());
    if (!assocId) { setUnits([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/bulk/units?association_id=${assocId}`);
      const data = await res.json();
      setUnits(data.units ?? []);
    } catch { setUnits([]); }
    setLoading(false);
  }

  function toggleUnit(id: string) {
    setSelectedUnits((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function selectAll() { setSelectedUnits(new Set(units.map((u) => u.unit_id))); }
  function clearAll() { setSelectedUnits(new Set()); }

  const previewTotal = useMemo(() => (parseFloat(amount) || 0) * selectedUnits.size, [amount, selectedUnits.size]);

  async function handleSubmit() {
    if (selectedUnits.size === 0) { setError('Select at least one unit'); return; }
    if (!categoryId) { setError('Select a charge category'); return; }
    setSending(true); setError(null);
    const fd = new FormData();
    fd.set('charge_category_id', categoryId);
    fd.set('frequency', frequency);
    if (startDate) fd.set('start_date', startDate);
    if (memo) fd.set('memo', memo);
    for (const uid of selectedUnits) {
      fd.append('unit_ids', uid);
      fd.append('amounts', amount || '0');
    }
    try {
      const r = await createBulkRecurringCharges(fd);
      if (r.error) setError(r.error);
      else setResult(r);
    } catch (e: any) { setError(e.message || 'Failed'); }
    setSending(false);
  }

  if (result) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="text-4xl mb-3">&#10003;</div>
        <h3 className="text-lg font-semibold text-emerald-800">Recurring Charges Created</h3>
        <p className="mt-2 text-sm text-emerald-700">{result.count} recurring charge{result.count !== 1 ? 's' : ''} created for {selectedUnits.size} unit{selectedUnits.size !== 1 ? 's' : ''}.</p>
        <p className="mt-1 text-xs text-emerald-600">{frequency} starting {startDate || 'today'}</p>
        <div className="mt-4 flex justify-center gap-3">
          <button onClick={() => { setResult(null); setSelectedUnits(new Set()); setAmount(''); setMemo(''); }}
            className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700">Create Another Batch</button>
          <a href="/charges" className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Back to Receivables</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-950">1. Select Association</h3>
        <select value={selectedAssoc} onChange={(e) => loadUnits(e.target.value)}
          className="mt-2 h-10 w-full max-w-md rounded border border-gray-300 bg-white px-3 text-sm">
          <option value="">Choose an association...</option>
          {associations.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>
      </div>

      {selectedAssoc && (
        <div className="rounded border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-950">2. Select Units</h3>
            {units.length > 0 && (
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-xs text-emerald-600 hover:underline">Select all</button>
                <button type="button" onClick={clearAll} className="text-xs text-gray-400 hover:underline">Clear</button>
              </div>
            )}
          </div>
          {loading ? <p className="mt-3 text-sm text-gray-500">Loading units...</p>
            : units.length === 0 ? <p className="mt-3 text-sm text-gray-500">No units found.</p>
            : (
              <div className="mt-3 max-h-64 overflow-y-auto rounded border border-gray-100">
                {units.map((u) => (
                  <label key={u.unit_id} className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm hover:bg-gray-50 ${selectedUnits.has(u.unit_id) ? 'bg-emerald-50' : ''}`}>
                    <input type="checkbox" checked={selectedUnits.has(u.unit_id)} onChange={() => toggleUnit(u.unit_id)} className="h-4 w-4 rounded border-gray-300 text-emerald-600" />
                    <span className="font-medium text-gray-900 w-16">{u.unit_number}</span>
                    <span className="text-gray-500">{u.owner_name ?? 'Vacant'}</span>
                    <span className="ml-auto text-gray-400 text-xs">Dues: {money(u.current_dues)}</span>
                  </label>
                ))}
              </div>
            )}
          <p className="mt-2 text-xs text-gray-500">{selectedUnits.size} of {units.length} selected</p>
        </div>
      )}

      {selectedAssoc && units.length > 0 && (
        <div className="rounded border border-gray-200 bg-white p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-950">3. Charge Details</h3>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Charge Category *</label>
            <select value={categoryId} onChange={(e) => {
              setCategoryId(e.target.value);
              const cat = categories.find((c) => c.id === e.target.value);
              if (cat?.default_amount) setAmount(String(cat.default_amount));
              if (cat?.default_frequency) setFrequency(cat.default_frequency);
            }} className="h-10 w-full max-w-md rounded border border-gray-300 bg-white px-3 text-sm">
              <option value="">Select category...</option>
              {assessmentCategories.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.code})</option>))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Amount per Unit ($)</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="h-10 w-full rounded border border-gray-300 px-3 text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)}
                className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="semi_annual">Semi-Annual</option>
                <option value="one_time">One-Time</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="h-10 w-full rounded border border-gray-300 px-3 text-sm" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Memo</label>
            <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)}
              className="h-10 w-full rounded border border-gray-300 px-3 text-sm" placeholder="Assessment increase memo..." />
          </div>

          <div className="rounded border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">Preview</span>
              <span className="text-sm tabular-nums text-blue-900">
                {selectedUnits.size} units × {money(parseFloat(amount) || 0)}/{frequency} = {money(previewTotal)}/{frequency}
              </span>
            </div>
          </div>

          {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <button onClick={handleSubmit} disabled={sending || selectedUnits.size === 0 || !categoryId}
            className="rounded bg-gray-950 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
            {sending ? 'Creating...' : `Create ${selectedUnits.size} Recurring Charge${selectedUnits.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
