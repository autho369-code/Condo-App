import { apiJson, authenticatePortfolioApi, listResponse, pagination } from '@/lib/api/portfolio-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticatePortfolioApi(request, 'read:vendors');
  if (!auth.ok) return auth.response;
  const { page, limit, offset, query } = pagination(request);
  let statement = auth.db
    .from('vendors')
    .select('id, name, vendor_type, trade, payment_terms, portal_activated, general_liability_expiration, workers_comp_expiration, state_license_expiration, created_at, updated_at', { count: 'exact' })
    .eq('portfolio_id', auth.portfolioId)
    .is('archived_at', null)
    .order('name')
    .range(offset, offset + limit - 1);
  if (query) statement = statement.ilike('name', `%${query}%`);
  const { data, count, error } = await statement;
  if (error) return apiJson({ error: { code: 'query_failed', message: 'Vendors could not be loaded.' } }, { status: 500, headers: auth.headers });
  return listResponse(data ?? [], count, page, limit, auth.headers);
}
