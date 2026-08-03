import { apiJson, authenticatePortfolioApi, listResponse, pagination } from '@/lib/api/portfolio-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticatePortfolioApi(request, 'read:associations');
  if (!auth.ok) return auth.response;
  const { page, limit, offset, query } = pagination(request);
  let statement = auth.db
    .from('associations')
    .select('id, slug, name, legal_name, address, city, state, zip, unit_count, created_at', { count: 'exact' })
    .eq('portfolio_id', auth.portfolioId)
    .is('archived_at', null)
    .order('name')
    .range(offset, offset + limit - 1);
  if (query) statement = statement.or(`name.ilike.%${query}%,city.ilike.%${query}%`);
  const { data, count, error } = await statement;
  if (error) return apiJson({ error: { code: 'query_failed', message: 'Associations could not be loaded.' } }, { status: 500, headers: auth.headers });
  return listResponse(data ?? [], count, page, limit, auth.headers);
}
