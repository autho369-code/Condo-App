import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
const password = process.env.STAGING_TEST_PASSWORD
if (!url || !anonKey || !serviceKey || !password || new URL(url).hostname.split('.')[0] !== STAGING_REF) {
  throw new Error('Exact staging credentials are required')
}

const ids = {
  associationA: '36900000-0000-4000-8000-000000000011',
  associationB: '36900000-0000-4000-8000-000000000021',
}
const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function signIn(email) {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`${email} sign-in: ${error.message}`)
  return client
}

async function assignments(userId) {
  const { data, error } = await service.from('association_managers')
    .select('association_id').eq('user_id', userId).is('ended_at', null).order('association_id')
  if (error) throw error
  return (data ?? []).map((row) => row.association_id)
}

async function main() {
  const startedAt = new Date().toISOString()
  const inviteEmail = `codex_test.manager.invite.${Date.now()}@portier369.invalid`
  let invitationId = null
  const [{ data: managerA }, { data: foreignProfile }] = await Promise.all([
    service.from('profiles').select('id').eq('email', 'codex_test.manager.a@portier369.invalid').single(),
    service.from('profiles').select('id').eq('email', 'codex_test.admin.b@portier369.invalid').single(),
  ])
  const originalA = await assignments(managerA.id)
  const originalForeign = await assignments(foreignProfile.id)
  const adminA = await signIn('codex_test.admin.a@portier369.invalid')
  const ordinaryManager = await signIn('codex_test.manager.a@portier369.invalid')

  try {
    const invited = await adminA.rpc('create_manager_invitation', {
      p_email: inviteEmail,
      p_association_ids: [ids.associationA, ids.associationA],
      p_message: 'Automated staging lifecycle verification',
    })
    if (invited.error) throw invited.error
    invitationId = invited.data?.invitation_id
    assert(typeof invitationId === 'string', 'Manager invitation did not return an invitation ID')
    assert(JSON.stringify(invited.data.association_ids) === JSON.stringify([ids.associationA]), 'Invitation association IDs were not normalized')

    const { data: invitation, error: invitationError } = await service.from('user_invitations')
      .select('id, email, hoa_role, role_id, association_ids, metadata')
      .eq('id', invitationId).single()
    if (invitationError) throw invitationError
    assert(invitation.email === inviteEmail, 'Manager invitation email was not normalized')
    assert(invitation.hoa_role === 'manager', 'Manager invitation has the wrong portal role')
    assert(JSON.stringify(invitation.association_ids) === JSON.stringify([ids.associationA]), 'Manager invitation scope was not persisted')
    assert(invitation.metadata?.email_delivery === 'application', 'Manager invitation did not select application email delivery')

    const { data: invitationRole, error: roleError } = await service.from('user_roles')
      .select('name, is_system').eq('id', invitation.role_id).single()
    if (roleError) throw roleError
    assert(invitationRole.name === 'Property Manager' && invitationRole.is_system, 'Manager invitation did not resolve the canonical system role')

    const { count: automaticEmailCount, error: automaticEmailError } = await service.from('email_queue')
      .select('id', { count: 'exact', head: true }).eq('to_email', inviteEmail)
    if (automaticEmailError) throw automaticEmailError
    assert(automaticEmailCount === 0, 'Database trigger queued a duplicate manager invitation email')

    const duplicateInvite = await adminA.rpc('create_manager_invitation', {
      p_email: inviteEmail,
      p_association_ids: [ids.associationA],
    })
    assert(duplicateInvite.error?.message?.includes('pending manager invitation'), 'Duplicate pending manager invitation was allowed')

    const foreignInvite = await adminA.rpc('create_manager_invitation', {
      p_email: `codex_test.manager.foreign.${Date.now()}@portier369.invalid`,
      p_association_ids: [ids.associationB],
    })
    assert(foreignInvite.error?.message?.includes('outside your portfolio'), 'Company Admin could invite a manager into a foreign association')

    const managerInviteAttempt = await ordinaryManager.rpc('create_manager_invitation', {
      p_email: `codex_test.manager.denied.${Date.now()}@portier369.invalid`,
      p_association_ids: [ids.associationA],
    })
    assert(managerInviteAttempt.error?.message?.includes('company administrator'), 'Ordinary manager could create a manager invitation')

    const scoped = await adminA.rpc('set_manager_association_scope', {
      p_manager_id: managerA.id,
      p_association_ids: [ids.associationA, ids.associationA],
    })
    if (scoped.error) throw scoped.error
    assert(scoped.data.association_count === 1, 'Duplicate association IDs were not normalized')
    assert(JSON.stringify(await assignments(managerA.id)) === JSON.stringify([ids.associationA]), 'Manager A scope was not saved')

    const crossTenantManager = await adminA.rpc('set_manager_association_scope', {
      p_manager_id: foreignProfile.id,
      p_association_ids: [ids.associationB],
    })
    assert(crossTenantManager.error?.message?.includes('Manager not found'), 'Admin A could reassign a foreign profile')
    assert(JSON.stringify(await assignments(foreignProfile.id)) === JSON.stringify(originalForeign), 'Denied foreign-profile request changed assignments')

    const crossTenantAssociation = await adminA.rpc('set_manager_association_scope', {
      p_manager_id: managerA.id,
      p_association_ids: [ids.associationB],
    })
    assert(crossTenantAssociation.error?.message?.includes('outside your portfolio'), 'Admin A could assign Association B')
    assert(JSON.stringify(await assignments(managerA.id)) === JSON.stringify([ids.associationA]), 'Rejected association changed Manager A scope')

    const managerAttempt = await ordinaryManager.rpc('set_manager_association_scope', {
      p_manager_id: managerA.id,
      p_association_ids: [],
    })
    assert(managerAttempt.error?.message?.includes('company administrator'), 'Ordinary manager could change manager scope')

    const restored = await adminA.rpc('set_manager_association_scope', {
      p_manager_id: managerA.id,
      p_association_ids: originalA,
    })
    if (restored.error) throw restored.error
    assert(JSON.stringify(await assignments(managerA.id)) === JSON.stringify(originalA), 'Manager A assignments were not restored')

    console.log('Company Admin invite, email ownership, atomic scope, duplicate normalization, tenant denial, role denial, and restoration: PASS')
  } finally {
    await Promise.all([adminA.auth.signOut(), ordinaryManager.auth.signOut()])
    await service.from('email_queue').delete().eq('to_email', inviteEmail)
    await service.from('user_invitations').delete().eq('email', inviteEmail)
    await service.from('audit_logs').delete()
      .eq('action', 'manager_association_scope_updated')
      .eq('entity_id', managerA.id)
      .gte('created_at', startedAt)
  }
}

main().catch((error) => { console.error(error.message); process.exit(1) })
