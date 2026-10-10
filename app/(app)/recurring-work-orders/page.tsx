import Link from 'next/link';
import { Plus, Repeat } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';
import { tradeLabel, vendorAssociationLabel } from '@/lib/vendors/options';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';

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

function deriveStatus(r: any, todayYmd: string): { label: string; tone: Tone } {
  // Date-only compare in local time: a plan is still running on its last day.
  if (r.end_date && r.end_date < todayYmd) {
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
  searchParams: Promise<{ q?: string; frequency?: string; association_id?: string; vendor_id?: string; status?: string; error?: string; generated?: string; paused?: string; resumed?: string }>;
}) {
  await requireStaff();
  const { q = '', frequency = '', association_id = '', vendor_id = '', status = '', error: actionError, generated, paused, resumed } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  // Every plan, paged past PostgREST's 1,000-row cap.
  const [
    rowsRes,
    { data: associations },
    { rows: vendors },
  ] = await Promise.all([
    fetchAllRows<any>(() => db
      .from('recurring_work_orders')
      .select('id, title, description, trade, priority, frequency, interval_count, next_due_date, last_generated_at, auto_generate, start_date, end_date, association_id, unit_id, vendor_id, associations(name), units(unit_number), vendors(name)')
      .is('archived_at', null)
      .order('next_due_date', { ascending: true, nullsFirst: false })
      .order('id')),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    // Every vendor, so a plan's vendor is always selectable in the filter.
    fetchAllRows<any>(() => db.from('vendors').select('id, name, is_management_company, associations(name)').is('archived_at', null).order('name').order('id')),
  ]);

  const all = rowsRes.rows;

  // ── Filter ──
  let filtered = all;
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(
      (r: any) =>
        (r.title ?? '').toLowerCase().includes(ql) ||
        (r.description ?? '').toLowerCase().includes(ql) ||
        (r.vendors?.name ?? '').toLowerCase().includes(ql) ||
        (r.associations?.name ?? '').toLowerCase().includes(ql) ||
        (r.units?.unit_number ?? '').toLowerCase().includes(ql),
    );
  }
  if (frequency) filtered = filtered.filter((r: any) => r.frequency === frequency);
  if (association_id) filtered = filtered.filter((r: any) => r.association_id === association_id);
  if (vendor_id) filtered = filtered.filter((r: any) => r.vendor_id === vendor_id);
  const todayYmd = todayInZone();
  if (status === 'active') filtered = filtered.filter((r: any) => r.auto_generate && (!r.end_date || r.end_date >= todayYmd));
  if (status === 'paused') filtered = filtered.filter((r: any) => !r.auto_generate && (!r.end_date || r.end_date >= todayYmd));
  if (status === 'ended') filtered = filtered.filter((r: any) => r.end_date && r.end_date < todayYmd);

  // ── Metrics ──
  const activeCount = all.filter((r: any) => r.auto_generate && (!r.end_date || r.end_date >= todayYmd)).length;
  const pausedCount = all.filter((r: any) => !r.auto_generate && (!r.end_date || r.end_date >= todayYmd)).length;
  const endedCount = all.filter((r: any) => r.end_date && r.end_date < todayYmd).length;
  // Active plans whose next due date has arrived (paused plans don't generate).
  const dueNowCount = all.filter(
    (r: any) => r.auto_generate && r.next_due_date && String(r.next_due_date).slice(0, 10) <= todayYmd && (!r.end_date || r.end_date >= todayYmd),
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
        <>
          <Link href="/reports/recurring_work_orders">
            <Button variant="secondary">Recurring work orders report</Button>
          </Link>
          <Link href="/work-orders/new">
            <Button variant="secondary">New work order</Button>
          </Link>
          <Link href="/recurring-work-orders/new">
            <Button><Plus className="h-4 w-4" /> New recurring work order</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {actionError && <Alert tone="danger" title="That didn't work.">{actionError}</Alert>}
        {generated && <Alert tone="success" title="Work order generated.">It&apos;s now in the work order queue.</Alert>}
        {paused && <Alert tone="success" title="Paused.">No new work orders will be generated until you resume it.</Alert>}
        {resumed && <Alert tone="success" title="Resumed.">Work orders will generate on schedule again.</Alert>}
        {rowsRes.error && <Alert tone="danger" title="Could not load every recurring work order">{rowsRes.error}</Alert>}
        {rowsRes.truncated && <Alert tone="warning" title="List is incomplete">There are more recurring work orders than this page can load. Filter by association or vendor.</Alert>}
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

          <FilterSelect label="Vendor" name="vendor_id" defaultValue={vendor_id}>
            <option value="">All vendors</option>
            {(vendors ?? []).map((v: any) => (
              <option key={v.id} value={v.id}>{v.name} · {vendorAssociationLabel(v)}</option>
            ))}
          </FilterSelect>
        </FilterBar>

        {/* ── TABLE ── */}
        {filtered.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Vendor</TH>
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
                const st = deriveStatus(r, todayYmd);
                return (
                  <TR key={r.id}>
                    <TD className="max-w-xs">
                      <div className="font-medium text-gray-900">{r.title}</div>
                      {r.trade && (
                        <div className="text-[13px] text-gray-500">{tradeLabel(r.trade)}</div>
                      )}
                      {r.description && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-gray-500">{r.description}</div>
                      )}
                    </TD>
                    <TD className="text-sm text-gray-700">
                      {r.vendor_id ? (
                        <Link href={`/vendors/${r.vendor_id}`} className="hover:text-gray-950 hover:underline">{r.vendors?.name ?? 'Vendor'}</Link>
                      ) : (
                        <span className="text-gray-400">No vendor</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-gray-700">
                      {formatFrequency(r.frequency, r.interval_count)}
                    </TD>
                    <TD className="text-sm text-gray-700">
                      {r.associations?.name ?? '—'}
                      {r.units?.unit_number && (
                        <div className="text-[13px] text-gray-500">Unit {r.units.unit_number}</div>
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
                          {/* The occurrence on screen: a repeated post must not generate the next one. */}
                          <input type="hidden" name="due" value={r.next_due_date ?? ''} />
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
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
