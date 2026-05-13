'use server';

import { requireStaff } from '@/lib/auth/me';
import {
  assertOwnerPortalActionAllowed,
  buildOwnerPortalRedirectTo,
  getOwnerPortalGeneratedLinkType,
  getOwnerPortalStatus,
  normalizeOwnerPortalEmail,
} from '@/lib/auth/owner-portal';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export type OwnerPortalLinkState = {
  ok: boolean;
  kind: 'invite' | 'recovery' | null;
  email: string | null;
  actionLink: string | null;
  error: string | null;
};

export const initialOwnerPortalLinkState: OwnerPortalLinkState = {
  ok: false,
  kind: null,
  email: null,
  actionLink: null,
  error: null,
};

function ownerPortalBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_PORTAL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    'http://localhost:3000'
  );
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function generateOwnerPortalAccessLink(
  _previousState: OwnerPortalLinkState,
  formData: FormData,
): Promise<OwnerPortalLinkState> {
  try {
    const ownerId = formString(formData, 'owner_id');
    if (!ownerId) throw new Error('Owner is required.');

    const me = await requireStaff();
    const supabase = await createClient();
    const { data: owner, error: ownerError } = await (supabase as any)
      .from('owners')
      .select('id, full_name, email, portfolio_id, auth_user_id, portal_activated')
      .eq('id', ownerId)
      .is('archived_at', null)
      .maybeSingle();

    if (ownerError) throw new Error(ownerError.message);
    if (!owner) throw new Error('Owner not found.');

    assertOwnerPortalActionAllowed(owner, me);
    const email = normalizeOwnerPortalEmail(owner.email)!;
    const kind = getOwnerPortalGeneratedLinkType(getOwnerPortalStatus(owner));
    if (!kind) throw new Error('Owner needs an email address before a link can be created.');

    const redirectTo = buildOwnerPortalRedirectTo(ownerPortalBaseUrl());
    const service = createServiceClient() as any;
    const params =
      kind === 'invite'
        ? {
            type: 'invite',
            email,
            options: owner.full_name ? { data: { full_name: owner.full_name }, redirectTo } : { redirectTo },
          }
        : {
            type: 'recovery',
            email,
            options: { redirectTo },
          };

    const { data, error } = await service.auth.admin.generateLink(params);
    if (error) throw new Error(error.message);

    const actionLink = data?.properties?.action_link;
    const authUserId = data?.user?.id;
    if (!actionLink) throw new Error('Supabase did not return a portal link.');

    if (kind === 'invite' && authUserId) {
      const { error: updateError } = await service
        .from('owners')
        .update({ auth_user_id: authUserId })
        .eq('id', ownerId);
      if (updateError) throw new Error(updateError.message);
    }

    return {
      ok: true,
      kind,
      email,
      actionLink,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      kind: null,
      email: null,
      actionLink: null,
      error: error instanceof Error ? error.message : 'Could not create portal link.',
    };
  }
}
