import { sanitizeSearchTerm } from '@/lib/search/global';
import Link from 'next/link';
import { BookText, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Alert } from '@/components/ui/shell';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { deleteDraftJournalEntry, postDraftJournalEntry } from '@/lib/rpcs/journal-entries';
import { archiveRecurringJournalEntry, postRecurringJournalEntries } from '@/lib/rpcs/recurring';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { todayInZone } from '@/lib/time/zoned';

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
  searchParams: Promise<{ tab?: string; q?: string; association_id?: string; gl_account_id?: string; ref_number?: string; date_from?: string; date_to?: string; status?: string; batch_id?: string; saved?: string; posted?: string; deleted?: string; archived?: string; through?: string; error?: string }>;
}) {
  await requireFinanceStaff();
  const {
    tab: tabParam,
    q = '',
    association_id = '',
    gl_account_id = '',
    ref_number = '',
    date_from = '',
    date_to = '',
    saved = '',
    status: statusParam = '',
    posted: postedFlag = '',
    deleted: deletedFlag = '',
    error: pageError = '',
    batch_id: batchParam = '',
    archived: archivedFlag = '',
    through = '',
  } = await searchParams;
  const batchId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(batchParam) ? batchParam : '';
  const status = statusParam === 'posted' || statusParam === 'draft' ? statusParam : '';
  const tab = parseTab(tabParam);
  const supabase = await createClient();
  const db = supabase as any;

  // Search runs in the database. Association and GL account names match
  // through the entries' lines, so collect those entry ids first.
  const term = sanitizeSearchTerm(q);
  let searchEntryIds: string[] = [];
  let searchIdsTruncated = false;
  const loadErrors: string[] = [];
  // Ids are sent in the request URL (`in.(...)`), so keep the lists short.
  const MAX_SEARCH_ACCOUNTS = 100;
  const MAX_SEARCH_ENTRIES = 200;
  if (term && tab === 'history') {
    // GL accounts are matched in memory so a partial account number
    // ("10" finds 1010) still works; number is an integer column.
    const tl = term.toLowerCase();
    const [{ rows: allGl, error: glError }, { data: assocMatch, error: assocError }] = await Promise.all([
      fetchAllRows<any>(() => db.from('gl_accounts').select('id, number, name').order('id')),
      db.from('associations').select('id').ilike('name', `%${term}%`).order('name').order('id').limit(MAX_SEARCH_ACCOUNTS + 1),
    ]);
    if (glError) loadErrors.push(glError);
    if (assocError) loadErrors.push(assocError.message);
    // Most relevant first: exact number, number prefix, name prefix, then any match.
    const rank = (g: any) => {
      const num = String(g.number ?? '');
      const name = String(g.name ?? '').toLowerCase();
      if (num === tl || name === tl) return 0;
      if (num.startsWith(tl)) return 1;
      if (name.startsWith(tl)) return 2;
      return 3;
    };
    const glMatches = allGl
      .filter((g) => String(g.number ?? '').includes(tl) || String(g.name ?? '').toLowerCase().includes(tl))
      .sort((a, b) => rank(a) - rank(b) || (Number(a.number) || 0) - (Number(b.number) || 0) || String(a.id).localeCompare(String(b.id)));
    const glIds = glMatches.slice(0, MAX_SEARCH_ACCOUNTS).map((g) => g.id);
    const assocRows = (assocMatch ?? []) as any[];
    const assocIds = assocRows.slice(0, MAX_SEARCH_ACCOUNTS).map((a) => a.id);
    if (glMatches.length > MAX_SEARCH_ACCOUNTS || assocRows.length > MAX_SEARCH_ACCOUNTS) searchIdsTruncated = true;
    if (glIds.length || assocIds.length) {
      const { rows, truncated, error: linesError } = await fetchAllRows<any>(() => {
        const parts = [
          glIds.length ? `gl_account_id.in.(${glIds.join(',')})` : null,
          assocIds.length ? `association_id.in.(${assocIds.join(',')})` : null,
        ].filter(Boolean).join(',');
        return db.from('journal_lines').select('entry_id').or(parts).order('id');
      }, { maxRows: 5000 });
      if (linesError) loadErrors.push(linesError);
      const uniqueIds = [...new Set(rows.map((r) => r.entry_id as string))];
      searchEntryIds = uniqueIds.slice(0, MAX_SEARCH_ENTRIES);
      if (truncated || uniqueIds.length > MAX_SEARCH_ENTRIES) searchIdsTruncated = true;
    }
  }

  // One filtered journal-entry query, used for the list and for the counts.
  const lineFilter = association_id || gl_account_id;
  const historyQuery = (select: string, opts?: { count: 'exact'; head: true }) => {
    let jq = db.from('journal_entries').select(`${select}${lineFilter ? ', match:journal_lines!inner(id)' : ''}`, opts);
    if (association_id) jq = jq.eq('match.association_id', association_id);
    if (gl_account_id) jq = jq.eq('match.gl_account_id', gl_account_id);
    if (date_from) jq = jq.gte('entry_date', date_from);
    if (date_to) jq = jq.lte('entry_date', date_to);
    if (batchId) jq = jq.eq('batch_id', batchId);
    const safeRef = sanitizeSearchTerm(ref_number);
    if (safeRef) jq = jq.ilike('reference_number', `%${safeRef}%`);
    if (term) {
      jq = jq.or([
        `reference_number.ilike.*${term}*`,
        `memo.ilike.*${term}*`,
        `description.ilike.*${term}*`,
        searchEntryIds.length ? `id.in.(${searchEntryIds.join(',')})` : null,
      ].filter(Boolean).join(','));
    }
    return jq;
  };

  // ── PARALLEL FETCH: all tab data + lookup tables ──
  const [
    { data: journalEntries, error: entriesError },
    { data: recurringEntries, error: recurringError },
    { data: batches, error: batchesError },
    { data: associations, error: associationsError },
    { data: glAccounts, error: glAccountsError },
    { count: postedTotal, error: postedCountError },
    { count: draftTotal, error: draftCountError },
  ] = await Promise.all([
    // Journal entries with their lines for History tab
    // Filters run in the query: applied in the app they only searched the
    // newest 500 entries, so older entries could never be found. A second,
    // aliased inner join filters by line without hiding the entry's other lines.
    (() => {
      let jq = historyQuery('id, entry_date, reference_number, memo, description, source_type, posted, posted_at, batch_id, reversed_by_entry_id, journal_lines(id, debit_amount, credit_amount, memo, association_id, gl_account_id, associations(name), gl_accounts(number, name))');
      if (status) jq = jq.eq('posted', status === 'posted');
      return jq.order('entry_date', { ascending: false }).order('id').limit(500);
    })(),
    // Recurring journal entries
    db.from('recurring_journal_entries')
      .select('id, name, memo, frequency, interval_count, next_post_date, end_date, auto_generate, last_generated_at, last_error, created_at')
      .is('archived_at', null)
      .order('next_post_date', { ascending: true, nullsFirst: false })
      .limit(500),
    // Journal entry batches
    db.from('journal_entry_batches')
      .select('id, name, description, status, total_entries, total_debit, total_credit, created_at, posted_at, error_message')
      .order('created_at', { ascending: false })
      .limit(500),
    // Associations and GL accounts for the filters (all rows, past 1,000).
    fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id')).then((r) => ({ data: r.rows, error: r.error })),
    fetchAllRows<any>(() => db.from('gl_accounts').select('id, number, name').order('number').order('id')).then((r) => ({ data: r.rows, error: r.error })),
    // Counts cover every matching entry, not only the 500 listed.
    historyQuery('id', { count: 'exact', head: true }).eq('posted', true),
    historyQuery('id', { count: 'exact', head: true }).eq('posted', false),
  ]);

  for (const e of [entriesError, recurringError, batchesError, associationsError, glAccountsError, postedCountError, draftCountError]) {
    if (e) loadErrors.push(typeof e === 'string' ? e : e.message ?? String(e));
  }

  // ── Journal entries (already filtered and searched in the database) ──
  const filteredEntries = (journalEntries ?? []) as any[];
  const matchingTotal = status === 'posted' ? (postedTotal ?? 0) : status === 'draft' ? (draftTotal ?? 0) : (postedTotal ?? 0) + (draftTotal ?? 0);

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
  const batchDraftCount = (batches ?? []).filter((b: any) => b.status === 'draft' || b.status === 'validating').length;
  const recurringActiveCount = (recurringEntries ?? []).filter((r: any) => r.auto_generate).length;

  const metrics: Metric[] = [
    { label: 'Posted entries', value: postedTotal ?? 0, sublabel: 'Matching the filters' },
    { label: 'Draft entries', value: draftTotal ?? 0, sublabel: 'Not yet posted' },
    { label: 'Open batches', value: batchDraftCount },
    { label: 'Active recurring', value: recurringActiveCount },
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
    if (status) p.set('status', status);
    if (batchId) p.set('batch_id', batchId);
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
        <>
          <Link href="/journal-entries/new">
            <Button><Plus className="h-4 w-4" /> New entry</Button>
          </Link>
          <Link href="/journal-entries/recurring/new">
            <Button variant="secondary">New recurring entry</Button>
          </Link>
          <Link href="/journal-entries/upload">
            <Button variant="secondary">Upload batch</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {saved && <Alert tone="success" title={tab === 'recurring' ? 'Recurring entry saved' : 'Journal entry saved'} />}
        {archivedFlag && <Alert tone="success" title="Recurring entry stopped" />}
        {tab === 'recurring' && postedFlag && (
          <Alert tone="success" title={`${Number(postedFlag) || 0} recurring entr${postedFlag === '1' ? 'y' : 'ies'} posted${through ? ` through ${date(through)}` : ''}`} />
        )}
        {batchId && tab === 'history' && <Alert tone="info" title="Showing one upload batch"><Link href="/journal-entries" className="font-medium underline">Show all entries</Link></Alert>}
        {postedFlag && tab !== 'recurring' && <Alert tone="success" title="Journal entry posted" />}
        {deletedFlag && <Alert tone="success" title="Draft deleted" />}
        {pageError && <Alert title="Could not update the journal entry.">{pageError}</Alert>}
        {loadErrors.length > 0 && <Alert tone="danger" title="Some journal data could not be loaded.">{[...new Set(loadErrors)].join(' · ')}</Alert>}
        {searchIdsTruncated && <Alert tone="warning" title="Search matched many accounts.">Results by association or GL account name may be incomplete; use the Association or GL Account filter instead.</Alert>}
        <MetricStrip metrics={metrics} />

        {/* ── MAIN TABS ── */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {JOURNAL_TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={filterParams({ tab: t.key })}
                className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-gray-950 text-gray-950'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
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
            {batchId && <input type="hidden" name="batch_id" value={batchId} />}
            <FilterSelect label="Status" name="status" defaultValue={status}>
              <option value="">All</option>
              <option value="posted">Posted</option>
              <option value="draft">Drafts (to post)</option>
            </FilterSelect>
            <FilterSelect label="Association" name="association_id" defaultValue={association_id}>
              <option value="">All associations</option>
              {(associations ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </FilterSelect>
            <FilterSelect label="GL Account" name="gl_account_id" defaultValue={gl_account_id}>
              <option value="">All GL accounts</option>
              {(glAccounts ?? []).map((g: any) => (
                <option key={g.id} value={g.id}>{g.number}: {g.name}</option>
              ))}
            </FilterSelect>
            <label className="text-[12px] font-medium text-gray-500">
              Reference #
              <input
                name="ref_number"
                defaultValue={ref_number}
                placeholder="e.g. JE-2026-001"
                className="mt-1 block h-10 min-w-32 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
            <label className="text-[12px] font-medium text-gray-500">
              From
              <input
                name="date_from"
                type="date"
                defaultValue={date_from}
                className="mt-1 block h-10 min-w-32 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
            <label className="text-[12px] font-medium text-gray-500">
              To
              <input
                name="date_to"
                type="date"
                defaultValue={date_to}
                className="mt-1 block h-10 min-w-32 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
                    <TH />
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
                    const glNames = [...new Set(lines.map((l: any) => l.gl_accounts ? `${l.gl_accounts.number}: ${l.gl_accounts.name}` : null).filter(Boolean))];

                    return (
                      <TR key={je.id}>
                        <TD className="whitespace-nowrap text-sm">{date(je.entry_date)}</TD>
                        <TD className="font-mono text-xs text-gray-600 whitespace-nowrap">{je.reference_number ?? '—'}</TD>
                        <TD className="max-w-xs truncate text-sm text-gray-700" title={je.memo ?? je.description ?? ''}>
                          <Link href={`/journal-entries/${je.id}`} className="text-gray-900 hover:underline">{je.description ?? je.memo ?? 'Journal entry'}</Link>
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
                          {je.reversed_by_entry_id ? <StatusChip tone="neutral">Reversed</StatusChip> : <JEStatusChip posted={je.posted} />}
                        </TD>
                        <TD className="whitespace-nowrap text-right">
                          {!je.posted && (
                            <div className="flex items-center justify-end gap-3">
                              <form action={postDraftJournalEntry}>
                                <input type="hidden" name="entry_id" value={je.id} />
                                <button type="submit" className="text-xs font-medium text-gray-900 hover:underline">Post</button>
                              </form>
                              <form action={deleteDraftJournalEntry}>
                                <input type="hidden" name="entry_id" value={je.id} />
                                <PendingSubmit variant="ghost" size="sm" pendingLabel="Deleting…" confirm="Delete this draft journal entry?">Delete</PendingSubmit>
                              </form>
                            </div>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={BookText}
                  title={
                    q || association_id || gl_account_id || ref_number || date_from || date_to || status
                      ? 'No journal entries match the current filters'
                      : 'No journal entries yet'
                  }
                  description="Manual and system-generated journal entries will appear here."
                />
              </div>
            )}
            {matchingTotal > filteredEntries.length && (
              <p className="text-xs text-gray-500">
                Showing the latest {filteredEntries.length} of {matchingTotal} entries. Narrow with dates or filters to see older ones.
              </p>
            )}
          </>
        )}

        {/* ── TAB: RECURRING JOURNAL ENTRIES ── */}
        {tab === 'recurring' && (
          <>
            {recurringActiveCount > 0 && (
              <form action={postRecurringJournalEntries} className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200/70 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-gray-950">Manually post recurring entries</h2>
                  <p className="mt-0.5 text-sm text-gray-600">Post every active recurring entry scheduled on or before this date now, instead of waiting for its date.</p>
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                  Post through
                  <input type="date" name="through" required defaultValue={todayInZone()} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-950" />
                </label>
                <PendingSubmit pendingLabel="Posting…">Post entries</PendingSubmit>
              </form>
            )}
            {filteredRecurring.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Memo</TH>
                    <TH>Frequency</TH>
                    <TH>Next Post Date</TH>
                    <TH>Ends</TH>
                    <TH>Last Generated</TH>
                    <TH>Status</TH>
                    <TH />
                  </TR>
                </THead>
                <tbody>
                  {filteredRecurring.map((r: any) => (
                    <TR key={r.id}>
                      <TD className="font-medium text-sm text-gray-900">
                        <Link href={`/journal-entries/recurring/${r.id}/edit`} className="hover:underline">{r.name}</Link>
                        {r.last_error && <p className="mt-1 max-w-xs text-xs font-normal text-red-700">Not posting: {r.last_error}</p>}
                      </TD>
                      <TD className="max-w-xs truncate text-sm text-gray-600" title={r.memo ?? ''}>
                        {r.memo ?? '—'}
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600 capitalize">
                        {r.frequency
                          ? `${r.interval_count > 1 ? `Every ${r.interval_count} ` : ''}${r.frequency.replace(/_/g, ' ')}${r.interval_count > 1 && !r.frequency.endsWith('s') ? 's' : ''}`
                          : '—'}
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(r.next_post_date)}</TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{r.end_date ? date(r.end_date) : 'No end date'}</TD>
                      <TD className="whitespace-nowrap text-sm text-gray-600">{date(r.last_generated_at)}</TD>
                      <TD>
                        <StatusChip tone={r.last_error ? 'danger' : r.auto_generate ? 'info' : 'neutral'}>
                          {r.last_error ? 'Needs attention' : r.auto_generate ? 'Active' : 'Paused'}
                        </StatusChip>
                      </TD>
                      <TD className="whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/journal-entries/recurring/${r.id}/edit`}><Button variant="ghost" size="sm">Edit</Button></Link>
                          <form action={archiveRecurringJournalEntry}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button type="submit" variant="ghost" size="sm">Stop</Button>
                          </form>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={BookText}
                  title={
                    q
                      ? 'No recurring journal entries match the current search'
                      : 'No recurring journal entries configured'
                  }
                  description="Set up recurring entries for automatic posting."
                />
              </div>
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
                      <TD className="font-medium text-sm text-gray-900">
                        <Link href={`/journal-entries?tab=history&batch_id=${b.id}`} className="hover:underline">{b.name}</Link>
                      </TD>
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
              <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <EmptyState
                  icon={BookText}
                  title={q ? 'No batches match the current search' : 'No journal entry batches yet'}
                  description="Upload a batch to import multiple entries at once."
                />
              </div>
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

