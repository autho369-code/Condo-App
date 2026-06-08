'use client';

import { useState } from 'react';
import Link from 'next/link';
import { bulkUpdateStatementSettings } from '@/lib/rpcs/bulk-operations';

interface AssocSettings {
  id: string;
  name: string;
  use_enhanced_statement: boolean;
  include_current_and_upcoming_charges: boolean;
  include_upcoming_in_amount_due: boolean;
  upcoming_charges_timeframe: string | null;
  include_current_message_on_statement: boolean;
  include_logo_on_statement: boolean;
  charge_history_includes: string | null;
  include_payments_due_date: boolean;
  include_payments_history_and_balance_forward: boolean;
  show_remaining_amount_for_past_due_charges: boolean;
  include_payment_coupon_on_statement: boolean;
}

const BOOL_FIELDS: Array<{ key: keyof AssocSettings; label: string; description: string }> = [
  { key: 'use_enhanced_statement', label: 'Enhanced Statement', description: 'Include detailed breakdown of charges and payments' },
  { key: 'include_current_and_upcoming_charges', label: 'Current & Upcoming Charges', description: 'Show charges from the current period and next period' },
  { key: 'include_upcoming_in_amount_due', label: 'Include Upcoming in Amount Due', description: 'Include next period charges in the total amount due' },
  { key: 'include_current_message_on_statement', label: 'Current Message', description: 'Include a custom message on the statement' },
  { key: 'include_logo_on_statement', label: 'Association Logo', description: 'Display association logo on statement header' },
  { key: 'include_payments_due_date', label: 'Payment Due Date', description: 'Show payment due date on statements' },
  { key: 'include_payments_history_and_balance_forward', label: 'Payment History', description: 'Include payment history and balance forward' },
  { key: 'show_remaining_amount_for_past_due_charges', label: 'Past Due Remaining', description: 'Show remaining amount on past-due charges' },
  { key: 'include_payment_coupon_on_statement', label: 'Payment Coupon', description: 'Include a detachable payment coupon' },
];

export function BulkStatementSettingsForm({ associations }: { associations: AssocSettings[] }) {
  const [selectedAssocs, setSelectedAssocs] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Record<string, boolean | string>>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleAssoc(id: string) { setSelectedAssocs((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function selectAll() { setSelectedAssocs(new Set(associations.map((a) => a.id))); }
  function clearAll() { setSelectedAssocs(new Set()); }

  function toggleSetting(key: string) {
    setSettings((p) => {
      const n = { ...p };
      if (key in n) { delete n[key]; }
      else { n[key] = true; }
      return n;
    });
  }

  function setTimeframe(val: string) { setSettings((p) => ({ ...p, upcoming_charges_timeframe: val })); }
  function setChargeHistory(val: string) { setSettings((p) => ({ ...p, charge_history_includes: val })); }

  const changedCount = Object.keys(settings).length;

  async function handleSubmit() {
    if (selectedAssocs.size === 0) { setError('Select at least one association'); return; }
    if (changedCount === 0) { setError('Select at least one setting to update'); return; }
    setSending(true); setError(null);
    const fd = new FormData();
    for (const id of selectedAssocs) fd.append('association_ids', id);
    for (const [k, v] of Object.entries(settings)) fd.set(k, String(v));
    try {
      const r = await bulkUpdateStatementSettings(fd);
      if (r.error) setError(r.error);
      else setResult(r);
    } catch (e: any) { setError(e.message || 'Failed'); }
    setSending(false);
  }

  if (result) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="text-4xl mb-3">&#10003;</div>
        <h3 className="text-lg font-semibold text-emerald-800">Settings Updated</h3>
        <p className="mt-2 text-sm text-emerald-700">
          {result.updated_count} association{result.updated_count !== 1 ? 's' : ''} updated with {changedCount} setting{changedCount !== 1 ? 's' : ''}.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <button onClick={() => { setResult(null); setSettings({}); }} className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700">Update More</button>
          <Link href="/reports" className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Back to Reports</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-950">1. Select Associations</h3>
            <p className="mt-0.5 text-xs text-gray-500">Choose which associations to update</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={selectAll} className="text-xs text-emerald-600 hover:underline">Select all</button>
            <button type="button" onClick={clearAll} className="text-xs text-gray-400 hover:underline">Clear</button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {associations.map((a) => (
            <label key={a.id} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-gray-50 ${selectedAssocs.has(a.id) ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
              <input type="checkbox" checked={selectedAssocs.has(a.id)} onChange={() => toggleAssoc(a.id)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600" />
              <span className="text-gray-900 truncate">{a.name}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">{selectedAssocs.size} association{selectedAssocs.size !== 1 ? 's' : ''} selected</p>
      </div>

      <div className="rounded border border-gray-200 bg-white p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-950">2. Statement Settings</h3>
        <p className="text-xs text-gray-500">Changes apply only to the selected associations. Unchanged settings keep their current value.</p>

        {/* Boolean toggles */}
        <div className="space-y-2">
          {BOOL_FIELDS.map(({ key, label, description }) => (
            <label key={key} className={`flex cursor-pointer items-start gap-3 rounded border p-3 hover:bg-gray-50 ${key in settings ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
              <input type="checkbox" checked={key in settings} onChange={() => toggleSetting(key)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600" />
              <div>
                <span className="text-sm font-medium text-gray-900">{label}</span>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Timeframe dropdown */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Upcoming Charges Timeframe</label>
          <select onChange={(e) => e.target.value ? setTimeframe(e.target.value) : setSettings((p) => { const n = {...p}; delete n.upcoming_charges_timeframe; return n; })}
            className="h-10 w-full max-w-xs rounded border border-gray-300 bg-white px-3 text-sm"
            value={(settings.upcoming_charges_timeframe as string) ?? ''}>
            <option value="">No change</option>
            <option value="next_month">Next Month</option>
            <option value="next_quarter">Next Quarter</option>
            <option value="next_year">Next Year</option>
          </select>
        </div>

        {/* Charge history dropdown */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Charge History Includes</label>
          <select onChange={(e) => e.target.value ? setChargeHistory(e.target.value) : setSettings((p) => { const n = {...p}; delete n.charge_history_includes; return n; })}
            className="h-10 w-full max-w-xs rounded border border-gray-300 bg-white px-3 text-sm"
            value={(settings.charge_history_includes as string) ?? ''}>
            <option value="">No change</option>
            <option value="all_past_due_charges">All Past Due Charges</option>
            <option value="current_and_past_due">Current and Past Due</option>
            <option value="all_charges">All Charges</option>
          </select>
        </div>

        <div className="rounded border border-blue-200 bg-blue-50 p-4">
          <span className="text-sm font-medium text-blue-800">{changedCount} setting{changedCount !== 1 ? 's' : ''} will be updated across {selectedAssocs.size} association{selectedAssocs.size !== 1 ? 's' : ''}</span>
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <button onClick={handleSubmit} disabled={sending || selectedAssocs.size === 0 || changedCount === 0}
          className="rounded bg-gray-950 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
          {sending ? 'Updating...' : `Update ${selectedAssocs.size} Association${selectedAssocs.size !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
