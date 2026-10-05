import 'server-only';

/**
 * Check the association / unit / vendor a work-order form posted, with the
 * caller's RLS-scoped client: the association must be visible to the caller,
 * the unit must be in it, and the vendor must belong to the association's own
 * company (a foreign vendor id would hand that vendor the job, the unit and the
 * association). Returns the association's portfolio id to store on the row.
 */
export async function checkWorkOrderLinks(
  db: any,
  associationId: string,
  unitId: string | null,
  vendorId: string | null,
): Promise<{ portfolioId: string; error?: undefined } | { error: string; portfolioId?: undefined }> {
  const { data: association, error: associationError } = await db
    .from('associations').select('id, portfolio_id').eq('id', associationId).maybeSingle();
  if (associationError) return { error: associationError.message };
  if (!association?.portfolio_id) return { error: 'That association was not found or is outside your access.' };
  if (unitId) {
    const { data: unit } = await db.from('units').select('id, buildings!inner(association_id)').eq('id', unitId).maybeSingle();
    if (!unit || unit.buildings?.association_id !== associationId) return { error: 'That unit is not in the selected association.' };
  }
  if (vendorId) {
    const { data: vendor } = await db.from('vendors').select('id')
      .eq('id', vendorId).eq('portfolio_id', association.portfolio_id).is('archived_at', null).maybeSingle();
    if (!vendor) return { error: 'That vendor is not one of this company’s vendors.' };
  }
  return { portfolioId: association.portfolio_id as string };
}
