'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { queueBulkReports } from '@/lib/rpcs/bulk-operations';

interface Association { id: string; name: string; }
interface Report { slug: string; name: string; description: string; category: string; }

export function BulkReportsForm({
  associations,
  reports,
}: {
  associations: Association[];
  reports: Report[];
}) {
  const [selectedAssocs, setSelectedAssocs] = useState<Set<string>>(new Set());
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<string>('csv');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Report[]>();
    for (const r of reports) {
      const g = map.get(r.category) || [];
      g.push(r);
      map.set(r.category, g);
    }
    return Array.from(map.entries());
  }, [reports]);

  function toggleAssoc(id: string) { setSelectedAssocs((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleReport(slug: string) { setSelectedReports((p) => { const n = new Set(p); n.has(slug) ? n.delete(slug) : n.add(slug); return n; }); }
  function selectAllAssocs() { setSelectedAssocs(new Set(associations.map((a) => a.id))); }
  function selectAllReports() { setSelectedReports(new Set(reports.map((r) => r.slug))); }
  function clearAssocs() { setSelectedAssocs(new Set()); }
  function clearReports() { setSelectedReports(new Set()); }

  const totalRuns = selectedAssocs.size * selectedReports.size;

  async function handleSubmit() {
    if (selectedAssocs.size === 0) { setError('Select at least one association'); return; }
    if (selectedReports.size === 0) { setError('Select at least one report'); return; }
    setSending(true); setError(null);
    const fd = new FormData();
    for (const a of selectedAssocs) fd.append('association_ids', a);
    for (const s of selectedReports) fd.append('report_slugs', s);
    if (dateStart) fd.set('date_start', dateStart);
    if (dateEnd) fd.set('date_end', dateEnd);
    fd.set('output_format', outputFormat);
    try {
      const r = await queueBulkReports(fd);
      if (r.error) setError(r.error);
      else setResult(r);
    } catch (e: any) { setError(e.message || 'Failed'); }
    setSending(false);
  }

  if (result) {
    return (
      <div className="max-w-4xl rounded-2xl border border-gray-200/70 bg-white p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl text-emerald-600">&#10003;</div>
        <h3 className="text-[15px] font-semibold text-gray-950">Reports queued</h3>
        <p className="mt-1 text-sm text-gray-500">
          {result.count} report{result.count !== 1 ? 's' : ''} queued across {selectedAssocs.size} association{selectedAssocs.size !== 1 ? 's' : ''}
          ({selectedReports.size} report type{selectedReports.size !== 1 ? 's' : ''}).
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { setResult(null); }} className="h-10 rounded-lg bg-gray-950 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800">Queue another batch</button>
          <Link href="/reports" className="inline-flex h-10 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50">Back to reports</Link>
          <Link href="/reports/runs" className="inline-flex h-10 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50">View runs</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-950">1. Select Reports</h3>
            <p className="mt-0.5 text-xs text-gray-500">Choose which reports to generate</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={selectAllReports} className="text-xs font-medium text-gray-600 hover:text-gray-950 hover:underline">Select all</button>
            <button type="button" onClick={clearReports} className="text-xs text-gray-400 hover:underline">Clear</button>
          </div>
        </div>
        {groups.map(([category, items]) => (
          <div key={category} className="mt-3">
            <p className="text-xs font-medium uppercase text-gray-500 mb-1">{category.replace(/_/g, ' ')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((r) => (
                <label key={r.slug} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm hover:bg-gray-50 ${selectedReports.has(r.slug) ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200'}`}>
                  <input type="checkbox" checked={selectedReports.has(r.slug)} onChange={() => toggleReport(r.slug)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600" />
                  <div>
                    <span className="font-medium text-gray-900">{r.name}</span>
                    <p className="text-xs text-gray-500">{r.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
        <p className="mt-3 text-xs text-gray-500">{selectedReports.size} report{selectedReports.size !== 1 ? 's' : ''} selected</p>
      </div>

      <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-950">2. Select Associations</h3>
            <p className="mt-0.5 text-xs text-gray-500">Reports will be generated for each selected association</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={selectAllAssocs} className="text-xs font-medium text-gray-600 hover:text-gray-950 hover:underline">Select all</button>
            <button type="button" onClick={clearAssocs} className="text-xs text-gray-400 hover:underline">Clear</button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {associations.map((a) => (
            <label key={a.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 ${selectedAssocs.has(a.id) ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200'}`}>
              <input type="checkbox" checked={selectedAssocs.has(a.id)} onChange={() => toggleAssoc(a.id)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600" />
              <span className="text-gray-900 truncate">{a.name}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">{selectedAssocs.size} association{selectedAssocs.size !== 1 ? 's' : ''} selected</p>
      </div>

      <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-4">
        <h3 className="text-sm font-semibold text-gray-950">3. Options</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Date Range Start</label>
            <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Date Range End</label>
            <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Output Format</label>
            <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel</option>
              <option value="html">HTML</option>
              <option value="json">JSON</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">Summary</span>
            <span className="text-sm tabular-nums text-blue-900">
              {selectedReports.size} report type{selectedReports.size !== 1 ? 's' : ''} × {selectedAssocs.size} association{selectedAssocs.size !== 1 ? 's' : ''} = {totalRuns} total run{totalRuns !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <button onClick={handleSubmit} disabled={sending || totalRuns === 0}
          className="h-10 rounded-lg bg-gray-950 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
          {sending ? 'Queueing...' : `Queue ${totalRuns} Report${totalRuns !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
