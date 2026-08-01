import { createClient } from '@supabase/supabase-js'

const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
const password = process.env.STAGING_TEST_PASSWORD
if (!url || !anonKey || !serviceKey || !password || new URL(url).hostname.split('.')[0] !== 'zalfkrtjeswvfmucicea') {
  throw new Error('Exact staging credentials are required')
}

const violationId = '36900000-0000-4000-8100-000000000312'
const reason = 'CODEX_TEST owner requests board review of the notice facts and governing-document citation.'
const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const session = () => createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const ownerA = session()
const ownerB = session()
const vendorA = session()
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function signIn(db, email) {
  const { error } = await db.auth.signInWithPassword({ email, password })
  if (error) throw error
}
const request = (db, id = violationId) => db.rpc('request_owner_violation_hearing', { p_violation_id: id, p_reason: reason })

async function cleanup() {
  await service.from('violations').update({
    status: 'notice_sent', hearing_required: false, hearing_requested_at: null, hearing_request_note: null,
  }).eq('id', violationId)
}

async function main() {
  await Promise.all([
    signIn(ownerA, 'codex_test.owner.a@portier369.invalid'),
    signIn(ownerB, 'codex_test.owner.b@portier369.invalid'),
    signIn(vendorA, 'codex_test.vendor.a@portier369.invalid'),
  ])

  const vendorAttempt = await request(vendorA)
  assert(vendorAttempt.error?.message.includes('Active owner portal access is required'), 'Vendor could call the owner hearing RPC')
  const crossOwnerAttempt = await request(ownerB)
  assert(crossOwnerAttempt.error?.message.includes('Violation not found'), 'Owner B could request a hearing on Owner A violation')

  const first = await request(ownerA)
  if (first.error) throw first.error
  const replay = await request(ownerA)
  if (replay.error) throw replay.error
  assert(first.data === replay.data, 'Hearing request replay was not idempotent')

  const { data: row, error: rowError } = await service.from('violations')
    .select('id, owner_id, status, hearing_required, hearing_requested_at, hearing_request_note')
    .eq('id', violationId).single()
  if (rowError) throw rowError
  assert(row.owner_id === '36900000-0000-4000-8000-000000000041', 'Hearing request owner attribution is incorrect')
  assert(row.status === 'hearing_pending' && row.hearing_required === true, 'Violation did not enter the hearing queue')
  assert(row.hearing_requested_at === first.data && row.hearing_request_note === reason, 'Hearing request evidence was not persisted')

  console.log('Owner hearing authorization, cross-owner isolation, durable reason/timestamp, hearing-queue transition, and replay idempotency: PASS')
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(cleanup)
