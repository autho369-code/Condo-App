import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey || new URL(url).hostname.split('.')[0] !== 'zalfkrtjeswvfmucicea') throw new Error('Exact staging credentials are required')
const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const flowId = randomUUID()
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const claim = (db, subjectId) => db.rpc('claim_automation_flow_run', { p_flow_id: flowId, p_subject_type: 'CODEX_TEST', p_subject_id: subjectId })

async function cleanup() { await service.from('automation_flows').delete().eq('id', flowId) }
async function main() {
  const { error: flowError } = await service.from('automation_flows').insert({
    id: flowId, portfolio_id: '36900000-0000-4000-8000-000000000001', name: 'CODEX_TEST retry flow',
    trigger_type: 'work_order_stale', trigger_config: { days: 14 }, actions: [{ type: 'raise_work_order_priority', config: {} }],
  })
  if (flowError) throw flowError
  const subject = randomUUID()
  const denied = await claim(anon, subject)
  assert(denied.error, 'Anonymous caller could claim automation work')
  const first = await claim(service, subject)
  if (first.error) throw first.error
  const firstRun = first.data?.[0]
  assert(firstRun?.attempt_count === 1, 'Initial automation claim was not recorded')
  const concurrent = await claim(service, subject)
  if (concurrent.error) throw concurrent.error
  assert(concurrent.data?.length === 0, 'Overlapping worker reclaimed an active subject')
  await service.from('automation_flow_runs').update({ status: 'partial', last_attempt_at: new Date(Date.now() - 11 * 60000).toISOString(), detail: { actions: [{ index: 0, ok: true }] } }).eq('id', firstRun.id)
  const retry = await claim(service, subject)
  if (retry.error) throw retry.error
  const retryRun = retry.data?.[0]
  assert(retryRun?.attempt_count === 2 && retryRun?.detail?.actions?.[0]?.ok, 'Partial retry did not preserve prior outcomes')
  await service.from('automation_flow_runs').update({ status: 'success' }).eq('id', retryRun.id)
  const completed = await claim(service, subject)
  if (completed.error) throw completed.error
  assert(completed.data?.length === 0, 'Successful automation subject was replayed')

  const terminalSubject = randomUUID()
  let terminal = await claim(service, terminalSubject)
  if (terminal.error) throw terminal.error
  for (let attempt = 2; attempt <= 5; attempt += 1) {
    const currentRun = terminal.data?.[0]
    await service.from('automation_flow_runs').update({ status: 'failed', last_attempt_at: new Date(Date.now() - 11 * 60000).toISOString() }).eq('id', currentRun.id)
    terminal = await claim(service, terminalSubject)
    if (terminal.error) throw terminal.error
    assert(terminal.data?.[0]?.attempt_count === attempt, `Automation attempt ${attempt} was not recorded`)
  }
  await service.from('automation_flow_runs').update({ status: 'failed', last_attempt_at: new Date(Date.now() - 11 * 60000).toISOString() }).eq('id', terminal.data[0].id)
  const sixth = await claim(service, terminalSubject)
  if (sixth.error) throw sixth.error
  assert(sixth.data?.length === 0, 'A sixth automation attempt was allowed')
  console.log('Automation claim authorization, concurrency cooldown, partial retry, outcome preservation, success immutability, and attempt ceiling: PASS')
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(cleanup)
