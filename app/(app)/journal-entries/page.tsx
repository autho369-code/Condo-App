import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type JournalTab = 'history' | 'recurring' | 'batches';

const JOURNAL_TABS: Array<{ key: JournalTab; label: string }> = [
  { key: 'history', label: 'Journal Entry History' },
  { key: 'recurring', label: 'Recurring Journal Entries' },
  { key: 'batches', label: 'Journal Entry Batches' },
];

function parseTab(value: string | undefined): JournalTab {
  switch (value) {
    case 'history':
    case 'recurring':
    case 'batches':
      return value;
    default:
      return 'history';
  }
}

export default async function JournalEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; association_id?: string; gl_account_id?: string; ref_number?: string; date_from?: string; date_to?: string }>;
}) {
  await requireStaff();
  const {
    tab: tabParam,
    q = '',
    association_id = '',
    gl_account_id = '',
    ref_number = '',
    date_from = '',
    date_to = '',
  } = await searchParams;
  const tab = parseTab(tabParam);
  const supabase = await createClient();
  const db = supabase as any;

  // ── PARALLEL FETCH: all tab data + lookup tables ──
  const [
    { data: journalEntries },
    { data: recurringEntries },
    { data: batches },
    { data: associations },
    { data: glAccounts },
  ] = await Promise.all([
    // Journal entries with their lines for History tab
    db.from('journal_entries')
      .select('id, entry_date, reference_number, memo, description, source_type, posted, posted_at, batch_id, journal_lines(id, debit_amount, credit_amount, memo, association_id, gl_account_id, associations(name), gl_accounts(code, name))')
      .order('entry_date', { ascending: false })
      .limit(500),
    // Recurring journal entries
    db.from('recurring_journal_entries')
      .select('id, name, memo, frequency, interval_count, next_post_date, auto_generate, last_generated_at, created_at')
      .is('archived_at', null)
      .order('next_post_date', { ascending: true, nullsFirst: false })
      .limit(500),
    // Journal entry batches
    db.from('journal_entry_batches')
      .select('id, name, description, status, total_entries, total_debit, total_credit, created_at, posted_at, error_message')
      .order('created_at', { ascending: false })
      .limit(500),
    // Associations for filter
    db.from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
    // GL accounts for filter
    db.from('gl_accounts')
      .select('id, code, name')
      .is('archived_at', null)
      .order('code'),
  ]);

  // ── FILTER: journal entries ──
  let filteredEntries = (journalEntries ?? []);

  // Search across reference number, memo, description, association name, GL account
  if (q) {
    const ql = q.toLowerCase();
    filteredEntries = filteredEntries.filter((je: any) => {
      const lines = je.journal_lines ?? [];
      const hasMatchingLine = lines.some(
        (l: any) =>
          (l.associations?.name ?? '').toLowerCase().includes(ql) ||
          (l.gl_accounts?.name ?? '').toLowerCase().includes(ql) ||
          (l.gl_accounts?.code ?? '').toLowerCase().includes(ql),
      );
      return (
        (je.reference_number ?? '').toLowerCase().includes(ql) ||
        (je.memo ?? '').toLowerCase().includes(ql) ||
        (je.description ?? '').toLowerCase().includes(ql) ||
        hasMatchingLine
      );
    });
  }

  if (association_id) {
    filteredEntries = filteredEntries.filter((je: any) =>
      (je.journal_lines ?? []).some((l: any) => l.association_id === association_id),
    );
  }

  if (gl_account_id) {
    filteredEntries = filteredEntries.filter((je: any) =>
      (je.journal_lines ?? []).some((l: any) => l.gl_account_id === gl_account_id),
    );
  }

  if (ref_number) {
    const rl = ref_number.toLowerCase();
    filteredEntries = filteredEntries.filter((je: any) =>
      (je.reference_number ?? '').toLowerCase().includes(rl),
    );
  }

  if (date_from) {
    filteredEntries = filteredEntries.filter((je: any) => je.entry_date >= date_from);
  }
  if (date_to) {
    filteredEntries = filteredEntries.filter((je: any) => je.entry_date <= date_to);
  }

  // ── FILTER: batches ──
  let filteredBatches = (batches ?? []);
  if (q) {
    const ql = q.toLowerCase();
    filteredBatches = filteredBatches.filter(
      (b: any) =>
        (b.name ?? '').toLowerCase().includes(ql) ||
        (b.description ?? '').toLowerCase().includes(ql),
    );
  }

  // ── FILTER: recurring ──
  let filteredRecurring = (recurringEntries ?? []);
  if (q) {
    const ql = q.toLowerCase();
    filteredRecurring = filteredRecurring.filter(
      (r: any) =>
        (r.name ?? '').toLowerCase().includes(ql) ||
        (r.memo ?? '').toLowerCase().includes(ql),
    );
  }

  // ── METRICS ──
  const postedCount = (journalEntries ?? []).filter((je: any) => je.posted).length;
  const draftCount = (journalEntries ?? []).filter((je: any) => !je.posted).length;

  const totalDebits = (journalEntries ?? []).reduce((sum: number, je: any) => {
    const lines = je.journal_lines ?? [];
    return sum + lines.reduce((ls: number, l: any) => ls + Number(l.debit_amount ?? 0), 0);
  }, 0);

  const totalCredits = (journalEntries ?? []).reduce((sum: number, je: any) => {
    const lines = je.journal_lines ?? [];
    return sum + lines.reduce((ls: number, l: any) => ls + Number(l.credit_amount ?? 0), 0);
  }, 0);

  const batchDraftCount = (batches ?? []).filter((b: any) => b.status === 'draft' || b.status === 'validating').length;
  const recurringActiveCount = (recurringEntries ?? []).filter((r: any) => r.auto_generate).length;

  const metrics: Metric[] = [
    { label: 'Posted entries', value: postedCount, sublabel: `${draftCount} drafts` },
    { label: 'Total debits', value: money(totalDebits), sublabel: `${(journalEntries ?? []).length} entries` },
    { label: 'Total credits', value: money(totalCredits) },
    { label: 'Open batches', value: batchDraftCount, sublabel: `${recurringActiveCount} active recurring` },
  ];

  // ── BUILD FILTER URL HELPER ──
  function filterParams(overrides: Record<string, string> = {}): string {
    const p = new URLSearchParams();
    p.set('tab', tab);
    if (q) p.set('q', q);
    if (association_id) p.set('association_id', association_id);
    if (gl_account_id) p.set('gl_account_id', gl_account_id);
    if (ref_number) p.set('ref_number', ref_number);
    if (date_from) p.set('date_from', date_from);
    if (date_to) p.set('date_to', date_to);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
    }
    return `/journal-entries?${p.toString()}`;
  }

  return (
    <DataWorkspace
      title="Journal Entries"
      description="Create, review, and post journal entries. Manage recurring entries and upload batches."
      actions={
        <div className="flex gap-2">
          <Link href={filterParams({ tab: 'history' })}>
            <Button variant={tab === 'history' ? 'primary' : 'secondary'} size="sm">+ New Entry</Button>
          </Link>
        </div>
      }
      rail={<JournalEntriesRail />}
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── MAIN TABS ── */}
        <nav className="flex flex-wrap gap-1 border-b border-gray-200">
          {JOURNAL_TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={filterParams({ tab: t.key })}
                className={`border-b-2 px-4 py-2 text-sm transition ${
                  active
                    ? 'border-brand-600 font-medium text-brand-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {/* ── FILTER BAR (History tab only for association/GL/date filters) ── */}
        {tab === 'history' && (
          <FilterBar
            action="/journal-entries"
            searchDefault={q}
            searchPlaceholder="Search reference #, memo, description, association, GL account..."
          >
            <input type="hidden" name="tab" value="history" />
            <label className="text-xs font-medium uppercase text-gray-500">
              Association
              <select
                name="association_id"
                defaultValue={association_id}
                className="mt-1 h-9 w-full min-w-40 rounded border border-gray-300 px-2 text-sm normal-case text-gray-900"
              >
                <option value="">All associations</option>
                {(associations ?? []).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium uppercase text-gray-500">
              GL Account
              <select
                name="gl_account_id"
                defaultValue={gl_account_id}
                className="mt-1 h-9 w-full min-w-40 rounded border border-gray-300 px-2 text-sm normal-case text-gray-900"
              >
                <option value="">All GL accounts</option>
                {(glAccounts ?? []).map((g: any) => (
                  <option key={g.id} value={g.id}>{g.code}: {g.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium uppercase text-gray-500">
              Reference #
              <input
                name="ref_number"
                defaultValue={ref_number}
                placeholder="e.g. JE-2026-001"
                className="mt-1 h-9 w-full min-w-32 rounded border border-gray-300 px-3 text-sm normal-case text-gray-900"
              />
            </label>
            <label className="text-xs font-medium uppercase text-gray-500">
              From
              <input
                name="date_from"
                type="date"
                defaultValue={date_from}
                className="mt-1 h-9 w-full min-w-32 rounded border border-gray-300 px-3 text-sm normal-case text-gray-900"
              />
            </label>
            <label className="text-xs font-medium uppercase text-gray-500">
              To
              <input
                name="date_to"
                type="date"
                defaultValue={date_to}
                className="mt-1 h-9 w-full min-w-32 rounded border border-gray-300 px-3 text-sm normal-case text-gray-900"
              />
            </label>
          </FilterBar>
        )}

        {/* ── FILTER BAR (Recurring tab) ── */}
        {tab === 'recurring' && (
          <FilterBar
            action="/journal-entries"
            searchDefault={q}
            searchPlaceholder="Search name, memo..."
          >
            <input type="hidden" name="tab" value="recurring" />
          </FilterBar>
        )}

        {/* ── FILTER BAR (Batches tab) ── */}
        {tab === 'batches' && (
          <FilterBar
            action="/journal-entries"
            searchDefault={q}
            searchPlaceholder="Search batch name, description..."
          >
            <input type="hidden" name="tab" value="batches" />
          </FilterBar>
        )}

        {/* ── TAB: JOURNAL ENTRY HISTORY ── */}
        {tab === 'history' && (
          <>
            {filteredEntries.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Reference</TH>
                    <TH>Description</TH>
                    <TH>Association</TH>
                    <TH>GL Account</TH>
                    <TH className="text-right">Debit</TH>
                    <TH className="text-right">Credit</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredEntries.map((je: any) => {
                    const lines: any[] = je.journal_lines ?? [];
                    const primaryLine = lines[0] ?? {};
                    // Aggregate debits and credits across all lines
                    const totalDebit = lines.reduce((s: number, l: any) => s + Number(l.debit_amount ?? 0), 0);
                    const totalCredit = lines.reduce((s: number, l: any) => s + Number(l.credit_amount ?? 0), 0);
                    // Collect unique associations and GL accounts
                    const assocNames = [...new Set(lines.map((l: any) => l.associations?.name).filter(Boolean))];
                    const glNames = [...new Set(lines.map((l: any) => l.gl_accounts ? `${l.gl_accounts.code}: ${l.gl_accounts.name}` : null).filter(Boolean))];

                    return (
                      <TR key={je.id}>
                        <TD className="whitespace-nowrap text-sm">{date(je.entry_date)}</TD>
                        <TD className="font-mono text-xs text-gray-600 whitespace-nowrap">{je.reference_number ?? '—'}</TD>
                        <TD className="max-w-xs truncate text-sm text-gray-700" title={je.memo ?? je.description ?? ''}>
                          {je.memo ?? je.description ?? '—'}
                        </TD>
                        <TD className="max-w-[160px] truncate text-sm text-gray-700" title={assocNames.join(', ')}>
                          {assocNames.length > 0 ? assocNames.join(', ') : '—'}
                        </TD>
                        <TD className="max-w-[200px] truncate text-sm text-gray-600" title={glNames.join(', ')}>
                          {glNames.length > 0 ? glNames.join(', ') : '—'}
                        </TD>
                        <TD className="text-right tabular-nums text-sm text-gray-900">
                          {totalDebit > 0 ? money(totalDebit) : '—'}
                        </TD>
                        <TD className="text-right tabular-nums text-sm text-gray-900">
                          {totalCredit > 0 ? money(totalCredit) : '—'}
                        </TD>
                        <TD>
                          <JEStatusChip posted={je.posted} />
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                {q || association_id || gl_account_id || ref_number || date_from || date_to
                  ? 'No journal entries match the current filters.'
                  : 'No journal entries yet. Create your first journal entry to get started.'}
              </p>
            )}
          </>
        )}

        {/* ── TAB: RECURRING JOURNAL ENTRIES ── */}
        {tab === 'recurring' && (
          <>
            {filteredRecurring.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Memo</TH>
                    <TH>Frequency</TH>
                    <TH>Next Post Date</TH>
                    <TH>Auto-Generate</TH>
                    <TH>Last Generated</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredRecurring.map((r: any) => (
                    <TR key={r.id}>
                      <TD className="font-medium text-sm text-gray-900">{r.name}</TD>
                      <TD className="max-w-xs truncate text-sm text-gray-600" title={r.memo ?? ''}>
                        {r.memo ?? '—'}
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600 capitalize">
                        {r.frequency
                          ? `${r.interval_count > 1 ? `Every ${r.interval_count} ` : ''}${r.frequency.replace(/_/g, ' ')}${r.interval_count > 1 && !r.frequency.endsWith('s') ? 's' : ''}`
                          : '—'}
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(r.next_post_date)}</TD>
                      <TD>
                        {r.auto_generate ? (
                          <StatusChip tone="success">Auto</StatusChip>
                        ) : (
                          <StatusChip tone="neutral">Manual</StatusChip>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(r.last_generated_at)}</TD>
                      <TD>
                        <StatusChip tone={r.auto_generate ? 'info' : 'neutral'}>
                          {r.auto_generate ? 'Active' : 'Paused'}
                        </StatusChip>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                {q
                  ? 'No recurring journal entries match the current search.'
                  : 'No recurring journal entries configured. Set up recurring entries for automatic posting.'}
              </p>
            )}
          </>
        )}

        {/* ── TAB: JOURNAL ENTRY BATCHES ── */}
        {tab === 'batches' && (
          <>
            {filteredBatches.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Batch Name</TH>
                    <TH>Description</TH>
                    <TH>Entries</TH>
                    <TH className="text-right">Total Debit</TH>
                    <TH className="text-right">Total Credit</TH>
                    <TH>Created</TH>
                    <TH>Posted</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredBatches.map((b: any) => (
                    <TR key={b.id}>
                      <TD className="font-medium text-sm text-gray-900">{b.name}</TD>
                      <TD className="max-w-xs truncate text-sm text-gray-600" title={b.description ?? ''}>
                        {b.description ?? '—'}
                      </TD>
                      <TD className="tabular-nums text-sm text-gray-700">{b.total_entries ?? 0}</TD>
                      <TD className="text-right tabular-nums text-sm text-gray-900">{money(b.total_debit)}</TD>
                      <TD className="text-right tabular-nums text-sm text-gray-900">{money(b.total_credit)}</TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(b.created_at)}</TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(b.posted_at)}</TD>
                      <TD>
                        <BatchStatusChip status={b.status} errorMessage={b.error_message} />
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
                {q
                  ? 'No batches match the current search.'
                  : 'No journal entry batches yet. Upload a batch to import multiple entries at once.'}
              </p>
            )}
          </>
        )}
      </div>
    </DataWorkspace>
  );
}

function JEStatusChip({ posted }: { posted: boolean }) {
  if (posted) {
    return <StatusChip tone="success">Posted</StatusChip>;
  }
  return <StatusChip tone="warning">Draft</StatusChip>;
}

function BatchStatusChip({ status, errorMessage }: { status: string; errorMessage?: string | null }) {
  const title = errorMessage ? `Error: ${errorMessage}` : undefined;
  switch (status) {
    case 'posted':
      return <StatusChip tone="success">Posted</StatusChip>;
    case 'validated':
      return <StatusChip tone="info">Validated</StatusChip>;
    case 'validating':
      return <StatusChip tone="warning">Validating</StatusChip>;
    case 'draft':
      return <StatusChip tone="neutral">Draft</StatusChip>;
    case 'failed':
      return (
        <span title={title}>
          <StatusChip tone="danger">Failed</StatusChip>
        </span>
      );
    default:
      return <StatusChip tone="neutral">{status}</StatusChip>;
  }
}

function JournalEntriesRail() {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Tasks</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/journal-entries/new" label="New Journal Entry" />
          <RailLink href="/journal-entries/post-gpr" label="Post GPR" placeholder />
          <RailLink href="/journal-entries/new?recurring=true" label="New Recurring Journal Entry" placeholder />
          <RailLink href="/journal-entries/upload-batch" label="Upload Journal Entry Batch" placeholder />
          <RailLink href="/journal-entries?tab=batches" label="View Journal Entry Batches" />
          <RailLink href="/journal-entries/manual-post" label="Manually Post Journal Entries" placeholder />
        </div>
      </section>

      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Reports</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/reports?slug=general-ledger" label="General Ledger" />
          <RailLink href="/reports?slug=trial-balance" label="Trial Balance" />
          <RailLink href="/reports?slug=journal-entry-register" label="Journal Entry Register" placeholder />
        </div>
      </section>

      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Help Topics</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/help/journal-entries" label="Journal Entries" placeholder />
        </div>
      </section>
    </div>
  );
}

function RailLink({ href, label, placeholder }: { href: string; label: string; placeholder?: boolean }) {
  if (placeholder) {
    return (
      <span className="rounded border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {label}
        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Placeholder</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      {label}
    </Link>
  );
}
