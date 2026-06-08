// GL Auto-Match Engine for Bank Transactions
// Matches imported bank transactions to GL accounts based on:
// 1. Exact merchant/vendor name match against existing vendors
// 2. Category-based rules (Plaid category → GL account range)
// 3. Historical matching patterns (same name → same GL as before)

import type { SupabaseClient } from '@supabase/supabase-js';

export interface MatchResult {
  gl_account_id: string | null;
  confidence: number;
  method: string;
}

// Category-to-GL-account-range mapping based on standard accounting
// Plaid categories mapped to Portier369 GL account number ranges
const CATEGORY_GL_RULES: Record<string, { numberMin: number; numberMax: number; label: string }> = {
  // Operating expenses
  'RENT_AND_UTILITIES': { numberMin: 6000, numberMax: 6999, label: 'Rent & Utilities' },
  'UTILITIES': { numberMin: 6400, numberMax: 6499, label: 'Utilities' },
  'INSURANCE': { numberMin: 6500, numberMax: 6599, label: 'Insurance' },
  'TAX': { numberMin: 6700, numberMax: 6799, label: 'Taxes' },

  // Maintenance and services
  'HOME_IMPROVEMENT': { numberMin: 6000, numberMax: 6299, label: 'Repairs & Maintenance' },
  'GENERAL_SERVICES': { numberMin: 6000, numberMax: 6299, label: 'General Services' },
  'PERSONAL_SERVICES': { numberMin: 6000, numberMax: 6299, label: 'Services' },

  // Fees and financial
  'BANK_FEES': { numberMin: 6900, numberMax: 6999, label: 'Bank Service Charges' },
  'INTEREST': { numberMin: 4800, numberMax: 4899, label: 'Interest Income' },
  'LOAN_PAYMENTS': { numberMin: 2600, numberMax: 2699, label: 'Notes Payable' },

  // Income
  'INCOME': { numberMin: 4100, numberMax: 4199, label: 'Assessment Income' },
  'TRANSFER_IN': { numberMin: 1100, numberMax: 1199, label: 'Cash - Operating' },
  'TRANSFER_OUT': { numberMin: 6100, numberMax: 6199, label: 'Transfers Out' },

  // Default operating expense
  'GENERAL_MERCHANDISE': { numberMin: 6000, numberMax: 6299, label: 'Operating Expenses' },
  'FOOD_AND_DRINK': { numberMin: 6000, numberMax: 6299, label: 'Operating Expenses' },
  'TRAVEL': { numberMin: 6000, numberMax: 6299, label: 'Travel' },
  'TRANSPORTATION': { numberMin: 6000, numberMax: 6299, label: 'Transportation' },
  'MEDICAL': { numberMin: 6000, numberMax: 6299, label: 'Medical' },
  'ENTERTAINMENT': { numberMin: 6000, numberMax: 6299, label: 'Entertainment' },
  'GOVERNMENT_AND_NON_PROFIT': { numberMin: 6700, numberMax: 6799, label: 'Government Fees' },
};

const DEFAULT_RULE = { numberMin: 6000, numberMax: 6299, label: 'Operating Expenses' };

export async function autoMatchTransaction(
  supabase: SupabaseClient,
  portfolioId: string,
  transactionName: string,
  merchantName: string | null,
  plaidCategory: string,
  amount: number
): Promise<MatchResult> {
  const searchName = (merchantName || transactionName).trim();

  // Step 1: Try exact vendor name match (highest confidence)
  if (searchName.length > 2) {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id, name, gl_account_id')
      .ilike('name', searchName)
      .eq('portfolio_id', portfolioId)
      .maybeSingle();

    if (vendor?.gl_account_id) {
      return { gl_account_id: vendor.gl_account_id, confidence: 0.95, method: 'auto' };
    }
  }

  // Step 2: Try historical match (same transaction name matched before)
  const { data: historical } = await supabase
    .from('bank_transactions')
    .select('gl_account_id')
    .eq('portfolio_id', portfolioId)
    .eq('name', transactionName)
    .not('gl_account_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (historical && historical.length > 0 && historical[0].gl_account_id) {
    return { gl_account_id: historical[0].gl_account_id, confidence: 0.85, method: 'auto' };
  }

  // Step 3: Fuzzy vendor name match
  if (searchName.length > 3) {
    const { data: fuzzyVendors } = await supabase
      .from('vendors')
      .select('id, name, gl_account_id')
      .eq('portfolio_id', portfolioId)
      .ilike('name', `%${searchName.substring(0, Math.min(searchName.length, 8))}%`)
      .limit(1);

    if (fuzzyVendors && fuzzyVendors.length > 0 && fuzzyVendors[0].gl_account_id) {
      return { gl_account_id: fuzzyVendors[0].gl_account_id, confidence: 0.7, method: 'auto' };
    }
  }

  // Step 4: Category-based GL account match
  const rule = CATEGORY_GL_RULES[plaidCategory] || DEFAULT_RULE;

  const { data: glAccount } = await supabase
    .from('gl_accounts')
    .select('id, number')
    .gte('number', rule.numberMin)
    .lte('number', rule.numberMax)
    .order('number')
    .limit(1);

  if (glAccount && glAccount.length > 0) {
    return { gl_account_id: glAccount[0].id, confidence: 0.4, method: 'auto' };
  }

  return { gl_account_id: null, confidence: 0, method: 'auto' };
}

// Get a human-readable match explanation for display
export function getMatchExplanation(result: MatchResult): string {
  if (!result.gl_account_id) {
    return 'No matching GL account found — needs manual review';
  }

  if (result.confidence >= 0.9) {
    return 'Matched to vendor\'s default GL account';
  } else if (result.confidence >= 0.8) {
    return 'Matched based on previous transactions';
  } else if (result.confidence >= 0.6) {
    return 'Matched based on similar vendor name';
  } else if (result.confidence >= 0.3) {
    return 'Matched based on transaction category';
  }

  return 'Matched — needs review';
}
