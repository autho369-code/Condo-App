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
  vendorA: '36900000-0000-4000-8000-000000000051',
  workOrderA: '36900000-0000-4000-8100-000000000300',
  workOrderB: '36900000-0000-4000-8200-000000000300',
  portfolioA: '36900000-0000-4000-8000-000000000001',
  associationA: '36900000-0000-4000-8000-000000000011',
}
const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
const session = () => createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const vendorA = session()
const vendorB = session()
const ownerA = session()
const invoiceNumber = `CODEX_TEST-VENDOR-${randomUUID()}`
const path = `vendors/${ids.vendorA}/invoice/${randomUUID()}-CODEX_TEST-invoice.pdf`
let billId = null
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function signIn(db, email) {
  const { data, error } = await db.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

async function submit(db, workOrderId, number = invoiceNumber) {
  return db.rpc('submit_vendor_invoice', {
    p_work_order_id: workOrderId,
    p_bill_number: number,
    p_bill_date: '2026-07-31',
    p_due_date: '2026-08-30',
    p_amount: '321.45',
    p_memo: 'CODEX_TEST vendor invoice submission verification',
    p_attachment_path: path,
    p_file_name: 'CODEX_TEST-invoice.pdf',
  })
}

async function cleanup() {
  await service.from('documents').delete().eq('file_url', path)
  if (billId) await service.from('payable_bills').delete().eq('id', billId)
  await service.storage.from('association-documents').remove([path])
}

async function main() {
  const [vendorUser] = await Promise.all([
    signIn(vendorA, 'codex_test.vendor.a@portier369.invalid'),
    signIn(vendorB, 'codex_test.vendor.b@portier369.invalid'),
    signIn(ownerA, 'codex_test.owner.a@portier369.invalid'),
  ])

  const payload = new TextEncoder().encode('%PDF-1.4\n% CODEX_TEST vendor invoice\n%%EOF\n')
  const { error: uploadError } = await service.storage.from('association-documents')
    .upload(path, payload, { contentType: 'application/pdf', upsert: false })
  if (uploadError) throw uploadError

  const ownerAttempt = await submit(ownerA, ids.workOrderA, `${invoiceNumber}-OWNER`)
  assert(ownerAttempt.error?.message.includes('Active vendor portal access is required'), 'Owner could call the vendor invoice RPC')

  const forgedAssociation = await submit(vendorA, ids.workOrderB, `${invoiceNumber}-FORGED`)
  assert(forgedAssociation.error?.message.includes('Assigned work order not found'), 'Vendor A could invoice Vendor B work')

  const first = await submit(vendorA, ids.workOrderA)
  if (first.error) throw first.error
  billId = first.data

  const replay = await submit(vendorA, ids.workOrderA)
  assert(replay.error?.message.includes('Invoice number already exists'), 'Duplicate vendor invoice number was accepted')

  const { data: bill, error: billError } = await service.from('payable_bills')
    .select('id, portfolio_id, association_id, vendor_id, work_order_id, bill_number, amount, status, approval_required, paid_at, created_by')
    .eq('id', billId).single()
  if (billError) throw billError
  assert(bill.portfolio_id === ids.portfolioA && bill.association_id === ids.associationA, 'Invoice tenant scope was not derived from the assigned work order')
  assert(bill.vendor_id === ids.vendorA && bill.work_order_id === ids.workOrderA, 'Invoice vendor/work-order attribution is incorrect')
  assert(bill.bill_number === invoiceNumber && Number(bill.amount) === 321.45, 'Invoice number or exact decimal amount is incorrect')
  assert(bill.status === 'pending_approval' && bill.approval_required === true && !bill.paid_at, 'Vendor invoice bypassed management approval')
  assert(bill.created_by === vendorUser.id, 'Invoice audit attribution is incorrect')

  const { data: documents, error: documentError } = await service.from('documents')
    .select('entity_type, entity_id, doc_type, file_name, file_url, uploaded_by').eq('file_url', path)
  if (documentError) throw documentError
  assert(documents.length === 1 && documents[0].entity_type === 'vendor' && documents[0].entity_id === ids.vendorA
    && documents[0].doc_type === 'vendor_invoice' && documents[0].uploaded_by === vendorUser.id,
  'Vendor invoice document record is missing or incorrectly scoped')

  const { data: vendorBRows, error: vendorBError } = await vendorB.from('payable_bills').select('id').eq('id', billId)
  if (vendorBError) throw vendorBError
  assert(vendorBRows.length === 0, 'Vendor B could read Vendor A invoice')

  console.log('Vendor invoice authorization, assigned-work scope, exact amount, approval gate, duplicate prevention, private document traceability, and tenant isolation: PASS')
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(cleanup)
