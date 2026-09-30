import 'server-only';

/**
 * Active staff in the caller's own company, by id → display name. Uses
 * mentionable_staff(), which only ever returns the caller's company, so an id
 * found here is safe to assign.
 */
export async function companyStaff(db: any): Promise<Map<string, string>> {
  const { data } = await db.rpc('mentionable_staff');
  return new Map(((data ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]));
}
