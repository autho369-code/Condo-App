import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('Connected to DB. Seeding...');

// 1. Seed company
await conn.execute(`
  INSERT IGNORE INTO companies (name, code, isActive) 
  VALUES ('Stellar Property Group', 'SPG', 1)
`);
const [companyRows] = await conn.execute(`SELECT id FROM companies WHERE code = 'SPG' LIMIT 1`);
const companyId = companyRows[0].id;
console.log(`Company ID: ${companyId}`);

// 2. Promote user 1 to super_admin
await conn.execute(`UPDATE users SET role = 'super_admin', companyId = ? WHERE id = 1`, [companyId]);
console.log('User 1 promoted to super_admin');

// 3. Seed sample properties/associations
const properties = [
  ['Buck City Lofts', '123 Buck City Rd', 'Phoenix', 'AZ', '85001', 'HOA', companyId],
  ['Sunrise Heights HOA', '456 Sunrise Blvd', 'Scottsdale', 'AZ', '85251', 'HOA', companyId],
  ['Desert Palms Condos', '789 Desert Palm Dr', 'Tempe', 'AZ', '85281', 'CONDO', companyId],
  ['Lakewood Commons', '321 Lakewood Ave', 'Mesa', 'AZ', '85201', 'HOA', companyId],
  ['Pinnacle Ridge Association', '654 Pinnacle Way', 'Chandler', 'AZ', '85224', 'HOA', companyId],
];
for (const p of properties) {
  await conn.execute(
    `INSERT IGNORE INTO properties (name, address, city, state, zip, type, companyId, status) VALUES (?,?,?,?,?,?,?,'ACTIVE')`,
    p
  );
}
console.log(`Seeded ${properties.length} properties`);

// 4. Seed GL accounts
const glAccounts = [
  ['1150','Operating Cash','ASSET'],
  ['1151','Petty Cash','ASSET'],
  ['1160','Reserve Cash','ASSET'],
  ['1200','Accounts Receivable','ASSET'],
  ['1210','Homeowner Assessments Receivable','ASSET'],
  ['1220','Special Assessment Receivable','ASSET'],
  ['1300','Prepaid Expenses','ASSET'],
  ['1310','Prepaid Insurance','ASSET'],
  ['1400','Investments - Operating','ASSET'],
  ['1410','Investments - Reserve','ASSET'],
  ['1500','Property & Equipment','ASSET'],
  ['1510','Accumulated Depreciation','ASSET'],
  ['2000','Accounts Payable','LIABILITY'],
  ['2010','Accrued Expenses','LIABILITY'],
  ['2020','Accrued Wages','LIABILITY'],
  ['2030','Prepaid Assessments','LIABILITY'],
  ['2040','Security Deposits Held','LIABILITY'],
  ['2050','Sales Tax Payable','LIABILITY'],
  ['2100','Reserve Fund Liability','LIABILITY'],
  ['2200','Notes Payable','LIABILITY'],
  ['2210','Mortgage Payable','LIABILITY'],
  ['2300','Deferred Revenue','LIABILITY'],
  ['3000','Retained Earnings','EQUITY'],
  ['3100','Fund Balance - Operating','EQUITY'],
  ['3200','Fund Balance - Reserve','EQUITY'],
  ['3300','Current Year Net Income','EQUITY'],
  ['4000','Assessment Income','INCOME'],
  ['4010','Regular Assessments','INCOME'],
  ['4020','Special Assessments','INCOME'],
  ['4030','Late Fees','INCOME'],
  ['4040','Transfer Fees','INCOME'],
  ['4050','Fines & Violations','INCOME'],
  ['4060','Amenity Fees','INCOME'],
  ['4070','Parking Fees','INCOME'],
  ['4080','Storage Fees','INCOME'],
  ['4090','Laundry Income','INCOME'],
  ['4100','Interest Income - Operating','INCOME'],
  ['4110','Interest Income - Reserve','INCOME'],
  ['4120','Rental Income','INCOME'],
  ['4130','Miscellaneous Income','INCOME'],
  ['4200','Reserve Contributions','INCOME'],
  ['5000','Administrative Expenses','EXPENSE'],
  ['5010','Management Fees','EXPENSE'],
  ['5020','Accounting & Audit Fees','EXPENSE'],
  ['5030','Legal Fees','EXPENSE'],
  ['5040','Office Supplies','EXPENSE'],
  ['5050','Postage & Mailing','EXPENSE'],
  ['5060','Telephone & Internet','EXPENSE'],
  ['5070','Bank Charges','EXPENSE'],
  ['5080','Insurance - General Liability','EXPENSE'],
  ['5090','Insurance - Property','EXPENSE'],
  ['5100','Insurance - Directors & Officers','EXPENSE'],
  ['5110','Insurance - Workers Comp','EXPENSE'],
  ['5120','Taxes & Licenses','EXPENSE'],
  ['5130','Bad Debt Expense','EXPENSE'],
  ['5200','Maintenance & Repairs','EXPENSE'],
  ['5210','Landscaping & Grounds','EXPENSE'],
  ['5220','Janitorial & Cleaning','EXPENSE'],
  ['5230','Pool & Spa Maintenance','EXPENSE'],
  ['5240','Elevator Maintenance','EXPENSE'],
  ['5250','HVAC Maintenance','EXPENSE'],
  ['5260','Plumbing Repairs','EXPENSE'],
  ['5270','Electrical Repairs','EXPENSE'],
  ['5280','Painting & Decorating','EXPENSE'],
  ['5290','Roof Repairs','EXPENSE'],
  ['5300','Pest Control','EXPENSE'],
  ['5310','Snow Removal','EXPENSE'],
  ['5320','Trash Removal','EXPENSE'],
  ['5330','Security Services','EXPENSE'],
  ['5340','Fire Protection','EXPENSE'],
  ['5350','Gate & Access Control','EXPENSE'],
  ['5360','Signage','EXPENSE'],
  ['5370','Parking Lot Maintenance','EXPENSE'],
  ['5380','Common Area Lighting','EXPENSE'],
  ['5390','Water & Sewer - Common','EXPENSE'],
  ['5400','Gas - Common','EXPENSE'],
  ['5410','Electric - Common','EXPENSE'],
  ['5420','Cable & Internet - Common','EXPENSE'],
  ['5500','Capital Improvements','EXPENSE'],
  ['5510','Reserve Fund Expenditures','EXPENSE'],
  ['5520','Depreciation Expense','EXPENSE'],
  ['5600','Payroll Expenses','EXPENSE'],
  ['5610','Salaries & Wages','EXPENSE'],
  ['5620','Payroll Taxes','EXPENSE'],
  ['5630','Employee Benefits','EXPENSE'],
  ['5640','Contract Labor','EXPENSE'],
  ['5700','Community Events','EXPENSE'],
  ['5710','Newsletter & Communications','EXPENSE'],
  ['5720','Website & Technology','EXPENSE'],
  ['5800','Contingency Reserve','EXPENSE'],
  ['5900','Miscellaneous Expense','EXPENSE'],
  ['6000','Interest Expense','OTHER_EXPENSE'],
  ['6010','Loan Interest','OTHER_EXPENSE'],
  ['6020','Mortgage Interest','OTHER_EXPENSE'],
  ['6100','Gain on Sale of Assets','OTHER_INCOME'],
  ['6110','Loss on Sale of Assets','OTHER_EXPENSE'],
  ['9000','Suspense Account','ASSET'],
  ['9100','Due To/From Operating','LIABILITY'],
  ['9200','Due To/From Reserve','LIABILITY'],
  ['9998','Loan Principal','LIABILITY'],
  ['9999','Clearing Account','ASSET'],
];

for (const [code, name, accountType] of glAccounts) {
  await conn.execute(
    `INSERT IGNORE INTO gl_accounts (code, name, accountType, isActive) VALUES (?,?,?,1)`,
    [code, name, accountType]
  );
}
console.log(`Seeded ${glAccounts.length} GL accounts`);

// 5. Seed sample vendors
const vendors = [
  ['ABC Landscaping', 'ABC Landscaping LLC', 'vendor@abclandscaping.com', '602-555-0101', companyId],
  ['Desert Plumbing Co', 'Desert Plumbing Co', 'info@desertplumbing.com', '602-555-0202', companyId],
  ['Pinnacle Electric', 'Pinnacle Electric Inc', 'service@pinnacleelectric.com', '602-555-0303', companyId],
  ['CleanPro Janitorial', 'CleanPro Services', 'contact@cleanpro.com', '602-555-0404', companyId],
  ['Southwest Pool Service', 'SW Pool Service LLC', 'pools@swpoolservice.com', '602-555-0505', companyId],
];
for (const [contactName, companyName, email, phone, cId] of vendors) {
  await conn.execute(
    `INSERT IGNORE INTO vendors (contactName, companyName, email, phone, companyId, isActive) VALUES (?,?,?,?,?,1)`,
    [contactName, companyName, email, phone, cId]
  );
}
console.log(`Seeded ${vendors.length} vendors`);

// 6. Seed sample owners (need a property first)
const [propRows] = await conn.execute(`SELECT id FROM properties LIMIT 1`);
const propId = propRows[0]?.id || 1;
const owners = [
  ['John', 'Smith', 'john.smith@email.com', '602-555-1001', 'Unit 101'],
  ['Maria', 'Garcia', 'maria.garcia@email.com', '602-555-1002', 'Unit 102'],
  ['Robert', 'Johnson', 'robert.j@email.com', '602-555-1003', 'Unit 103'],
  ['Sarah', 'Williams', 'sarah.w@email.com', '602-555-1004', 'Unit 201'],
  ['David', 'Brown', 'david.b@email.com', '602-555-1005', 'Unit 202'],
];
for (const [firstName, lastName, email, phone, unit] of owners) {
  await conn.execute(
    `INSERT IGNORE INTO owners (firstName, lastName, email, phone, unit, propertyId, portalAccess) VALUES (?,?,?,?,?,?,0)`,
    [firstName, lastName, email, phone, unit, propId]
  );
}
console.log(`Seeded ${owners.length} owners`);

await conn.end();
console.log('Seeding complete!');
