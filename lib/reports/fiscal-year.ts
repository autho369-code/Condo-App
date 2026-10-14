import { fiscalYearStartDate } from '@/lib/reports/financial';

/**
 * First day of the fiscal year containing `asOf`: the association's fiscal
 * year when one is selected, else the company's. `portfolioId` is required
 * with a service client; a signed-in client reads its own company's row.
 */
export async function fiscalYearStartFor(
  db: any,
  asOf: string,
  associationId: string | null,
  portfolioId?: string | null,
): Promise<string> {
  let month: number | null = null;
  if (associationId) {
    const { data, error } = await db.from('associations').select('fiscal_year_start').eq('id', associationId).maybeSingle();
    if (error) throw new Error(`Could not load the association's fiscal year: ${error.message}`);
    month = data?.fiscal_year_start ?? null;
  } else {
    let query = db.from('portfolios').select('fiscal_year_start_month');
    query = portfolioId ? query.eq('id', portfolioId) : query.order('id');
    const { data, error } = await query.limit(2);
    if (error) throw new Error(`Could not load the company's fiscal year: ${error.message}`);
    // A user who can read several companies (platform operator) gets January.
    month = (data ?? []).length === 1 ? data[0].fiscal_year_start_month ?? null : null;
  }
  return fiscalYearStartDate(asOf, month);
}
