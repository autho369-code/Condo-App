'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendOwnerStatements } from '@/lib/rpcs/bulk-operations';

interface Association { id: string; name: string; }

export function SendStatementsForm({ associations }: { associations: Association[] }) {
  const [assocId, setAssocId] = useState<string>('');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [batchName, setBatchName] = useState<string>('');
  const [deliveryChannel, setDeliveryChannel] = useState<string>('email');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewOwners, setPreviewOwners] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function loadPreview() {
    if (!assocId) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/bulk/units?association_id=${assocId}`);
      const data = await res.json();
      setPreviewOwners(data.units ?? []);
    } catch { setPreviewOwners([]); }
    setPreviewLoading(false);
  }

  async function handleSubmit() {
    if (!assocId) { setError('Select an association'); return; }
    if (!periodStart || !periodEnd) { setError('Set both start and end dates'); return; }
    setSending(true); setError(null);
    const fd = new FormData();
    fd.set('association_id', assocId);
    fd.set('period_start', periodStart);
    fd.set('period_end', periodEnd);
    fd.set('delivery_channel', deliveryChannel);
    if (batchName) fd.set('batch_name', batchName);
    try {
      const r = await sendOwnerStatements(fd);
      if (r.error) setError(r.error);
      else setResult(r);
    } catch (e: any) { setError(e.message || 'Failed'); }
    setSending(false);
  }

  if (result) {
    return (
      <div className="max-w-4xl rounded-2xl border border-gray-200/70 bg-white p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl text-emerald-600">&#10003;</div>
        <h3 className="text-[15px] font-semibold text-gray-950">Statements generated</h3>
        <p className="mt-1 text-sm text-gray-500">
          Statement batch created for {associations.find((a) => a.id === assocId)?.name}.
        </p>
        <p className="mt-1 text-xs text-gray-400">Batch ID: {result.batch_id}</p>
        <p className="mt-1 text-xs text-gray-400">Period: {periodStart} to {periodEnd}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { setResult(null); }} className="h-10 rounded-lg bg-gray-950 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800">Send another batch</button>
          <Link href="/reports" className="inline-flex h-10 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50">Back to reports</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="space-y-4 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h3 className="text-sm font-semibold text-gray-950">Statement Generation</h3>
        <p className="text-xs text-gray-500">Statements are generated for all current owners in the selected association. Each statement includes current charges, past-due amounts, and payment history for the selected period.</p>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Association *</label>
          <select value={assocId} onChange={(e) => { setAssocId(e.target.value); setPreviewOwners([]); }}
            className="h-10 w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
            <option value="">Choose an association...</option>
            {associations.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Period Start *</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Period End *</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Batch Name (optional)</label>
          <input type="text" value={batchName} onChange={(e) => setBatchName(e.target.value)}
            className="h-10 w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="e.g., June 2026 Monthly Statements" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Delivery Channel</label>
          <div className="flex gap-4 mt-1">
            {(['email', 'print', 'portal'] as const).map((ch) => (
              <label key={ch} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="channel" value={ch} checked={deliveryChannel === ch} onChange={() => setDeliveryChannel(ch)}
                  className="h-4 w-4 text-blue-600" />
                <span className="text-gray-700 capitalize">{ch}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Preview owners button */}
        {assocId && (
          <div>
            <button type="button" onClick={loadPreview} disabled={previewLoading}
              className="text-sm font-medium text-gray-600 hover:text-gray-950 hover:underline disabled:opacity-50">
              {previewLoading ? 'Loading...' : 'Preview owners in this association'}
            </button>
            {previewOwners.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-100">
                {previewOwners.map((o) => (
                  <div key={o.unit_id} className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm">
                    <span className="font-medium w-16">{o.unit_number}</span>
                    <span className="text-gray-600">{o.owner_name ?? 'Vacant'}</span>
                    <span className="ml-auto text-gray-400 text-xs">Dues: ${o.current_dues}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {previewOwners.length > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <span className="text-sm font-medium text-blue-800">{previewOwners.length} owner{previewOwners.length !== 1 ? 's' : ''} will receive statements</span>
          </div>
        )}

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <button onClick={handleSubmit} disabled={sending || !assocId || !periodStart || !periodEnd}
          className="h-10 rounded-lg bg-gray-950 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
          {sending ? 'Generating...' : 'Generate & Send Statements'}
        </button>
      </div>
    </div>
  );
}
