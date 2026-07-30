import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const PRODUCTION_REF = 'termxngysvotnfbzbgrv'
const FIXTURE = 'CODEX_TEST_PORTIER369_V1'
const url = process.env.STAGING_SUPABASE_URL
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
const password = process.env.STAGING_TEST_PASSWORD

if (!url || !key || !password) throw new Error('Missing staging URL, service-role key, or test password')
const ref = new URL(url).hostname.split('.')[0]
if (ref !== STAGING_REF || ref === PRODUCTION_REF || process.env.PORTIER369_STAGING_CONFIRM !== STAGING_REF) {
  throw new Error(`Refusing seed for project ${ref || 'unknown'}`)
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const ids = {
  portfolioA: '36900000-0000-4000-8000-000000000001', portfolioB: '36900000-0000-4000-8000-000000000002',
  associationA: '36900000-0000-4000-8000-000000000011', associationB: '36900000-0000-4000-8000-000000000012',
  buildingA: '36900000-0000-4000-8000-000000000021', buildingB: '36900000-0000-4000-8000-000000000022',
  unitA: '36900000-0000-4000-8000-000000000031', unitB: '36900000-0000-4000-8000-000000000032',
  ownerA: '36900000-0000-4000-8000-000000000041', ownerB: '36900000-0000-4000-8000-000000000042',
  vendorA: '36900000-0000-4000-8000-000000000051', vendorB: '36900000-0000-4000-8000-000000000052',
  bankA: '36900000-0000-4000-8000-000000000061', bankB: '36900000-0000-4000-8000-000000000062',
}
const account = (tenant, suffix) => `36900000-0000-4000-8${tenant}00-${String(suffix).padStart(12, '0')}`
const entry = (tenant, suffix) => `36900000-0000-4000-9${tenant}00-${String(suffix).padStart(12, '0')}`

async function must(label, promise) {
  const result = await promise
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}
async function upsert(table, rows, onConflict = 'id') {
  return must(table, db.from(table).upsert(rows, { onConflict }))
}
async function ensureUser(email, displayName, portfolioId, role) {
  const listed = await must('list users', db.auth.admin.listUsers({ perPage: 1000 }))
  let user = listed.users.find((candidate) => candidate.email === email)
  if (!user) user = await must(`create ${email}`, db.auth.admin.createUser({ email, password, email_confirm: true })).then((r) => r.user)
  else await must(`refresh password ${email}`, db.auth.admin.updateUserById(user.id, { password, email_confirm: true }))
  const isStaff = role === 'company_admin' || role === 'manager'
  await upsert('profiles', [{
    id: user.id, email, full_name: displayName, display_name: displayName,
    portfolio_id: portfolioId, role,
    hoa_role: isStaff ? role : role === 'board' || role === 'owner' ? role : null,
    mvp_role: isStaff ? role : null,
  }])
  return user
}

async function main() {
  await upsert('portfolios', [
    { id: ids.portfolioA, company_name: `${FIXTURE} Alpha`, slug: 'codex-test-portier-alpha', tier: 'growth' },
    { id: ids.portfolioB, company_name: `${FIXTURE} Beta`, slug: 'codex-test-portier-beta', tier: 'growth' },
  ])
  const [adminA, managerA, adminB] = await Promise.all([
    ensureUser('codex_test.admin.a@portier369.invalid', 'CODEX_TEST Admin A', ids.portfolioA, 'company_admin'),
    ensureUser('codex_test.manager.a@portier369.invalid', 'CODEX_TEST Manager A', ids.portfolioA, 'manager'),
    ensureUser('codex_test.admin.b@portier369.invalid', 'CODEX_TEST Admin B', ids.portfolioB, 'company_admin'),
  ])
  await upsert('report_definitions', [
    ['trial_balance', 'Trial Balance', 'Debit and credit summary for every general-ledger account'],
    ['balance_sheet', 'Balance Sheet', 'Assets, liabilities, and equity as of a selected date'],
    ['income_statement', 'Income Statement', 'Revenue and expenses for a selected period'],
    ['general_ledger', 'General Ledger', 'Posted journal activity with account balances'],
    ['ar_aging', 'A/R Aging', 'Outstanding owner receivables by aging bucket'],
    ['delinquency_summary', 'Delinquency Summary', 'Outstanding owner receivables summarized by aging bucket'],
    ['ap_aging', 'A/P Aging', 'Outstanding vendor payables by aging bucket'],
    ['aged_payables', 'Aged Payables', 'Detailed outstanding vendor payables'],
    ['aged_payables_summary', 'Aged Payables Summary', 'Outstanding payables summarized by aging bucket'],
    ['budget_vs_actual', 'Budget vs Actual', 'Budgeted and actual activity with variance'],
    ['budget_vs_actuals', 'Budget vs Actuals', 'Budgeted and actual activity with monthly variance'],
    ['annual_budget_comparative', 'Annual Budget Comparative', 'Annual budget compared with actual activity'],
    ['bank_reconciliation', 'Bank Reconciliation', 'Statement and book balance reconciliation summary'],
    ['bank_account_reconciliation', 'Bank Account Reconciliation', 'Reconciliation status by bank account'],
    ['bank_reconciliation_detail', 'Bank Reconciliation Detail', 'Detailed bank reconciliation activity'],
  ].map(([slug, name, description]) => ({
    slug,
    name,
    description,
    category: 'accounting',
    is_system: true,
    active: true,
    output_formats: ['pdf', 'xlsx', 'csv', 'json'],
  })), 'slug')
  await upsert('associations', [
    { id: ids.associationA, portfolio_id: ids.portfolioA, created_by: adminA.id, name: 'Harbor View Staging HOA', slug: 'harbor-view-staging', address: '100 Verification Way', city: 'Seattle', state: 'WA', zip: '98101', fiscal_year_start: 1, unit_count: 1, status: 'active' },
    { id: ids.associationB, portfolio_id: ids.portfolioB, created_by: adminB.id, name: 'Cedar Grove Isolation HOA', slug: 'cedar-grove-isolation', address: '200 Boundary Lane', city: 'Portland', state: 'OR', zip: '97201', fiscal_year_start: 1, unit_count: 1, status: 'active' },
  ])
  await upsert('buildings', [
    { id: ids.buildingA, association_id: ids.associationA, name: 'Harbor View', address: '100 Verification Way', city: 'Seattle', state: 'WA', zip: '98101', is_primary: true },
    { id: ids.buildingB, association_id: ids.associationB, name: 'Cedar Grove', address: '200 Boundary Lane', city: 'Portland', state: 'OR', zip: '97201', is_primary: true },
  ])
  await upsert('units', [
    { id: ids.unitA, building_id: ids.buildingA, unit_number: 'A-101', name: 'A-101', ownership_pct: 100 },
    { id: ids.unitB, building_id: ids.buildingB, unit_number: 'B-201', name: 'B-201', ownership_pct: 100 },
  ])
  await upsert('owners', [
    { id: ids.ownerA, portfolio_id: ids.portfolioA, full_name: 'CODEX_TEST Avery Alpha', first_name: 'Avery', last_name: 'Alpha', email: 'codex_test.owner.a@portier369.invalid', portal_activated: true },
    { id: ids.ownerB, portfolio_id: ids.portfolioB, full_name: 'CODEX_TEST Bailey Beta', first_name: 'Bailey', last_name: 'Beta', email: 'codex_test.owner.b@portier369.invalid', portal_activated: true },
  ])
  await upsert('unit_owners', [
    { id: account(1, 91), unit_id: ids.unitA, owner_id: ids.ownerA, is_primary: true, share_pct: 100 },
    { id: account(2, 92), unit_id: ids.unitB, owner_id: ids.ownerB, is_primary: true, share_pct: 100 },
  ])
  await upsert('association_assignments', [{ id: account(1, 93), association_id: ids.associationA, portfolio_id: ids.portfolioA, manager_id: managerA.id, assigned_by: adminA.id, role: 'manager' }])

  const templates = [
    [1100, 'Operating Cash', 'asset'], [1200, 'Accounts Receivable', 'asset'], [2000, 'Accounts Payable', 'liability'],
    [3000, 'Retained Earnings', 'equity'], [4000, 'Assessments', 'income'], [6100, 'Utilities', 'expense'], [6200, 'Repairs', 'expense'],
  ]
  const gl = []
  for (const [tenant, portfolioId, associationId] of [[1, ids.portfolioA, ids.associationA], [2, ids.portfolioB, ids.associationB]]) {
    templates.forEach(([number, name, accountType], index) => gl.push({ id: account(tenant, index + 1), portfolio_id: portfolioId, association_id: associationId, number, name, account_type: accountType, active: true }))
  }
  await upsert('gl_accounts', gl)
  await upsert('vendors', [
    { id: ids.vendorA, portfolio_id: ids.portfolioA, name: 'CODEX_TEST Alpha Building Services', trade: 'general_contractor', payment_terms: 'Net 30', portal_activated: true },
    { id: ids.vendorB, portfolio_id: ids.portfolioB, name: 'CODEX_TEST Beta Building Services', trade: 'general_contractor', payment_terms: 'Net 30', portal_activated: true },
  ])
  const [boardA, ownerAUser, vendorAUser, ownerBUser, vendorBUser] = await Promise.all([
    ensureUser('codex_test.board.a@portier369.invalid', 'CODEX_TEST Board A', ids.portfolioA, 'board'),
    ensureUser('codex_test.owner.a@portier369.invalid', 'CODEX_TEST Owner A', ids.portfolioA, 'owner'),
    ensureUser('codex_test.vendor.a@portier369.invalid', 'CODEX_TEST Vendor A', ids.portfolioA, 'vendor'),
    ensureUser('codex_test.owner.b@portier369.invalid', 'CODEX_TEST Owner B', ids.portfolioB, 'owner'),
    ensureUser('codex_test.vendor.b@portier369.invalid', 'CODEX_TEST Vendor B', ids.portfolioB, 'vendor'),
  ])
  await upsert('board_members', [{ id: account(1, 94), association_id: ids.associationA, full_name: 'CODEX_TEST Board A', email: 'codex_test.board.a@portier369.invalid', role: 'treasurer', active: true, auth_user_id: boardA.id }])
  await must('link owner A auth', db.from('owners').update({ auth_user_id: ownerAUser.id }).eq('id', ids.ownerA))
  await must('link owner B auth', db.from('owners').update({ auth_user_id: ownerBUser.id }).eq('id', ids.ownerB))
  await must('link vendor A auth', db.from('vendors').update({ auth_user_id: vendorAUser.id }).eq('id', ids.vendorA))
  await must('link vendor B auth', db.from('vendors').update({ auth_user_id: vendorBUser.id }).eq('id', ids.vendorB))
  await upsert('bank_accounts', [
    { id: ids.bankA, portfolio_id: ids.portfolioA, association_id: ids.associationA, gl_account_id: account(1, 1), name: 'Alpha Operating', bank_name: 'Staging Bank', account_type: 'checking', purpose: 'operating' },
    { id: ids.bankB, portfolio_id: ids.portfolioB, association_id: ids.associationB, gl_account_id: account(2, 1), name: 'Beta Operating', bank_name: 'Staging Bank', account_type: 'checking', purpose: 'operating' },
  ])
  const entries = []
  const lines = []
  for (const [tenant, portfolioId, associationId] of [[1, ids.portfolioA, ids.associationA], [2, ids.portfolioB, ids.associationB]]) {
    const amounts = tenant === 1 ? [12000, 7200, 1800] : [8000, 4100, 900]
    const specs = [
      ['2026-01-05', 'Opening cash', 1, 4, amounts[0]],
      ['2026-06-01', 'Assessment revenue', 2, 5, amounts[1]],
      ['2026-06-15', 'Utilities expense', 6, 1, amounts[2]],
    ]
    specs.forEach(([date, description, debit, credit, amount], i) => {
      const entryId = entry(tenant, i + 1)
      entries.push({ id: entryId, portfolio_id: portfolioId, entry_date: date, description, reference_number: `STG-${tenant}-${i + 1}`, source_type: 'staging_verification', posted: true, posted_at: `${date}T12:00:00Z` })
      lines.push(
        { id: entry(tenant, 100 + i * 2), entry_id: entryId, association_id: associationId, gl_account_id: account(tenant, debit), debit_amount: amount, credit_amount: 0, sort_order: 1 },
        { id: entry(tenant, 101 + i * 2), entry_id: entryId, association_id: associationId, gl_account_id: account(tenant, credit), debit_amount: 0, credit_amount: amount, sort_order: 2 },
      )
    })
  }
  await upsert('journal_entries', entries)
  await upsert('journal_lines', lines)
  await upsert('budget_lines', [
    { id: account(1, 71), association_id: ids.associationA, gl_account_id: account(1, 5), fiscal_year: 2026, category: 'income', monthly_amounts: Array(12).fill(1200) },
    { id: account(1, 72), association_id: ids.associationA, gl_account_id: account(1, 6), fiscal_year: 2026, category: 'expense', monthly_amounts: Array(12).fill(300) },
    { id: account(2, 73), association_id: ids.associationB, gl_account_id: account(2, 5), fiscal_year: 2026, category: 'income', monthly_amounts: Array(12).fill(800) },
  ])
  await upsert('payable_bills', [
    { id: account(1, 81), portfolio_id: ids.portfolioA, association_id: ids.associationA, vendor_id: ids.vendorA, gl_account_id: account(1, 6), bill_number: 'ALPHA-90', bill_date: '2026-03-01', due_date: '2026-03-31', amount: 750, status: 'approved', memo: '90+ day aging fixture' },
    { id: account(1, 82), portfolio_id: ids.portfolioA, association_id: ids.associationA, vendor_id: ids.vendorA, gl_account_id: account(1, 7), bill_number: 'ALPHA-CURRENT', bill_date: '2026-07-15', due_date: '2026-08-15', amount: 425, status: 'approved', memo: 'Current aging fixture' },
    { id: account(2, 83), portfolio_id: ids.portfolioB, association_id: ids.associationB, vendor_id: ids.vendorB, gl_account_id: account(2, 6), bill_number: 'BETA-ONLY', bill_date: '2026-07-01', due_date: '2026-08-01', amount: 333, status: 'approved', memo: 'Tenant isolation sentinel' },
  ])
  const chargeIds = [1, 2, 3, 4, 5, 6].map((suffix) => account(suffix === 6 ? 2 : 1, 200 + suffix))
  await upsert('charges', [
    { id: chargeIds[0], unit_id: ids.unitA, charge_type: 'assessment', description: 'CODEX_TEST current assessment', due_date: '2026-08-15', amount: 100, gl_account_id: account(1, 5) },
    { id: chargeIds[1], unit_id: ids.unitA, charge_type: 'assessment', description: 'CODEX_TEST 1-30 assessment', due_date: '2026-07-15', amount: 200, gl_account_id: account(1, 5) },
    { id: chargeIds[2], unit_id: ids.unitA, charge_type: 'assessment', description: 'CODEX_TEST 31-60 assessment', due_date: '2026-06-15', amount: 300, gl_account_id: account(1, 5) },
    { id: chargeIds[3], unit_id: ids.unitA, charge_type: 'assessment', description: 'CODEX_TEST 61-90 assessment', due_date: '2026-05-15', amount: 400, gl_account_id: account(1, 5) },
    { id: chargeIds[4], unit_id: ids.unitA, charge_type: 'assessment', description: 'CODEX_TEST 90+ partially paid assessment', due_date: '2026-03-15', amount: 500, gl_account_id: account(1, 5) },
    { id: chargeIds[5], unit_id: ids.unitB, charge_type: 'assessment', description: 'CODEX_TEST cross-tenant receivable sentinel', due_date: '2026-03-15', amount: 999, gl_account_id: account(2, 5) },
  ])
  const paymentId = account(1, 220)
  await upsert('payments', [{ id: paymentId, unit_id: ids.unitA, charge_id: chargeIds[4], payment_date: '2026-07-01', amount: 100, method: 'check', reference: 'CODEX_TEST-PARTIAL', gl_account_id: account(1, 1), bank_account_id: ids.bankA }])
  await upsert('bank_transactions', [
    { id: account(1, 85), portfolio_id: ids.portfolioA, bank_account_id: ids.bankA, gl_account_id: account(1, 1), plaid_transaction_id: 'staging-alpha-deposit', date: '2026-06-01', name: 'Assessment deposit', amount: 7200, reviewed: true },
    { id: account(2, 86), portfolio_id: ids.portfolioB, bank_account_id: ids.bankB, gl_account_id: account(2, 1), plaid_transaction_id: 'staging-beta-deposit', date: '2026-06-01', name: 'Assessment deposit', amount: 4100, reviewed: true },
  ])
  await upsert('bank_reconciliations', [
    { id: account(1, 87), portfolio_id: ids.portfolioA, bank_account_id: ids.bankA, statement_date: '2026-06-30', statement_balance: 10400, ending_book_balance: 10400, reconciled_balance: 10400, difference: 0, status: 'completed', completed_at: '2026-07-01T12:00:00Z' },
    { id: account(2, 88), portfolio_id: ids.portfolioB, bank_account_id: ids.bankB, statement_date: '2026-06-30', statement_balance: 7100, ending_book_balance: 7100, reconciled_balance: 7100, difference: 0, status: 'completed', completed_at: '2026-07-01T12:00:00Z' },
  ])
  console.log(JSON.stringify({ project: ref, fixture: FIXTURE, portfolios: 2, associations: 2, balancedEntries: entries.length, journalLines: lines.length }, null, 2))
}

main().catch((error) => { console.error(error.message); process.exit(1) })
