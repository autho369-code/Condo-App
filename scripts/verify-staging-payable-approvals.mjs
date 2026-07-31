import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const url = process.env.STAGING_SUPABASE_URL
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
const password = process.env.STAGING_TEST_PASSWORD
if (!url || !anonKey || !serviceKey || !password || new URL(url).hostname.split('.')[0] !== STAGING_REF) {
  throw new Error('Exact staging credentials are required')
}

const ids = {
  portfolioA: '36900000-0000-4000-8000-000000000001',
  associationA: '36900000-0000-4000-8000-000000000011',
  vendorA: '36900000-0000-4000-8000-000000000051',
  vendorB: '36900000-0000-4000-8000-000000000052',
  bankA: '36900000-0000-4000-8000-000000000061',
  expenseA: '36900000-0000-4000-8100-000000000006',
}
const client = () => createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const manager = client()
const selectedBoard = client()
const unselectedBoard = client()
const createdBills = []
const approvalRequests = []
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const signIn = async (db, email) => {
  const { error } = await db.auth.signInWithPassword({ email, password })
  if (error) throw error
}

async function cleanup() {
  if (createdBills.length) {
    const { data: entries } = await service.from('journal_entries').select('id').in('source_id', createdBills)
    const entryIds = (entries ?? []).map((row) => row.id)
    if (entryIds.length) await service.from('journal_lines').delete().in('entry_id', entryIds)
    if (entryIds.length) await service.from('journal_entries').delete().in('id', entryIds)
    await service.from('payable_bills').delete().in('id', createdBills)
  }
  if (approvalRequests.length) {
    await service.from('approval_decisions').delete().in('approval_request_id', approvalRequests)
    await service.from('approval_requests').delete().in('id', approvalRequests)
  }
}

async function createBill(overrides = {}) {
  const result = await manager.rpc('create_payable_bill', {
    p_portfolio_id: ids.portfolioA,
    p_vendor_id: ids.vendorA,
    p_association_id: ids.associationA,
    p_gl_account_id: ids.expenseA,
    p_bank_account_id: ids.bankA,
    p_bill_number: `CODEX-APPROVAL-${Date.now()}`,
    p_bill_date: '2026-07-30',
    p_due_date: '2026-08-30',
    p_amount: 650,
    p_memo: 'CODEX_TEST board approval lifecycle',
    p_submit_for_approval: true,
    p_board_approval: false,
    ...overrides,
  })
  if (result.data) createdBills.push(result.data)
  return result
}

async function main() {
  await Promise.all([
    signIn(manager, 'codex_test.manager.a@portier369.invalid'),
    signIn(selectedBoard, 'codex_test.board.a@portier369.invalid'),
    signIn(unselectedBoard, 'codex_test.board.observer.a@portier369.invalid'),
  ])

  const direct = await manager.from('payable_bills').insert({
    portfolio_id: ids.portfolioA, vendor_id: ids.vendorA, association_id: ids.associationA,
    gl_account_id: ids.expenseA, bill_date: '2026-07-30', amount: 1, status: 'approved',
  })
  assert(Boolean(direct.error), 'Direct bill insertion was not denied')

  const crossTenant = await createBill({ p_vendor_id: ids.vendorB })
  assert(crossTenant.error?.message.includes('outside the bill portfolio'), 'Cross-portfolio vendor was not rejected')

  const draft = await createBill({ p_amount: 100, p_submit_for_approval: false })
  if (draft.error) throw draft.error
  const prematureDraftApproval = await manager.rpc('approve_payable_bill', { p_bill_id: draft.data })
  assert(prematureDraftApproval.error?.message.includes('Only submitted'), 'Draft bill could be approved without submission')
  const submittedDraft = await manager.rpc('request_payable_bill_approval', { p_bill_id: draft.data })
  if (submittedDraft.error) throw submittedDraft.error
  const approvedSubmittedDraft = await manager.rpc('approve_payable_bill', { p_bill_id: draft.data })
  if (approvedSubmittedDraft.error) throw approvedSubmittedDraft.error

  const created = await createBill()
  if (created.error) throw created.error
  const billId = created.data
  const { data: pending, error: pendingError } = await manager.from('payable_bills')
    .select('status, approval_required, approval_request_id').eq('id', billId).single()
  if (pendingError) throw pendingError
  assert(pending.status === 'pending_approval' && pending.approval_required && pending.approval_request_id,
    'Threshold bill was not routed to board approval')
  approvalRequests.push(pending.approval_request_id)

  const premature = await manager.rpc('approve_payable_bill', { p_bill_id: billId })
  assert(premature.error?.message.includes('Board approval is not complete'), 'Manager could approve before the board')

  const observerVote = await unselectedBoard.rpc('cast_board_approval', {
    p_request_id: pending.approval_request_id, p_decision: 'approve',
    p_signature: 'CODEX_TEST Observer', p_comment: 'Should be rejected',
  })
  assert(observerVote.error?.message.includes('Not an eligible voter'), 'Unselected board member could vote')

  const unsignedVote = await selectedBoard.rpc('cast_board_approval', {
    p_request_id: pending.approval_request_id, p_decision: 'approve', p_signature: '', p_comment: '',
  })
  assert(unsignedVote.error?.message.includes('Signature required'), 'Required signature was not enforced')

  const directDecision = await selectedBoard.from('approval_decisions').insert({
    approval_request_id: pending.approval_request_id,
    board_member_id: '36900000-0000-4000-8100-000000000094',
    decision: 'approve',
  })
  assert(Boolean(directDecision.error), 'Direct approval decision insertion was not denied')

  const vote = await selectedBoard.rpc('cast_board_approval', {
    p_request_id: pending.approval_request_id, p_decision: 'approve',
    p_signature: 'CODEX_TEST Board A', p_comment: 'Approved in staging verification',
  })
  if (vote.error) throw vote.error
  const { data: approvedRequest } = await selectedBoard.from('approval_requests')
    .select('status, votes_for, decision_at').eq('id', pending.approval_request_id).single()
  assert(approvedRequest?.status === 'approved' && approvedRequest.votes_for === 1 && approvedRequest.decision_at,
    'Selected board approval did not finalize the request')

  const finalizedReplay = await selectedBoard.rpc('cast_board_approval', {
    p_request_id: pending.approval_request_id, p_decision: 'reject',
    p_signature: 'CODEX_TEST Board A', p_comment: '',
  })
  assert(finalizedReplay.error?.message.includes('already finalized'), 'Finalized board decision could be changed')

  const posting = await manager.rpc('approve_payable_bill', { p_bill_id: billId })
  if (posting.error) throw posting.error
  const { data: postedBill } = await manager.from('payable_bills')
    .select('status, approved_by, approved_at').eq('id', billId).single()
  assert(postedBill?.status === 'approved' && postedBill.approved_by && postedBill.approved_at,
    'Board-approved bill was not posted by the manager')
  const { data: entry } = await manager.from('journal_entries')
    .select('id, posted').eq('source_type', 'payable_bill').eq('source_id', billId).single()
  assert(entry?.posted && posting.data === entry.id, 'Bill accrual entry was not posted')
  const { data: lines } = await manager.from('journal_lines')
    .select('debit_amount, credit_amount').eq('entry_id', entry.id)
  const debits = (lines ?? []).reduce((sum, row) => sum + Number(row.debit_amount), 0)
  const credits = (lines ?? []).reduce((sum, row) => sum + Number(row.credit_amount), 0)
  assert(lines?.length === 2 && debits === 650 && credits === 650, 'Bill accrual is not balanced')

  console.log('Payable creation, explicit submission, tenant guard, board routing, eligible voting, signature, finalization, and balanced posting: PASS')
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(cleanup)
