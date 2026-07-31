import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
const password = process.env.STAGING_TEST_PASSWORD

if (!url || !anonKey || !serviceKey || !password || new URL(url).hostname.split('.')[0] !== STAGING_REF) {
  throw new Error('Exact staging URL, anon key, service-role key, and test password are required')
}

const identities = [
  ['codex_test.operator@portier369.invalid', 'is_platform_operator'],
  ['codex_test.admin.a@portier369.invalid', 'is_company_admin'],
  ['codex_test.manager.a@portier369.invalid', 'is_staff'],
  ['codex_test.board.a@portier369.invalid', 'is_board'],
  ['codex_test.owner.a@portier369.invalid', 'owner_id'],
  ['codex_test.vendor.a@portier369.invalid', 'vendor_id'],
]

const capabilityFields = [
  'is_platform_operator',
  'is_company_admin',
  'is_full_access_staff',
  'is_finance_staff',
  'is_staff',
  'is_board',
  'is_resident',
]

const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function setDisabledAt(userId, value) {
  const { error } = await service.from('profiles').update({ disabled_at: value }).eq('id', userId)
  if (error) throw new Error(`profile restore/disable failed: ${error.message}`)
}

async function verifyIdentity(email, expectedField) {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`${email} sign-in: ${signInError.message}`)

  const userId = signIn.user?.id
  assert(userId, `${email} did not return an auth user`)

  const { data: before, error: beforeError } = await client.rpc('me')
  if (beforeError) throw new Error(`${email} pre-disable me(): ${beforeError.message}`)
  assert(Boolean(before?.[expectedField]), `${email} did not begin with ${expectedField}`)

  let disabled = false
  try {
    await setDisabledAt(userId, new Date().toISOString())
    disabled = true

    // Keep using the already-issued access token. The database must revoke its
    // authorization immediately even if the Auth session has not expired yet.
    const { data: stale, error: staleError } = await client.rpc('me')
    if (staleError) throw new Error(`${email} stale-session me(): ${staleError.message}`)

    assert(stale?.profile?.disabled_at, `${email} stale session did not observe disabled_at`)
    assert(stale?.portfolio === null, `${email} stale session retained a portfolio`)
    assert(stale?.owner_id === null, `${email} stale session retained owner scope`)
    assert(stale?.vendor_id === null, `${email} stale session retained vendor scope`)
    assert((stale?.board_association_ids ?? []).length === 0, `${email} stale session retained board scope`)
    assert((stale?.resident_association_ids ?? []).length === 0, `${email} stale session retained resident scope`)
    assert(capabilityFields.every((field) => !stale?.[field]), `${email} stale session retained a capability flag`)

    const { data: protectedRows, error: protectedError } = await client
      .from('portfolios')
      .select('id')
      .in('id', ['36900000-0000-4000-8000-000000000001', '36900000-0000-4000-8000-000000000002'])
    if (protectedError) throw new Error(`${email} stale-session protected query: ${protectedError.message}`)
    assert((protectedRows ?? []).length === 0, `${email} stale session retained protected portfolio reads`)

    console.log(`${email}: stale-session authorization revocation=PASS`)
  } finally {
    if (disabled) await setDisabledAt(userId, null)
    await client.auth.signOut()
  }

  const restored = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: restoredSignInError } = await restored.auth.signInWithPassword({ email, password })
  if (restoredSignInError) throw new Error(`${email} did not recover after restore: ${restoredSignInError.message}`)
  const { data: restoredMe, error: restoredMeError } = await restored.rpc('me')
  if (restoredMeError) throw new Error(`${email} restored me(): ${restoredMeError.message}`)
  assert(Boolean(restoredMe?.[expectedField]), `${email} did not recover ${expectedField}`)
  await restored.auth.signOut()
}

async function main() {
  for (const [email, expectedField] of identities) await verifyIdentity(email, expectedField)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
