import { sanitizeSearchTerm } from '@/lib/search/global';
// Bank Feed page — imported transactions with auto-match review
// /bank-accounts/feeds

import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button, buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { bankFeedAction } from '@/lib/rpcs/bank-feed';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';
import { RefreshButton } from './sync-button';
import { isPlaidConfigured } from '@/lib/plaid/client';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

export const dynamic = 'force-dynamic';

// suggest_bank_transaction_payments accepts at most 100 lines per call.
const SUGGEST_BATCH = 100;

export default async function BankFeedsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    q?: string;
    bank_account_id?: string;
    error?: string;
    done?: string;
  }>;
}) {
  await requireFinanceStaff();
  const { filter = '', q = '', bank_account_id = '', error: pageError, done } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const plaidConfigured = isPlaidConfigured();

  // Load connected Plaid items
  const { data: plaidItems } = await db
    .from('plaid_items')
    .select('id, plaid_institution_name, bank_account_id, status, last_sync_at')
    .eq('status', 'active')
    .order('plaid_institution_name');

  const activeConnections = plaidItems || [];

  // Load imported transactions
  let query = db
    .from('bank_transactions')
    .select(
      'id, amount, date, name, merchant_name, original_description, category, pending, reviewed, gl_account_id, match_confidence, match_method, matched_at, matched_journal_line_id, matched_bank_deposit_id, ignored_at, bank_account_id, bank_accounts(name, gl_account_id, association_id), gl_accounts(number, name)'
    )
    .order('date', { ascending: false })
    .limit(100);

  if (filter === 'unreviewed') query = query.is('matched_at', null).is('ignored_at', null);
  if (filter === 'unmatched') query = query.is('matched_at', null);
  if (filter === 'ignored') query = query.not('ignored_at', 'is', null);
  if (filter === 'pending') query = query.eq('pending', true);
  if (bank_account_id) query = query.eq('bank_account_id', bank_account_id);
  // Strip characters that are syntax in a PostgREST or() filter, so a search
  // like "Smith, Inc" works and cannot add filter terms.
  const safeQ = sanitizeSearchTerm(q);
  if (safeQ) query = query.or(`name.ilike.%${safeQ}%,merchant_name.ilike.%${safeQ}%`);

  const { data: transactions, error: txnsError } = await query;
  const txns = transactions || [];
  // Load failures render an alert rather than an empty feed / no candidates.
  const loadErrors: string[] = [];
  if (txnsError) loadErrors.push(`Bank transactions: ${txnsError.message}`);

  // Load bank accounts for filter dropdown
  const { data: bankAccounts } = await db
    .from('bank_accounts')
    .select('id, name')
    .is('archived_at', null)
    .order('name');

  // matched_at also covers Stripe payout reconciliation, which claims a
  // transaction without a ledger line or deposit.
  const isMatched = (t: any) => Boolean(t.matched_at || t.matched_journal_line_id || t.matched_bank_deposit_id);
  const open = (t: any) => !isMatched(t) && !t.ignored_at && !t.pending;
  const unreviewedCount = txns.filter(open).length;
  const unmatchedCount = txns.filter((t: any) => !isMatched(t)).length;

  // Ledger lines each open transaction could be: same bank (GL account and
  // association), same amount (bank amounts are positive for money out, so the
  // line's debit - credit is -amount), within 7 days, and not matched yet.
  const openTxns = txns.filter(open);
  const candidatesByTxn = new Map<string, any[]>();
  const openDates = openTxns.map((t: any) => t.date).sort();
  const shift = (d: string, days: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
  if (openTxns.length) {
    const dates = openDates;
    const glIds = [...new Set(openTxns.map((t: any) => t.bank_accounts?.gl_account_id).filter(Boolean))];
    if (glIds.length) {
      const { data: lines, error: linesError } = await db.from('journal_lines')
        .select('id, gl_account_id, association_id, debit_amount, credit_amount, memo, journal_entries!inner(entry_date, description, reference_number, posted)')
        .in('gl_account_id', glIds)
        .eq('journal_entries.posted', true)
        .gte('journal_entries.entry_date', shift(dates[0], -7))
        .lte('journal_entries.entry_date', shift(dates[dates.length - 1], 7))
        .order('journal_entries(entry_date)', { ascending: false })
        .order('id')
        .limit(1000);
      if (linesError) loadErrors.push(`Ledger match candidates: ${linesError.message}`);
      const raw = new Map<string, any[]>();
      for (const t of openTxns) {
        const bank = t.bank_accounts;
        const want = Math.round(-Number(t.amount) * 100);
        const from = shift(t.date, -7);
        const to = shift(t.date, 7);
        raw.set(t.id, (lines ?? []).filter((l: any) =>
          l.gl_account_id === bank?.gl_account_id && (l.association_id ?? null) === (bank?.association_id ?? null)
          && Math.round((Number(l.debit_amount) - Number(l.credit_amount)) * 100) === want
          && l.journal_entries.entry_date >= from && l.journal_entries.entry_date <= to));
      }
      // "Already matched" only for the candidate lines, not every matched row.
      const candidateIds = [...new Set([...raw.values()].flat().map((l: any) => l.id))];
      let taken = new Set<string>();
      if (candidateIds.length) {
        const { data: matched, error: matchedError } = await db.from('bank_transactions')
          .select('matched_journal_line_id').in('matched_journal_line_id', candidateIds);
        if (matchedError) loadErrors.push(`Matched ledger lines: ${matchedError.message}`);
        taken = new Set((matched ?? []).map((m: any) => m.matched_journal_line_id));
      }
      for (const [id, list] of raw) candidatesByTxn.set(id, list.filter((l: any) => !taken.has(l.id)));
    }
  }
  // Bank deposits (grouped receipts) of the same amount within 7 days.
  const depositsByTxn = new Map<string, any[]>();
  const inflows = openTxns.filter((t: any) => Number(t.amount) < 0);
  if (inflows.length) {
    const inflowDates = inflows.map((t: any) => t.date).sort();
    const { data: deps, error: depsError } = await db.from('bank_deposits')
      .select('id, bank_account_id, deposit_date, amount, receipt_count')
      .in('bank_account_id', [...new Set(inflows.map((t: any) => t.bank_account_id))])
      .is('voided_at', null)
      .gte('deposit_date', shift(inflowDates[0], -7))
      .lte('deposit_date', shift(inflowDates[inflowDates.length - 1], 7))
      .order('deposit_date', { ascending: false })
      .order('id')
      .limit(1000);
    if (depsError) loadErrors.push(`Bank deposit candidates: ${depsError.message}`);
    const days = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
    const raw = new Map<string, any[]>();
    for (const t of inflows) {
      raw.set(t.id, (deps ?? []).filter((d: any) => d.bank_account_id === t.bank_account_id
        && Math.round(Number(d.amount) * 100) === Math.round(-Number(t.amount) * 100) && days(d.deposit_date, t.date) <= 7));
    }
    const candidateIds = [...new Set([...raw.values()].flat().map((d: any) => d.id))];
    let taken = new Set<string>();
    if (candidateIds.length) {
      const { data: takenDeps, error: takenError } = await db.from('bank_transactions')
        .select('matched_bank_deposit_id').in('matched_bank_deposit_id', candidateIds);
      if (takenError) loadErrors.push(`Matched bank deposits: ${takenError.message}`);
      taken = new Set((takenDeps ?? []).map((m: any) => m.matched_bank_deposit_id));
    }
    for (const [id, list] of raw) depositsByTxn.set(id, list.filter((d: any) => !taken.has(d.id)));
  }
  // Money in that may be an owner payment (Zelle, ACH): the database suggests
  // the unit (remembered sender, unit number in the memo, owner name, amount)
  // and staff confirm. Only units of the bank account's association(s).
  // Every open inflow on the page gets suggestions and the receive form.
  const receivable = inflows.filter((t: any) => t.bank_accounts?.gl_account_id);
  const suggestionsByTxn = new Map<string, any[]>();
  const assocsByBank = new Map<string, string[]>();
  const unitsByAssoc = new Map<string, { id: string; unit_number: string; association_name: string }[]>();
  if (receivable.length) {
    // One call per 100 lines, the batch limit (the database checks access to each one).
    const ids: string[] = receivable.map((t: any) => t.id);
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += SUGGEST_BATCH) chunks.push(ids.slice(i, i + SUGGEST_BATCH));
    const results = await Promise.all(chunks.map((p_ids) => db.rpc('suggest_bank_transaction_payments', { p_ids })));
    for (const t of receivable) suggestionsByTxn.set(t.id, []);
    for (const { data: suggested, error: suggestError } of results) {
      if (suggestError) loadErrors.push(`Owner payment suggestions: ${suggestError.message}`);
      for (const sg of (suggested ?? []) as any[]) suggestionsByTxn.get(sg.transaction_id)?.push(sg);
    }
    for (const t of receivable) {
      if (t.bank_accounts?.association_id) assocsByBank.set(t.bank_account_id, [t.bank_accounts.association_id]);
    }
    // A company-wide account serves the associations that name it as their bank.
    const companyWide: string[] = [...new Set<string>(receivable.map((t: any) => String(t.bank_account_id)))].filter((id) => !assocsByBank.has(id));
    if (companyWide.length) {
      const list = companyWide.join(',');
      const { data: linked, error: linkedError } = await db.from('associations')
        .select('id, operating_bank_account_id, reserve_bank_account_id, primary_bank_account_id')
        .is('archived_at', null)
        .or(`operating_bank_account_id.in.(${list}),reserve_bank_account_id.in.(${list}),primary_bank_account_id.in.(${list})`)
        .order('id')
        .limit(1000);
      if (linkedError) loadErrors.push(`Associations of company bank accounts: ${linkedError.message}`);
      for (const a of linked ?? []) {
        for (const bankId of companyWide) {
          if ([a.operating_bank_account_id, a.reserve_bank_account_id, a.primary_bank_account_id].includes(bankId)) {
            assocsByBank.set(bankId, [...(assocsByBank.get(bankId) ?? []), a.id]);
          }
        }
      }
    }
    const assocIds = [...new Set([...assocsByBank.values()].flat())];
    if (assocIds.length) {
      const unitRes = await fetchAllRows(() => db.from('units')
        .select('id, unit_number, buildings!inner(association_id, associations(name))')
        .in('buildings.association_id', assocIds)
        .is('archived_at', null)
        .order('unit_number')
        .order('id'), { maxRows: 10000 });
      if (unitRes.error) loadErrors.push(`Units: ${unitRes.error}`);
      for (const u of unitRes.rows as any[]) {
        const assoc = u.buildings?.association_id;
        if (!assoc) continue;
        unitsByAssoc.set(assoc, [...(unitsByAssoc.get(assoc) ?? []), { id: u.id, unit_number: u.unit_number, association_name: u.buildings?.associations?.name ?? '' }]);
      }
    }
  }
  const unitsForBank = (bankId: string) => (assocsByBank.get(bankId) ?? []).flatMap((a) => unitsByAssoc.get(a) ?? []);
  const { data: glOptions } = await db.from('gl_accounts').select('id, number, name').eq('active', true).order('number');
  const back = `/bank-accounts/feeds?${new URLSearchParams({ ...(filter ? { filter } : {}), ...(q ? { q } : {}), ...(bank_account_id ? { bank_account_id } : {}) }).toString()}`;
  const DONE: Record<string, string> = { match: 'Matched to the ledger', match_deposit: 'Matched to the bank deposit', post: 'Posted to the ledger', ignore: 'Transaction ignored', restore: 'Transaction back in review', receive: 'Received as an owner payment and matched to its bank deposit' };
  const pendingCount = txns.filter((t: any) => t.pending).length;

  return (
    <DataWorkspace
      title="Bank feed"
      description="Transactions imported from your bank. Match each one to the ledger entry it belongs to, post it if the books don't have it yet (bank fees, interest), or ignore it. Matched transactions start cleared on the next reconciliation."
      actions={plaidConfigured ? (
        <Link href="/bank-accounts/link-bank" className={buttonClass('secondary')}>Connect bank</Link>
      ) : undefined}
    >
      <div className="space-y-6">
        {pageError && <Alert tone="danger" title="Could not update the transaction">{pageError}</Alert>}
        {loadErrors.length > 0 && (
          <Alert tone="danger" title="Some bank feed data could not be loaded.">{loadErrors.join(' · ')}</Alert>
        )}
        {done && DONE[done] && <Alert tone="success" title={DONE[done]} />}
        {activeConnections.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeConnections.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-medium text-gray-800">
                  {item.plaid_institution_name || 'Connected Bank'}
                </span>
                <span className="text-gray-400">
                  Last sync: {item.last_sync_at ? date(item.last_sync_at) : 'Never'}
                </span>
                <RefreshButton plaidItemId={item.id} />
              </div>
            ))}
          </div>
        )}

        <MetricStrip
          metrics={[
            { label: 'Transactions', value: txns.length, sublabel: 'In current view' },
            { label: 'To review', value: unreviewedCount, sublabel: 'Not matched, posted or ignored' },
            { label: 'Unmatched', value: unmatchedCount, sublabel: 'No ledger entry yet' },
          ]}
        />

        <FilterBar action="/bank-accounts/feeds" searchDefault={q} searchPlaceholder="Search by name">
          <FilterSelect label="Queue" name="filter" defaultValue={filter}>
            <option value="">All transactions</option>
            <option value="unreviewed">To review</option>
            <option value="unmatched">Unmatched</option>
            <option value="ignored">Ignored</option>
            <option value="pending">Pending only</option>
          </FilterSelect>

          {(bankAccounts || []).length > 1 && (
            <FilterSelect label="Account" name="bank_account_id" defaultValue={bank_account_id}>
              <option value="">All accounts</option>
              {(bankAccounts || []).map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </FilterSelect>
          )}
        </FilterBar>

        {txns.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Description</TH>
                <TH className="text-right">Money out</TH>
                <TH className="text-right">Money in</TH>
                <TH>Ledger</TH>
              </TR>
            </THead>
            <tbody>
              {txns.map((txn: any) => {
                const candidates = candidatesByTxn.get(txn.id) ?? [];
                const depositCandidates = depositsByTxn.get(txn.id) ?? [];
                const suggestions = suggestionsByTxn.get(txn.id) ?? [];
                const top = suggestions[0];
                // Units of the bank account's association(s), for a manual choice even with no suggestion.
                const unitOptions = Number(txn.amount) < 0 ? unitsForBank(txn.bank_account_id) : [];
                return (
                  <TR key={txn.id}>
                    <TD className="whitespace-nowrap align-top">{date(txn.date)}</TD>
                    <TD className="align-top">
                      <div className="font-medium text-gray-900">{txn.name}</div>
                      {txn.merchant_name && <div className="text-[13px] text-gray-500">{txn.merchant_name}</div>}
                      {txn.original_description && txn.original_description !== txn.name && (
                        <div className="break-words text-[13px] text-gray-500">{txn.original_description}</div>
                      )}
                      <div className="text-[13px] text-gray-500">{txn.bank_accounts?.name}</div>
                    </TD>
                    <TD className="text-right tabular-nums align-top">{Number(txn.amount) > 0 ? money(Number(txn.amount)) : ''}</TD>
                    <TD className="text-right tabular-nums align-top">{Number(txn.amount) < 0 ? money(-Number(txn.amount)) : ''}</TD>
                    <TD className="align-top">
                      {txn.pending ? (
                        <StatusChip tone="warning">Pending at the bank</StatusChip>
                      ) : isMatched(txn) ? (
                        <StatusChip tone="success">{txn.match_method === 'posted' ? 'Posted' : txn.match_method === 'owner_payment' ? 'Owner payment' : txn.match_method === 'deposit' ? 'Matched to deposit' : txn.matched_journal_line_id ? 'Matched' : 'Matched to payout'}</StatusChip>
                      ) : txn.ignored_at ? (
                        <form action={bankFeedAction} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={txn.id} />
                          <input type="hidden" name="op" value="restore" />
                          <input type="hidden" name="back" value={back} />
                          <StatusChip tone="neutral">Ignored</StatusChip>
                          <Button type="submit" variant="ghost" size="sm">Review again</Button>
                        </form>
                      ) : !txn.bank_accounts?.gl_account_id ? (
                        <span className="text-sm text-amber-700">Link the bank account to a GL account first</span>
                      ) : (
                        <div className="space-y-2">
                          {(unitOptions.length > 0 || suggestions.length > 0) && (
                            <form action={bankFeedAction} className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                              <input type="hidden" name="id" value={txn.id} />
                              <input type="hidden" name="op" value="receive" />
                              <input type="hidden" name="back" value={back} />
                              <div className="text-[13px] font-medium text-gray-900">Receive as owner payment</div>
                              <p className="text-[13px] text-gray-500">
                                {top
                                  ? <>Suggested: {top.unit_label}{top.owner_name ? ` · ${top.owner_name}` : ''}. {top.reason} ({Math.round(Number(top.confidence) * 100)}% sure)</>
                                  : 'No unit found from the sender, memo or amount. Choose the unit that paid.'}
                              </p>
                              <div className="flex flex-wrap items-end gap-2">
                                <Select name="unit_id" aria-label="Unit that paid" defaultValue={top?.unit_id ?? ''} required className="min-w-56">
                                  <option value="">Choose the unit…</option>
                                  {suggestions.length > 0 && (
                                    <optgroup label="Suggested">
                                      {suggestions.map((sg: any) => (
                                        <option key={`s-${sg.unit_id}`} value={sg.unit_id}>{sg.unit_label}{sg.owner_name ? ` · ${sg.owner_name}` : ''}</option>
                                      ))}
                                    </optgroup>
                                  )}
                                  <optgroup label="All units">
                                    {unitOptions.filter((u) => !suggestions.some((sg: any) => sg.unit_id === u.id)).map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {/* A company-wide bank can serve associations that reuse unit numbers. */}
                                        {(assocsByBank.get(txn.bank_account_id)?.length ?? 0) > 1 && u.association_name
                                          ? `Unit ${u.unit_number} · ${u.association_name}`
                                          : `Unit ${u.unit_number}`}
                                      </option>
                                    ))}
                                  </optgroup>
                                </Select>
                                <PendingSubmit size="sm" pendingLabel="Receiving…">Receive</PendingSubmit>
                              </div>
                              <label className="flex min-h-10 items-center gap-2 text-[13px] text-gray-600">
                                <input type="checkbox" name="remember_sender" defaultChecked className="h-4 w-4 rounded border-gray-300" />
                                Remember this sender for this unit
                              </label>
                            </form>
                          )}
                          {depositCandidates.length > 0 && (
                            <form action={bankFeedAction} className="flex flex-wrap items-end gap-2">
                              <input type="hidden" name="id" value={txn.id} />
                              <input type="hidden" name="op" value="match_deposit" />
                              <input type="hidden" name="back" value={back} />
                              <Select name="bank_deposit_id" aria-label="Bank deposit" className="min-w-56">
                                {depositCandidates.map((d: any) => (
                                  <option key={d.id} value={d.id}>Bank deposit {date(d.deposit_date)} · {d.receipt_count} receipts</option>
                                ))}
                              </Select>
                              <Button type="submit" size="sm">Match</Button>
                            </form>
                          )}
                          {candidates.length > 0 && (
                            <form action={bankFeedAction} className="flex flex-wrap items-end gap-2">
                              <input type="hidden" name="id" value={txn.id} />
                              <input type="hidden" name="op" value="match" />
                              <input type="hidden" name="back" value={back} />
                              <Select name="journal_line_id" aria-label="Ledger entry" className="min-w-56">
                                {candidates.map((l: any) => (
                                  <option key={l.id} value={l.id}>
                                    {date(l.journal_entries.entry_date)} · {l.journal_entries.description ?? l.memo ?? 'Entry'}{l.journal_entries.reference_number ? ` #${l.journal_entries.reference_number}` : ''}
                                  </option>
                                ))}
                              </Select>
                              <Button type="submit" size="sm">Match</Button>
                            </form>
                          )}
                          <form action={bankFeedAction} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="id" value={txn.id} />
                            <input type="hidden" name="op" value="post" />
                            <input type="hidden" name="back" value={back} />
                            <Select name="gl_account_id" aria-label="GL account" defaultValue={txn.gl_account_id ?? ''} className="min-w-56">
                              <option value="">{candidates.length ? 'Or post to a GL account…' : 'Post to a GL account…'}</option>
                              {(glOptions ?? []).filter((g: any) => g.id !== txn.bank_accounts?.gl_account_id).map((g: any) => (
                                <option key={g.id} value={g.id}>{g.number} — {g.name}</option>
                              ))}
                            </Select>
                            <Button type="submit" size="sm" variant="secondary">Post</Button>
                          </form>
                          <form action={bankFeedAction}>
                            <input type="hidden" name="id" value={txn.id} />
                            <input type="hidden" name="op" value="ignore" />
                            <input type="hidden" name="back" value={back} />
                            <Button type="submit" size="sm" variant="ghost">Ignore</Button>
                          </form>
                        </div>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        ) : activeConnections.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={Landmark}
              title="No bank connections"
              description={plaidConfigured
                ? 'Link a bank account securely to start importing transactions.'
                : 'Automatic bank connections are not enabled. Manual bank-account and reconciliation workflows remain available.'}
              action={plaidConfigured ? (
                <Link href="/bank-accounts/link-bank" className={buttonClass()}>Connect bank</Link>
              ) : undefined}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={Landmark}
              title="No transactions yet"
              description="Click the sync button on your connected bank to import transactions, or they will appear once your bank processes them."
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
