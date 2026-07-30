import { createClient } from '@supabase/supabase-js'

const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const password = process.env.STAGING_TEST_PASSWORD
if (!url || !anonKey || !password || new URL(url).hostname.split('.')[0] !== 'zalfkrtjeswvfmucicea') throw new Error('Exact staging credentials are required')

const bankA = '36900000-0000-4000-8000-000000000061'
const billA = '36900000-0000-4000-8100-000000000081'
const billB = '36900000-0000-4000-8200-000000000083'
const db = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function main() {
  const { error: signInError } = await db.auth.signInWithPassword({ email: 'codex_test.manager.a@portier369.invalid', password })
  if (signInError) throw signInError

  const cross = await db.rpc('record_check_run', { p_bank_account_id: bankA, p_bill_ids: [billA, billB], p_starting_check_number: 5001, p_payment_date: '2026-07-29' })
  assert(Boolean(cross.error), 'Cross-portfolio check run was not rejected')
  const { data: unchanged } = await db.from('payable_bills').select('status, check_number').eq('id', billA).single()
  assert(unchanged?.status === 'approved' && unchanged?.check_number === null, 'Rejected cross-portfolio batch was not atomic')

  const duplicate = await db.rpc('record_check_run', { p_bank_account_id: bankA, p_bill_ids: [billA, billA], p_starting_check_number: 5001, p_payment_date: '2026-07-29' })
  assert(duplicate.error?.message.includes('duplicate or unknown'), 'Duplicate bill selection was not rejected')

  const written = await db.rpc('record_check_run', { p_bank_account_id: bankA, p_bill_ids: [billA], p_starting_check_number: 5001, p_payment_date: '2026-07-29' })
  if (written.error) throw written.error
  assert(written.data?.checks_written === 1 && written.data?.next_check_number === 5002, 'Valid check run returned incorrect sequence data')
  const { data: paid } = await db.from('payable_bills').select('status, check_number, bank_account_id').eq('id', billA).single()
  assert(paid?.status === 'paid' && Number(paid?.check_number) === 5001 && paid?.bank_account_id === bankA, 'Valid check was not recorded correctly')
  const replay = await db.rpc('record_check_run', { p_bank_account_id: bankA, p_bill_ids: [billA], p_starting_check_number: 5002, p_payment_date: '2026-07-29' })
  assert(replay.error?.message.includes('not approved and unpaid'), 'Paid bill replay was not rejected')
  console.log('Check-run tenant scope, atomicity, uniqueness, sequence, write, and replay rejection: PASS')
}

main().catch((error) => { console.error(error.message); process.exit(1) })
