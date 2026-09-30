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

/**
 * Team members who can actually open this work order — association-scoped
 * managers only for their own associations. Use this (not companyStaff) for
 * anything assigned to or credited on a work order.
 */
export async function workOrderStaff(db: any, workOrderId: string): Promise<Map<string, string>> {
  const { data } = await db.rpc('work_order_staff', { p_work_order: workOrderId });
  return new Map(((data ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]));
}
