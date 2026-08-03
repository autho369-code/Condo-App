import { apiJson, authenticatePortfolioApi, listResponse, pagination } from '@/lib/api/portfolio-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticatePortfolioApi(request, 'read:work_orders');
  if (!auth.ok) return auth.response;
  const { page, limit, offset, query } = pagination(request);
  let statement = auth.db
    .from('work_orders')
    .select('id, number, title, status, priority, category, trade, scheduled_date, completed_date, association_id, unit_id, vendor_id, created_at, updated_at, associations!inner(name, portfolio_id)', { count: 'exact' })
    .eq('associations.portfolio_id', auth.portfolioId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (query) statement = statement.or(`number.ilike.%${query}%,title.ilike.%${query}%`);
  const { data, count, error } = await statement;
  if (error) return apiJson({ error: { code: 'query_failed', message: 'Work orders could not be loaded.' } }, { status: 500, headers: auth.headers });
  return listResponse(data ?? [], count, page, limit, auth.headers);
}
