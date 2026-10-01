import { Button } from '@/components/ui/button';
import {
  BOARD_PERMISSIONS,
  BOARD_ROLES,
  PERMISSION_LABELS,
  ROLE_LABELS,
  type BoardPermission,
  type BoardRole,
} from '@/lib/board/permission-catalog';

/**
 * Officer permission matrix for one association: permissions down the side,
 * board roles across the top. Saved rows override the default (allowed).
 */
export function OfficerPermissionsForm({
  associationId,
  saved,
  rolesSeated,
  action,
  canEdit,
}: {
  associationId: string;
  saved: { role: BoardRole; permission: BoardPermission; allowed: boolean }[];
  rolesSeated: Set<string>;
  action: (formData: FormData) => void | Promise<void>;
  canEdit: boolean;
}) {
  const allowed = (permission: BoardPermission, role: BoardRole) =>
    saved.find((s) => s.permission === permission && s.role === role)?.allowed ?? true;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="association_id" value={associationId} />
      <fieldset disabled={!canEdit}>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Permission</th>
                {BOARD_ROLES.map((role) => (
                  <th key={role} className="px-3 py-2 text-center font-semibold">
                    {ROLE_LABELS[role]}
                    {!rolesSeated.has(role) && <span className="block text-[10px] font-normal normal-case text-gray-400">no one seated</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BOARD_PERMISSIONS.map((permission) => (
                <tr key={permission} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-gray-900">{PERMISSION_LABELS[permission].title}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{PERMISSION_LABELS[permission].detail}</div>
                  </td>
                  {BOARD_ROLES.map((role) => (
                    <td key={role} className="px-3 py-3 text-center align-middle">
                      <input
                        type="checkbox"
                        name={`perm:${permission}:${role}`}
                        defaultChecked={allowed(permission, role)}
                        aria-label={`${ROLE_LABELS[role]}: ${PERMISSION_LABELS[permission].title}`}
                        className="h-5 w-5 rounded border-gray-300"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit">Save officer permissions</Button>
            <Button type="submit" name="preset" value="recommended" variant="secondary">
              Apply recommended split
            </Button>
          </div>
        )}
      </fieldset>
      <p className="text-xs text-gray-500">
        Recommended split: only the president and treasurer vote on approvals and see owner balances; every officer sees
        financials and can comment. Enforced by the database, not just hidden in the portal.
      </p>
    </form>
  );
}
