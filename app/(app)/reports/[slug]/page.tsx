import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Workspace, WorkspaceHeader, Section, Tile } from '@/components/reports/workspace';
import { Button } from '@/components/ui/button';
import { queueReport } from '@/lib/rpcs/reports';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Category labels for the breadcrumb eyebrow
const CATEGORY_LABELS: Record<string, string> = {
  accounting:    'Accounting',
  association:   'Association & HOA',
  property_unit: 'Property & units',
  people:        'People',
  maintenance:   'Maintenance',
  compliance:    'Compliance',
  communication: 'Communication',
};

export default async function ReportView({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preset?: string; from?: string; to?: string; association?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: def } = await supabase
    .from('report_definitions')
    .select('id, slug, name, category, description, output_formats')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();

  if (!def) notFound();

  const [{ data: runs }, { data: associations }] = await Promise.all([
    supabase.from('report_runs')
      .select('id, status, output_format, output_url, row_count, duration_ms, created_at')
      .eq('definition_id', def.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('associations')
      .select('id, name, created_at')
      .is('archived_at', null)
      .order('name'),
  ]);

  // Compute default period from preset
  const period = computePeriod(sp.preset ?? 'this_month', sp.from, sp.to);

  const ctx = {
    def,
    runs: runs ?? [],
    associations: associations ?? [],
    period,
    selectedAssociation: sp.association ?? '',
    selectedPreset: sp.preset ?? 'this_month',
  };

  if (def.slug === 'ar_aging') {
    return <ARAgingView {...ctx} />;
  }
  return <QueuedReportView {...ctx} />;
}

// ---------- period presets ----------
type Period = { from: string; to: string; label: string };

function computePeriod(preset: string, customFrom?: string, customTo?: string): Period {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const firstOfMonth = (y: number, m: number) => new Date(y, m, 1);
  const lastOfMonth  = (y: number, m: number) => new Date(y, m + 1, 0);

  if (preset === 'custom') {
    return {
      from:  customFrom ?? fmt(firstOfMonth(today.getFullYear(), today.getMonth())),
      to:    customTo   ?? fmt(today),
      label: 'Custom',
    };
  }
  if (preset === 'last_month') {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { from: fmt(firstOfMonth(d.getFullYear(), d.getMonth())), to: fmt(lastOfMonth(d.getFullYear(), d.getMonth())), label: 'Last month' };
  }
  if (preset === 'this_quarter') {
    const q = Math.floor(today.getMonth() / 3) * 3;
    return { from: fmt(firstOfMonth(today.getFullYear(), q)), to: fmt(today), label: 'This quarter' };
  }
  if (preset === 'last_quarter') {
    const q = Math.floor(today.getMonth() / 3) * 3 - 3;
    const y = q < 0 ? today.getFullYear() - 1 : today.getFullYear();
    const m = (q + 12) % 12;
    return { from: fmt(firstOfMonth(y, m)), to: fmt(lastOfMonth(y, m + 2)), label: 'Last quarter' };
  }
  if (preset === 'ytd') {
    return { from: fmt(new Date(today.getFullYear(), 0, 1)), to: fmt(today), label: 'Year to date' };
  }
  if (preset === 'last_year') {
    return { from: fmt(new Date(today.getFullYear() - 1, 0, 1)), to: fmt(new Date(today.getFullYear() - 1, 11, 31)), label: 'Last year' };
  }
  // default: this_month
  return { from: fmt(firstOfMonth(today.getFullYear(), today.getMonth())), to: fmt(today), label: 'This month' };
}

// ============================================================================
// LIVE VIEW â€” A/R Aging (renders aged_receivables inline)
// ============================================================================
async function ARAgingView({
  def, runs, associations, period, selectedAssociation, selectedPreset,
}: {
  def: any; runs: any[]; associations: any[]; period: Period;
  selectedAssociation: string; selectedPreset: string;
}) {
  const supabase = await createClient();

  let q = supabase.from('aged_receivables').select('*').order('due_date');
  if (selectedAssociation) q = q.eq('association_id', selectedAssociation);
  const { data: rows } = await q;
  const assocs = associations;

  const BUCKETS = ['current', '1-30', '31-60', '61-90', '90+'];
  const totals: Record<string, { count: number; amount: number }> = {};
  for (const b of BUCKETS) totals[b] = { count: 0, amount: 0 };
  for (const r of (rows ?? []) as any[]) {
    const b = r.aging_bucket in totals ? r.aging_bucket : '90+';
    totals[b].count += 1;
    totals[b].amount += Number(r.balance_due ?? 0);
  }
  const grand = Object.values(totals).reduce((s, v) => s + v.amount, 0);
  const pastDue = grand - totals['current'].amount;
  const distinctUnits = new Set((rows ?? []).map((r: any) => r.unit_id)).size;

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/reports" className="hover:text-brand-600">Reports</Link>
              {' Â· '}
              <span className="text-gray-400">{CATEGORY_LABELS[def.category] ?? def.category}</span>
              {' Â· '}
              <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold uppercase text-green-700">live</span>
            </>
          }
          title={def.name}
          subtitle={def.description}
        />
      }
      rail={<RightRail def={def} runs={runs} associations={associations} period={period} selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} isLive />}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {BUCKETS.map((b) => (
          <Tile
            key={b}
            label={b === 'current' ? 'Current' : `${b} days`}
            value={money(totals[b].amount)}
            sub={`${totals[b].count} ${totals[b].count === 1 ? 'charge' : 'charges'}`}
            tone={b === 'current' ? 'positive' : totals[b].amount > 0 ? (b === '90+' ? 'danger' : 'warning') : 'neutral'}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Tile label="Total outstanding" value={money(grand)}     tone={grand > 0 ? 'danger' : 'positive'} />
        <Tile label="Past due (30d+)"    value={money(pastDue)}   tone={pastDue > 0 ? 'danger' : 'positive'} />
        <Tile label="Units with balance" value={distinctUnits} />
        <Tile label="Open charges"       value={(rows ?? []).length} />
      </div>

      <Section
        title="Open charges"
        subtitle="Every receivable with a positive balance"
        actions={
          <select
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-brand-500 focus:outline-none"
            defaultValue=""
          >
            <option value="">All associations</option>
            {(assocs ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        }
      >
        {(rows ?? []).length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">No open receivables. All units paid up.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-5 py-2 text-left font-semibold">Unit</th>
                  <th className="px-4 py-2 text-left font-semibold">Description</th>
                  <th className="px-4 py-2 text-left font-semibold">Due</th>
                  <th className="px-4 py-2 text-left font-semibold">Bucket</th>
                  <th className="px-4 py-2 text-right font-semibold">Charged</th>
                  <th className="px-4 py-2 text-right font-semibold">Paid</th>
                  <th className="px-5 py-2 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r: any) => (
                  <tr key={r.charge_id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-2">
                      <div className="font-medium text-gray-900">Unit {r.unit_number}</div>
                      <div className="text-xs text-gray-500">{r.association_name}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{r.description}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{date(r.due_date)}</td>
                    <td className="px-4 py-2"><BucketPill bucket={r.aging_bucket} /></td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{money(r.amount)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-500">{money(r.total_paid)}</td>
                    <td className="px-5 py-2 text-right font-semibold tabular-nums text-gray-900">{money(r.balance_due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Workspace>
  );
}

function BucketPill({ bucket }: { bucket: string }) {
  const m: Record<string, string> = {
    current: 'bg-green-100 text-green-700',
    '1-30':  'bg-yellow-100 text-yellow-800',
    '31-60': 'bg-orange-100 text-orange-800',
    '61-90': 'bg-red-100 text-red-800',
    '90+':   'bg-red-200 text-red-900',
  };
  const cls = m[bucket] ?? m['90+'];
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{bucket === 'current' ? 'current' : `${bucket}d`}</span>;
}

// ============================================================================
// QUEUED REPORT VIEW â€” Run form + recent runs for this definition
// ============================================================================
function QueuedReportView({
  def, runs, associations, period, selectedAssociation, selectedPreset,
}: {
  def: any; runs: any[]; associations: any[]; period: Period;
  selectedAssociation: string; selectedPreset: string;
}) {
  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/reports" className="hover:text-brand-600">Reports</Link>
              {' Â· '}
              <span className="text-gray-400">{CATEGORY_LABELS[def.category] ?? def.category}</span>
            </>
          }
          title={def.name}
          subtitle={def.description}
        />
      }
      rail={<RightRail def={def} runs={runs} associations={associations} period={period} selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} />}
    >
      <Section title="About this report">
        <div className="px-5 py-4 text-sm leading-6 text-gray-700">
          <p>{def.description}</p>
          <p className="mt-3 text-xs text-gray-500">
            Available formats:
            <span className="ml-2 inline-flex gap-1">
              {(def.output_formats ?? []).map((f: string) => (
                <span key={f} className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] uppercase text-gray-700">{f}</span>
              ))}
            </span>
          </p>
        </div>
      </Section>

      <Section title="Recent runs" subtitle={`Last ${runs.length} for this report`}>
        {runs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">
            No runs yet. Use the panel on the right to run this report.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Created</th>
                <th className="px-4 py-2 text-left font-semibold">Format</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">Rows</th>
                <th className="px-5 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r: any) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-2 text-gray-700">{date(r.created_at)}</td>
                  <td className="px-4 py-2 text-xs uppercase text-gray-500">{r.output_format}</td>
                  <td className="px-4 py-2"><RunPill status={r.status} /></td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">{r.row_count?.toLocaleString() ?? 'â€”'}</td>
                  <td className="px-5 py-2 text-right">
                    <Link href={`/reports/runs/${r.id}`} className="text-xs text-brand-600 hover:underline">
                      {r.status === 'succeeded' ? 'Download' : 'Open'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </Workspace>
  );
}

// ============================================================================
// RIGHT RAIL â€” Run form + quick stats
// ============================================================================
function RightRail({
  def, runs, associations, period, selectedAssociation, selectedPreset, isLive,
}: {
  def: any; runs: any[]; associations: any[]; period: Period;
  selectedAssociation: string; selectedPreset: string; isLive?: boolean;
}) {
  const lastSuccess = runs.find((r: any) => r.status === 'succeeded');
  const inFlight = runs.find((r: any) => r.status === 'queued' || r.status === 'running');

  const presets: Array<{ k: string; label: string }> = [
    { k: 'this_month',   label: 'This month' },
    { k: 'last_month',   label: 'Last month' },
    { k: 'this_quarter', label: 'This quarter' },
    { k: 'last_quarter', label: 'Last quarter' },
    { k: 'ytd',          label: 'Year to date' },
    { k: 'last_year',    label: 'Last year' },
    { k: 'custom',       label: 'Custom' },
  ];

  const presetHref = (k: string) => {
    const p = new URLSearchParams();
    p.set('preset', k);
    if (selectedAssociation) p.set('association', selectedAssociation);
    return `?${p.toString()}`;
  };

  return (
    <>
      <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {isLive ? 'Export snapshot' : 'Run this report'}
      </div>

      <form action={queueReport as any} className="space-y-3">
        <input type="hidden" name="definition_id" value={def.id} />

        {/* Association â€” required; each report tied to one association */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Association <span className="text-red-500">*</span>
          </label>
          <select
            name="param_association_id"
            required
            defaultValue={selectedAssociation}
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Selectâ€¦</option>
            {associations.map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Period presets */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Period</label>
          <div className="mb-2 flex flex-wrap gap-1">
            {presets.map((p) => (
              <Link
                key={p.k}
                href={presetHref(p.k)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  selectedPreset === p.k
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[11px] text-gray-500">From</label>
              <input
                type="date"
                name="param_period_from"
                defaultValue={period.from}
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] text-gray-500">To</label>
              <input
                type="date"
                name="param_period_to"
                defaultValue={period.to}
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
              />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            {period.label}: {period.from} â†’ {period.to}
          </p>
        </div>

        {/* Format */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Output format</label>
          <select
            name="output_format"
            defaultValue={def.output_formats?.[0] ?? 'csv'}
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {(def.output_formats ?? ['csv']).map((f: string) => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <Button type="submit" className="w-full">
          {isLive ? 'Export to file' : 'Run now'}
        </Button>
      </form>

      {inFlight && (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          A run is currently <strong>{inFlight.status}</strong>.
          <Link href={`/reports/runs/${inFlight.id}`} className="ml-1 font-semibold hover:underline">View â†’</Link>
        </div>
      )}

      {lastSuccess && (
        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Latest output</div>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
            <div className="font-mono uppercase text-gray-500">{lastSuccess.output_format}</div>
            <div className="mt-1 text-gray-700">{date(lastSuccess.created_at)}</div>
            <div className="mt-1 tabular-nums text-gray-700">{lastSuccess.row_count?.toLocaleString()} rows</div>
            {lastSuccess.output_url && (
              <a href={lastSuccess.output_url} target="_blank" rel="noopener"
                className="mt-2 inline-block text-brand-600 hover:underline">
                Download â†’
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Recent runs</div>
        {runs.length === 0 ? (
          <p className="text-xs text-gray-500">No runs yet.</p>
        ) : (
          <ul className="space-y-1">
            {runs.slice(0, 5).map((r: any) => (
              <li key={r.id}>
                <Link href={`/reports/runs/${r.id}`}
                  className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-gray-100">
                  <span className="text-gray-600">{date(r.created_at)}</span>
                  <RunPill status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function RunPill({ status }: { status: string }) {
  const m: Record<string, string> = {
    queued:    'bg-gray-100 text-gray-600',
    running:   'bg-blue-100 text-blue-700',
    succeeded: 'bg-green-100 text-green-700',
    failed:    'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-400 line-through',
  };
  return <span className={`rounded px-2 py-0.5 text-[10px] font-medium capitalize ${m[status] ?? m.queued}`}>{status}</span>;
}
