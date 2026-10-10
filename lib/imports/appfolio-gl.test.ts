import { describe, expect, it } from 'vitest';
import {
  leadingAccountNumber, mapAppfolioAccountType, normalizeGlAccount, parseAmount,
  parseAppfolioChartOfAccounts, parseAppfolioTrialBalance, splitGlAccountCell,
} from './appfolio-gl';

const CHART = [
  'Number,Account Name,Account Type,Sub Account of,Offset Account,Available To,Options,Hidden,Fund Account',
  '"1150","Operating","Cash",,,"Property",,,"Operating"',
  '"1700","BUILDING ASSETS","Asset",,,"Property",,,',
  '"1705","Unit 15B","Asset","1700 BUILDING ASSETS","1150 Operating","Property","Include On Cash Flow",,',
  '"1830","Equipment","Asset","1800 OTHER PROPERTY ASSETS","1150 Operating","Property","Exclude From 1099, Include On Cash Flow, Management Fees",,',
  '"2100","SECURITY DEPOSITS","Liability",,,"Property",,,',
  '"3000","Owner Equity","Equity",,,"Property",,,',
  '"4101","Regular Assessment","Income",,,"Property","Include On Cash Flow, Management Fees",,',
  '"4130","Late Fees","Other Income",,"1150 Operating","Property","Late Fees, Management Fees",,',
  '"6100","Old Repairs","Expense",,,"Property",,"Yes",',
  '"5000","Mystery","Suspense",,,"Property",,,',
  '"99","Too Short","Expense",,,"Property",,,',
  '"1150","Duplicate","Cash",,,"Property",,,',
].join('\n');

describe('AppFolio Chart of Accounts', () => {
  it('maps AppFolio account types onto Portier gl_accounts types', () => {
    expect(mapAppfolioAccountType('Cash')).toBe('cash');
    expect(mapAppfolioAccountType('Asset')).toBe('asset');
    expect(mapAppfolioAccountType('Liability')).toBe('liability');
    expect(mapAppfolioAccountType('Equity')).toBe('equity');
    expect(mapAppfolioAccountType('Capital')).toBe('equity');
    expect(mapAppfolioAccountType('Income')).toBe('income');
    expect(mapAppfolioAccountType(' expense ')).toBe('expense');
    expect(mapAppfolioAccountType('Suspense')).toBeNull();
  });

  it('reads the parent number from "Sub Account of"', () => {
    expect(leadingAccountNumber('1700 BUILDING ASSETS')).toBe('1700');
    expect(leadingAccountNumber('1700: Building Assets')).toBe('1700');
    expect(leadingAccountNumber('')).toBeNull();
  });

  it('parses accounts with parents, options, fund and hidden flags', () => {
    const { accounts, errors, error } = parseAppfolioChartOfAccounts(CHART);
    expect(error).toBeUndefined();
    expect(accounts?.map((a) => a.number)).toEqual([1150, 1700, 1705, 1830, 2100, 3000, 4101, 4130, 6100]);
    const byNumber = new Map(accounts!.map((a) => [a.number, a]));
    expect(byNumber.get(1150)).toMatchObject({ account_type: 'cash', parent_number: null, include_on_cash_flow: false, fund_account: 'operating', active: true, row: '2' });
    expect(byNumber.get(1705)).toMatchObject({ account_type: 'asset', parent_number: 1700, include_on_cash_flow: true, subject_to_management_fees: false });
    expect(byNumber.get(1705)!.not_imported).toEqual(['offset account 1150 Operating']);
    expect(byNumber.get(1830)).toMatchObject({ parent_number: 1800, include_on_cash_flow: true, subject_to_management_fees: true });
    expect(byNumber.get(1830)!.not_imported).toContain('1099 exclusion');
    expect(byNumber.get(4101)).toMatchObject({ account_type: 'income', subject_to_management_fees: true });
    expect(byNumber.get(4130)).toMatchObject({ account_type: 'other_income', subject_to_management_fees: true });
    expect(byNumber.get(4130)!.not_imported).toContain('late fee account');
    expect(byNumber.get(6100)).toMatchObject({ account_type: 'expense', active: false });
    expect(errors).toHaveLength(3);
    expect(errors![0]).toMatch(/unknown account type "Suspense"/);
    expect(errors![1]).toMatch(/1000 to 9999/);
    expect(errors![2]).toMatch(/more than once/);
  });

  it('refuses a file that is not a chart of accounts', () => {
    expect(parseAppfolioChartOfAccounts('Unit Name,Sqft\n101,800').error).toMatch(/Chart of Accounts/);
  });

  it('re-validates what the browser sends', () => {
    expect(normalizeGlAccount({ row: '3', number: 1150, name: 'Operating', account_type: 'cash' }).account?.number).toBe(1150);
    expect(normalizeGlAccount({ row: '3', number: 1150, name: 'Operating', account_type: 'bogus' }).error).toMatch(/unknown account type/);
    expect(normalizeGlAccount({ row: '3', number: 1150, name: '', account_type: 'cash' }).error).toMatch(/no account name/);
    expect(normalizeGlAccount({ row: '3', number: 1150, name: 'X', account_type: 'cash', parent_number: 1150 }).error).toMatch(/own parent/);
  });
});

const TRIAL_BALANCE = [
  'Trial Balance',
  'Properties: Pine Tree Court',
  'Date Range: 01/01/2026 to 09/30/2026',
  'Accounting Basis: Accrual',
  '',
  'GL Account,Balance Forward,Debit,Credit,Ending Balance',
  '1150: Operating,"600,000.00","20,000.00","7,862.76","612,137.24"',
  '2100: SECURITY DEPOSITS,"-1,200.00",,,"-1,200.00"',
  '4101: Regular Assessment,0.00,,"610,937.24","-610,937.24"',
  '6100: Repairs,,(5.00),,',
  'Total,"598,800.00","20,000.00","618,800.00",0.00',
].join('\n');

describe('AppFolio Trial Balance', () => {
  it('parses amounts and GL account cells', () => {
    expect(parseAmount('612,137.24')).toBe(612137.24);
    expect(parseAmount('-1,200.00')).toBe(-1200);
    expect(parseAmount('(1,200.00)')).toBe(-1200);
    expect(parseAmount('$5.10')).toBe(5.1);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('n/a')).toBeNull();
    expect(splitGlAccountCell('1150: Operating')).toEqual({ number: 1150, name: 'Operating' });
    expect(splitGlAccountCell('4101 - Regular Assessment')).toEqual({ number: 4101, name: 'Regular Assessment' });
    expect(splitGlAccountCell('Total Assets')).toBeNull();
  });

  it('reads rows, the date range end and the accounting basis', () => {
    const tb = parseAppfolioTrialBalance(TRIAL_BALANCE);
    expect(tb.error).toBeUndefined();
    expect(tb.asOf).toBe('2026-09-30');
    expect(tb.basis).toBe('accrual');
    expect(tb.rows?.map((r) => r.number)).toEqual([1150, 2100, 4101, 6100]);
    expect(tb.rows?.[0]).toMatchObject({ row: '7', name: 'Operating', balance_forward: 600000, debit: 20000, credit: 7862.76, ending: 612137.24 });
    expect(tb.rows?.[1].ending).toBe(-1200);
    expect(tb.rows?.[3]).toMatchObject({ debit: -5, ending: 0 });
    expect(tb.groups).toEqual(['']);
    expect(tb.property).toBe('Pine Tree Court');
    expect(tb.total).toEqual({ balance_forward: 598800, debit: 20000, credit: 618800, ending: 0 });
    expect(tb.warnings).toEqual([expect.stringMatching(/debits \(20,000.00\) and credits \(618,800.00\) are not equal/)]);
  });

  it('reads AppFolio\'s real layout: credits negative, prior years retained earnings, balanced Total row', () => {
    // Same shape as an AppFolio export run for all properties: no title lines,
    // a blank line after the header, liabilities/equity/income negative.
    const tb = parseAppfolioTrialBalance([
      'GL Account,Balance Forward,Debit,Credit,Ending Balance',
      '',
      '1150: Operating,"1,000.00","500.00",,"1,500.00"',
      '2300: Prepaid Assessment,-200.00,100.00,,-100.00',
      '3999: Opening Balance Import Offset,-300.00,,,-300.00',
      '4101: Regular Assessment,"-1,000.00",,600.00,"-1,600.00"',
      '6213: Property Insurance,400.00,,,400.00',
      'Calculated Prior Years Retained Earnings,100.00,,,100.00',
      '',
      'Total,0.00,600.00,600.00,0.00',
    ].join('\n'));
    expect(tb.error).toBeUndefined();
    expect(tb.rows?.map((r) => r.number)).toEqual([1150, 2300, 3999, 4101, 6213]);
    expect(tb.rows?.find((r) => r.number === 4101)?.ending).toBe(-1600);
    expect(tb.priorYearsRetainedEarnings).toEqual({ '': { balance_forward: 100, debit: 0, credit: 0, ending: 100 } });
    expect(tb.total).toEqual({ balance_forward: 0, debit: 600, credit: 600, ending: 0 });
    expect(tb.property).toBeUndefined();
    expect(tb.ignored).toBeUndefined();
    expect(tb.warnings).toBeUndefined();
  });

  it('marks a property whose account or prior-years amount could not be read', () => {
    const tb = parseAppfolioTrialBalance([
      'GL Account,Balance Forward,Debit,Credit,Ending Balance',
      '-> Oak Court,,,,',
      '1150: Operating,,,,"10.00"',
      '-> Elm Court,,,,',
      '1150: Operating,,,,"abc"',
      'Calculated Prior Years Retained Earnings,,,,"n/a"',
      '-> Ash Court,,,,',
      '1150: Operating,,,,"5.00"',
      '-> Fir Court,,,,',
      '115O: Operating,,,,"5.00"',
      '-> Bay Court,,,,',
      'I150 Operating,,,,"5.00"',
      '-> Yew Court,,,,',
      '1150: Operating,,,,"5.00"',
      'Total Yew Court,,,,"5.00"',
    ].join('\n'));
    expect(tb.unreadable).toEqual(['Elm Court', 'Fir Court', 'Bay Court']);
    expect(tb.rows?.map((r) => r.group)).toEqual(['Oak Court', 'Ash Court', 'Yew Court']);
  });

  it('warns when the account lines do not add up to the Total row', () => {
    const tb = parseAppfolioTrialBalance([
      'GL Account,Balance Forward,Debit,Credit,Ending Balance',
      '1150: Operating,,,,10.00',
      'Total,,,,0.00',
    ].join('\n'));
    expect(tb.warnings?.join(' ')).toMatch(/add up to 10.00, but the Total row says 0.00/);
    expect(tb.warnings?.join(' ')).toMatch(/instead of 0.00/);
  });

  it('works without title lines and with property groups', () => {
    const tb = parseAppfolioTrialBalance([
      'GL Account,Balance Forward,Debit,Credit,Ending Balance',
      '"-> Pine Tree Court - 5460 W Higgins Ave Chicago, IL 60630",,,,',
      '1150: Operating,,,,"10.00"',
      ',,,,10.00',
      '-> Granville Courts,,,,',
      '1150: Operating,,,,"20.00"',
      'Total,,,,30.00',
    ].join('\n'));
    expect(tb.asOf).toBeUndefined();
    // Groups keep the full heading (name + address): two properties may share a name.
    const pine = 'Pine Tree Court - 5460 W Higgins Ave Chicago, IL 60630';
    expect(tb.groups).toEqual([pine, 'Granville Courts']);
    expect(tb.rows?.map((r) => [r.group, r.ending])).toEqual([[pine, 10], ['Granville Courts', 20]]);
  });

  it('keeps two same-named properties at different addresses apart', () => {
    const tb = parseAppfolioTrialBalance([
      'GL Account,Balance Forward,Debit,Credit,Ending Balance',
      '"-> Lakeview - 100 N Main St",,,,',
      '1150: Operating,,,,"10.00"',
      '"-> Lakeview - 200 S Oak Ave",,,,',
      '1150: Operating,,,,"20.00"',
      'Total,,,,30.00',
    ].join('\n'));
    expect(tb.groups).toEqual(['Lakeview - 100 N Main St', 'Lakeview - 200 S Oak Ave']);
  });

  it('refuses a file that is not a trial balance', () => {
    expect(parseAppfolioTrialBalance('Number,Account Name\n1150,Operating').error).toMatch(/Trial Balance/);
  });
});
