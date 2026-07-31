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
  const [{ data: managerA }, { data: foreignProfile }] = await Promise.all([
    service.from('profiles').select('id').eq('email', 'codex_test.manager.a@portier369.invalid').single(),
    service.from('profiles').select('id').eq('email', 'codex_test.admin.b@portier369.invalid').single(),
  ])
  const originalA = await assignments(managerA.id)
  const originalForeign = await assignments(foreignProfile.id)
  const adminA = await signIn('codex_test.admin.a@portier369.invalid')
  const ordinaryManager = await signIn('codex_test.manager.a@portier369.invalid')

  try {
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

    console.log('Company Admin atomic manager scope, duplicate normalization, tenant denial, role denial, and restoration: PASS')
  } finally {
    await Promise.all([adminA.auth.signOut(), ordinaryManager.auth.signOut()])
    await service.from('audit_logs').delete()
      .eq('action', 'manager_association_scope_updated')
      .eq('entity_id', managerA.id)
      .gte('created_at', startedAt)
  }
}

main().catch((error) => { console.error(error.message); process.exit(1) })
