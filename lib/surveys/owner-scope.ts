/**
 * The surveys an owner may see and answer: open, in the owner's own company,
 * and for every association or one the owner lives in. Applied explicitly in
 * the portal (RLS does the same) so a staffer, board member or platform
 * operator who is also an owner gets only the owner view.
 */
export async function ownerSurveyScope(db: any, me: { owner_id: string | null; owner_ids?: string[] | null; resident_association_ids?: string[] | null }) {
  // Every record of the login is in the login's own company (current_owner_ids).
  const ownerIds = me.owner_ids?.length ? me.owner_ids : me.owner_id ? [me.owner_id] : [];
  const { data: owner } = ownerIds.length
    ? await db.from('owners').select('portfolio_id').in('id', ownerIds).limit(1).maybeSingle()
    : { data: null };
  const assocIds = me.resident_association_ids ?? [];
  return {
    portfolioId: (owner?.portfolio_id as string | undefined) ?? null,
    associationFilter: assocIds.length ? `association_id.is.null,association_id.in.(${assocIds.join(',')})` : 'association_id.is.null',
  };
}

/** Applies the owner scope to a surveys query; with no known company it matches nothing. */
export function scopeOwnerSurveys(query: any, scope: { portfolioId: string | null; associationFilter: string }) {
  return query
    .eq('portfolio_id', scope.portfolioId ?? '00000000-0000-0000-0000-000000000000')
    .eq('active', true)
    .is('archived_at', null)
    .or(scope.associationFilter);
}
