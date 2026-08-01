import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
const password = process.env.STAGING_TEST_PASSWORD
if (!url || !anonKey || !serviceKey || !password || new URL(url).hostname.split('.')[0] !== STAGING_REF) {
  throw new Error('Exact staging credentials are required')
}

const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function signIn(email) {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`${email} sign-in: ${error.message}`)
  return client
}

async function main() {
  const email = `codex_test.operator.lifecycle.${Date.now()}@portier369.invalid`
  const { data: association, error: associationError } = await service.from('associations')
    .select('id, portfolio_id').eq('id', '36900000-0000-4000-8000-000000000011').single()
  if (associationError) throw associationError

  const operator = await signIn('codex_test.operator@portier369.invalid')
  const ordinaryManager = await signIn('codex_test.manager.a@portier369.invalid')
  let userId = null

  try {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'CODEX_TEST Operator Lifecycle' },
    })
    if (createError || !created.user) throw createError ?? new Error('Synthetic Auth user was not created')
    userId = created.user.id

    const { error: profileError } = await service.from('profiles').update({
      portfolio_id: association.portfolio_id,
      hoa_role: 'owner',
      role_id: null,
      disabled_at: null,
    }).eq('id', userId)
    if (profileError) throw profileError

    const promoted = await operator.rpc('platform_set_profile_role', {
      p_profile_id: userId,
      p_hoa_role: 'manager',
    })
    if (promoted.error) throw promoted.error
    assert(promoted.data.hoa_role === 'manager', 'Operator could not promote the synthetic profile to manager')

    const { data: managerProfile, error: managerProfileError } = await service.from('profiles')
      .select('hoa_role, role_id').eq('id', userId).single()
    if (managerProfileError) throw managerProfileError
    const { data: managerRole, error: managerRoleError } = await service.from('user_roles')
      .select('name, is_system').eq('id', managerProfile.role_id).single()
    if (managerRoleError) throw managerRoleError
    assert(managerProfile.hoa_role === 'manager', 'Manager portal role was not persisted')
    assert(managerRole.name === 'Property Manager' && managerRole.is_system, 'Canonical Property Manager role was not assigned')

    const { error: assignmentError } = await service.from('association_managers').insert({
      user_id: userId,
      association_id: association.id,
      portfolio_id: association.portfolio_id,
      assigned_by: created.user.id,
    })
    if (assignmentError) throw assignmentError

    const denied = await ordinaryManager.rpc('platform_set_profile_role', {
      p_profile_id: userId,
      p_hoa_role: 'owner',
    })
    assert(denied.error?.message?.includes('platform administrator'), 'Ordinary manager could change a platform user role')

    const invalid = await operator.rpc('platform_set_profile_role', {
      p_profile_id: userId,
      p_hoa_role: 'vendor',
    })
    assert(Boolean(invalid.error), 'Invalid non-enum profile role was accepted')

    const selfChange = await operator.rpc('platform_set_profile_role', {
      p_profile_id: (await operator.auth.getUser()).data.user.id,
      p_hoa_role: 'owner',
    })
    assert(selfChange.error?.message?.includes('own platform profile'), 'Operator could change their own platform profile role')

    const demoted = await operator.rpc('platform_set_profile_role', {
      p_profile_id: userId,
      p_hoa_role: 'owner',
    })
    if (demoted.error) throw demoted.error

    const [{ data: ownerProfile, error: ownerProfileError }, { count: scopeCount, error: scopeError }] = await Promise.all([
      service.from('profiles').select('hoa_role, role_id').eq('id', userId).single(),
      service.from('association_managers').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])
    if (ownerProfileError) throw ownerProfileError
    if (scopeError) throw scopeError
    assert(ownerProfile.hoa_role === 'owner' && ownerProfile.role_id === null, 'Demotion did not clear the staff role')
    assert(scopeCount === 0, 'Demotion left stale manager association access')

    const { count: auditCount, error: auditError } = await service.from('audit_logs')
      .select('id', { count: 'exact', head: true }).eq('entity_id', userId).eq('action', 'user_role_changed')
    if (auditError) throw auditError
    assert(auditCount === 2, 'Role changes did not create the expected audit records')

    console.log('Operator admin-only role lifecycle, enum denial, canonical role mapping, scope cleanup, and audit trail: PASS')
  } finally {
    await Promise.all([operator.auth.signOut(), ordinaryManager.auth.signOut()])
    if (userId) {
      await service.from('association_managers').delete().eq('user_id', userId)
      await service.from('audit_logs').delete().eq('entity_id', userId)
      await service.auth.admin.deleteUser(userId)
    }
  }
}

main().catch((error) => { console.error(error.message); process.exit(1) })
