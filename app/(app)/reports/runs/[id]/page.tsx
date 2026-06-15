import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Workspace, WorkspaceHeader, Section } from '@/components/reports/workspace';
import { Button } from '@/components/ui/button';
import { cancelReportRun } from '@/lib/rpcs/reports';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportRunDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: run } = await (supabase as any)
    .from('report_runs')
    .select('*, report_definitions(id, slug, name, category, description)')
    .eq('id', id)
    .maybeSingle();

  if (!run) notFound();
  const def = run.report_definitions as any;
  const isInFlight = run.status === 'queued' || run.status === 'running';

  return (
    <Workspace
      header={
        <>
          {isInFlight && <meta httpEquiv="refresh" content="3" />}
          <WorkspaceHeader
            eyebrow={
              <>
                <Link href="/reports" className="transition-colors hover:text-gray-700">Reports</Link>
                {' · '}
                <Link href="/reports/runs" className="transition-colors hover:text-gray-700">Run history</Link>
              </>
            }
            title={def?.name ?? 'Report run'}
            subtitle={def?.description}
            actions={
              run.status === 'succeeded' && run.output_url ? (
                <a href={run.output_url} target="_blank" rel="noopener">
                  <Button>Download {run.output_format?.toUpperCase()}</Button>
                </a>
              ) : isInFlight ? (
                <form action={cancelReportRun.bind(null, run.id) as any}>
                  <Button type="submit" variant="secondary" size="sm">Cancel run</Button>
                </form>
              ) : null
            }
          />
        </>
      }
      rail={
        <>
          <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Details</div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-gray-500">Status</dt>
              <dd className="mt-1"><BigStatusPill status={run.status} /></dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-gray-500">Format</dt>
              <dd className="mt-0.5 font-mono uppercase text-gray-800">{run.output_format}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-gray-500">Created</dt>
              <dd className="mt-0.5 text-gray-800">{date(run.created_at)}</dd>
            </div>
            {run.started_at && (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-gray-500">Started</dt>
                <dd className="mt-0.5 text-gray-800">{date(run.started_at)}</dd>
              </div>
            )}
            {run.finished_at && (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-gray-500">Finished</dt>
                <dd className="mt-0.5 text-gray-800">{date(run.finished_at)}</dd>
              </div>
            )}
            {run.duration_ms !== null && (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-gray-500">Duration</dt>
                <dd className="mt-0.5 tabular-nums text-gray-800">{formatDuration(run.duration_ms)}</dd>
              </div>
            )}
            {run.row_count !== null && (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-gray-500">Rows</dt>
                <dd className="mt-0.5 tabular-nums text-gray-800">{run.row_count?.toLocaleString()}</dd>
              </div>
            )}
            {run.output_size_bytes !== null && (
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-gray-500">Size</dt>
                <dd className="mt-0.5 tabular-nums text-gray-800">{formatBytes(run.output_size_bytes)}</dd>
              </div>
            )}
          </dl>

          {isInFlight && (
            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              Auto-refreshing every 3 seconds.
            </div>
          )}
        </>
      }
    >
      {sp.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Something went wrong:</span> {sp.error}
        </div>
      )}

      <Section title="Summary">
        <div className="px-5 py-4">
          <p className="text-sm text-gray-700">
            {run.status === 'queued' && 'Waiting for the report worker to pick up this job.'}
            {run.status === 'running' && 'The report worker is generating your output.'}
            {run.status === 'succeeded' && `Completed in ${formatDuration(run.duration_ms)}. Output ready to download.`}
            {run.status === 'failed' && 'This run failed — see the error below.'}
            {run.status === 'cancelled' && 'Cancelled before completion.'}
          </p>
        </div>
      </Section>

      {run.error_message && (
        <Section title="Error">
          <pre className="overflow-x-auto whitespace-pre-wrap px-5 py-4 text-xs text-red-800">
            {run.error_message}
          </pre>
        </Section>
      )}

      {run.parameters && Object.keys(run.parameters).length > 0 && (
        <Section title="Parameters">
          <pre className="overflow-x-auto px-5 py-4 text-xs text-gray-800">
            {JSON.stringify(run.parameters, null, 2)}
          </pre>
        </Section>
      )}
    </Workspace>
  );
}

function BigStatusPill({ status }: { status: string }) {
  const m: Record<string, string> = {
    queued:    'bg-gray-100 text-gray-700 ring-gray-500/15',
    running:   'bg-blue-50 text-blue-700 ring-blue-600/15',
    succeeded: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    failed:    'bg-red-50 text-red-700 ring-red-600/15',
    cancelled: 'bg-gray-100 text-gray-500 ring-gray-500/15',
  };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold capitalize ring-1 ring-inset ${m[status] ?? m.queued}`}>{status}</span>;
}

function formatDuration(ms: number | null) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
