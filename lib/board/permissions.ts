import 'server-only';
import { BOARD_PERMISSIONS, type BoardPermission } from './permission-catalog';

export type BoardPermissions = {
  /** Permission in this association (missing association → false). */
  can(associationId: string | null | undefined, permission: BoardPermission): boolean;
  /** Permission in at least one of the member's associations. */
  any(permission: BoardPermission): boolean;
  /** Associations where the member holds the permission. */
  associationsWith(permission: BoardPermission): string[];
};

/**
 * The signed-in board member's officer permissions (my_board_permissions RPC).
 * The database enforces these; the portal uses them to hide what the member
 * can't use. Fails closed if the RPC errors.
 */
export async function getBoardPermissions(db: any): Promise<BoardPermissions> {
  const { data } = await db.rpc('my_board_permissions');
  const granted = new Map<BoardPermission, Set<string>>(BOARD_PERMISSIONS.map((p) => [p, new Set<string>()]));
  for (const row of (data ?? []) as { association_id: string; permission: BoardPermission; allowed: boolean }[]) {
    if (row.allowed) granted.get(row.permission)?.add(row.association_id);
  }
  return {
    can: (associationId, permission) => !!associationId && !!granted.get(permission)?.has(associationId),
    any: (permission) => (granted.get(permission)?.size ?? 0) > 0,
    associationsWith: (permission) => [...(granted.get(permission) ?? [])],
  };
}
