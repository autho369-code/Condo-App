import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Workspace, WorkspaceHeader, Section } from '@/components/reports/workspace';
import { cancelReportRun } from '@/lib/rpcs/reports';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ReportRunsHistory() {
  const supabase = await createClient();

  const { data: runs } = await (supabase as any)
    .from('report_runs')
    .select(`
      id, status, output_format, output_url, output_size_bytes, row_count,
      duration_ms, started_at, finished_at, created_at,
      report_definitions(slug, name, category)
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  const byStatus = (s: string) => (runs ?? []).filter((r: any) => r.status === s).length;

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={<Link href="/reports" className="hover:text-brand-600">Reports</Link>}
          title="Run history"
          subtitle={`Last ${runs?.length ?? 0} runs across all reports`}
        />
      }
      rail={
        <>
          <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Summary</div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
              <span className="text-slate-400">Succeeded</span>
              <span className="font-semibold tabular-nums text-green-700">{byStatus('succeeded')}</span>
            </li>
            <li className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
              <span className="text-slate-400">Running</span>
              <span className="font-semibold tabular-nums text-blue-700">{byStatus('running')}</span>
            </li>
            <li className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
              <span className="text-slate-400">Queued</span>
              <span className="font-semibold tabular-nums text-gray-700">{byStatus('queued')}</span>
            </li>
            <li className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
              <span className="text-slate-400">Failed</span>
              <span className="font-semibold tabular-nums text-red-700">{byStatus('failed')}</span>
            </li>
            <li className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
              <span className="text-slate-400">Cancelled</span>
              <span className="font-semibold tabular-nums text-slate-400">{byStatus('cancelled')}</span>
            </li>
          </ul>
        </>
      }
    >
      <Section title="Runs" subtitle="Click a row for full details, download link, or to cancel an in-flight job">
        {runs && runs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2 text-left font-semibold">Report</th>
                  <th className="px-4 py-2 text-left font-semibold">Format</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-right font-semibold">Rows</th>
                  <th className="px-4 py-2 text-right font-semibold">Duration</th>
                  <th className="px-4 py-2 text-left font-semibold">Started</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r: any) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-2">
                      <Link href={`/reports/runs/${r.id}`} className="font-medium text-gray-900 hover:text-brand-600 hover:underline">
                        {r.report_definitions?.name ?? 'Unknown'}
                      </Link>
                      <div className="text-xs text-slate-400 capitalize">{r.report_definitions?.category?.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="px-4 py-2 text-xs uppercase text-slate-400">{r.output_format}</td>
                    <td className="px-4 py-2"><StatusPill status={r.status} /></td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{r.row_count?.toLocaleString() ?? 'â€”'}</td>
                    <td className="px-4 py-2 text-right text-slate-400">{formatDuration(r.duration_ms)}</td>
                    <td className="px-4 py-2 text-slate-400">{date(r.started_at ?? r.created_at)}</td>
                    <td className="whitespace-nowrap px-5 py-2 text-right">
                      {r.status === 'succeeded' && r.output_url && (
                        <a href={r.output_url} target="_blank" rel="noopener" className="text-xs text-brand-600 hover:underline">Download</a>
                      )}
                      {(r.status === 'queued' || r.status === 'running') && (
                        <form action={cancelReportRun.bind(null, r.id) as any} className="inline">
                          <button type="submit" className="text-xs text-red-600 hover:underline">Cancel</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-400">No runs yet.</p>
            <Link href="/reports" className="mt-2 inline-block text-sm text-brand-600 hover:underline">Run your first report â†’</Link>
          </div>
        )}
      </Section>
    </Workspace>
  );
}

function StatusPill({ status }: { status: string }) {
  const m: Record<string, string> = {
    queued:    'bg-gray-100 text-slate-400',
    running:   'bg-blue-100 text-blue-700',
    succeeded: 'bg-green-100 text-green-700',
    failed:    'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-400 line-through',
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${m[status] ?? m.queued}`}>{status}</span>;
}

function formatDuration(ms: number | null) {
  if (!ms) return 'â€”';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const min = Math.floor(s / 60);
  return `${min}m ${Math.round(s % 60)}s`;
}
