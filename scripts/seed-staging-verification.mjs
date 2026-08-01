import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'zalfkrtjeswvfmucicea'
const PRODUCTION_REF = 'termxngysvotnfbzbgrv'
const FIXTURE = 'CODEX_TEST_PORTIER369_V1'
const DOCUMENT_BUCKET = 'association-documents'
const DOCUMENT_PATH = 'associations/36900000-0000-4000-8000-000000000011/codex-test/governing-document.pdf'
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
  associationA: '36900000-0000-4000-8000-000000000011', associationB: '36900000-0000-4000-8000-000000000012', associationA2: '36900000-0000-4000-8000-000000000013',
  buildingA: '36900000-0000-4000-8000-000000000021', buildingB: '36900000-0000-4000-8000-000000000022', buildingA2: '36900000-0000-4000-8000-000000000023',
  unitA: '36900000-0000-4000-8000-000000000031', unitB: '36900000-0000-4000-8000-000000000032', unitA2: '36900000-0000-4000-8000-000000000033',
  ownerA: '36900000-0000-4000-8000-000000000041', ownerB: '36900000-0000-4000-8000-000000000042', ownerA2: '36900000-0000-4000-8000-000000000043',
  vendorA: '36900000-0000-4000-8000-000000000051', vendorB: '36900000-0000-4000-8000-000000000052',
  bankA: '36900000-0000-4000-8000-000000000061', bankB: '36900000-0000-4000-8000-000000000062',
  tenantA: '36900000-0000-4000-8000-000000000071',
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
  const operator = await ensureUser('codex_test.operator@portier369.invalid', 'CODEX_TEST Platform Operator', null, 'platform_operator')
  await upsert('platform_operators', [{ id: account(1, 95), auth_user_id: operator.id, email: 'codex_test.operator@portier369.invalid', full_name: 'CODEX_TEST Platform Operator', role: 'admin', active: true }])
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
    output_formats: ['pdf', 'csv', 'json'],
  })), 'slug')
  await upsert('associations', [
    { id: ids.associationA, portfolio_id: ids.portfolioA, created_by: adminA.id, name: 'CODEX_TEST Harbor View Staging HOA', slug: 'codex-test-harbor-view-staging', address: '100 Verification Way', city: 'Seattle', state: 'WA', zip: '98101', fiscal_year_start: 1, unit_count: 1, status: 'active' },
    { id: ids.associationB, portfolio_id: ids.portfolioB, created_by: adminB.id, name: 'CODEX_TEST Cedar Grove Isolation HOA', slug: 'codex-test-cedar-grove-isolation', address: '200 Boundary Lane', city: 'Portland', state: 'OR', zip: '97201', fiscal_year_start: 1, unit_count: 1, status: 'active' },
    { id: ids.associationA2, portfolio_id: ids.portfolioA, created_by: adminA.id, name: 'CODEX_TEST Marina Court HOA', slug: 'codex-test-marina-court', address: '300 Switching Court', city: 'Seattle', state: 'WA', zip: '98102', fiscal_year_start: 1, unit_count: 1, status: 'active' },
  ])
  await upsert('buildings', [
    { id: ids.buildingA, association_id: ids.associationA, name: 'CODEX_TEST Harbor View', address: '100 Verification Way', city: 'Seattle', state: 'WA', zip: '98101', is_primary: true },
    { id: ids.buildingB, association_id: ids.associationB, name: 'CODEX_TEST Cedar Grove', address: '200 Boundary Lane', city: 'Portland', state: 'OR', zip: '97201', is_primary: true },
    { id: ids.buildingA2, association_id: ids.associationA2, name: 'CODEX_TEST Marina Court', address: '300 Switching Court', city: 'Seattle', state: 'WA', zip: '98102', is_primary: true },
  ])
  await upsert('units', [
    { id: ids.unitA, building_id: ids.buildingA, unit_number: 'CODEX_TEST_A-101', name: 'CODEX_TEST A-101', ownership_pct: 100 },
    { id: ids.unitB, building_id: ids.buildingB, unit_number: 'CODEX_TEST_B-201', name: 'CODEX_TEST B-201', ownership_pct: 100 },
    { id: ids.unitA2, building_id: ids.buildingA2, unit_number: 'M-301', name: 'CODEX_TEST M-301', ownership_pct: 100 },
  ])
  await upsert('owners', [
    { id: ids.ownerA, portfolio_id: ids.portfolioA, full_name: 'CODEX_TEST Avery Alpha', first_name: 'Avery', last_name: 'Alpha', email: 'codex_test.owner.a@portier369.invalid', portal_activated: true },
    { id: ids.ownerB, portfolio_id: ids.portfolioB, full_name: 'CODEX_TEST Bailey Beta', first_name: 'Bailey', last_name: 'Beta', email: 'codex_test.owner.b@portier369.invalid', portal_activated: true },
    { id: ids.ownerA2, portfolio_id: ids.portfolioA, full_name: 'CODEX_TEST Morgan Marina', first_name: 'Morgan', last_name: 'Marina', email: 'codex_test.owner.mariner@portier369.invalid', portal_activated: false },
  ])
  await upsert('unit_owners', [
    { id: account(1, 91), unit_id: ids.unitA, owner_id: ids.ownerA, is_primary: true, share_pct: 100 },
    { id: account(2, 92), unit_id: ids.unitB, owner_id: ids.ownerB, is_primary: true, share_pct: 100 },
    { id: account(1, 99), unit_id: ids.unitA2, owner_id: ids.ownerA2, is_primary: true, share_pct: 100 },
  ])
  await upsert('occupancies', [
    { id: account(1, 97), association_id: ids.associationA, unit_id: ids.unitA, owner_id: ids.ownerA, occupancy_type: 'owner', status: 'current', is_primary: true, share_pct: 100 },
    { id: account(2, 98), association_id: ids.associationB, unit_id: ids.unitB, owner_id: ids.ownerB, occupancy_type: 'owner', status: 'current', is_primary: true, share_pct: 100 },
    { id: account(1, 100), association_id: ids.associationA2, unit_id: ids.unitA2, owner_id: ids.ownerA2, occupancy_type: 'tenant', status: 'current', is_primary: true, share_pct: 100 },
  ])
  await upsert('association_assignments', [
    { id: account(1, 93), association_id: ids.associationA, portfolio_id: ids.portfolioA, manager_id: managerA.id, assigned_by: adminA.id, role: 'manager' },
    { id: account(1, 101), association_id: ids.associationA2, portfolio_id: ids.portfolioA, manager_id: managerA.id, assigned_by: adminA.id, role: 'manager' },
  ])
  await upsert('tenants', [{
    id: ids.tenantA, portfolio_id: ids.portfolioA, association_id: ids.associationA2,
    unit_id: ids.unitA2, owner_id: ids.ownerA2, first_name: 'CODEX_TEST Taylor', last_name: 'Tenant',
    email: 'codex_test.tenant.a@portier369.invalid', phone: '206-555-0369', status: 'active',
    lease_start: '2026-01-01', lease_end: '2026-12-31', insurance_policy_number: 'CODEX_TEST-RENTERS-369',
    insurance_expiration: '2026-12-31', emergency_contact_name: 'CODEX_TEST Emergency Contact',
    emergency_contact_phone: '206-555-0399', notes: `${FIXTURE} manager-side tenant and lease fixture`,
  }])

  const templates = [
    [1100, 'CODEX_TEST Operating Cash', 'asset'], [1200, 'CODEX_TEST Accounts Receivable', 'asset'], [2000, 'CODEX_TEST Accounts Payable', 'liability'],
    [3000, 'CODEX_TEST Retained Earnings', 'equity'], [4000, 'CODEX_TEST Assessments', 'income'], [6100, 'CODEX_TEST Utilities', 'expense'], [6200, 'CODEX_TEST Repairs', 'expense'],
  ]
  const gl = []
  for (const [tenant, portfolioId, associationId] of [[1, ids.portfolioA, ids.associationA], [2, ids.portfolioB, ids.associationB]]) {
    templates.forEach(([number, name, accountType], index) => gl.push({ id: account(tenant, index + 1), portfolio_id: portfolioId, association_id: associationId, number, name, account_type: accountType, active: true }))
  }
  await upsert('gl_accounts', gl)
  await upsert('vendors', [
    { id: ids.vendorA, portfolio_id: ids.portfolioA, name: 'CODEX_TEST Alpha Building Services', trade: 'general_contractor', payment_terms: 'Net 30', portal_activated: true, address_street: '410 Fixture Avenue', address_city: 'Seattle', address_state: 'WA', address_zip: '98101' },
    { id: ids.vendorB, portfolio_id: ids.portfolioB, name: 'CODEX_TEST Beta Building Services', trade: 'general_contractor', payment_terms: 'Net 30', portal_activated: true, address_street: '820 Sentinel Street', address_city: 'Portland', address_state: 'OR', address_zip: '97205' },
  ])
  const [boardA, boardObserverA, ownerAUser, vendorAUser, ownerBUser, vendorBUser] = await Promise.all([
    ensureUser('codex_test.board.a@portier369.invalid', 'CODEX_TEST Board A', ids.portfolioA, 'board'),
    ensureUser('codex_test.board.observer.a@portier369.invalid', 'CODEX_TEST Board Observer A', ids.portfolioA, 'board'),
    ensureUser('codex_test.owner.a@portier369.invalid', 'CODEX_TEST Owner A', ids.portfolioA, 'owner'),
    ensureUser('codex_test.vendor.a@portier369.invalid', 'CODEX_TEST Vendor A', ids.portfolioA, 'vendor'),
    ensureUser('codex_test.owner.b@portier369.invalid', 'CODEX_TEST Owner B', ids.portfolioB, 'owner'),
    ensureUser('codex_test.vendor.b@portier369.invalid', 'CODEX_TEST Vendor B', ids.portfolioB, 'vendor'),
  ])
  await upsert('board_members', [
    { id: account(1, 94), association_id: ids.associationA, full_name: 'CODEX_TEST Board A', email: 'codex_test.board.a@portier369.invalid', role: 'treasurer', active: true, auth_user_id: boardA.id },
    { id: account(1, 96), association_id: ids.associationA, full_name: 'CODEX_TEST Board Observer A', email: 'codex_test.board.observer.a@portier369.invalid', role: 'director', active: true, auth_user_id: boardObserverA.id },
  ])
  await upsert('board_approval_settings', [{
    association_id: ids.associationA,
    signatures_required: true,
    default_board_member_ids: [account(1, 94)],
    default_voting_scheme: 'any_one_approver',
    default_percentage_required: null,
    sends_bills_to_board: 'over_threshold',
    bills_threshold: 500,
  }], 'association_id')
  await must('link owner A auth', db.from('owners').update({ auth_user_id: ownerAUser.id }).eq('id', ids.ownerA))
  await must('link owner B auth', db.from('owners').update({ auth_user_id: ownerBUser.id }).eq('id', ids.ownerB))
  await must('link vendor A auth', db.from('vendors').update({ auth_user_id: vendorAUser.id }).eq('id', ids.vendorA))
  await must('link vendor B auth', db.from('vendors').update({ auth_user_id: vendorBUser.id }).eq('id', ids.vendorB))
  await upsert('bank_accounts', [
    { id: ids.bankA, portfolio_id: ids.portfolioA, association_id: ids.associationA, gl_account_id: account(1, 1), name: 'CODEX_TEST Alpha Operating', bank_name: 'CODEX_TEST Staging Bank', account_type: 'checking', purpose: 'operating', last_reconciliation_date: '2026-06-30', next_check_number: 5001, check_signature: 'CODEX_TEST Alpha Authorized Signer', company_name: 'CODEX_TEST Alpha Management', company_address: '100 Verification Way\nSeattle, WA 98101' },
    { id: ids.bankB, portfolio_id: ids.portfolioB, association_id: ids.associationB, gl_account_id: account(2, 1), name: 'CODEX_TEST Beta Operating', bank_name: 'CODEX_TEST Staging Bank', account_type: 'checking', purpose: 'operating', last_reconciliation_date: '2026-06-30', next_check_number: 7001, check_signature: 'CODEX_TEST Beta Authorized Signer', company_name: 'CODEX_TEST Beta Management', company_address: '200 Isolation Avenue\nPortland, OR 97205' },
  ])
  // Association creation intentionally provisions empty Operating/Reserve bank
  // shells. The fixture owns these exact associations, so replace those shells
  // with the deterministic, fully configured accounts used by verification.
  // This prevents diagnostics from reporting fake reconciliation lapses while
  // preserving the production provisioning behavior for real associations.
  await Promise.all([
    must('link Alpha fixture bank account', db.from('associations').update({ operating_bank_account_id: ids.bankA, reserve_bank_account_id: null }).eq('id', ids.associationA)),
    must('link Beta fixture bank account', db.from('associations').update({ operating_bank_account_id: ids.bankB, reserve_bank_account_id: null }).eq('id', ids.associationB)),
    must('clear Marina fixture bank shells', db.from('associations').update({ operating_bank_account_id: null, reserve_bank_account_id: null }).eq('id', ids.associationA2)),
  ])
  const provisionedBankShells = await must(
    'find auto-provisioned fixture bank shells',
    db.from('bank_accounts')
      .select('id, name, bank_name')
      .in('association_id', [ids.associationA, ids.associationB, ids.associationA2])
      .in('name', ['Operating', 'Reserve'])
      .is('bank_name', null),
  )
  if (provisionedBankShells.length) {
    await must(
      'remove auto-provisioned fixture bank shells',
      db.from('bank_accounts').delete().in('id', provisionedBankShells.map((row) => row.id)),
    )
  }
  const entries = []
  const lines = []
  for (const [tenant, portfolioId, associationId] of [[1, ids.portfolioA, ids.associationA], [2, ids.portfolioB, ids.associationB]]) {
    const amounts = tenant === 1 ? [12000, 7200, 1800] : [8000, 4100, 900]
    const specs = [
      ['2026-01-05', 'CODEX_TEST Opening cash', 1, 4, amounts[0]],
      ['2026-06-01', 'CODEX_TEST Assessment revenue', 2, 5, amounts[1]],
      ['2026-06-15', 'CODEX_TEST Utilities expense', 6, 1, amounts[2]],
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
  const payableBillIds = [account(1, 81), account(1, 82), account(2, 83)]
  const oldChecks = await must('find old payable fixture checks', db.from('payable_checks').select('id, payment_entry_id, void_entry_id').in('bill_id', payableBillIds))
  if (oldChecks.length) {
    const checkEntryIds = oldChecks.flatMap((row) => [row.payment_entry_id, row.void_entry_id]).filter(Boolean)
    await must('remove old payable fixture checks', db.from('payable_checks').delete().in('id', oldChecks.map((row) => row.id)))
    if (checkEntryIds.length) {
      await must('remove old check fixture lines', db.from('journal_lines').delete().in('entry_id', checkEntryIds))
      await must('remove old check fixture entries', db.from('journal_entries').delete().in('id', checkEntryIds))
    }
  }
  const oldPayableEntries = await must('find old payable fixture entries', db.from('journal_entries').select('id').in('source_id', payableBillIds).in('source_type', ['payable_bill', 'check_payment', 'payable_bill_void']))
  if (oldPayableEntries.length) {
    const oldEntryIds = oldPayableEntries.map((row) => row.id)
    await must('remove old payable fixture lines', db.from('journal_lines').delete().in('entry_id', oldEntryIds))
    await must('remove old payable fixture entries', db.from('journal_entries').delete().in('id', oldEntryIds))
  }
  await upsert('payable_bills', [
    { id: payableBillIds[0], portfolio_id: ids.portfolioA, association_id: ids.associationA, vendor_id: ids.vendorA, gl_account_id: account(1, 6), bill_number: 'CODEX_TEST-ALPHA-90', bill_date: '2026-03-01', due_date: '2026-03-31', amount: 750, status: 'approved', memo: 'CODEX_TEST 90+ day aging fixture', paid_at: null, bank_account_id: null, check_number: null },
    { id: payableBillIds[1], portfolio_id: ids.portfolioA, association_id: ids.associationA, vendor_id: ids.vendorA, gl_account_id: account(1, 7), bill_number: 'CODEX_TEST-ALPHA-CURRENT', bill_date: '2026-07-15', due_date: '2026-08-15', amount: 425, status: 'approved', memo: 'CODEX_TEST current aging fixture', paid_at: null, bank_account_id: null, check_number: null },
    { id: payableBillIds[2], portfolio_id: ids.portfolioB, association_id: ids.associationB, vendor_id: ids.vendorB, gl_account_id: account(2, 6), bill_number: 'CODEX_TEST-BETA-ONLY', bill_date: '2026-07-01', due_date: '2026-08-01', amount: 333, status: 'approved', memo: 'CODEX_TEST tenant isolation sentinel', paid_at: null, bank_account_id: null, check_number: null },
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
    { id: account(1, 85), portfolio_id: ids.portfolioA, bank_account_id: ids.bankA, gl_account_id: account(1, 1), plaid_transaction_id: 'codex-test-staging-alpha-deposit', date: '2026-06-01', name: 'CODEX_TEST Assessment deposit', amount: 7200, reviewed: true },
    { id: account(2, 86), portfolio_id: ids.portfolioB, bank_account_id: ids.bankB, gl_account_id: account(2, 1), plaid_transaction_id: 'codex-test-staging-beta-deposit', date: '2026-06-01', name: 'CODEX_TEST Assessment deposit', amount: 4100, reviewed: true },
  ])
  await upsert('bank_reconciliations', [
    { id: account(1, 87), portfolio_id: ids.portfolioA, bank_account_id: ids.bankA, statement_date: '2026-06-30', statement_balance: 10200, ending_book_balance: 10200, reconciled_balance: 10200, difference: 0, status: 'completed', completed_at: '2026-07-01T12:00:00Z' },
    { id: account(2, 88), portfolio_id: ids.portfolioB, bank_account_id: ids.bankB, statement_date: '2026-06-30', statement_balance: 7100, ending_book_balance: 7100, reconciled_balance: 7100, difference: 0, status: 'completed', completed_at: '2026-07-01T12:00:00Z' },
  ])
  await upsert('bank_reconciliation_items', [
    { id: account(1, 89), reconciliation_id: account(1, 87), journal_line_id: entry(1, 100), description: 'CODEX_TEST Opening cash cleared', amount: 12000, type: 'book', is_cleared: true, cleared_at: '2026-07-01T12:00:00Z', sort_order: 1 },
    { id: account(1, 90), reconciliation_id: account(1, 87), journal_line_id: entry(1, 105), description: 'CODEX_TEST Utilities payment cleared', amount: -1800, type: 'book', is_cleared: true, cleared_at: '2026-07-01T12:00:00Z', sort_order: 2 },
    { id: account(2, 89), reconciliation_id: account(2, 88), journal_line_id: entry(2, 100), description: 'CODEX_TEST Beta opening cash cleared', amount: 8000, type: 'book', is_cleared: true, cleared_at: '2026-07-01T12:00:00Z', sort_order: 1 },
    { id: account(2, 90), reconciliation_id: account(2, 88), journal_line_id: entry(2, 105), description: 'CODEX_TEST Beta utilities payment cleared', amount: -900, type: 'book', is_cleared: true, cleared_at: '2026-07-01T12:00:00Z', sort_order: 2 },
  ])

  const workOrderIds = [account(1, 300), account(2, 300)]
  const maintenanceTaskIds = [account(1, 301), account(2, 301)]
  const violationIds = [account(1, 302), account(2, 302), account(1, 312)]
  const calendarEventIds = [account(1, 303), account(2, 303)]
  const meetingIds = [account(1, 304), account(2, 304)]
  const communicationIds = [account(1, 305), account(2, 305)]
  const communicationLogIds = [account(1, 308), account(1, 309), account(2, 308), account(2, 309)]
  const communicationTimestamp = new Date().toISOString()
  const insuranceIds = [account(1, 306), account(2, 306)]
  const documentIds = [account(1, 307), account(2, 307)]

  await upsert('work_orders', [
    { id: workOrderIds[0], portfolio_id: ids.portfolioA, association_id: ids.associationA, unit_id: ids.unitA, vendor_id: ids.vendorA, created_by: managerA.id, number: 'CODEX_TEST-WO-A-001', title: 'CODEX_TEST lobby plumbing repair', description: 'Deterministic manager-owner-vendor workflow fixture', category: 'plumbing', priority: 'high', status: 'assigned', requested_by: 'CODEX_TEST Avery Alpha', scheduled_date: '2026-08-05', vendor_instructions: 'Check in with management before entry.' },
    { id: workOrderIds[1], portfolio_id: ids.portfolioB, association_id: ids.associationB, unit_id: ids.unitB, vendor_id: ids.vendorB, created_by: adminB.id, number: 'CODEX_TEST-WO-B-001', title: 'CODEX_TEST isolation sentinel repair', description: 'Must never be visible to portfolio Alpha', category: 'electrical', priority: 'normal', status: 'scheduled', requested_by: 'CODEX_TEST Bailey Beta', scheduled_date: '2026-08-06' },
  ])
  await upsert('maintenance_tasks', [
    { id: maintenanceTaskIds[0], association_id: ids.associationA, assigned_staff_id: managerA.id, vendor_id: ids.vendorA, task_name: 'CODEX_TEST annual fire alarm inspection', category: 'Safety', frequency: 'annual', start_date: '2026-01-01', next_due_date: '2026-08-10', priority: 'high', status: 'active', reminder_days: [30, 7, 1], notes: FIXTURE },
    { id: maintenanceTaskIds[1], association_id: ids.associationB, vendor_id: ids.vendorB, task_name: 'CODEX_TEST Beta isolation elevator inspection', category: 'Safety', frequency: 'annual', start_date: '2026-01-01', next_due_date: '2026-08-11', priority: 'normal', status: 'active', reminder_days: [7], notes: FIXTURE },
  ])
  await upsert('violations', [
    { id: violationIds[0], association_id: ids.associationA, unit_id: ids.unitA, owner_id: ids.ownerA, created_by: managerA.id, title: 'CODEX_TEST repeated noise violation', description: 'Deterministic notice and hearing workflow fixture', violation_type: 'noise', status: 'hearing_pending', date_observed: '2026-07-20', cure_deadline: '2026-07-27', hearing_required: true, hearing_at: '2026-08-12T18:00:00Z', hearing_date: '2026-08-12', fine_amount: 100, attachments: [], communication_log: [], owner_visible_history: [] },
    { id: violationIds[1], association_id: ids.associationB, unit_id: ids.unitB, owner_id: ids.ownerB, created_by: adminB.id, title: 'CODEX_TEST Beta isolation parking violation', description: 'Must never be visible to portfolio Alpha', violation_type: 'parking', status: 'open', date_observed: '2026-07-21', hearing_required: false, attachments: [], communication_log: [], owner_visible_history: [] },
    { id: violationIds[2], association_id: ids.associationA, unit_id: ids.unitA, owner_id: ids.ownerA, created_by: managerA.id, title: 'CODEX_TEST hearing request eligibility', description: 'Deterministic owner hearing request fixture', violation_type: 'other', status: 'notice_sent', date_observed: '2026-07-24', cure_deadline: '2026-08-07', hearing_required: false, hearing_requested_at: null, hearing_request_note: null, attachments: [], communication_log: [], owner_visible_history: [] },
  ])
  await upsert('calendar_events', [
    { id: calendarEventIds[0], portfolio_id: ids.portfolioA, association_id: ids.associationA, created_by: managerA.id, title: 'CODEX_TEST annual owners meeting', description: FIXTURE, event_type: 'annual_meeting_election', calendar_scope: 'annual', start_datetime: '2026-08-20T18:00:00Z', end_datetime: '2026-08-20T20:00:00Z', location: 'Harbor View Community Room', operations_status: 'scheduled', attendees: [], notification_recipients: ['owners', 'board'], reminder_rules: [] },
    { id: calendarEventIds[1], portfolio_id: ids.portfolioB, association_id: ids.associationB, created_by: adminB.id, title: 'CODEX_TEST Beta isolation board meeting', description: 'Must never be visible to portfolio Alpha', event_type: 'board_meeting', calendar_scope: 'daily', start_datetime: '2026-08-21T18:00:00Z', end_datetime: '2026-08-21T19:00:00Z', location: 'Cedar Grove', operations_status: 'scheduled', attendees: [], notification_recipients: ['board'], reminder_rules: [] },
  ])
  await upsert('meetings', [
    { id: meetingIds[0], portfolio_id: ids.portfolioA, association_id: ids.associationA, created_by: managerA.id, title: 'CODEX_TEST July board meeting', meeting_type: 'board_meeting', status: 'completed', start_time: '2026-07-15T18:00:00Z', end_time: '2026-07-15T19:30:00Z', location: 'Harbor View Community Room', agenda: 'Financial review; maintenance; owner forum', minutes: 'CODEX_TEST minutes approved for role and document verification.', quorum_met: true, quorum_requirement: 2, total_units: 1 },
    { id: meetingIds[1], portfolio_id: ids.portfolioB, association_id: ids.associationB, created_by: adminB.id, title: 'CODEX_TEST Beta isolation meeting', meeting_type: 'board_meeting', status: 'scheduled', start_time: '2026-08-22T18:00:00Z', location: 'Cedar Grove', agenda: 'Isolation sentinel', quorum_requirement: 1, total_units: 1 },
  ])
  await upsert('communication_messages', [
    { id: communicationIds[0], portfolio_id: ids.portfolioA, association_id: ids.associationA, created_by: managerA.id, calendar_event_id: calendarEventIds[0], channel: 'portal', status: 'sent', recipient_group: 'owners', subject: 'CODEX_TEST annual meeting announcement', body: 'CODEX_TEST owners meeting announcement for portal visibility verification.', recipient_name: 'Harbor View Owners', sent_at: '2026-07-31T12:00:00Z' },
    { id: communicationIds[1], portfolio_id: ids.portfolioB, association_id: ids.associationB, created_by: adminB.id, calendar_event_id: calendarEventIds[1], channel: 'portal', status: 'sent', recipient_group: 'board', subject: 'CODEX_TEST Beta isolation announcement', body: 'Must never be visible to portfolio Alpha.', recipient_name: 'Cedar Grove Board', sent_at: '2026-07-31T12:00:00Z' },
  ])
  await upsert('communications_log', [
    { id: communicationLogIds[0], portfolio_id: ids.portfolioA, association_id: ids.associationA, sender_id: managerA.id, direction: 'outbound', channel: 'announcement', status: 'sent', subject: 'CODEX_TEST annual meeting announcement', recipient_count: 1, created_at: communicationTimestamp },
    { id: communicationLogIds[1], portfolio_id: ids.portfolioA, association_id: ids.associationA, sender_id: managerA.id, direction: 'outbound', channel: 'email', status: 'delivered', subject: 'CODEX_TEST financial packet delivered', recipient_count: 1, created_at: communicationTimestamp },
    { id: communicationLogIds[2], portfolio_id: ids.portfolioB, association_id: ids.associationB, sender_id: adminB.id, direction: 'outbound', channel: 'announcement', status: 'sent', subject: 'CODEX_TEST Beta isolation announcement', recipient_count: 1, created_at: communicationTimestamp },
    { id: communicationLogIds[3], portfolio_id: ids.portfolioB, association_id: ids.associationB, sender_id: adminB.id, direction: 'outbound', channel: 'email', status: 'delivered', subject: 'CODEX_TEST Beta isolation email', recipient_count: 1, created_at: communicationTimestamp },
  ])
  await upsert('insurance_policies', [
    { id: insuranceIds[0], association_id: ids.associationA, owner_id: ids.ownerA, policy_number: 'CODEX_TEST-HO6-A-369', insurance_company: 'CODEX_TEST Mutual', effective_date: '2026-01-01', expiration_date: '2026-12-31', coverage_amount: 250000, liability_amount: 100000, deductible_amount: 1000, status: 'active', extraction_status: 'verified', notes: FIXTURE },
    { id: insuranceIds[1], association_id: ids.associationB, owner_id: ids.ownerB, policy_number: 'CODEX_TEST-HO6-B-369', insurance_company: 'CODEX_TEST Isolation Mutual', effective_date: '2026-01-01', expiration_date: '2026-12-31', coverage_amount: 200000, liability_amount: 100000, deductible_amount: 1000, status: 'active', extraction_status: 'verified', notes: 'Must never be visible to portfolio Alpha' },
  ])

  const pdf = new TextEncoder().encode('%PDF-1.4\n% CODEX_TEST deterministic governing document\n%%EOF\n')
  await must('upload deterministic document', db.storage.from(DOCUMENT_BUCKET).upload(DOCUMENT_PATH, pdf, { contentType: 'application/pdf', upsert: true }))
  await upsert('documents', [
    { id: documentIds[0], entity_type: 'association', entity_id: ids.associationA, doc_type: 'bylaws', file_name: 'CODEX_TEST_Harbor_View_Bylaws.pdf', file_url: DOCUMENT_PATH, uploaded_by: managerA.id },
    { id: documentIds[1], entity_type: 'meeting', entity_id: meetingIds[0], doc_type: 'minutes', file_name: 'CODEX_TEST_July_Board_Minutes.pdf', file_url: DOCUMENT_PATH, uploaded_by: managerA.id },
  ])

  console.log(JSON.stringify({
    project: ref,
    fixture: FIXTURE,
    portfolios: 2,
    associations: 3,
    balancedEntries: entries.length,
    journalLines: lines.length,
    operationalFixtures: { workOrders: 2, maintenanceTasks: 2, violations: 3, calendarEvents: 2, meetings: 2, announcementMessages: 2, communicationLogs: 4, documents: 2, insurancePolicies: 2, tenants: 1 },
    expected: { alphaTrialBalanceDebits: 21000, alphaTrialBalanceCredits: 21000, alphaNetIncome: 5400, alphaBalanceSheetTotal: 17400, alphaReceivables: 1400, alphaPayables: 1175, alphaReconciledBookBalance: 10200 },
  }, null, 2))
}

try {
  await main()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
