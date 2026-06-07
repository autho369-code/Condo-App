/**
 * seed-comprehensive.ts — Full Portier369 seed with all modules
 * Run: npx tsx scripts/seed-comprehensive.ts
 * Populates: units, occupancies, vendors (with compliance + contact),
 *   bills, payments, journal entries, bank transfers, purchase orders,
 *   inspections, fixed assets, calendar events, violations, work orders,
 *   maintenance tasks + history, house rules, activity
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

const db = createClient(env['NEXT_PUBLIC_SUPABASE_URL']!, env['SUPABASE_SERVICE_ROLE_KEY']!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function uid() { return crypto.randomUUID(); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function between(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function cents(min: number, max: number) { return Math.round(between(min * 100, max * 100)) / 100; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }
function futureDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; }
function isoNow() { return new Date().toISOString(); }

async function seed() {
  console.log('🌱 Seeding Portier369 — comprehensive data...\n');

  // ── Get existing associations ─────────────────────────────────────
  const { data: associations } = await db.from('associations').select('id, name, unit_count').is('archived_at', null);
  if (!associations?.length) { console.error('No associations. Create first.'); process.exit(1); }
  console.log(`Found ${associations.length} associations`);

  const portfolioId = 'a1000000-0000-0000-0000-000000000001';
  const userId = '11111111-1111-1111-1111-111111111111';

  // ── GL Accounts ────────────────────────────────────────────────────
  const glAccounts = [
    { number: 1150, name: 'Operating Cash', account_type: 'asset' },
    { number: 1154, name: 'Security Deposit Account', account_type: 'asset' },
    { number: 1170, name: 'Reserve Fund', account_type: 'asset' },
    { number: 1300, name: 'Accounts Receivable', account_type: 'asset' },
    { number: 2100, name: 'Security Deposits Held', account_type: 'liability' },
    { number: 2300, name: 'Prepaid Assessments', account_type: 'liability' },
    { number: 2500, name: 'Accounts Payable', account_type: 'liability' },
    { number: 3150, name: 'Reserve Contribution', account_type: 'equity' },
    { number: 3300, name: 'Retained Earnings', account_type: 'equity' },
    { number: 4101, name: 'Regular Assessment', account_type: 'income' },
    { number: 4102, name: 'Parking Income', account_type: 'income' },
    { number: 4460, name: 'Late Fee Income', account_type: 'income' },
    { number: 4550, name: 'Laundry Income', account_type: 'income' },
    { number: 6101, name: 'Electricity', account_type: 'expense' },
    { number: 6103, name: 'Water/Sewer', account_type: 'expense' },
    { number: 6201, name: 'Management Fees', account_type: 'expense' },
    { number: 6205, name: 'Legal - Association', account_type: 'expense' },
    { number: 6209, name: 'Property Taxes', account_type: 'expense' },
    { number: 6213, name: 'Property Insurance', account_type: 'expense' },
    { number: 6301, name: 'Janitorial', account_type: 'expense' },
    { number: 6303, name: 'Snow Removal', account_type: 'expense' },
    { number: 6304, name: 'Landscaping', account_type: 'expense' },
    { number: 6314, name: 'HVAC Maintenance', account_type: 'expense' },
    { number: 6357, name: 'Plumbing Repairs', account_type: 'expense' },
  ];
  await db.from('gl_accounts').upsert(glAccounts.map(g => ({ ...g, active: true })), { onConflict: 'number' });
  const { data: glRows } = await db.from('gl_accounts').select('id, number').eq('active', true);
  const glMap = new Map(glRows?.map(g => [g.number, g.id]) ?? []);
  console.log(`  ✓ ${glAccounts.length} GL accounts`);

  // ── Units + Occupancies ───────────────────────────────────────────
  const unitIds: string[] = [];
  const ownerIdsByAssoc: Record<string, string[]> = {};
  const firstNames = ['James','Maria','Robert','Patricia','David','Jennifer','Michael','Linda','William','Elizabeth','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Christopher','Karen','Daniel','Nancy'];
  const lastNames = ['Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor'];

  for (const assoc of associations) {
    const unitCount = Math.min(assoc.unit_count ?? 8, 12);
    ownerIdsByAssoc[assoc.id] = [];
    
    for (let i = 0; i < unitCount; i++) {
      // Create unit
      const unitId = uid();
      unitIds.push(unitId);
      await db.from('units').insert({
        id: unitId, building_id: null,
        unit_number: `${String(i + 1).padStart(2, '0')}${pick(['A','B','C',''])}`,
        sqft: between(600, 2200),
        bedrooms: between(1, 3),
        bathrooms: between(1, 2.5),
      });
      
      // Create owner for this unit
      const ownerId = uid();
      ownerIdsByAssoc[assoc.id].push(ownerId);
      const first = pick(firstNames);
      const last = pick(lastNames);
      await db.from('owners').insert({
        id: ownerId, first_name: first, last_name: last,
        full_name: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@email.com`,
        phone: `312-${between(100,999)}-${between(1000,9999)}`,
        preferred_comm: pick(['email','phone','portal']),
        portal_activated: Math.random() > 0.3,
      });

      // Create occupancy link
      await db.from('occupancies').insert({
        id: uid(), owner_id: ownerId, unit_id: unitId,
        association_id: assoc.id,
        occupancy_type: 'owner', status: 'current',
        move_in_date: daysAgo(between(30, 1095)),
        dues_amount: cents(200, 600),
        dues_frequency: 'monthly',
        share_pct: Math.round(10000 / unitCount) / 100,
        is_primary: i === 0,
      });
    }
  }
  const totalOwners = Object.values(ownerIdsByAssoc).reduce((s,a) => s + a.length, 0);
  console.log(`  ✓ ${unitIds.length} units, ${totalOwners} owners with occupancies`);

  // ── Vendors (with compliance + contact) ────────────────────────────
  const vendorData = [
    { name: 'ProFix HVAC Services', trade: 'hvac', phones: [{type:'landline',number:'312-555-1001'},{type:'mobile',number:'312-555-2001'}], emails: ['dispatch@profitxhvac.com'] },
    { name: 'Apex Plumbing Co.', trade: 'plumbing', phones: [{type:'landline',number:'312-555-1002'}], emails: ['service@apexplumbing.com'] },
    { name: 'Bright Spark Electric', trade: 'electrical', phones: [{type:'mobile',number:'312-555-2003'}], emails: ['info@brightspark.com'] },
    { name: 'GreenThumb Landscaping', trade: 'landscaping', phones: [{type:'landline',number:'312-555-1004'},{type:'mobile',number:'312-555-2004'}], emails: ['office@greenthumb.com'] },
    { name: 'CleanPro Janitorial', trade: 'janitorial', phones: [{type:'landline',number:'312-555-1005'}], emails: ['billing@cleanpro.com'] },
    { name: 'SecureGuard Locksmiths', trade: 'locksmith', phones: [{type:'mobile',number:'312-555-2006'}], emails: ['dispatch@secureguard.com'] },
    { name: 'RoofMaster Inc.', trade: 'roofing', phones: [{type:'landline',number:'312-555-1007'}], emails: ['jobs@roofmaster.com'] },
    { name: 'CityView Elevator Co.', trade: 'elevator', phones: [{type:'landline',number:'312-555-1008'},{type:'mobile',number:'312-555-2008'}], emails: ['support@cityviewelevator.com'] },
    { name: 'PestShield Services', trade: 'pest_control', phones: [{type:'mobile',number:'312-555-2009'}], emails: ['schedule@pestshield.com'] },
    { name: 'SnowPro Removal', trade: 'snow_removal', phones: [{type:'landline',number:'312-555-1010'}], emails: ['plow@snowpro.com'] },
    { name: 'FireSafe Systems', trade: 'fire_safety', phones: [{type:'landline',number:'312-555-1011'},{type:'mobile',number:'312-555-2011'}], emails: ['inspections@firesafe.com'] },
    { name: 'GarageDoor Pro', trade: 'garage_doors', phones: [{type:'mobile',number:'312-555-2012'}], emails: ['repair@garagedoorpro.com'] },
    { name: 'PaintCraft Inc.', trade: 'painting', phones: [{type:'landline',number:'312-555-1013'}], emails: ['estimates@paintcraft.com'] },
    { name: 'ComEd', trade: 'utilities', phones: [{type:'landline',number:'800-334-7661'}], emails: ['service@comed.com'], is_utility: true },
    { name: 'Peoples Gas', trade: 'utilities', phones: [{type:'landline',number:'866-556-6001'}], emails: ['customerservice@peoplesgas.com'], is_utility: true },
  ];
  const vendorIds: string[] = [];
  for (const v of vendorData) {
    const vid = uid();
    vendorIds.push(vid);
    await db.from('vendors').insert({
      id: vid, name: v.name, trade: v.trade, vendor_type: 'general',
      phone_numbers: v.phones, emails: v.emails,
      payment_type: pick(['check','ach','ach','ach']),
      payment_terms: 'Net 30',
      is_utility: (v as any).is_utility ?? false,
      send_1099: !((v as any).is_utility),
      taxpayer_id: `XX-${between(1000000,9999999)}`,
      portal_activated: Math.random() > 0.4,
      hold_payments: false,
      // Compliance dates
      workers_comp_expiration: futureDays(between(30, 365)),
      general_liability_expiration: futureDays(between(30, 400)),
      auto_insurance_expiration: futureDays(between(15, 300)),
      state_license_expiration: futureDays(between(60, 500)),
      contract_expiration: futureDays(between(90, 600)),
    });
  }
  console.log(`  ✓ ${vendorIds.length} vendors with compliance dates + contact`);

  // ── Bank Accounts ─────────────────────────────────────────────────
  const banks = ['Chase','Bank of America','Wells Fargo','BMO Harris','Fifth Third'];
  const bankAccountIds: string[] = [];
  for (const assoc of associations) {
    const opId = uid(); bankAccountIds.push(opId);
    await db.from('bank_accounts').insert({
      id: opId, portfolio_id: portfolioId, association_id: assoc.id,
      name: `${assoc.name} Operating`, bank_name: pick(banks),
      account_type: 'checking', payments_enabled: true,
      auto_reconciliation: true,
      last_reconciliation_date: daysAgo(between(1, 30)),
    });
    const resId = uid(); bankAccountIds.push(resId);
    await db.from('bank_accounts').insert({
      id: resId, portfolio_id: portfolioId, association_id: assoc.id,
      name: `${assoc.name} Reserve`, bank_name: pick(banks),
      account_type: 'savings', payments_enabled: false,
      auto_reconciliation: false,
    });
  }
  console.log(`  ✓ ${associations.length * 2} bank accounts`);

  // ── Bills + Journal Entries ──────────────────────────────────────
  let billsCreated = 0, entriesCreated = 0;
  const allOwnerIds = Object.values(ownerIdsByAssoc).flat();
  for (const assoc of associations) {
    // Bills per association
    for (let i = 0; i < between(3, 6); i++) {
      const vendor = pick(vendorData);
      const glAcct = pick([6101,6103,6301,6303,6304,6314,6357,6213]);
      const status = pick(['pending_approval','pending_approval','approved','approved','paid']);
      const amount = cents(200, 8500);
      await db.from('payable_bills').insert({
        id: uid(), association_id: assoc.id,
        vendor_id: vendorIds[vendorData.indexOf(vendor)],
        gl_account_id: glMap.get(glAcct),
        bill_date: daysAgo(between(1, 45)),
        due_date: futureDays(between(5, 30)),
        amount, status,
        memo: `${vendor.name} — ${pick(['Monthly service','Repair','Emergency','Quarterly maint.','Annual inspection'])}`,
      });
      billsCreated++;

      // If paid, create journal entry
      if (status === 'paid') {
        const jeId = uid();
        await db.from('journal_entries').insert({
          id: jeId, portfolio_id: portfolioId,
          association_id: assoc.id,
          name: `Bill payment — ${vendor.name}`,
          memo: `Payment for ${vendor.name}`,
          status: 'posted',
          created_by: userId,
        });
        await db.from('journal_lines').insert([
          { id: uid(), journal_entry_id: jeId, gl_account_id: glMap.get(glAcct), debit: 0, credit: amount, description: `${vendor.name} expense` },
          { id: uid(), journal_entry_id: jeId, gl_account_id: glMap.get(1150), debit: amount, credit: 0, description: 'Cash payment' },
        ]);
        entriesCreated++;
      }
    }
  }
  console.log(`  ✓ ${billsCreated} bills, ${entriesCreated} journal entries`);

  // ── Charges + Payments ────────────────────────────────────────────
  let chargesCreated = 0, paymentsCreated = 0;
  for (const ownerId of allOwnerIds.slice(0, 30)) {
    const amount = cents(200, 800);
    const chargeId = uid();
    await db.from('receivable_charges').insert({
      id: chargeId, owner_id: ownerId,
      amount, charge_type: 'regular_assessment',
      due_date: daysAgo(between(-30, 15)),
      status: Math.random() > 0.3 ? 'outstanding' : 'paid',
      memo: 'Monthly HOA assessment',
    });
    chargesCreated++;

    // Random payment
    if (Math.random() > 0.4) {
      await db.from('receivable_payments').insert({
        id: uid(), owner_id: ownerId,
        amount: Math.random() > 0.7 ? amount : cents(amount * 0.5, amount),
        method: pick(['ach','check','online']),
        payment_date: daysAgo(between(0, 14)),
        status: 'completed',
        reference: `PMT-${between(1000,9999)}`,
      });
      paymentsCreated++;
    }
  }
  console.log(`  ✓ ${chargesCreated} charges, ${paymentsCreated} payments`);

  // ── Work Orders ──────────────────────────────────────────────────
  const woTypes = ['Plumbing leak','HVAC not cooling','Electrical outlet dead','Light fixture out','Door lock broken','Window seal failed','Elevator inspection','Fire alarm test','Common area cleaning','Carpet replacement','Gutter cleaning','Paint touch-up','Appliance repair','Water heater service'];
  let woCreated = 0;
  for (const assoc of associations) {
    for (let i = 0; i < between(3, 6); i++) {
      const vendor = pick(vendorData);
      await db.from('work_orders').insert({
        id: uid(), association_id: assoc.id,
        unit_id: pick(unitIds),
        vendor_id: vendorIds[vendorData.indexOf(vendor)],
        title: pick(woTypes),
        description: `Reported by owner — requires ${pick(['immediate','scheduled','routine'])} attention.`,
        status: pick(['new','assigned','in_progress','in_progress','completed']),
        priority: pick(['normal','normal','high','emergency']),
        trade: vendor.trade,
        scheduled_date: futureDays(between(1, 14)),
        created_at: isoNow(),
      });
      woCreated++;
    }
  }
  console.log(`  ✓ ${woCreated} work orders`);

  // ── Purchase Orders ──────────────────────────────────────────────
  let poCreated = 0;
  for (const assoc of associations.slice(0, 3)) {
    for (let i = 0; i < between(1, 3); i++) {
      const vendor = pick(vendorData);
      const poId = uid();
      const poTotal = cents(500, 15000);
      await db.from('purchase_orders').insert({
        id: poId, association_id: assoc.id,
        vendor_id: vendorIds[vendorData.indexOf(vendor)],
        number: `PO-${String(between(100,999))}`,
        status: pick(['open','approved','billed']),
        po_total: poTotal,
        po_billed: Math.random() > 0.5 ? cents(poTotal * 0.5, poTotal) : 0,
      });
      // Line items
      await db.from('purchase_order_line_items').insert([
        { id: uid(), purchase_order_id: poId, description: pick(['Parts','Labor','Materials','Equipment rental']), qty: between(1, 10), unit_price: cents(20, 500), gl_account_id: glMap.get(pick([6314,6357,6301,6303,6304])) },
        { id: uid(), purchase_order_id: poId, description: pick(['Disposal','Permits','Inspection fee']), qty: 1, unit_price: cents(50, 300), gl_account_id: glMap.get(6205) },
      ]);
      poCreated++;
    }
  }
  console.log(`  ✓ ${poCreated} purchase orders with line items`);

  // ── Violations ────────────────────────────────────────────────────
  const violationTypes = ['Noise complaint','Trash violation','Unauthorized modification','Parking violation','Pet violation','Lease violation','Fire lane obstruction','Common area damage','Unauthorized occupant','Improper storage'];
  let violationsCreated = 0;
  for (const assoc of associations) {
    for (let i = 0; i < between(3, 7); i++) {
      const dueDate = daysAgo(between(-10, 30));
      const isOpen = dueDate < daysAgo(0) && Math.random() > 0.3;
      await db.from('violations').insert({
        id: uid(), association_id: assoc.id,
        title: pick(violationTypes),
        description: `${pick(['First','Second','Final'])} notice — ${pick(['Owner notified','Board review pending','Photos attached','Witness reported'])}`,
        status: isOpen ? 'open' : pick(['closed','cured']),
        severity: pick(['low','medium','medium','high']),
        reported_date: daysAgo(between(5, 90)),
        cure_deadline: dueDate,
        fine_amount: isOpen && Math.random() > 0.4 ? cents(50, 500) : null,
      });
      violationsCreated++;
    }
  }
  console.log(`  ✓ ${violationsCreated} violations`);

  // ── House Rules ──────────────────────────────────────────────────
  let rulesCreated = 0;
  const rules = [
    { title: 'Noise ordinance', description: 'Quiet hours 10 PM – 7 AM. No loud music or gatherings during quiet hours.', category: 'Noise' },
    { title: 'Trash disposal', description: 'All trash must be bagged and placed in designated dumpsters. No loose items.', category: 'Cleanliness' },
    { title: 'Pet policy', description: 'Pets must be leashed in common areas. Maximum 2 pets per unit. No aggressive breeds.', category: 'Pets' },
    { title: 'Parking regulations', description: 'Assigned parking only. No commercial vehicles. Guest parking limited to 48 hours.', category: 'Parking' },
    { title: 'Common area use', description: 'Common areas close at 11 PM. No personal items stored in hallways or stairwells.', category: 'Common Areas' },
    { title: 'Architectural changes', description: 'All exterior modifications require board approval. Includes paint, windows, doors, and landscaping.', category: 'Modifications' },
    { title: 'Smoking policy', description: 'No smoking in common areas, hallways, elevators, or within 25 feet of building entrances.', category: 'Health' },
    { title: 'Grill/BBQ policy', description: 'No charcoal grills on balconies. Electric and gas grills permitted with fire safety inspection.', category: 'Safety' },
  ];
  for (const assoc of associations.slice(0, 3)) {
    for (const rule of rules) {
      await db.from('house_rules').insert({
        id: uid(), association_id: assoc.id,
        title: rule.title, description: rule.description, category: rule.category,
        status: 'active',
      });
      rulesCreated++;
    }
  }
  console.log(`  ✓ ${rulesCreated} house rules`);

  // ── Inspections ──────────────────────────────────────────────────
  let inspectionsCreated = 0;
  const inspectionTypes = ['Move-In','Move-Out','Routine','Drive-By'];
  for (const assoc of associations) {
    for (let i = 0; i < between(2, 4); i++) {
      const inspId = uid();
      const status = pick(['scheduled','in_progress','completed','completed']);
      await db.from('inspections').insert({
        id: inspId, association_id: assoc.id,
        unit_id: pick(unitIds),
        type: pick(inspectionTypes),
        scheduled_date: futureDays(between(-5, 20)),
        inspector_name: pick(['Mike Reynolds','Sarah Chen','James Wilson','Amanda Torres']),
        status,
        notes: status === 'completed' ? `${pick(['No issues found','Minor wear noted','Needs follow-up','Passed all checks'])}` : null,
      });
      // Inspection items
      if (status === 'completed') {
        await db.from('inspection_items').insert([
          { id: uid(), inspection_id: inspId, name: 'Structural integrity', severity: pick(['info','info','minor']) },
          { id: uid(), inspection_id: inspId, name: 'Plumbing fixtures', severity: pick(['info','minor','moderate']) },
          { id: uid(), inspection_id: inspId, name: 'Electrical outlets', severity: pick(['info','info','info']) },
          { id: uid(), inspection_id: inspId, name: 'HVAC system', severity: pick(['info','minor','major']) },
          { id: uid(), inspection_id: inspId, name: 'Windows and doors', severity: pick(['info','info','minor']) },
        ]);
      }
      inspectionsCreated++;
    }
  }
  console.log(`  ✓ ${inspectionsCreated} inspections with items`);

  // ── Fixed Assets ─────────────────────────────────────────────────
  let assetsCreated = 0;
  const assetCategories = ['HVAC','Elevator','Plumbing','Electrical','Roofing','Flooring','Common Area','Safety'];
  for (const assoc of associations) {
    for (let i = 0; i < between(2, 3); i++) {
      const purchasePrice = cents(2000, 50000);
      await db.from('fixed_assets').insert({
        id: uid(), association_id: assoc.id,
        name: `${pick(['Main','Secondary','Emergency','Replacement'])} ${pick(assetCategories)} ${pick(['System','Unit','Equipment'])}`,
        category: pick(assetCategories),
        purchase_date: daysAgo(between(90, 1825)),
        purchase_price: purchasePrice,
        accumulated_depreciation: cents(purchasePrice * 0.1, purchasePrice * 0.7),
        useful_life_years: pick([10,15,20,25,30]),
        depreciation_method: pick(['straight_line','straight_line','declining_balance']),
        status: pick(['active','active','active','disposed']),
      });
      assetsCreated++;
    }
  }
  console.log(`  ✓ ${assetsCreated} fixed assets`);

  // ── Bank Transfers ───────────────────────────────────────────────
  let transfersCreated = 0;
  for (const assoc of associations) {
    for (let i = 0; i < between(1, 3); i++) {
      await db.from('bank_transfers').insert({
        id: uid(), portfolio_id: portfolioId,
        from_bank_account_id: pick(bankAccountIds),
        to_bank_account_id: pick(bankAccountIds),
        amount: cents(500, 20000),
        memo: pick(['Monthly reserve transfer','Operating transfer','Year-end sweep']),
        reference_number: `TRF-${between(1000,9999)}`,
        created_by: userId,
      });
      transfersCreated++;
    }
  }
  console.log(`  ✓ ${transfersCreated} bank transfers`);

  // ── Calendar Events ───────────────────────────────────────────────
  let eventsCreated = 0;
  const eventTypes = ['board_meeting','annual_meeting','vendor_service','inspection','social_event','water_shutoff'];
  for (const assoc of associations) {
    for (let i = 0; i < between(2, 4); i++) {
      const type = pick(eventTypes);
      const startDate = futureDays(between(3, 60));
      await db.from('calendar_events').insert({
        id: uid(), association_id: assoc.id,
        portfolio_id: portfolioId,
        title: type === 'board_meeting' ? `${assoc.name} Board Meeting` : `${type.replace(/_/g,' ')} — ${assoc.name}`,
        event_type: type,
        calendar_scope: 'daily',
        start_datetime: `${startDate}T${String(between(9,18)).padStart(2,'0')}:00:00`,
        end_datetime: `${startDate}T${String(between(11,20)).padStart(2,'0')}:00:00`,
        location: pick(['Community Room','Lobby','On-site','Virtual','Management Office']),
        operations_status: 'scheduled',
        notification_recipients: ['management_office'],
        reminder_rules: [{ minutes_before: 10080, actions: ['notify_management_office'] }],
        created_by: userId,
      });
      eventsCreated++;
    }
  }
  console.log(`  ✓ ${eventsCreated} calendar events`);

  // ── Maintenance Tasks + History ──────────────────────────────────
  let mtCreated = 0, mtHistory = 0;
  const maintenanceCats = ['Safety','Plumbing','Exterior','HVAC','Electrical','Mechanical'];
  const maintTaskNames: Record<string, string[]> = {
    Safety: ['Fire alarm test','Sprinkler inspection','Emergency light check','Exit sign inspection'],
    Plumbing: ['Water heater flush','Backflow preventer test','Sump pump check','Pipe inspection'],
    Exterior: ['Roof inspection','Window seal check','Gutter cleaning','Facade inspection'],
    HVAC: ['Filter replacement','Coil cleaning','Thermostat calibration','Duct inspection'],
    Electrical: ['Panel inspection','GFCI test','Lighting check','Generator test'],
    Mechanical: ['Elevator inspection','Boiler maintenance','Garage door service','Gate operator check'],
  };
  for (const assoc of associations) {
    for (let i = 0; i < between(2, 4); i++) {
      const cat = pick(maintenanceCats);
      const tasks = maintTaskNames[cat];
      const taskName = pick(tasks);
      const dueDate = futureDays(between(-5, 30));
      const mtId = uid();
      await db.from('maintenance_tasks').insert({
        id: mtId, association_id: assoc.id,
        task_name: taskName, category: cat,
        frequency: pick(['monthly','quarterly','semiannual','annual']),
        priority: pick(['normal','high']),
        start_date: daysAgo(between(10, 60)),
        next_due_date: dueDate,
        status: 'active',
        notes: `Scheduled ${cat.toLowerCase()} maintenance for ${assoc.name}`,
      });
      mtCreated++;

      // Random history entry
      if (Math.random() > 0.5) {
        await db.from('maintenance_task_history').insert({
          id: uid(), task_id: mtId,
          status: 'completed',
          completed_date: daysAgo(between(1, 30)),
          notes: `Previous ${taskName.toLowerCase()} completed successfully`,
        });
        mtHistory++;
      }
    }
  }
  console.log(`  ✓ ${mtCreated} maintenance tasks, ${mtHistory} history entries`);

  // ── Activity ─────────────────────────────────────────────────────
  const actions = ['violation.created','bill.approved','work_order.created','payment.received','owner.activated','vendor.added','inspection.scheduled','notice.sent','maintenance.completed','calendar.event.created'];
  let activityCreated = 0;
  for (let i = 0; i < 40; i++) {
    await db.from('activity').insert({
      id: uid(), action: pick(actions),
      agent: pick(['System','Staff','Owner Portal','Vendor Portal','Cron Job']),
      details: pick(['Automatic processing','Manual entry','Scheduled task','Portal submission']),
      created_at: new Date(Date.now() - between(1, 168) * 3600000).toISOString(),
    });
    activityCreated++;
  }
  console.log(`  ✓ ${activityCreated} activity entries`);

  console.log('\n✅ Comprehensive seed complete! Dashboard and all modules have real data.');
}

seed().catch(e => { console.error('SEED FAILED:', e); process.exit(1); });
