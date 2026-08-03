import { apiJson, authenticatePortfolioApi, listResponse, pagination } from '@/lib/api/portfolio-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticatePortfolioApi(request, 'read:violations');
  if (!auth.ok) return auth.response;
  const { page, limit, offset, query } = pagination(request);
  let statement = auth.db
    .from('violations')
    .select('id, association_id, unit_id, title, violation_type, status, date_observed, cure_deadline, due_date, fine_amount, hearing_date, created_at, updated_at, associations!inner(name, portfolio_id)', { count: 'exact' })
    .eq('associations.portfolio_id', auth.portfolioId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (query) statement = statement.ilike('title', `%${query}%`);
  const { data, count, error } = await statement;
  if (error) return apiJson({ error: { code: 'query_failed', message: 'Violations could not be loaded.' } }, { status: 500, headers: auth.headers });
  return listResponse(data ?? [], count, page, limit, auth.headers);
}
