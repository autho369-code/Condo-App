import { createClient } from '@supabase/supabase-js'

const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const password = process.env.STAGING_TEST_PASSWORD
if (!url || !anonKey || !password || new URL(url).hostname.split('.')[0] !== 'zalfkrtjeswvfmucicea') throw new Error('Exact staging credentials are required')

const bankA = '36900000-0000-4000-8000-000000000061'
const billA = '36900000-0000-4000-8100-000000000081'
const billA2 = '36900000-0000-4000-8100-000000000082'
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
  const { data: entries, error: entriesError } = await db.from('journal_entries').select('id, source_type, posted').eq('source_id', billA).in('source_type', ['payable_bill', 'check_payment'])
  if (entriesError) throw entriesError
  assert(entries?.length === 2 && entries.every((entry) => entry.posted), 'Bill accrual and check payment were not both posted')
  const { data: lines, error: linesError } = await db.from('journal_lines').select('entry_id, debit_amount, credit_amount').in('entry_id', entries.map((entry) => entry.id))
  if (linesError) throw linesError
  assert(lines?.length === 4, 'Expected two balanced journal lines per payable entry')
  for (const entry of entries) {
    const entryLines = lines.filter((line) => line.entry_id === entry.id)
    const debits = entryLines.reduce((sum, line) => sum + Number(line.debit_amount), 0)
    const credits = entryLines.reduce((sum, line) => sum + Number(line.credit_amount), 0)
    assert(debits === 750 && credits === 750, `${entry.source_type} is not balanced to the bill amount`)
  }
  const replay = await db.rpc('record_check_run', { p_bank_account_id: bankA, p_bill_ids: [billA], p_starting_check_number: 5002, p_payment_date: '2026-07-29' })
  assert(replay.error?.message.includes('not approved and unpaid'), 'Paid bill replay was not rejected')

  const approved = await db.rpc('approve_payable_bill', { p_bill_id: billA2 })
  if (approved.error) throw approved.error
  const approvedAgain = await db.rpc('approve_payable_bill', { p_bill_id: billA2 })
  if (approvedAgain.error) throw approvedAgain.error
  assert(approved.data === approvedAgain.data, 'Repeated approval did not return the idempotent accrual entry')
  const voided = await db.rpc('void_payable_bill', { p_bill_id: billA2 })
  if (voided.error) throw voided.error
  const { data: voidBill } = await db.from('payable_bills').select('status').eq('id', billA2).single()
  assert(voidBill?.status === 'void', 'Unpaid approved bill was not voided')
  const { data: voidEntries } = await db.from('journal_entries').select('id, source_type').eq('source_id', billA2).in('source_type', ['payable_bill', 'payable_bill_void'])
  assert(voidEntries?.length === 2, 'Void did not preserve accrual and create one reversal')
  const { data: voidLines } = await db.from('journal_lines').select('entry_id, debit_amount, credit_amount').in('entry_id', voidEntries.map((entry) => entry.id))
  const net = voidLines.reduce((sum, line) => sum + Number(line.debit_amount) - Number(line.credit_amount), 0)
  assert(net === 0 && voidLines.length === 4, 'Accrual and void reversal do not net to zero')
  console.log('Check run plus approve/accrue/void/reverse lifecycle: PASS')
}

main().catch((error) => { console.error(error.message); process.exit(1) })
