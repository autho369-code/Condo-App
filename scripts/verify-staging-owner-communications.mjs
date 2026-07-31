import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
const password = process.env.STAGING_TEST_PASSWORD
if (!url || !anonKey || !serviceKey || !password || new URL(url).hostname.split('.')[0] !== 'zalfkrtjeswvfmucicea') {
  throw new Error('Exact staging credentials are required')
}

const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const client = () => createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const ownerA = client()
const ownerB = client()
const vendorA = client()
const messageIds = []
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function signIn(db, email) {
  const { error } = await db.auth.signInWithPassword({ email, password })
  if (error) throw error
}

async function cleanup() {
  if (!messageIds.length) return
  await service.from('email_queue').delete().in('communication_log_id', messageIds)
  await service.from('communications_log').delete().in('id', messageIds)
}

async function submit(db, subject, body, key) {
  return db.rpc('submit_owner_message', {
    p_subject: subject,
    p_body: body,
    p_idempotency_key: key,
  })
}

async function main() {
  await Promise.all([
    signIn(ownerA, 'codex_test.owner.a@portier369.invalid'),
    signIn(ownerB, 'codex_test.owner.b@portier369.invalid'),
    signIn(vendorA, 'codex_test.vendor.a@portier369.invalid'),
  ])

  const invalid = await submit(ownerA, 'x', 'Valid body', randomUUID())
  assert(invalid.error?.message.includes('Subject must be between'), 'Short subject was not rejected')

  const vendorAttempt = await submit(vendorA, 'Vendor impersonation', 'This must not queue.', randomUUID())
  assert(vendorAttempt.error?.message.includes('Active owner portal access is required'), 'Vendor could use the owner message RPC')

  const keyA = randomUUID()
  const sentA = await submit(ownerA, 'CODEX_TEST owner A message', 'Please confirm the annual meeting schedule.', keyA)
  if (sentA.error) throw sentA.error
  messageIds.push(sentA.data)
  const replayA = await submit(ownerA, 'CODEX_TEST owner A message', 'Please confirm the annual meeting schedule.', keyA)
  if (replayA.error) throw replayA.error
  assert(replayA.data === sentA.data, 'Idempotent owner-message replay created a new message')

  const { data: ownerHistory, error: historyError } = await ownerA.from('communications_log')
    .select('id, portfolio_id, association_id, sender_id, subject, body, recipient_count')
    .eq('id', sentA.data).single()
  if (historyError) throw historyError
  assert(ownerHistory.portfolio_id === '36900000-0000-4000-8000-000000000001', 'Owner A message used the wrong portfolio')
  assert(ownerHistory.association_id === '36900000-0000-4000-8000-000000000011', 'Owner A message used the wrong association')
  assert(ownerHistory.body === 'Please confirm the annual meeting schedule.', 'Owner A history did not preserve the message body')

  const { data: queueA, error: queueAError } = await service.from('email_queue')
    .select('id, to_email, portfolio_id, association_id, sent_by, communication_log_id')
    .eq('communication_log_id', sentA.data)
  if (queueAError) throw queueAError
  assert(queueA.length >= 1 && queueA.some((row) => row.to_email === 'codex_test.admin.a@portier369.invalid'),
    'Owner A message did not resolve its tenant-local company admin')
  assert(queueA.every((row) => row.portfolio_id === '36900000-0000-4000-8000-000000000001'
    && row.association_id === '36900000-0000-4000-8000-000000000011'), 'Owner A queue crossed a tenant boundary')
  assert(ownerHistory.recipient_count === queueA.length, 'Owner A communication log does not match its queue rows')

  const keyB = randomUUID()
  const sentB = await submit(ownerB, 'CODEX_TEST owner B message', 'Tenant isolation sentinel.', keyB)
  if (sentB.error) throw sentB.error
  messageIds.push(sentB.data)
  const { data: queueB } = await service.from('email_queue')
    .select('to_email, portfolio_id, association_id').eq('communication_log_id', sentB.data)
  assert(queueB?.length >= 1 && queueB.some((row) => row.to_email === 'codex_test.admin.b@portier369.invalid'),
    'Owner B message did not resolve its tenant-local company admin')
  assert(queueB.every((row) => row.portfolio_id === '36900000-0000-4000-8000-000000000002'
    && row.association_id === '36900000-0000-4000-8000-000000000012'), 'Owner B queue crossed a tenant boundary')

  for (let index = 2; index <= 10; index += 1) {
    const allowed = await submit(ownerA, `CODEX_TEST throttle ${index}`, 'Durable staging rate-limit verification.', randomUUID())
    if (allowed.error) throw allowed.error
    messageIds.push(allowed.data)
  }
  const throttled = await submit(ownerA, 'CODEX_TEST throttle 11', 'This request must be rejected.', randomUUID())
  assert(throttled.error?.message.includes('Message limit reached'), 'The eleventh owner message inside one hour was not rejected')

  console.log('Owner message authentication, validation, idempotency, tenant derivation, queue traceability, owner history, and durable throttling: PASS')
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(cleanup)
