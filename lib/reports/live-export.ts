import { addLedgerLine } from '@/lib/reports/financial';
type ServiceClient = any;
export const LIVE_EXPORT_SLUGS = ['trial_balance'] as const;
export function supportsLiveExport(slug: unknown): slug is (typeof LIVE_EXPORT_SLUGS)[number] { return typeof slug === 'string' && (LIVE_EXPORT_SLUGS as readonly string[]).includes(slug); }
function stringParam(params: Record<string, unknown>, name: string): string | null { const value = params[name]; return typeof value === 'string' && value.trim() ? value.trim() : null; }
export async function generateLiveExportRows(db: ServiceClient, portfolioId: string, slug: (typeof LIVE_EXPORT_SLUGS)[number], rawParams: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  if (slug !== 'trial_balance') throw new Error(`Live export not implemented for ${slug}`);
  const associationId = stringParam(rawParams, 'association_id');
  const asOf = stringParam(rawParams, 'date_to') ?? new Date().toISOString().slice(0, 10);
  if (associationId) { const { data: association } = await db.from('associations').select('id').eq('id', associationId).eq('portfolio_id', portfolioId).maybeSingle(); if (!association) throw new Error('Association is not in this portfolio.'); }
  let accountsQuery = db.from('gl_accounts').select('id, number, name, account_type').eq('portfolio_id', portfolioId).eq('active', true).order('number');
  if (associationId) accountsQuery = accountsQuery.or(`association_id.is.null,association_id.eq.${associationId}`);
  const { data: accounts, error: accountsError } = await accountsQuery;
  if (accountsError) throw accountsError;
  const accountRows = accounts ?? []; const accountIds = accountRows.map((account: any) => account.id); if (accountIds.length === 0) return [];
  let linesQuery = db.from('journal_lines').select('gl_account_id, debit_amount, credit_amount, journal_entries!inner(entry_date, posted)').in('gl_account_id', accountIds).eq('journal_entries.posted', true).lte('journal_entries.entry_date', asOf);
  if (associationId) linesQuery = linesQuery.eq('association_id', associationId);
  const { data: lines, error: linesError } = await linesQuery; if (linesError) throw linesError;
  const totals: Record<string, { debit: number; credit: number }> = {}; for (const account of accountRows) totals[account.id] = { debit: 0, credit: 0 }; for (const line of lines ?? []) addLedgerLine(totals, line.gl_account_id, line.debit_amount, line.credit_amount);
  const rows = accountRows.map((account: any) => { const total = totals[account.id] ?? { debit: 0, credit: 0 }; return { 'Account #': account.number, Account: account.name, Type: account.account_type, Debit: total.debit, Credit: total.credit, 'Net balance': total.debit - total.credit, 'As of': asOf }; });
  const totalDebit = rows.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.Debit), 0); const totalCredit = rows.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.Credit), 0);
  rows.push({ 'Account #': '', Account: 'Totals', Type: '', Debit: totalDebit, Credit: totalCredit, 'Net balance': totalDebit - totalCredit, 'As of': asOf }); return rows;
}
