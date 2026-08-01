'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { queueEmails } from '@/lib/email/queue'
import { tenantWorkspaceUrl } from '@/lib/tenant/host'

// Company admin invites a manager into their own portfolio. If specific
// associations are selected, the invitation carries them so the manager is
// scoped to exactly those properties on acceptance (apply_pending_invitation
// creates the association_managers rows). No selection = full portfolio access.
export async function inviteManager(formData: FormData) {
  const me = await requirePortfolioAdmin()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const associationIds = (formData.getAll('association_ids') as string[]).filter(Boolean)

  const fail = (msg: string): never => redirect('/company-admin/managers?error=' + encodeURIComponent(msg))
  if (!email) fail('Enter an email address to invite.')
  if (!me.portfolio?.id) fail('Your account is not linked to a portfolio.')

  const supabase = await createClient()
  const { data: result, error } = await (supabase as any).rpc('create_manager_invitation', {
    p_email: email,
    p_association_ids: associationIds,
    p_message: `You have been invited to manage associations for ${me.portfolio?.company_name ?? 'your company'}. Your operating document (Manager Runbook): https://portier369.com/manuals/Portier369-Manager-Runbook.pdf`,
  })
  if (error) fail(error.message)

  const invitationId = result?.invitation_id as string | undefined
  const token = result?.token as string | undefined
  if (typeof invitationId !== 'string' || typeof token !== 'string') {
    fail('The invitation could not be created safely.')
  }

  const svc = createServiceClient() as any

  const companyName = me.portfolio.company_name ?? 'your management company'
  const inviteUrl = tenantWorkspaceUrl(
    me.portfolio.slug,
    `/invite?token=${encodeURIComponent(token as string)}`,
  )
  const queued = await queueEmails(svc, [{
    to: email,
    subject: `You're invited to manage properties for ${companyName} on Portier369`,
    text: [
      `You have been invited to join ${companyName} as a Property Manager.`,
      '',
      'Set up your account:',
      inviteUrl,
      '',
      `This invitation expires ${new Date(result.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`,
    ].join('\n'),
    portfolioId: me.portfolio.id,
    sentBy: me.auth_user_id,
    idempotencyKey: `manager-invitation:${invitationId}`,
  }])
  if (queued.error || queued.count !== 1) {
    await svc.from('user_invitations').delete().eq('id', invitationId)
    fail(queued.error ?? 'Could not queue the manager invitation email.')
  }

  await svc.from('audit_logs').insert({
    portfolio_id: me.portfolio.id,
    entity_type: 'user',
    entity_id: null,
    action: 'manager_invited',
    actor_id: me.auth_user_id,
    actor_email: me.email,
    changes: { email, association_ids: associationIds, invitation_id: invitationId },
  })

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
  const fail = (msg: string): never => redirect(`${returnTo}?error=${encodeURIComponent(msg)}`)

  if (!managerId) fail('Missing manager.')
  if (!me.portfolio?.id) fail('Your account is not linked to a portfolio.')

  const supabase = await createClient()
  const { error } = await (supabase as any).rpc('set_manager_association_scope', {
    p_manager_id: managerId,
    p_association_ids: selected,
  })
  if (error) fail(error.message)

  revalidatePath(returnTo)
  redirect(`${returnTo}?saved=1`)
}

export async function setManagerLoginStatus(formData: FormData) {
  const me = await requirePortfolioAdmin()
  const managerId = formData.get('manager_id') as string
  const action = formData.get('action') as string
  const returnTo = `/company-admin/managers/${managerId}`
  const fail = (msg: string): never => redirect(`${returnTo}?error=${encodeURIComponent(msg)}`)
  if (!managerId || !['disable', 'enable'].includes(action)) fail('Invalid manager status request.')
  if (!me.portfolio?.id) fail('Your account is not linked to a portfolio.')
  if (managerId === me.auth_user_id) fail('You cannot disable your own account.')

  const svc = createServiceClient() as any
  const { data: manager } = await svc.from('profiles')
    .select('id, email, disabled_at')
    .eq('id', managerId)
    .eq('portfolio_id', me.portfolio.id)
    .eq('hoa_role', 'manager')
    .maybeSingle()
  if (!manager) fail('Manager not found in your portfolio.')

  const disabling = action === 'disable'
  const { error: authError } = await svc.auth.admin.updateUserById(managerId, {
    ban_duration: disabling ? '876000h' : 'none',
  })
  if (authError) fail(`Could not ${action} the manager login: ${authError.message}`)

  const { data: updatedProfile, error: profileError } = await svc.from('profiles')
    .update({ disabled_at: disabling ? new Date().toISOString() : null })
    .eq('id', managerId)
    .eq('portfolio_id', me.portfolio.id)
    .select('id')
    .single()
  if (profileError || !updatedProfile) {
    const { error: rollbackError } = await svc.auth.admin.updateUserById(managerId, {
      ban_duration: disabling ? 'none' : '876000h',
    })
    fail(rollbackError
      ? `Profile update and login rollback both failed. Contact platform support: ${profileError?.message ?? 'profile not found'}`
      : `Could not ${action} the manager profile: ${profileError?.message ?? 'profile not found'}`)
  }

  await svc.from('audit_logs').insert({
    portfolio_id: me.portfolio.id,
    entity_type: 'user',
    entity_id: managerId,
    action: disabling ? 'manager_disabled' : 'manager_enabled',
    actor_id: me.auth_user_id,
    actor_email: me.email,
    changes: { email: manager.email, disabled_at: disabling ? 'set' : null },
  })

  revalidatePath('/company-admin/managers')
  revalidatePath(returnTo)
  redirect(`${returnTo}?${disabling ? 'disabled' : 'enabled'}=1`)
}
