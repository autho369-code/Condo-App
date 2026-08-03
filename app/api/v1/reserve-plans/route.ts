import { apiJson, authenticatePortfolioApi, listResponse, pagination } from '@/lib/api/portfolio-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticatePortfolioApi(request, 'read:reserves');
  if (!auth.ok) return auth.response;
  const { page, limit, offset, query } = pagination(request);
  let statement = auth.db
    .from('reserve_studies')
    .select('id, association_id, name, status, study_date, base_year, horizon_years, opening_balance, annual_contribution, annual_contribution_growth_rate, annual_inflation_rate, annual_interest_rate, funding_goal, approved_at, created_at, updated_at, associations(name)', { count: 'exact' })
    .eq('portfolio_id', auth.portfolioId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (query) statement = statement.ilike('name', `%${query}%`);
  const { data, count, error } = await statement;
  if (error) return apiJson({ error: { code: 'query_failed', message: 'Reserve plans could not be loaded.' } }, { status: 500, headers: auth.headers });
  return listResponse(data ?? [], count, page, limit, auth.headers);
}
