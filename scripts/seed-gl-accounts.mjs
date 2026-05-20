/**
 * Seed script: 370+ standard GL accounts for HOA/property management
 * Uses the actual gl_accounts table schema:
 *   number, name, account_type, active, portfolio_id, association_id,
 *   include_on_cash_flow, fund_account, subject_to_management_fees, description
 *
 * account_type values: cash, accounts_receivable, accounts_payable,
 *   other_current_asset, fixed_asset, other_asset, other_current_liability,
 *   long_term_liability, equity, income, expense, other_income, other_expense
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env");
try {
  const envContent = readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const [key, ...vals] = line.split("=");
    if (key && vals.length) process.env[key.trim()] = vals.join("=").trim().replace(/^["']|["']$/g, "");
  }
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL || "https://termxngysvotnfbzbgrv.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlcm14bmd5c3ZvdG5mYnpiZ3J2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTcwNDc5MiwiZXhwIjoyMDkxMjgwNzkyfQ.JDP-aAoL6MKrU_e4h0M6Ngjv-86RrQZvgElTaDClsIo";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Standard HOA/property management chart of accounts
// Based on AppFolio, Buildium, and GAAP standards for community associations
const GL_ACCOUNTS = [
  // ─── ASSETS (1000–1999) ───────────────────────────────────────────────────
  // Cash & Bank Accounts (1100–1199)
  { number: 1100, name: "Cash - Operating", account_type: "cash", fund_account: "operating", include_on_cash_flow: true },
  { number: 1110, name: "Cash - Operating Checking", account_type: "cash", fund_account: "operating", include_on_cash_flow: true },
  { number: 1120, name: "Cash - Operating Savings", account_type: "cash", fund_account: "operating", include_on_cash_flow: true },
  { number: 1130, name: "Cash - Petty Cash", account_type: "cash", fund_account: "operating", include_on_cash_flow: true },
  { number: 1150, name: "Cash - Reserve", account_type: "cash", fund_account: "reserve", include_on_cash_flow: true },
  { number: 1155, name: "Cash - Reserve Checking", account_type: "cash", fund_account: "reserve", include_on_cash_flow: true },
  { number: 1160, name: "Cash - Reserve Savings", account_type: "cash", fund_account: "reserve", include_on_cash_flow: true },
  { number: 1165, name: "Cash - Reserve Money Market", account_type: "cash", fund_account: "reserve", include_on_cash_flow: true },
  { number: 1170, name: "Cash - Reserve CD", account_type: "cash", fund_account: "reserve", include_on_cash_flow: true },
  { number: 1175, name: "Cash - Reserve Investments", account_type: "cash", fund_account: "reserve", include_on_cash_flow: true },
  { number: 1180, name: "Cash - Special Assessment", account_type: "cash", fund_account: "special_assessment", include_on_cash_flow: true },
  { number: 1185, name: "Cash - Capital Improvement", account_type: "cash", fund_account: "capital", include_on_cash_flow: true },
  { number: 1190, name: "Cash - Security Deposits", account_type: "cash", fund_account: "operating", include_on_cash_flow: true },
  { number: 1195, name: "Cash - Undeposited Funds", account_type: "cash", fund_account: "operating", include_on_cash_flow: true },
  // Accounts Receivable (1200–1299)
  { number: 1200, name: "Accounts Receivable", account_type: "accounts_receivable", include_on_cash_flow: true },
  { number: 1210, name: "Assessments Receivable", account_type: "accounts_receivable", include_on_cash_flow: true },
  { number: 1215, name: "Special Assessment Receivable", account_type: "accounts_receivable", include_on_cash_flow: true },
  { number: 1220, name: "Late Fees Receivable", account_type: "accounts_receivable", include_on_cash_flow: true },
  { number: 1225, name: "NSF Fees Receivable", account_type: "accounts_receivable", include_on_cash_flow: true },
  { number: 1230, name: "Fines & Violations Receivable", account_type: "accounts_receivable", include_on_cash_flow: true },
  { number: 1235, name: "Rental Income Receivable", account_type: "accounts_receivable", include_on_cash_flow: true },
  { number: 1240, name: "Interest Receivable", account_type: "accounts_receivable", include_on_cash_flow: true },
  { number: 1250, name: "Allowance for Doubtful Accounts", account_type: "accounts_receivable", include_on_cash_flow: false, description: "Contra account" },
  { number: 1260, name: "Tenant Receivable", account_type: "accounts_receivable", include_on_cash_flow: true },
  { number: 1270, name: "Insurance Claim Receivable", account_type: "accounts_receivable", include_on_cash_flow: true },
  // Prepaid & Other Current Assets (1300–1399)
  { number: 1300, name: "Prepaid Expenses", account_type: "other_current_asset", include_on_cash_flow: false },
  { number: 1310, name: "Prepaid Insurance", account_type: "other_current_asset", include_on_cash_flow: false },
  { number: 1320, name: "Prepaid Maintenance Contracts", account_type: "other_current_asset", include_on_cash_flow: false },
  { number: 1330, name: "Prepaid Management Fees", account_type: "other_current_asset", include_on_cash_flow: false },
  { number: 1340, name: "Prepaid Utilities", account_type: "other_current_asset", include_on_cash_flow: false },
  { number: 1350, name: "Prepaid Taxes", account_type: "other_current_asset", include_on_cash_flow: false },
  { number: 1360, name: "Deposits - Utility", account_type: "other_current_asset", include_on_cash_flow: false },
  { number: 1370, name: "Deposits - Other", account_type: "other_current_asset", include_on_cash_flow: false },
  { number: 1380, name: "Inventory - Supplies", account_type: "other_current_asset", include_on_cash_flow: false },
  { number: 1390, name: "Other Current Assets", account_type: "other_current_asset", include_on_cash_flow: false },
  // Fixed Assets (1400–1599)
  { number: 1400, name: "Fixed Assets", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1410, name: "Land", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1420, name: "Buildings & Structures", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1425, name: "Accumulated Depreciation - Buildings", account_type: "fixed_asset", include_on_cash_flow: false, description: "Contra account" },
  { number: 1430, name: "Common Area Improvements", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1435, name: "Accumulated Depreciation - Improvements", account_type: "fixed_asset", include_on_cash_flow: false, description: "Contra account" },
  { number: 1440, name: "Pool & Recreation Equipment", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1445, name: "Accumulated Depreciation - Pool/Rec", account_type: "fixed_asset", include_on_cash_flow: false, description: "Contra account" },
  { number: 1450, name: "Landscaping & Irrigation", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1455, name: "Accumulated Depreciation - Landscaping", account_type: "fixed_asset", include_on_cash_flow: false, description: "Contra account" },
  { number: 1460, name: "Parking Lot & Driveways", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1465, name: "Accumulated Depreciation - Parking", account_type: "fixed_asset", include_on_cash_flow: false, description: "Contra account" },
  { number: 1470, name: "Roofing", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1475, name: "Accumulated Depreciation - Roofing", account_type: "fixed_asset", include_on_cash_flow: false, description: "Contra account" },
  { number: 1480, name: "HVAC Systems", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1485, name: "Accumulated Depreciation - HVAC", account_type: "fixed_asset", include_on_cash_flow: false, description: "Contra account" },
  { number: 1490, name: "Elevator Systems", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1495, name: "Accumulated Depreciation - Elevator", account_type: "fixed_asset", include_on_cash_flow: false, description: "Contra account" },
  { number: 1500, name: "Furniture & Equipment", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1505, name: "Accumulated Depreciation - Furniture", account_type: "fixed_asset", include_on_cash_flow: false, description: "Contra account" },
  { number: 1510, name: "Computer Equipment", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1515, name: "Accumulated Depreciation - Computers", account_type: "fixed_asset", include_on_cash_flow: false, description: "Contra account" },
  { number: 1520, name: "Security Systems", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1525, name: "Accumulated Depreciation - Security", account_type: "fixed_asset", include_on_cash_flow: false, description: "Contra account" },
  { number: 1530, name: "Signage", account_type: "fixed_asset", include_on_cash_flow: false },
  { number: 1540, name: "Construction in Progress", account_type: "fixed_asset", include_on_cash_flow: false },
  // Other Assets (1600–1699)
  { number: 1600, name: "Other Assets", account_type: "other_asset", include_on_cash_flow: false },
  { number: 1610, name: "Organizational Costs", account_type: "other_asset", include_on_cash_flow: false },
  { number: 1620, name: "Legal & Formation Costs", account_type: "other_asset", include_on_cash_flow: false },
  { number: 1630, name: "Long-Term Deposits", account_type: "other_asset", include_on_cash_flow: false },
  { number: 1640, name: "Notes Receivable - Long Term", account_type: "other_asset", include_on_cash_flow: false },
  { number: 1650, name: "Investments - Long Term", account_type: "other_asset", include_on_cash_flow: false },
  // ─── LIABILITIES (2000–2999) ──────────────────────────────────────────────
  // Accounts Payable (2000–2099)
  { number: 2000, name: "Accounts Payable", account_type: "accounts_payable", include_on_cash_flow: true },
  { number: 2010, name: "Accounts Payable - Vendors", account_type: "accounts_payable", include_on_cash_flow: true },
  { number: 2020, name: "Accounts Payable - Contractors", account_type: "accounts_payable", include_on_cash_flow: true },
  { number: 2030, name: "Accounts Payable - Utilities", account_type: "accounts_payable", include_on_cash_flow: true },
  { number: 2040, name: "Accounts Payable - Management Fees", account_type: "accounts_payable", include_on_cash_flow: true },
  // Accrued Liabilities (2100–2199)
  { number: 2100, name: "Accrued Liabilities", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2110, name: "Accrued Wages & Salaries", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2120, name: "Accrued Payroll Taxes", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2130, name: "Accrued Benefits", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2140, name: "Accrued Interest", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2150, name: "Accrued Insurance", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2160, name: "Accrued Taxes", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2170, name: "Accrued Maintenance", account_type: "other_current_liability", include_on_cash_flow: false },
  // Deferred Revenue & Deposits (2200–2299)
  { number: 2200, name: "Deferred Revenue", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2210, name: "Prepaid Assessments", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2220, name: "Prepaid Dues", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2230, name: "Security Deposits Held", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2240, name: "Key/Fob Deposits Held", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2250, name: "Pet Deposits Held", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2260, name: "Move-In Deposits Held", account_type: "other_current_liability", include_on_cash_flow: false },
  // Other Current Liabilities (2300–2399)
  { number: 2300, name: "Other Current Liabilities", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2310, name: "Sales Tax Payable", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2320, name: "Income Tax Payable", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2330, name: "Due to Management Company", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2340, name: "Due to Other Associations", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2350, name: "Unearned Income", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2360, name: "Tenant Overpayments", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2370, name: "Retainage Payable", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2380, name: "Workers Comp Payable", account_type: "other_current_liability", include_on_cash_flow: false },
  { number: 2390, name: "Credit Card Payable", account_type: "other_current_liability", include_on_cash_flow: false },
  // Long-Term Liabilities (2400–2499)
  { number: 2400, name: "Long-Term Liabilities", account_type: "long_term_liability", include_on_cash_flow: false },
  { number: 2410, name: "Mortgage Payable", account_type: "long_term_liability", include_on_cash_flow: false },
  { number: 2420, name: "Notes Payable - Long Term", account_type: "long_term_liability", include_on_cash_flow: false },
  { number: 2430, name: "Line of Credit", account_type: "long_term_liability", include_on_cash_flow: false },
  { number: 2440, name: "Equipment Loan Payable", account_type: "long_term_liability", include_on_cash_flow: false },
  { number: 2450, name: "Deferred Maintenance Liability", account_type: "long_term_liability", include_on_cash_flow: false },
  // ─── EQUITY (3000–3999) ───────────────────────────────────────────────────
  { number: 3000, name: "Members' Equity", account_type: "equity", include_on_cash_flow: false },
  { number: 3100, name: "Operating Fund Balance", account_type: "equity", fund_account: "operating", include_on_cash_flow: false },
  { number: 3200, name: "Reserve Fund Balance", account_type: "equity", fund_account: "reserve", include_on_cash_flow: false },
  { number: 3300, name: "Special Assessment Fund Balance", account_type: "equity", fund_account: "special_assessment", include_on_cash_flow: false },
  { number: 3400, name: "Capital Improvement Fund Balance", account_type: "equity", fund_account: "capital", include_on_cash_flow: false },
  { number: 3500, name: "Retained Earnings", account_type: "equity", include_on_cash_flow: false },
  { number: 3600, name: "Current Year Net Income", account_type: "equity", include_on_cash_flow: false },
  // ─── INCOME (4000–4999) ───────────────────────────────────────────────────
  // Assessment Income (4000–4099)
  { number: 4000, name: "Assessment Income", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4010, name: "Regular Assessments", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4020, name: "Monthly Dues", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4030, name: "Quarterly Dues", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4040, name: "Annual Dues", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4050, name: "Special Assessments", account_type: "income", fund_account: "special_assessment", include_on_cash_flow: true },
  { number: 4060, name: "Capital Assessments", account_type: "income", fund_account: "capital", include_on_cash_flow: true },
  { number: 4070, name: "Reserve Contributions", account_type: "income", fund_account: "reserve", include_on_cash_flow: true },
  // Fee Income (4100–4199)
  { number: 4100, name: "Fee Income", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4110, name: "Late Fees", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4120, name: "NSF / Returned Check Fees", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4130, name: "Violation Fines", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4140, name: "Move-In / Move-Out Fees", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4150, name: "Key / Fob Fees", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4160, name: "Parking Fees", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4170, name: "Storage Fees", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4180, name: "Pet Fees", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4190, name: "Amenity Fees", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  // Rental & Other Income (4200–4299)
  { number: 4200, name: "Rental Income", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4210, name: "Common Area Rental", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4220, name: "Clubhouse Rental", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4230, name: "Pool Rental", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4240, name: "Parking Space Rental", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4250, name: "Laundry Income", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4260, name: "Vending Machine Income", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4270, name: "Cell Tower / Antenna Lease", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4280, name: "Cable / Internet Access Fees", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  // Interest & Investment Income (4300–4399)
  { number: 4300, name: "Interest Income", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4310, name: "Interest Income - Operating", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4320, name: "Interest Income - Reserve", account_type: "income", fund_account: "reserve", include_on_cash_flow: true },
  { number: 4330, name: "Dividend Income", account_type: "income", fund_account: "reserve", include_on_cash_flow: true },
  { number: 4340, name: "Investment Gains", account_type: "income", fund_account: "reserve", include_on_cash_flow: true },
  // Other Income (4400–4499)
  { number: 4400, name: "Other Income", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4410, name: "Insurance Proceeds", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4420, name: "Grant Income", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4430, name: "Donation Income", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4440, name: "Miscellaneous Income", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4450, name: "Gain on Sale of Assets", account_type: "other_income", include_on_cash_flow: true },
  { number: 4460, name: "Bad Debt Recovery", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  { number: 4470, name: "Rebates & Refunds", account_type: "income", fund_account: "operating", include_on_cash_flow: true },
  // ─── EXPENSES (5000–8999) ─────────────────────────────────────────────────
  // Management & Administrative (5000–5099)
  { number: 5000, name: "Management Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true, subject_to_management_fees: false },
  { number: 5010, name: "Property Management Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true, subject_to_management_fees: false },
  { number: 5020, name: "Portfolio Management Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true, subject_to_management_fees: false },
  { number: 5030, name: "Accounting Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true, subject_to_management_fees: false },
  { number: 5040, name: "Audit & Tax Preparation Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true, subject_to_management_fees: false },
  { number: 5050, name: "Legal Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true, subject_to_management_fees: false },
  { number: 5060, name: "Consulting Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5070, name: "Reserve Study Fees", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 5080, name: "Engineering & Inspection Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5090, name: "Collection Agency Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  // Payroll & Personnel (5100–5199)
  { number: 5100, name: "Payroll Expenses", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5110, name: "Salaries & Wages", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5120, name: "Payroll Taxes", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5130, name: "Employee Benefits", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5140, name: "Health Insurance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5150, name: "Workers Compensation Insurance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5160, name: "Retirement Contributions", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5170, name: "Uniforms & Safety Equipment", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5180, name: "Staff Training & Education", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5190, name: "Contract Labor", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  // Insurance (5200–5299)
  { number: 5200, name: "Insurance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5210, name: "Property Insurance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5220, name: "General Liability Insurance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5230, name: "Directors & Officers Insurance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5240, name: "Fidelity / Crime Insurance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5250, name: "Umbrella Insurance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5260, name: "Flood Insurance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5270, name: "Earthquake Insurance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5280, name: "Auto Insurance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  // Utilities (5300–5399)
  { number: 5300, name: "Utilities", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5310, name: "Electricity", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5320, name: "Gas & Heating", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5330, name: "Water & Sewer", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5340, name: "Trash & Recycling", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5350, name: "Telephone & Internet", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5360, name: "Cable TV Services", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5370, name: "Stormwater / Drainage Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  // Maintenance & Repairs (5400–5599)
  { number: 5400, name: "Maintenance & Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5410, name: "General Maintenance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5420, name: "Building Maintenance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5430, name: "Plumbing Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5440, name: "Electrical Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5450, name: "HVAC Maintenance & Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5460, name: "Elevator Maintenance & Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5470, name: "Roof Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5480, name: "Painting & Decorating", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5490, name: "Flooring & Carpet Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5500, name: "Door & Window Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5510, name: "Appliance Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5520, name: "Lighting Repairs & Replacement", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5530, name: "Concrete & Masonry Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5540, name: "Fence & Gate Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5550, name: "Parking Lot Maintenance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5560, name: "Sidewalk & Walkway Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5570, name: "Pest Control", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5580, name: "Janitorial & Cleaning Services", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5590, name: "Maintenance Supplies", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  // Landscaping & Grounds (5600–5699)
  { number: 5600, name: "Landscaping & Grounds", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5610, name: "Lawn Care & Mowing", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5620, name: "Tree Trimming & Removal", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5630, name: "Irrigation System Maintenance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5640, name: "Fertilization & Weed Control", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5650, name: "Seasonal Plantings & Flowers", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5660, name: "Snow Removal & Ice Control", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5670, name: "Mulch & Soil Amendments", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  // Pool & Recreation (5700–5799)
  { number: 5700, name: "Pool & Recreation", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5710, name: "Pool Maintenance & Chemicals", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5720, name: "Pool Service Contract", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5730, name: "Pool Repairs", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5740, name: "Fitness Center Equipment", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5750, name: "Clubhouse Maintenance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5760, name: "Playground Equipment Maintenance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5770, name: "Tennis / Sports Court Maintenance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  // Security & Safety (5800–5899)
  { number: 5800, name: "Security & Safety", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5810, name: "Security Guard Services", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5820, name: "Security System Monitoring", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5830, name: "Security System Maintenance", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5840, name: "Access Control Systems", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5850, name: "Fire Safety & Sprinkler Systems", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5860, name: "Emergency Lighting", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  // Administrative & Office (5900–5999)
  { number: 5900, name: "Administrative Expenses", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5910, name: "Office Supplies", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5920, name: "Postage & Mailing", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5930, name: "Printing & Reproduction", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5940, name: "Software & Technology", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5950, name: "Website & Online Services", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5960, name: "Bank Service Charges", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5970, name: "Credit Card Processing Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5980, name: "Dues & Subscriptions", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 5990, name: "Miscellaneous Administrative", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  // Taxes & Licenses (6000–6099)
  { number: 6000, name: "Taxes & Licenses", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 6010, name: "Property Taxes", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 6020, name: "Income Taxes", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 6030, name: "Business License Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 6040, name: "State Registration Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 6050, name: "Permits & Inspection Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  // Communications & Community (6100–6199)
  { number: 6100, name: "Communications", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 6110, name: "Newsletter & Publications", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 6120, name: "Community Events", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 6130, name: "Meeting Expenses", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 6140, name: "Election Expenses", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 6150, name: "Signage & Notices", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  { number: 6160, name: "Community Portal / App", account_type: "expense", fund_account: "operating", include_on_cash_flow: true },
  // Depreciation & Amortization (6200–6299)
  { number: 6200, name: "Depreciation Expense", account_type: "expense", fund_account: "operating", include_on_cash_flow: false },
  { number: 6210, name: "Depreciation - Buildings", account_type: "expense", fund_account: "operating", include_on_cash_flow: false },
  { number: 6220, name: "Depreciation - Equipment", account_type: "expense", fund_account: "operating", include_on_cash_flow: false },
  { number: 6230, name: "Depreciation - Improvements", account_type: "expense", fund_account: "operating", include_on_cash_flow: false },
  { number: 6240, name: "Amortization Expense", account_type: "expense", fund_account: "operating", include_on_cash_flow: false },
  // Bad Debt & Write-offs (6300–6399)
  { number: 6300, name: "Bad Debt Expense", account_type: "expense", fund_account: "operating", include_on_cash_flow: false },
  { number: 6310, name: "Write-off - Assessments", account_type: "expense", fund_account: "operating", include_on_cash_flow: false },
  { number: 6320, name: "Write-off - Late Fees", account_type: "expense", fund_account: "operating", include_on_cash_flow: false },
  // Reserve Expenditures (7000–7999)
  { number: 7000, name: "Reserve Expenditures", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7010, name: "Reserve - Roof Replacement", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7020, name: "Reserve - Parking Lot Replacement", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7030, name: "Reserve - Pool Resurfacing", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7040, name: "Reserve - Painting", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7050, name: "Reserve - HVAC Replacement", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7060, name: "Reserve - Elevator Modernization", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7070, name: "Reserve - Landscaping Replacement", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7080, name: "Reserve - Fence Replacement", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7090, name: "Reserve - Lighting Replacement", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7100, name: "Reserve - Security System Replacement", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7110, name: "Reserve - Clubhouse Renovation", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7120, name: "Reserve - Plumbing Replacement", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7130, name: "Reserve - Electrical Upgrade", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7140, name: "Reserve - Siding / Exterior", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7150, name: "Reserve - Windows & Doors", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7160, name: "Reserve - Playground Replacement", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7170, name: "Reserve - Fitness Equipment", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7180, name: "Reserve - Irrigation System", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  { number: 7190, name: "Reserve - Miscellaneous", account_type: "expense", fund_account: "reserve", include_on_cash_flow: true },
  // Capital Improvements (8000–8099)
  { number: 8000, name: "Capital Improvements", account_type: "expense", fund_account: "capital", include_on_cash_flow: true },
  { number: 8010, name: "Capital - Building Improvements", account_type: "expense", fund_account: "capital", include_on_cash_flow: true },
  { number: 8020, name: "Capital - Common Area Improvements", account_type: "expense", fund_account: "capital", include_on_cash_flow: true },
  { number: 8030, name: "Capital - Technology Upgrades", account_type: "expense", fund_account: "capital", include_on_cash_flow: true },
  { number: 8040, name: "Capital - New Equipment", account_type: "expense", fund_account: "capital", include_on_cash_flow: true },
  // Other Expenses (8100–8199)
  { number: 8100, name: "Other Expenses", account_type: "other_expense", include_on_cash_flow: true },
  { number: 8110, name: "Interest Expense", account_type: "other_expense", include_on_cash_flow: true },
  { number: 8120, name: "Loan Origination Fees", account_type: "other_expense", include_on_cash_flow: true },
  { number: 8130, name: "Loss on Sale of Assets", account_type: "other_expense", include_on_cash_flow: true },
  { number: 8140, name: "Penalties & Fines", account_type: "other_expense", include_on_cash_flow: true },
  { number: 8150, name: "Extraordinary Expenses", account_type: "other_expense", include_on_cash_flow: true },
];

async function seedGlAccounts() {
  console.log(`Seeding ${GL_ACCOUNTS.length} GL accounts...`);

  // Get existing account numbers to avoid duplicates
  const { data: existing } = await supabase.from("gl_accounts").select("number");
  const existingNumbers = new Set((existing ?? []).map((a) => a.number));
  console.log(`Found ${existingNumbers.size} existing accounts`);

  // Map invalid enum values to valid ones
  const accountTypeMap = {
    other_current_asset: "asset",
    other_asset: "asset",
    other_current_liability: "liability",
    long_term_liability: "liability",
  };
  const fundAccountMap = {
    capital: "special_assessment",
    capital_improvement: "special_assessment",
  };

  const PORTFOLIO_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  const toInsert = GL_ACCOUNTS.filter((a) => !existingNumbers.has(a.number)).map((a) => ({
    number: a.number,
    name: a.name,
    account_type: accountTypeMap[a.account_type] ?? a.account_type,
    active: true,
    include_on_cash_flow: a.include_on_cash_flow ?? true,
    fund_account: a.fund_account ? (fundAccountMap[a.fund_account] ?? a.fund_account) : null,
    subject_to_management_fees: a.subject_to_management_fees ?? false,
    description: a.description ?? null,
    portfolio_id: PORTFOLIO_ID,
  }));

  console.log(`Inserting ${toInsert.length} new accounts...`);

  // Insert in batches of 50
  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const { error } = await supabase.from("gl_accounts").insert(batch);
    if (error) {
      console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${inserted}/${toInsert.length}`);
    }
  }

  const { count } = await supabase.from("gl_accounts").select("*", { count: "exact", head: true });
  console.log(`\n✅ Done! Total GL accounts in database: ${count}`);
}

seedGlAccounts().catch(console.error);
