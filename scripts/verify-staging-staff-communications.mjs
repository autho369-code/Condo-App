import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
const password = process.env.STAGING_TEST_PASSWORD
if (!url || !anonKey || !serviceKey || !password || new URL(url).hostname.split('.')[0] !== 'zalfkrtjeswvfmucicea') {
  throw new Error('Exact staging credentials are required')
}

const ids = {
  portfolioA: '36900000-0000-4000-8000-000000000001',
  portfolioB: '36900000-0000-4000-8000-000000000002',
  associationA: '36900000-0000-4000-8000-000000000011',
  associationB: '36900000-0000-4000-8000-000000000012',
}
const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const session = () => createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const managerA = session()
const vendorA = session()
const messageIds = []
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function signIn(db, email) {
  const { data, error } = await db.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

async function makeMessage(portfolioId, associationId, createdBy, subject = 'CODEX_TEST staff queue') {
  const id = randomUUID()
  const { error } = await service.from('communication_messages').insert({
    id, portfolio_id: portfolioId, association_id: associationId, created_by: createdBy,
    channel: 'email', status: 'draft', recipient_group: 'owners', subject,
    body: 'Durable communication queue verification.',
  })
  if (error) throw error
  messageIds.push(id)
  return id
}

async function enqueue(db, id, recipients) {
  return db.rpc('enqueue_communication_message', {
    p_message_id: id,
    p_recipients: recipients,
    p_html: '<div>Durable communication queue verification.</div>',
    p_from_name: 'CODEX_TEST Alpha',
  })
}

async function cleanup() {
  if (!messageIds.length) return
  await service.from('email_queue').delete().in('communication_message_id', messageIds)
  await service.from('communication_messages').delete().in('id', messageIds)
}

async function main() {
  const [manager, vendor] = await Promise.all([
    signIn(managerA, 'codex_test.manager.a@portier369.invalid'),
    signIn(vendorA, 'codex_test.vendor.a@portier369.invalid'),
  ])

  const messageA = await makeMessage(ids.portfolioA, ids.associationA, manager.id)
  const unauthorized = await enqueue(vendorA, messageA, [{ email: 'codex_test.owner.a@portier369.invalid', name: 'Avery' }])
  assert(unauthorized.error?.message.includes('Staff access required'), 'Vendor could queue a staff communication')

  const invalidMessage = await makeMessage(ids.portfolioA, ids.associationA, manager.id, 'CODEX_TEST invalid recipient')
  const invalid = await enqueue(managerA, invalidMessage, [{ email: 'not-an-email', name: 'Invalid' }])
  assert(invalid.error?.message.includes('Invalid recipient'), 'Invalid recipient was accepted')

  const recipients = [
    { email: 'codex_test.owner.a@portier369.invalid', name: 'Avery Alpha' },
    { email: 'CODEX_TEST.OWNER.A@PORTIER369.INVALID', name: 'Duplicate casing' },
  ]
  const first = await enqueue(managerA, messageA, recipients)
  if (first.error) throw first.error
  assert(first.data === 1, `Expected one deduplicated queue row, received ${first.data}`)
  const replay = await enqueue(managerA, messageA, recipients)
  if (replay.error) throw replay.error
  assert(replay.data === 1, 'Idempotent replay did not return the existing queue count')

  const { data: queue, error: queueError } = await service.from('email_queue')
    .select('id, to_email, status, portfolio_id, association_id, sent_by, communication_message_id, idempotency_key')
    .eq('communication_message_id', messageA)
  if (queueError) throw queueError
  assert(queue.length === 1, 'Duplicate queue rows were created')
  assert(queue[0].portfolio_id === ids.portfolioA && queue[0].association_id === ids.associationA, 'Queue row crossed a tenant boundary')
  assert(queue[0].sent_by === manager.id && queue[0].status === 'pending', 'Queue attribution or delivery state is incorrect')
  assert(queue[0].idempotency_key === `communication:${messageA}:codex_test.owner.a@portier369.invalid`, 'Queue idempotency key is not deterministic')

  const { data: messageState } = await service.from('communication_messages')
    .select('status, queued_at, sent_at').eq('id', messageA).single()
  assert(messageState.status === 'queued' && messageState.queued_at && !messageState.sent_at,
    'Message was reported sent before delivery')

  const messageB = await makeMessage(ids.portfolioB, ids.associationB, vendor.id, 'CODEX_TEST tenant boundary')
  const crossTenant = await enqueue(managerA, messageB, [{ email: 'codex_test.owner.b@portier369.invalid', name: 'Bailey' }])
  assert(crossTenant.error?.message.includes('Message not found or unavailable'), 'Manager A could queue tenant B communication')

  console.log('Staff authorization, validation, tenant isolation, atomic queueing, traceability, idempotency, and honest delivery state: PASS')
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(cleanup)
