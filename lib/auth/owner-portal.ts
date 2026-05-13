import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireStaff, type MeResult } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export type OwnerPortalStatus = 'active' | 'invited' | 'needs_invite' | 'missing_email';

type OwnerForPortal = {
  id?: string | null;
  full_name?: string | null;
  email?: string | null;
  portfolio_id?: string | null;
  auth_user_id?: string | null;
  portal_activated?: boolean | null;
};

type PortalActor = Pick<MeResult, 'is_platform_operator' | 'portfolio'> | {
  is_platform_operator?: boolean;
  roles?: string[];
  portfolio?: { id?: string | null } | null;
};

export function normalizeOwnerPortalEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export function buildOwnerPortalRedirectTo(baseUrl: string, next = '/reset-password') {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const url = new URL('/api/auth/callback', base || 'http://localhost:3000');
  url.searchParams.set('next', next.startsWith('/') ? next : `/${next}`);
  return url.toString();
}

export function getOwnerPortalStatus(owner: OwnerForPortal): OwnerPortalStatus {
  if (!normalizeOwnerPortalEmail(owner.email)) return 'missing_email';
  if (owner.portal_activated) return 'active';
  if (owner.auth_user_id) return 'invited';
  return 'needs_invite';
}

export function assertOwnerPortalActionAllowed(owner: OwnerForPortal, actor: PortalActor) {
  if (!normalizeOwnerPortalEmail(owner.email)) {
    throw new Error('Owner needs an email address before portal access can be sent.');
  }

  const actorPortfolioId = actor.portfolio?.id ?? null;
  if (!actor.is_platform_operator && owner.portfolio_id && actorPortfolioId && owner.portfolio_id !== actorPortfolioId) {
    throw new Error('Owner belongs to another portfolio.');
  }
}

export function ownerPortalStatusLabel(status: OwnerPortalStatus) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'invited':
      return 'Invited';
    case 'missing_email':
      return 'Missing email';
    case 'needs_invite':
    default:
      return 'Needs invite';
  }
}

export function ownerPortalStatusTone(status: OwnerPortalStatus) {
  switch (status) {
    case 'active':
      return 'success' as const;
    case 'invited':
      return 'info' as const;
    case 'missing_email':
      return 'danger' as const;
    case 'needs_invite':
    default:
      return 'warning' as const;
  }
}

function ownerPortalBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_PORTAL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    'http://localhost:3000'
  );
}

function safeReturnPath(returnTo: string | null | undefined, fallback = '/owners/activations') {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) return fallback;
  return returnTo;
}

function resultPath(returnTo: string, params: Record<string, string>) {
  const url = new URL(safeReturnPath(returnTo), 'http://local.test');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

async function loadPortalOwner(ownerId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from('owners')
    .select('id, full_name, email, portfolio_id, auth_user_id, portal_activated')
    .eq('id', ownerId)
    .is('archived_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Owner not found.');
  return data as OwnerForPortal;
}

function revalidateOwnerPortalPaths(ownerId: string) {
  revalidatePath('/owners');
  revalidatePath('/owners/activations');
  revalidatePath(`/owners/${ownerId}`);
}

export async function sendOwnerPortalInvite(ownerId: string, returnTo: string, _formData?: FormData) {
  'use server';

  let target = safeReturnPath(returnTo);
  try {
    const me = await requireStaff();
    const owner = await loadPortalOwner(ownerId);
    assertOwnerPortalActionAllowed(owner, me);
    const portfolioId = owner.portfolio_id ?? me.portfolio?.id;
    if (!portfolioId) throw new Error('Owner needs a portfolio before portal access can be sent.');

    const email = normalizeOwnerPortalEmail(owner.email)!;
    const redirectTo = buildOwnerPortalRedirectTo(ownerPortalBaseUrl());

    if (owner.auth_user_id) {
      const supabase = await createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw new Error(error.message);

      revalidateOwnerPortalPaths(ownerId);
      target = resultPath(returnTo, { portal_reset_sent: email });
    } else {
      const service = createServiceClient() as any;
      const inviteOptions = owner.full_name ? { data: { full_name: owner.full_name }, redirectTo } : { redirectTo };
      const { data, error } = await service.auth.admin.inviteUserByEmail(email, inviteOptions);
      if (error) throw new Error(error.message);

      const authUserId = data?.user?.id;
      if (!authUserId) throw new Error('Supabase did not return an invited user.');

      const { error: updateError } = await service
        .from('owners')
        .update({ auth_user_id: authUserId })
        .eq('id', ownerId);
      if (updateError) throw new Error(updateError.message);

      await service.from('user_invitations').insert({
        portfolio_id: portfolioId,
        email,
        full_name: owner.full_name ?? null,
        hoa_role: 'owner',
        status: 'pending',
        invited_by: me.auth_user_id,
        message: 'Owner portal invitation sent through Supabase Auth.',
      });

      revalidateOwnerPortalPaths(ownerId);
      target = resultPath(returnTo, { portal_invite_sent: email });
    }
  } catch (error) {
    target = resultPath(returnTo, {
      portal_error: error instanceof Error ? error.message : 'Could not send portal invitation.',
    });
  }

  redirect(target);
}

export async function sendOwnerPortalPasswordReset(ownerId: string, returnTo: string, _formData?: FormData) {
  'use server';

  let target = safeReturnPath(returnTo);
  try {
    const me = await requireStaff();
    const owner = await loadPortalOwner(ownerId);
    assertOwnerPortalActionAllowed(owner, me);

    if (!owner.auth_user_id) {
      throw new Error('Send a portal invitation before sending a password reset link.');
    }

    const email = normalizeOwnerPortalEmail(owner.email)!;
    const supabase = await createClient();
    const redirectTo = buildOwnerPortalRedirectTo(ownerPortalBaseUrl());
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(error.message);

    revalidateOwnerPortalPaths(ownerId);
    target = resultPath(returnTo, { portal_reset_sent: email });
  } catch (error) {
    target = resultPath(returnTo, {
      portal_error: error instanceof Error ? error.message : 'Could not send password reset link.',
    });
  }

  redirect(target);
}
