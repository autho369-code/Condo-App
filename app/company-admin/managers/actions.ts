'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Company admin invites a manager into their own portfolio. If specific
// associations are selected, the invitation carries them so the manager is
// scoped to exactly those properties on acceptance (apply_pending_invitation
// creates the association_managers rows). No selection = full portfolio access.
export async function inviteManager(formData: FormData) {
  const me = await requirePortfolioAdmin()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const roleName = (formData.get('role_name') as string) || 'Property Manager'
  const associationIds = (formData.getAll('association_ids') as string[]).filter(Boolean)

  const fail = (msg: string) => redirect('/company-admin/managers?error=' + encodeURIComponent(msg))
  if (!email) fail('Enter an email address to invite.')
  if (!me.portfolio?.id) fail('Your account is not linked to a portfolio.')

  const supabase = await createClient()
  const { data: result, error } = await (supabase as any).rpc('invite_staff', {
    p_portfolio_id: me.portfolio!.id,
    p_email: email,
    p_role_name: roleName,
    p_message: `You have been invited to manage associations for ${me.portfolio?.company_name ?? 'your company'}. Your operating document (Manager Runbook): https://portier369.com/manuals/Portier369-Manager-Runbook.pdf`,
  })
  if (error) fail(error.message)

  // invite_staff returns the new invitation id; stamp the chosen associations on
  // it so the acceptance trigger scopes the manager to them.
  if (associationIds.length > 0 && result?.invitation_id) {
    const svc = createServiceClient() as any
    await svc
      .from('user_invitations')
      .update({ association_ids: associationIds })
      .eq('id', result.invitation_id)
  }

  revalidatePath('/company-admin/managers')
  redirect('/company-admin/managers?invited=' + encodeURIComponent(email))
}

// Company admin sets exactly which associations an existing manager can access.
// Writing zero rows = full portfolio access (no scoping).
export async function updateManagerAssociations(formData: FormData) {
  const me = await requirePortfolioAdmin()
  const managerId = formData.get('manager_id') as string
  const selected = (formData.getAll('association_ids') as string[]).filter(Boolean)
  const returnTo = `/company-admin/managers/${managerId}`
  const fail = (msg: string) => redirect(`${returnTo}?error=${encodeURIComponent(msg)}`)

  if (!managerId) fail('Missing manager.')
  if (!me.portfolio?.id) fail('Your account is not linked to a portfolio.')

  const supabase = await createClient()
  const db = supabase as any

  // Confirm the manager belongs to this portfolio.
  const { data: mgr } = await db
    .from('profiles')
    .select('id')
    .eq('id', managerId)
    .eq('portfolio_id', me.portfolio.id)
    .maybeSingle()
  if (!mgr) fail('Manager not found in your portfolio.')

  // Only allow associations that belong to this portfolio.
  const { data: portfolioAssocs } = await db
    .from('associations')
    .select('id')
    .eq('portfolio_id', me.portfolio.id)
    .is('archived_at', null)
  const allowed = new Set((portfolioAssocs ?? []).map((a: any) => a.id))
  const target = selected.filter((id) => allowed.has(id))

  const svc = createServiceClient() as any
  const { data: existing } = await svc
    .from('association_managers')
    .select('id, association_id')
    .eq('user_id', managerId)
  const existingIds = new Set((existing ?? []).map((r: any) => r.association_id))

  // Remove unchecked assignments.
  const toRemove = (existing ?? []).filter((r: any) => !target.includes(r.association_id)).map((r: any) => r.id)
  if (toRemove.length > 0) {
    await svc.from('association_managers').delete().in('id', toRemove)
  }
  // Add newly checked assignments.
  const toAdd = target
    .filter((id) => !existingIds.has(id))
    .map((id) => ({ user_id: managerId, association_id: id, portfolio_id: me.portfolio!.id, assigned_by: me.auth_user_id }))
  if (toAdd.length > 0) {
    await svc.from('association_managers').insert(toAdd)
  }

  revalidatePath(returnTo)
  redirect(`${returnTo}?saved=1`)
}
