import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://termxngysvotnfbzbgrv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlcm14bmd5c3ZvdG5mYnpiZ3J2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTcwNDc5MiwiZXhwIjoyMDkxMjgwNzkyfQ.JDP-aAoL6MKrU_e4h0M6Ngjv-86RrQZvgElTaDClsIo"
);

const PORTFOLIO_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

// Test account_type enum values
const accountTypes = [
  "cash", "accounts_receivable", "accounts_payable", "income", "expense",
  "other_income", "other_expense", "equity", "other_current_asset",
  "fixed_asset", "other_asset", "other_current_liability", "long_term_liability",
  "bank", "credit_card", "loan", "asset", "liability"
];

// Test fund_account enum values
const fundAccounts = [
  "operating", "reserve", "special_assessment", "capital", "capital_improvement",
  "replacement_reserve", "general", "maintenance", "insurance"
];

console.log("Testing account_type enum values...");
for (const t of accountTypes) {
  const { error } = await supabase.from("gl_accounts").insert({
    number: 9998,
    name: "test_enum",
    account_type: t,
    active: true,
    portfolio_id: PORTFOLIO_ID,
  });
  if (!error) {
    console.log(`  VALID: ${t}`);
    await supabase.from("gl_accounts").delete().eq("number", 9998);
  } else if (error.message.includes("invalid input value for enum")) {
    console.log(`  INVALID: ${t}`);
  } else {
    console.log(`  ERROR (other): ${t} - ${error.message}`);
  }
}

console.log("\nTesting fund_account enum values...");
for (const f of fundAccounts) {
  const { error } = await supabase.from("gl_accounts").insert({
    number: 9997,
    name: "test_fund",
    account_type: "expense",
    fund_account: f,
    active: true,
    portfolio_id: PORTFOLIO_ID,
  });
  if (!error) {
    console.log(`  VALID: ${f}`);
    await supabase.from("gl_accounts").delete().eq("number", 9997);
  } else if (error.message.includes("invalid input value for enum")) {
    console.log(`  INVALID: ${f}`);
  } else {
    console.log(`  ERROR (other): ${f} - ${error.message}`);
  }
}
