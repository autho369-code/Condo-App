interface MfaPolicyIdentity {
  is_platform_operator: boolean;
  is_company_admin: boolean;
  is_staff: boolean;
  profile?: { mfa_required?: boolean } | null;
  portfolio?: {
    require_mfa_for_admins?: boolean;
    require_mfa_for_staff?: boolean;
  } | null;
}

/**
 * Resolve the effective MFA policy for an authenticated identity.
 *
 * Platform operators are always protected because they can cross tenant
 * boundaries. Portfolio policies apply independently to company admins and
 * staff, while an explicit per-profile requirement applies to any role.
 */
export function requiresMfa(identity: MfaPolicyIdentity): boolean {
  if (identity.is_platform_operator) return true;
  if (identity.profile?.mfa_required === true) return true;

  return (
    (identity.is_company_admin && identity.portfolio?.require_mfa_for_admins === true)
    || (identity.is_staff && identity.portfolio?.require_mfa_for_staff === true)
  );
}
