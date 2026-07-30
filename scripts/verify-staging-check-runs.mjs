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

  const unacknowledged = await db.rpc('record_check_run', { p_bank_account_id: bankA, p_bill_ids: [billA], p_starting_check_number: 5001, p_payment_date: '2026-07-29', p_authorization_confirmed: false })
  assert(unacknowledged.error?.message.includes('authorization must be acknowledged'), 'Unacknowledged check signing was not rejected')

  const cross = await db.rpc('record_check_run', { p_bank_account_id: bankA, p_bill_ids: [billA, billB], p_starting_check_number: 5001, p_payment_date: '2026-07-29', p_authorization_confirmed: true })
  assert(Boolean(cross.error), 'Cross-portfolio check run was not rejected')
  const { data: unchanged } = await db.from('payable_bills').select('status, check_number').eq('id', billA).single()
  assert(unchanged?.status === 'approved' && unchanged?.check_number === null, 'Rejected cross-portfolio batch was not atomic')

  const duplicate = await db.rpc('record_check_run', { p_bank_account_id: bankA, p_bill_ids: [billA, billA], p_starting_check_number: 5001, p_payment_date: '2026-07-29', p_authorization_confirmed: true })
  assert(duplicate.error?.message.includes('duplicate or unknown'), 'Duplicate bill selection was not rejected')

  const written = await db.rpc('record_check_run', { p_bank_account_id: bankA, p_bill_ids: [billA], p_starting_check_number: 5001, p_payment_date: '2026-07-29', p_authorization_confirmed: true })
  if (written.error) throw written.error
  assert(written.data?.checks_written === 1 && written.data?.next_check_number === 5002, 'Valid check run returned incorrect sequence data')
  const { data: paid } = await db.from('payable_bills').select('status, check_number, bank_account_id').eq('id', billA).single()
  assert(paid?.status === 'paid' && Number(paid?.check_number) === 5001 && paid?.bank_account_id === bankA, 'Valid check was not recorded correctly')
  const { data: issuedChecks, error: checksError } = await db.from('payable_checks').select('id, status, check_number, payment_entry_id, run_transaction_id, authorized_signer_label, authorization_acknowledged_at').eq('bill_id', billA).order('issued_at')
  if (checksError) throw checksError
  assert(issuedChecks?.length === 1 && issuedChecks[0].status === 'issued' && issuedChecks[0].check_number === 5001, 'Issued check history was not captured')
  assert(issuedChecks[0].authorized_signer_label === 'CODEX_TEST Alpha Authorized Signer' && issuedChecks[0].authorization_acknowledged_at, 'Issuer acknowledgement and signer snapshot were not captured')
  const { data: printableRun, error: printableError } = await db.from('payable_checks').select(`
    id, bill_id, check_number, amount, payment_date, status, void_reason, authorized_signer_label, authorization_acknowledged_at,
    vendors(name, address_street, address_city, address_state, address_zip, taxpayer_id),
    associations(name),
    bank_accounts(name, bank_name, company_name, company_address, routing_number, account_number, check_signature),
    payable_bills(bill_number, memo, bill_date, due_date, gl_accounts(number, name))
  `).eq('run_transaction_id', issuedChecks[0].run_transaction_id).order('check_number').limit(100)
  if (printableError) throw printableError
  assert(printableRun?.length === 1 && printableRun[0].payable_bills?.bill_number && printableRun[0].vendors?.name && printableRun[0].bank_accounts?.name, 'Immutable printable check run could not load its bill, vendor, and bank details')
  const { data: entries, error: entriesError } = await db.from('journal_entries').select('id, source_type, posted').or(`and(source_type.eq.payable_bill,source_id.eq.${billA}),id.eq.${issuedChecks[0].payment_entry_id}`)
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
  const replay = await db.rpc('record_check_run', { p_bank_account_id: bankA, p_bill_ids: [billA], p_starting_check_number: 5002, p_payment_date: '2026-07-29', p_authorization_confirmed: true })
  assert(replay.error?.message.includes('not approved and unpaid'), 'Paid bill replay was not rejected')

  const voidCheck = await db.rpc('void_payable_check', { p_check_id: issuedChecks[0].id, p_reason: 'CODEX_TEST incorrect vendor address', p_stop_payment: false })
  if (voidCheck.error) throw voidCheck.error
  const { data: voidedCheck } = await db.from('payable_checks').select('status, void_entry_id, check_number').eq('id', issuedChecks[0].id).single()
  assert(voidedCheck?.status === 'voided' && voidedCheck?.void_entry_id, 'Paid check void history was not recorded')
  const { data: voidPaymentLines } = await db.from('journal_lines').select('debit_amount, credit_amount').in('entry_id', [issuedChecks[0].payment_entry_id, voidedCheck.void_entry_id])
  assert(voidPaymentLines?.length === 4 && voidPaymentLines.reduce((sum, line) => sum + Number(line.debit_amount) - Number(line.credit_amount), 0) === 0, 'Paid check and void reversal do not net to zero')
  const { data: reopenedBill } = await db.from('payable_bills').select('status, paid_at, check_number').eq('id', billA).single()
  assert(reopenedBill?.status === 'approved' && reopenedBill?.paid_at === null && reopenedBill?.check_number === null, 'Voided check did not reopen the bill')
  const reissue = await db.rpc('record_check_run', { p_bank_account_id: bankA, p_bill_ids: [billA], p_starting_check_number: 5002, p_payment_date: '2026-07-30', p_authorization_confirmed: true })
  if (reissue.error) throw reissue.error
  const { data: allChecks } = await db.from('payable_checks').select('id, status, check_number').eq('bill_id', billA).order('check_number')
  assert(allChecks?.length === 2 && allChecks[0].status === 'voided' && allChecks[1].status === 'issued' && allChecks[1].check_number === 5002, 'Reissue did not preserve the void and issue the next number')
  const stopped = await db.rpc('void_payable_check', { p_check_id: allChecks[1].id, p_reason: 'CODEX_TEST lost in mail', p_stop_payment: true })
  if (stopped.error) throw stopped.error
  const thirdIssue = await db.rpc('record_check_run', { p_bank_account_id: bankA, p_bill_ids: [billA], p_starting_check_number: 5003, p_payment_date: '2026-07-30', p_authorization_confirmed: true })
  if (thirdIssue.error) throw thirdIssue.error
  const { data: finalChecks } = await db.from('payable_checks').select('status, check_number').eq('bill_id', billA).order('check_number')
  assert(finalChecks?.length === 3 && finalChecks[1].status === 'stop_payment' && finalChecks[2].status === 'issued' && finalChecks[2].check_number === 5003, 'Stop payment did not preserve history and reissue the next number')

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
  console.log('Check authorization, issue, printable history, ledger, void, stop-payment, reissue, approval, and reversal lifecycle: PASS')
}

main().catch((error) => { console.error(error.message); process.exit(1) })
