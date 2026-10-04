// Typed wrappers for the server-side totals RPCs
// (supabase/migrations/20261002013309_server_side_totals.sql).
// PostgREST caps a request at 1,000 rows, so summing fetched rows in the app
// understated cash, AR and billing totals for larger companies. These
// functions sum in the database under the caller's RLS.

type Db = any;

export type JournalTotalsFilter = {
  portfolioId?: string | null;
  glAccountIds?: string[] | null;
  associationIds?: string[] | null;
  accountTypes?: string[] | null;
  from?: string | null;
  to?: string | null;
};

export type JournalTotalRow = { gl_account_id: string; account_type: string; debit_total: number; credit_total: number };

export async function journalLineTotals(db: Db, f: JournalTotalsFilter = {}): Promise<JournalTotalRow[]> {
  // An explicitly empty id list means "nothing", not "everything".
  if ((f.glAccountIds && f.glAccountIds.length === 0) || (f.associationIds && f.associationIds.length === 0)) return [];
  const { data, error } = await db.rpc('journal_line_totals', {
    p_portfolio_id: f.portfolioId ?? null,
    p_gl_account_ids: f.glAccountIds ?? null,
    p_association_ids: f.associationIds ?? null,
    p_account_types: f.accountTypes ?? null,
    p_from: f.from ?? null,
    p_to: f.to ?? null,
  });
  // Fail loudly: returning [] here rendered balances as a silent $0.
  if (error) throw new Error(`Could not load journal totals: ${error.message}`);
  return ((data ?? []) as any[]).map((r) => ({
    gl_account_id: r.gl_account_id,
    account_type: r.account_type,
    debit_total: Number(r.debit_total ?? 0),
    credit_total: Number(r.credit_total ?? 0),
  }));
}

/** Debit-minus-credit balance per GL account (cash/asset convention). */
export async function glDebitBalances(db: Db, f: JournalTotalsFilter): Promise<Map<string, number>> {
  const rows = await journalLineTotals(db, f);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.gl_account_id, (map.get(r.gl_account_id) ?? 0) + r.debit_total - r.credit_total);
  return map;
}

/**
 * Income (credit-normal) and expense (debit-normal) totals for a period.
 * Account types follow gl_section(): cost_of_goods_sold and non_operating
 * are expense-section accounts.
 */
export async function incomeExpenseTotals(db: Db, f: Omit<JournalTotalsFilter, 'accountTypes'>): Promise<{ income: number; expense: number }> {
  const rows = await journalLineTotals(db, { ...f, accountTypes: ['income', 'other_income', 'expense', 'cost_of_goods_sold', 'other_expense', 'non_operating'] });
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.account_type === 'income' || r.account_type === 'other_income') income += r.credit_total - r.debit_total;
    else expense += r.debit_total - r.credit_total;
  }
  return { income, expense };
}

export type ReceivableSummary = { arTotal: number; overdueTotal: number; delinquentUnits: number; weightedDays: number | null };

/** `asOf` moves the overdue cut-off (overdue = due before asOf); defaults to today. */
export async function receivableSummary(db: Db, associationIds?: string[] | null, asOf?: string): Promise<ReceivableSummary> {
  const empty = { arTotal: 0, overdueTotal: 0, delinquentUnits: 0, weightedDays: null };
  if (associationIds && associationIds.length === 0) return empty;
  const { data, error } = await db.rpc('receivable_summary', { p_association_ids: associationIds ?? null, ...(asOf ? { p_as_of: asOf } : {}) });
  if (error) throw new Error(`Receivable summary could not be loaded: ${error.message}`);
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return empty;
  return {
    arTotal: Number(r.ar_total ?? 0),
    overdueTotal: Number(r.overdue_total ?? 0),
    delinquentUnits: Number(r.delinquent_units ?? 0),
    weightedDays: r.weighted_days == null ? null : Number(r.weighted_days),
  };
}

export async function billingCollectionTotals(db: Db, from: string, to: string, associationIds?: string[] | null): Promise<{ charges: number; payments: number }> {
  if (associationIds && associationIds.length === 0) return { charges: 0, payments: 0 };
  const { data, error } = await db.rpc('billing_collection_totals', { p_from: from, p_to: to, p_association_ids: associationIds ?? null });
  if (error) throw new Error(`Billing and collection totals could not be loaded: ${error.message}`);
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return { charges: 0, payments: 0 };
  return { charges: Number(r.charges_total ?? 0), payments: Number(r.payments_total ?? 0) };
}

export async function unpaidBillsTotal(db: Db, portfolioId?: string | null): Promise<{ total: number; count: number; overdue: number }> {
  const { data, error } = await db.rpc('unpaid_bills_total', { p_portfolio_id: portfolioId ?? null });
  if (error) throw new Error(`Unpaid bill totals could not be loaded: ${error.message}`);
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return { total: 0, count: 0, overdue: 0 };
  return { total: Number(r.unpaid_total ?? 0), count: Number(r.unpaid_count ?? 0), overdue: Number(r.overdue_total ?? 0) };
}

/** Receivable balance per aging bucket ('current', '1_30', '31_60', '61_90', '90_plus'). */
export async function receivableAgingBuckets(db: Db, associationIds?: string[] | null): Promise<Record<string, number>> {
  if (associationIds && associationIds.length === 0) return {};
  const { data, error } = await db.rpc('receivable_aging_buckets', { p_association_ids: associationIds ?? null });
  if (error) throw new Error(`Receivable aging could not be loaded: ${error.message}`);
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as any[]) out[r.aging_bucket] = (out[r.aging_bucket] ?? 0) + Number(r.balance_total ?? 0);
  return out;
}

/**
 * Posted debit/credit totals keyed by GL account id — the shape the report
 * pages build their trial balance, balance sheet and income statement from.
 */
export async function ledgerTotalsByAccount(db: Db, f: JournalTotalsFilter): Promise<Record<string, { debit: number; credit: number }>> {
  const rows = await journalLineTotals(db, f);
  const out: Record<string, { debit: number; credit: number }> = {};
  for (const r of rows) {
    const t = out[r.gl_account_id] ?? (out[r.gl_account_id] = { debit: 0, credit: 0 });
    t.debit += r.debit_total;
    t.credit += r.credit_total;
  }
  return out;
}

/**
 * Paid-bill totals per payer (association) and 1099 vendor for a tax year,
 * summed in the database, joined to the vendor and association details the
 * 1099 pages render. Each row stands in for all of that pair's bills.
 */
export async function vendor1099Rows(
  db: Db,
  taxYear: number,
  filter: { vendorId?: string | null; associationId?: string | null } = {},
): Promise<Array<{ association_id: string | null; vendor: any; association: any; amount: number; credit_applied: number; bill_count: number }>> {
  const { data, error } = await db.rpc('vendor_1099_totals', { p_tax_year: taxYear });
  if (error) throw new Error(`1099 vendor totals could not be loaded: ${error.message}`);
  const totals = ((data ?? []) as any[]).filter((r) =>
    (!filter.vendorId || r.vendor_id === filter.vendorId)
    && (!filter.associationId || r.association_id === filter.associationId));
  const vendorIds = [...new Set(totals.map((r) => r.vendor_id).filter(Boolean))];
  const associationIds = [...new Set(totals.map((r) => r.association_id).filter(Boolean))];
  const [{ data: vendors, error: vendorsError }, { data: associations, error: associationsError }] = await Promise.all([
    vendorIds.length > 0
      ? db.from('vendors').select('id, name, vendor_type, send_1099, taxpayer_name, vendor_financial_details(taxpayer_id, tax_account_number), address_street, address_city, address_state, address_zip').in('id', vendorIds)
      : Promise.resolve({ data: [] }),
    associationIds.length > 0
      ? db.from('associations').select('id, name, legal_name, address, city, state, zip, tax_id').in('id', associationIds)
      : Promise.resolve({ data: [] }),
  ]);
  if (vendorsError || associationsError) {
    throw new Error(`1099 vendor details could not be loaded: ${(vendorsError ?? associationsError).message}`);
  }
  const vendorById = new Map(((vendors ?? []) as any[]).map((v) => [v.id, v]));
  const associationById = new Map(((associations ?? []) as any[]).map((a) => [a.id, a]));
  return totals.map((r) => ({
    association_id: r.association_id ?? null,
    vendor: vendorById.get(r.vendor_id) ?? null,
    association: r.association_id ? associationById.get(r.association_id) ?? null : null,
    amount: Number(r.total_paid ?? 0),
    credit_applied: 0,
    bill_count: Number(r.bill_count ?? 0),
  }));
}
