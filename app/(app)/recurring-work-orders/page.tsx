import Link from 'next/link';
import { Plus, Repeat } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ── Types ──
type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'quarterly', 'annually'];

function formatFrequency(freq: string, count: number): string {
  if (count > 1) return `Every ${count} ${freq}s`;
  return freq.charAt(0).toUpperCase() + freq.slice(1);
}

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveStatus(r: any): { label: string; tone: Tone } {
  if (r.end_date && new Date(r.end_date) < new Date()) {
    return { label: 'Ended', tone: 'neutral' };
  }
  if (r.auto_generate) {
    return { label: 'Active', tone: 'success' };
  }
  return { label: 'Paused', tone: 'warning' };
}

// ── Page ──
export default async function RecurringWorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; frequency?: string; association_id?: string; status?: string }>;
}) {
  await requireStaff();
  const { q = '', frequency = '', association_id = '', status = '' } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [
    { data: rows },
    { data: associations },
  ] = await Promise.all([
    db
      .from('recurring_work_orders')
      .select('id, title, trade, priority, frequency, interval_count, next_due_date, last_generated_at, auto_generate, start_date, end_date, association_id, unit_id, vendor_id, associations(name), units(unit_number), vendors(name)')
      .is('archived_at', null)
      .order('next_due_date', { ascending: true, nullsFirst: false })
      .limit(500),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);

  const all = (rows ?? []) as any[];

  // ── Filter ──
  let filtered = all;
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(
      (r: any) =>
        (r.title ?? '').toLowerCase().includes(ql) ||
        (r.vendors?.name ?? '').toLowerCase().includes(ql) ||
        (r.associations?.name ?? '').toLowerCase().includes(ql) ||
        (r.units?.unit_number ?? '').toLowerCase().includes(ql),
    );
  }
  if (frequency) filtered = filtered.filter((r: any) => r.frequency === frequency);
  if (association_id) filtered = filtered.filter((r: any) => r.association_id === association_id);
  if (status === 'active') filtered = filtered.filter((r: any) => r.auto_generate && (!r.end_date || new Date(r.end_date) >= new Date()));
  if (status === 'paused') filtered = filtered.filter((r: any) => !r.auto_generate && (!r.end_date || new Date(r.end_date) >= new Date()));
  if (status === 'ended') filtered = filtered.filter((r: any) => r.end_date && new Date(r.end_date) < new Date());

  // ── Metrics ──
  const now = new Date();
  const activeCount = all.filter((r: any) => r.auto_generate && (!r.end_date || new Date(r.end_date) >= now)).length;
  const pausedCount = all.filter((r: any) => !r.auto_generate && (!r.end_date || new Date(r.end_date) >= now)).length;
  const endedCount = all.filter((r: any) => r.end_date && new Date(r.end_date) < now).length;
  const dueNowCount = all.filter(
    (r: any) => r.next_due_date && new Date(r.next_due_date) <= now && (!r.end_date || new Date(r.end_date) >= now),
  ).length;

  const metrics = [
    { label: 'Active', value: activeCount, sublabel: 'Auto-generating' },
    { label: 'Paused', value: pausedCount, sublabel: 'Manual only' },
    { label: 'Ended', value: endedCount, sublabel: 'Past end date' },
    { label: 'Due now', value: dueNowCount, sublabel: 'Past next due date' },
  ];

  // ── Render ──
  return (
    <DataWorkspace
      title="Recurring Work Orders"
      description="Scheduled maintenance — landscaping, pool service, annual inspections. A nightly cron generates real work orders from these."
      actions={
        <Link href="/recurring-work-orders/new">
          <Button><Plus className="h-4 w-4" /> New recurring work order</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── FILTER BAR ── */}
        <FilterBar
          action="/recurring-work-orders"
          searchDefault={q}
          searchPlaceholder="Search by title, vendor, association, or unit..."
        >
          <FilterSelect label="Frequency" name="frequency" defaultValue={frequency}>
            <option value="">All frequencies</option>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>{formatLabel(f)}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="ended">Ended</option>
          </FilterSelect>

          <FilterSelect label="Association" name="association_id" defaultValue={association_id}>
            <option value="">All</option>
            {(associations ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </FilterSelect>
        </FilterBar>

        {/* ── TABLE ── */}
        {filtered.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Frequency</TH>
                <TH>Association</TH>
                <TH>Next Due</TH>
                <TH>Last Generated</TH>
                <TH>Status</TH>
                <TH className="w-0" />
              </TR>
            </THead>
            <tbody>
              {filtered.map((r: any) => {
                const st = deriveStatus(r);
                return (
                  <TR key={r.id}>
                    <TD className="max-w-xs">
                      <div className="font-medium text-gray-900">{r.title}</div>
                      {r.trade && (
                        <div className="text-xs capitalize text-gray-500">{r.trade.replace(/_/g, ' ')}</div>
                      )}
                      {r.vendors?.name && (
                        <div className="text-xs text-gray-400">{r.vendors.name}</div>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-gray-700">
                      {formatFrequency(r.frequency, r.interval_count)}
                    </TD>
                    <TD className="text-sm text-gray-700">
                      {r.associations?.name ?? '—'}
                      {r.units?.unit_number && (
                        <div className="text-xs text-gray-400">Unit {r.units.unit_number}</div>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-gray-700">{date(r.next_due_date)}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-500">{r.last_generated_at ? date(r.last_generated_at) : 'Never'}</TD>
                    <TD>
                      <StatusChip tone={st.tone}>{st.label}</StatusChip>
                    </TD>
                    <TD className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/recurring-work-orders/${r.id}/edit`}
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          Edit
                        </Link>
                        <form method="POST" action="/api/recurring-work-orders/generate">
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50">
                            Generate now
                          </button>
                        </form>
                        <form method="POST" action="/api/recurring-work-orders/toggle">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="action" value={r.auto_generate ? 'pause' : 'resume'} />
                          <button
                            type="submit"
                            className={`rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium transition-colors ${
                              r.auto_generate ? 'text-amber-700 hover:bg-amber-50' : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {r.auto_generate ? 'Pause' : 'Resume'}
                          </button>
                        </form>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={Repeat}
              title="No recurring work orders match this view"
              description="Scheduled maintenance templates will appear here. A nightly cron generates real work orders from them."
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
