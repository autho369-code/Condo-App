// A manager with no association_managers rows has FULL portfolio access
// (set_manager_association_scope writes zero rows for "no scoping"). Counting
// only the rows showed those managers as having 0 associations / 0 doors.

export type ManagerScope = { associationIds: string[]; fullAccess: boolean }

export function effectiveManagerScope(assignedIds: readonly string[], portfolioAssociationIds: readonly string[]): ManagerScope {
  const portfolio = new Set(portfolioAssociationIds)
  const assigned = [...new Set(assignedIds)].filter((id) => portfolio.has(id))
  if (assignedIds.length === 0) return { associationIds: [...portfolio], fullAccess: true }
  return { associationIds: assigned, fullAccess: false }
}
