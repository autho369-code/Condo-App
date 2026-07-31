import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
const password = process.env.STAGING_TEST_PASSWORD
if (!url || !anonKey || !serviceKey || !password || new URL(url).hostname.split('.')[0] !== STAGING_REF) {
  throw new Error('Exact staging URL, anon key, service-role key, and test password are required')
}

const PORTFOLIO_A = '36900000-0000-4000-8000-000000000001'
const ASSOCIATION_A = '36900000-0000-4000-8000-000000000011'
const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  const nonce = randomUUID()
  const invitedEmail = `codex_test.invitation.${nonce}@portier369.invalid`
  const otherEmail = `codex_test.invitation.other.${nonce}@portier369.invalid`
  const acceptedToken = randomUUID().replaceAll('-', '')
  const mismatchToken = randomUUID().replaceAll('-', '')
  const invitationIds = []
  let userId = null

  try {
    const { data: acceptedInvite, error: acceptedInviteError } = await service.from('user_invitations').insert({
      email: invitedEmail,
      full_name: 'CODEX_TEST Invitation Manager',
      portfolio_id: PORTFOLIO_A,
      hoa_role: 'manager',
      mvp_role: 'manager',
      association_ids: [ASSOCIATION_A],
      token: acceptedToken,
      status: 'pending',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }).select('id').single()
    if (acceptedInviteError) throw new Error(`manager invitation setup: ${acceptedInviteError.message}`)
    invitationIds.push(acceptedInvite.id)

    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: invitedEmail,
      password,
      email_confirm: true,
    })
    if (createError || !created.user) throw new Error(`invited auth user creation: ${createError?.message ?? 'missing user'}`)
    userId = created.user.id

    const [{ data: invitation }, { data: profile }, { data: assignments }] = await Promise.all([
      service.from('user_invitations').select('status, used_by, used_at').eq('id', acceptedInvite.id).single(),
      service.from('profiles').select('portfolio_id, hoa_role, mvp_role').eq('id', userId).single(),
      service.from('association_managers').select('association_id').eq('user_id', userId),
    ])
    assert(invitation?.status === 'accepted' && invitation.used_by === userId && invitation.used_at, 'invitation trigger did not consume the token')
    assert(profile?.portfolio_id === PORTFOLIO_A && profile.hoa_role === 'manager' && profile.mvp_role === 'manager', 'invitation trigger applied the wrong profile scope')
    assert((assignments ?? []).length === 1 && assignments[0].association_id === ASSOCIATION_A, 'invitation trigger did not apply the exact association assignment')

    const session = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error: signInError } = await session.auth.signInWithPassword({ email: invitedEmail, password })
    if (signInError) throw new Error(`invited user sign-in: ${signInError.message}`)
    const { error: replayError } = await session.rpc('accept_invitation', { p_token: acceptedToken })
    assert(replayError, 'accepted invitation token was reusable')

    const { data: mismatchInvite, error: mismatchInviteError } = await service.from('user_invitations').insert({
      email: otherEmail,
      full_name: 'CODEX_TEST Wrong Recipient',
      portfolio_id: PORTFOLIO_A,
      hoa_role: 'manager',
      mvp_role: 'manager',
      association_ids: [ASSOCIATION_A],
      token: mismatchToken,
      status: 'pending',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }).select('id').single()
    if (mismatchInviteError) throw new Error(`mismatch invitation setup: ${mismatchInviteError.message}`)
    invitationIds.push(mismatchInvite.id)

    const { error: mismatchError } = await session.rpc('accept_invitation', { p_token: mismatchToken })
    assert(mismatchError?.message?.includes('email does not match'), 'another user could consume an invitation token')
    const { data: mismatchAfter } = await service.from('user_invitations').select('status, used_by').eq('id', mismatchInvite.id).single()
    assert(mismatchAfter?.status === 'pending' && mismatchAfter.used_by === null, 'email-mismatch attempt changed the invitation')
    await session.auth.signOut()

    console.log('manager invitation: profile and exact association assignment=PASS')
    console.log('invitation token replay and email mismatch=DENIED')
  } finally {
    if (userId) {
      await service.from('association_managers').delete().eq('user_id', userId)
      const { error: deleteUserError } = await service.auth.admin.deleteUser(userId)
      if (deleteUserError) throw new Error(`invitation test user cleanup failed: ${deleteUserError.message}`)
    }
    if (invitationIds.length) {
      const { error: deleteInvitesError } = await service.from('user_invitations').delete().in('id', invitationIds)
      if (deleteInvitesError) throw new Error(`invitation row cleanup failed: ${deleteInvitesError.message}`)
      const { data: leftovers, error: leftoversError } = await service.from('user_invitations').select('id').in('id', invitationIds)
      if (leftoversError || (leftovers ?? []).length) throw new Error(`invitation cleanup audit failed: ${leftoversError?.message ?? 'rows remain'}`)
    }
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
