/**
 * seed-real.ts — Populate portier369 with realistic property management data.
 * Run: npx tsx scripts/seed-real.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────
function uid() { return crypto.randomUUID(); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function between(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function cents(min: number, max: number) { return Math.round(between(min * 100, max * 100)) / 100; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }
function futureDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; }

async function seed() {
  console.log('🌱 Seeding Portier369 with real property management data...\n');

  // ── 1. Get existing associations ───────────────────────────────────
  const { data: associations } = await db.from('associations').select('id, name, unit_count').is('archived_at', null);
  if (!associations?.length) {
    console.error('No associations found. Create associations first.');
    process.exit(1);
  }
  console.log(`Found ${associations.length} associations`);

  // ── 2. GL Accounts (Chart of Accounts) ─────────────────────────────
  const glAccounts = [
    // Assets (1000s)
    { number: 1150, name: 'Operating Cash', account_type: 'asset' },
    { number: 1154, name: 'Security Deposit Account', account_type: 'asset' },
    { number: 1170, name: 'Reserve Fund', account_type: 'asset' },
    { number: 1300, name: 'Accounts Receivable', account_type: 'asset' },
    // Liabilities (2000s)
    { number: 2100, name: 'Security Deposits Held', account_type: 'liability' },
    { number: 2300, name: 'Prepaid Assessments', account_type: 'liability' },
    { number: 2500, name: 'Accounts Payable', account_type: 'liability' },
    // Equity (3000s)
    { number: 3150, name: 'Reserve Contribution', account_type: 'equity' },
    { number: 3300, name: 'Retained Earnings', account_type: 'equity' },
    // Income (4000s)
    { number: 4101, name: 'Regular Assessment', account_type: 'income' },
    { number: 4102, name: 'Parking Income', account_type: 'income' },
    { number: 4460, name: 'Late Fee Income', account_type: 'income' },
    // Expenses (6000s)
    { number: 6101, name: 'Electricity', account_type: 'expense' },
    { number: 6103, name: 'Water/Sewer', account_type: 'expense' },
    { number: 6201, name: 'Management Fees', account_type: 'expense' },
    { number: 6213, name: 'Property Insurance', account_type: 'expense' },
    { number: 6301, name: 'Janitorial', account_type: 'expense' },
    { number: 6303, name: 'Snow Removal', account_type: 'expense' },
    { number: 6304, name: 'Landscaping', account_type: 'expense' },
    { number: 6314, name: 'HVAC Maintenance', account_type: 'expense' },
    { number: 6357, name: 'Plumbing Repairs', account_type: 'expense' },
  ];

  const { error: glErr } = await db.from('gl_accounts').upsert(
    glAccounts.map(g => ({ ...g, active: true })),
    { onConflict: 'number' }
  );
  if (glErr) console.error('GL accounts error:', glErr.message);
  else console.log(`Created ${glAccounts.length} GL accounts`);

  const { data: glRows } = await db.from('gl_accounts').select('id, number').eq('active', true);
  const glMap = new Map(glRows?.map(g => [g.number, g.id]) ?? []);

  // ── 3. Bank Accounts (2 per association) ───────────────────────────
  const banks = ['Chase', 'Bank of America', 'Wells Fargo', 'BMO Harris', 'Fifth Third'];
  const bankIds: string[] = [];
  for (const assoc of associations) {
    // Operating account
    const opId = uid();
    bankIds.push(opId);
    await db.from('bank_accounts').insert({
      id: opId, association_id: assoc.id, name: `${assoc.name} Operating`,
      bank_name: pick(banks), account_type: 'checking',
      payments_enabled: true, auto_reconciliation: true,
      last_reconciliation_date: daysAgo(between(1, 30)),
    });
    // Reserve account
    const resId = uid();
    bankIds.push(resId);
    await db.from('bank_accounts').insert({
      id: resId, association_id: assoc.id, name: `${assoc.name} Reserve`,
      bank_name: pick(banks), account_type: 'savings',
      payments_enabled: false, auto_reconciliation: false,
    });
  }
  console.log(`Created ${associations.length * 2} bank accounts`);

  // ── 4. Owners (5 per association) ──────────────────────────────────
  const firstNames = ['James', 'Maria', 'Robert', 'Patricia', 'David', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen', 'Daniel', 'Nancy', 'Matthew', 'Lisa', 'Anthony', 'Betty', 'Mark'];
  const lastNames = ['Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis'];
  const ownerIds: string[] = [];
  for (const assoc of associations) {
    const count = Math.min(assoc.unit_count ?? 10, 10);
    for (let i = 0; i < count; i++) {
      const ownerId = uid();
      ownerIds.push(ownerId);
      const first = pick(firstNames);
      const last = pick(lastNames);
      await db.from('owners').insert({
        id: ownerId, first_name: first, last_name: last,
        full_name: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${between(1,99)}@email.com`,
        phone: `312-${String(between(100,999))}-${String(between(1000,9999))}`,
        preferred_comm: pick(['email', 'phone', 'portal']),
        portal_activated: Math.random() > 0.3,
        portal_login_last_at: Math.random() > 0.4 ? new Date(Date.now() - between(1, 30) * 86400000).toISOString() : null,
        electronic_consent: Math.random() > 0.2,
      });
    }
  }
  console.log(`Created ${ownerIds.length} owners`);

  // ── 5. Vendors (15 total) ──────────────────────────────────────────
  const vendorData = [
    { name: 'ProFix HVAC Services', trade: 'hvac', payment_type: 'ach' },
    { name: 'Apex Plumbing Co.', trade: 'plumbing', payment_type: 'ach' },
    { name: 'Bright Spark Electric', trade: 'electrical', payment_type: 'check' },
    { name: 'GreenThumb Landscaping', trade: 'landscaping', payment_type: 'ach' },
    { name: 'CleanPro Janitorial', trade: 'janitorial', payment_type: 'ach' },
    { name: 'SecureGuard Locksmiths', trade: 'locksmith', payment_type: 'check' },
    { name: 'RoofMaster Inc.', trade: 'roofing', payment_type: 'check' },
    { name: 'CityView Elevator Co.', trade: 'elevator', payment_type: 'ach' },
    { name: 'PestShield Services', trade: 'pest_control', payment_type: 'ach' },
    { name: 'SnowPro Removal', trade: 'snow_removal', payment_type: 'check' },
    { name: 'PoolGuard Services', trade: 'pool', payment_type: 'ach' },
    { name: 'FireSafe Systems', trade: 'fire_safety', payment_type: 'check' },
    { name: 'GarageDoor Pro', trade: 'garage_doors', payment_type: 'check' },
    { name: 'PaintCraft Inc.', trade: 'painting', payment_type: 'ach' },
    { name: 'ComEd Utilities', trade: 'utilities', payment_type: 'ach', is_utility: true },
  ];
  const vendorIds: string[] = [];
  for (const v of vendorData) {
    const vid = uid();
    vendorIds.push(vid);
    await db.from('vendors').insert({
      id: vid, name: v.name, trade: v.trade, vendor_type: 'general',
      payment_type: v.payment_type, payment_terms: 'Net 30',
      is_utility: v.is_utility ?? false,
      send_1099: !v.is_utility, taxpayer_id: Math.random() > 0.5 ? `XX-${between(1000000, 9999999)}` : null,
      portal_activated: Math.random() > 0.4,
      hold_payments: false,
    });
  }
  console.log(`Created ${vendorIds.length} vendors`);

  // ── 6. Bills (2-4 per association) ─────────────────────────────────
  let billsCreated = 0;
  for (const assoc of associations) {
    const count = between(2, 4);
    for (let i = 0; i < count; i++) {
      const vendor = pick(vendorData);
      const glAcct = pick(['6101','6103','6301','6303','6304','6314','6357','6213']);
      const status = pick(['pending_approval', 'pending_approval', 'approved', 'paid']);
      const amount = cents(200, 8500);
      const billDate = daysAgo(between(1, 45));
      await db.from('payable_bills').insert({
        id: uid(), association_id: assoc.id,
        vendor_id: vendorIds[vendorData.indexOf(vendor)],
        gl_account_id: glMap.get(parseInt(glAcct)),
        bill_date: billDate, due_date: futureDays(30),
        amount, status, memo: `${vendor.name} — ${pick(['Monthly service', 'Repair', 'Emergency call', 'Quarterly maintenance', 'Annual inspection'])}`,
      });
      billsCreated++;
    }
  }
  console.log(`Created ${billsCreated} bills`);

  // ── 7. Violations (3-6 per association, some overdue) ──────────────
  const violationTypes = ['Noise complaint', 'Trash violation', 'Unauthorized modification', 'Parking violation', 'Pet violation', 'Lease violation', 'Fire lane obstruction', 'Common area damage'];
  let violationsCreated = 0;
  for (const assoc of associations) {
    const count = between(3, 6);
    for (let i = 0; i < count; i++) {
      const owner = pick(ownerIds);
      const dueDate = daysAgo(between(-10, 30));
      const status = dueDate < daysAgo(0) && Math.random() > 0.3 ? 'open' : pick(['open', 'open', 'closed']);
      await db.from('violations').insert({
        id: uid(), association_id: assoc.id,
        title: pick(violationTypes),
        description: `Reported violation requiring attention — ${pick(['first notice', 'second notice', 'final warning', 'board review required'])}`,
        status, priority: pick(['normal', 'normal', 'high']),
        reported_date: daysAgo(between(5, 60)),
        due_date: dueDate,
        fine_amount: status === 'open' && Math.random() > 0.5 ? cents(50, 500) : null,
      });
      violationsCreated++;
    }
  }
  console.log(`Created ${violationsCreated} violations`);

  // ── 8. Work Orders (2-4 per association) ───────────────────────────
  const woTypes = ['Plumbing leak', 'HVAC not cooling', 'Electrical outlet dead', 'Light fixture out', 'Door lock broken', 'Window seal failed', 'Elevator inspection', 'Fire alarm test', 'Common area cleaning', 'Carpet replacement'];
  let woCreated = 0;
  for (const assoc of associations) {
    const count = between(2, 4);
    for (let i = 0; i < count; i++) {
      const vendor = pick(vendorData);
      const status = pick(['new', 'assigned', 'in_progress', 'in_progress', 'completed']);
      await db.from('work_orders').insert({
        id: uid(), association_id: assoc.id,
        vendor_id: vendorIds[vendorData.indexOf(vendor)],
        title: pick(woTypes),
        description: `Work order for ${assoc.name}`,
        status, priority: pick(['normal', 'normal', 'high', 'emergency']),
        trade: vendor.trade,
        scheduled_date: futureDays(between(1, 14)),
        created_at: new Date(Date.now() - between(1, 30) * 86400000).toISOString(),
      });
      woCreated++;
    }
  }
  console.log(`Created ${woCreated} work orders`);

  // ── 9. Calendar Events (2-3 per association) ───────────────────────
  const eventTypes = ['board_meeting', 'annual_meeting', 'maintenance_visit', 'inspection', 'social_event', 'vendor_visit', 'water_shutoff'];
  let eventsCreated = 0;
  for (const assoc of associations) {
    const count = between(2, 3);
    for (let i = 0; i < count; i++) {
      const type = pick(eventTypes);
      const startDate = futureDays(between(5, 45));
      await db.from('calendar_events').insert({
        id: uid(), association_id: assoc.id,
        title: type === 'board_meeting' ? `${assoc.name} Board Meeting` : type === 'annual_meeting' ? `${assoc.name} Annual Meeting` : `${type.replace(/_/g, ' ')} — ${assoc.name}`,
        event_type: type,
        start_datetime: `${startDate}T${String(between(9,18)).padStart(2,'0')}:00:00`,
        end_datetime: `${startDate}T${String(between(11,20)).padStart(2,'0')}:00:00`,
        location: pick(['Community Room', 'Lobby', 'On-site', 'Virtual', 'Management Office']),
        operations_status: 'scheduled',
        public_notice_text: Math.random() > 0.5 ? `Notice: ${type.replace(/_/g, ' ')} scheduled for ${startDate}. Please plan accordingly.` : null,
      });
      eventsCreated++;
    }
  }
  console.log(`Created ${eventsCreated} calendar events`);

  // ── 10. Charges (assessments for owners) ────────────────────────────
  let chargesCreated = 0;
  for (const ownerId of ownerIds.slice(0, 15)) {
    const amount = cents(200, 800);
    await db.from('receivable_charges').insert({
      id: uid(), owner_id: ownerId,
      amount, charge_type: 'regular_assessment',
      due_date: daysAgo(between(-30, 15)),
      status: Math.random() > 0.3 ? 'outstanding' : 'paid',
      memo: 'Monthly HOA assessment',
    });
    chargesCreated++;
  }
  console.log(`Created ${chargesCreated} charges`);

  // ── 11. Activity entries ────────────────────────────────────────────
  const actions = ['violation.created', 'bill.approved', 'work_order.created', 'payment.received', 'owner.activated', 'vendor.added', 'inspection.scheduled', 'notice.sent'];
  let activityCreated = 0;
  for (let i = 0; i < 20; i++) {
    await db.from('activity').insert({
      id: uid(), action: pick(actions),
      agent: pick(['System', 'Staff', 'Owner Portal', 'Vendor Portal', 'Cron Job']),
      details: pick(['Automatic processing', 'Manual entry', 'Scheduled task', 'Portal submission']),
      created_at: new Date(Date.now() - between(1, 72) * 3600000).toISOString(),
    });
    activityCreated++;
  }
  console.log(`Created ${activityCreated} activity entries`);

  console.log('\n✅ Seed complete! Refresh the dashboard to see real data.');
}

seed().catch(console.error);
