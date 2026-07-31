import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey || new URL(url).hostname.split('.')[0] !== 'zalfkrtjeswvfmucicea') {
  throw new Error('Exact staging credentials are required')
}

const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const messageIds = []
const queueIds = []
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function cleanup() {
  if (queueIds.length) await service.from('email_queue').delete().in('id', queueIds)
  if (messageIds.length) await service.from('communication_messages').delete().in('id', messageIds)
}

async function createMessage(subject) {
  const id = randomUUID()
  const { error } = await service.from('communication_messages').insert({
    id,
    portfolio_id: '36900000-0000-4000-8000-000000000001',
    association_id: '36900000-0000-4000-8000-000000000011',
    channel: 'email', status: 'queued', recipient_group: 'owners', subject,
    body: 'CODEX_TEST durable worker verification', queued_at: new Date().toISOString(),
  })
  if (error) throw error
  messageIds.push(id)
  return id
}

async function createQueue(messageId, suffix, attemptCount = 0) {
  const id = randomUUID()
  const { error } = await service.from('email_queue').insert({
    id, communication_message_id: messageId,
    portfolio_id: '36900000-0000-4000-8000-000000000001',
    association_id: '36900000-0000-4000-8000-000000000011',
    to_email: `codex_test.worker.${suffix}@portier369.invalid`,
    subject: 'CODEX_TEST worker', body: '<p>Worker verification</p>', status: 'pending',
    from_address: 'hello@portier369.com', from_name: 'CODEX_TEST Alpha',
    idempotency_key: `codex-test-worker-${id}`, attempt_count: attemptCount,
  })
  if (error) throw error
  queueIds.push(id)
  return id
}

async function main() {
  const denied = await anon.rpc('claim_email_queue', { p_limit: 1 })
  assert(denied.error, 'Anonymous caller could claim email work')

  const message = await createMessage('CODEX_TEST successful multi-recipient delivery')
  const firstId = await createQueue(message, 'first')
  const secondId = await createQueue(message, 'second')
  const { data: claimed, error: claimError } = await service.rpc('claim_email_queue', { p_limit: 2 })
  if (claimError) throw claimError
  assert(claimed.length === 2 && claimed.every((row) => row.attempt_count === 1 && row.processing_at), 'Due rows were not atomically claimed')

  const secondClaim = await service.rpc('claim_email_queue', { p_limit: 2 })
  if (secondClaim.error) throw secondClaim.error
  assert(secondClaim.data.length === 0, 'Already-processing rows were claimed twice')

  const failed = await service.rpc('fail_email_delivery', { p_email_id: firstId, p_error: 'CODEX_TEST transient failure' })
  if (failed.error) throw failed.error
  assert(failed.data === true, 'Transient failure was not recorded')
  const { data: failedRow } = await service.from('email_queue').select('status, attempt_count, next_attempt_at, processing_at').eq('id', firstId).single()
  assert(failedRow.status === 'failed' && failedRow.attempt_count === 1 && !failedRow.processing_at
    && new Date(failedRow.next_attempt_at) > new Date(), 'Retry state or delay is incorrect')

  const completedSecond = await service.rpc('complete_email_delivery', { p_email_id: secondId, p_provider_message_id: 'codex-provider-second' })
  if (completedSecond.error) throw completedSecond.error
  const { data: stillQueued } = await service.from('communication_messages').select('status').eq('id', message).single()
  assert(stillQueued.status === 'queued', 'Multi-recipient communication completed before every email succeeded')

  await service.from('email_queue').update({ next_attempt_at: new Date(Date.now() - 1000).toISOString() }).eq('id', firstId)
  const retried = await service.rpc('claim_email_queue', { p_limit: 1 })
  if (retried.error) throw retried.error
  assert(retried.data.length === 1 && retried.data[0].id === firstId && retried.data[0].attempt_count === 2, 'Failed email was not reclaimed when due')
  const completedFirst = await service.rpc('complete_email_delivery', { p_email_id: firstId, p_provider_message_id: 'codex-provider-first' })
  if (completedFirst.error) throw completedFirst.error
  const { data: sentMessage } = await service.from('communication_messages').select('status, sent_at').eq('id', message).single()
  assert(sentMessage.status === 'sent' && sentMessage.sent_at, 'Communication did not complete after every recipient succeeded')

  const terminalMessage = await createMessage('CODEX_TEST terminal failure')
  const terminalId = await createQueue(terminalMessage, 'terminal', 4)
  const terminalClaim = await service.rpc('claim_email_queue', { p_limit: 1 })
  if (terminalClaim.error) throw terminalClaim.error
  assert(terminalClaim.data[0]?.id === terminalId && terminalClaim.data[0]?.attempt_count === 5, 'Fifth attempt was not claimed')
  const terminalFail = await service.rpc('fail_email_delivery', { p_email_id: terminalId, p_error: 'CODEX_TEST permanent failure' })
  if (terminalFail.error) throw terminalFail.error
  const { data: terminalState } = await service.from('communication_messages').select('status, error_message').eq('id', terminalMessage).single()
  assert(terminalState.status === 'failed' && terminalState.error_message === 'CODEX_TEST permanent failure', 'Terminal failure was not reflected in communication history')
  const noSixthAttempt = await service.rpc('claim_email_queue', { p_limit: 1 })
  if (noSixthAttempt.error) throw noSixthAttempt.error
  assert(noSixthAttempt.data.length === 0, 'A sixth delivery attempt was allowed')

  console.log('Email worker authorization, atomic claims, retry backoff, completion reconciliation, and terminal failure: PASS')
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(cleanup)
