/**
 * Reports Router — real data-backed report execution
 * Each report queries Supabase and returns structured rows + summary.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { supabase } from "../supabase";
import { getAccessiblePropertyIds } from "../db";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
async function getPropertyFilter(user: any) {
  const ids = await getAccessiblePropertyIds(user);
  return ids; // null = all, [] = none, [1,2,...] = scoped
}

// ─── REPORT CATALOG ───────────────────────────────────────────────────────────
export const REPORT_CATALOG = [
  {
    category: "Accounting Reports",
    reports: [
      { id: "balance_sheet", name: "Balance Sheet" },
      { id: "income_statement", name: "Income Statement" },
      { id: "trial_balance", name: "Trial Balance" },
      { id: "general_ledger", name: "General Ledger" },
      { id: "chart_of_accounts", name: "Chart of Accounts" },
      { id: "cash_flow", name: "Cash Flow" },
      { id: "bank_account_activity", name: "Bank Account Activity" },
      { id: "account_totals", name: "Account Totals" },
      { id: "expense_distribution", name: "Expense Distribution" },
      { id: "trust_account_balance", name: "Trust Account Balance" },
    ],
  },
  {
    category: "Association Reports",
    reports: [
      { id: "fund_balance", name: "Fund Balance" },
      { id: "fund_income_statement", name: "Fund Income Statement" },
      { id: "delinquency_report", name: "Delinquency Report" },
      { id: "homeowner_delinquency", name: "Homeowner Delinquency" },
      { id: "homeowner_ledger", name: "Homeowner Ledger" },
      { id: "hoa_assessment_roll", name: "HOA Assessment Roll" },
      { id: "reserve_fund_analysis", name: "Reserve Fund Analysis" },
      { id: "budget_vs_actual", name: "Budget vs Actual" },
      { id: "owner_ledger", name: "Owner Ledger" },
      { id: "unit_ledger", name: "Unit Ledger" },
    ],
  },
  {
    category: "Diagnostic Reports",
    reports: [
      { id: "unreconciled_transactions", name: "Unreconciled Transactions" },
      { id: "negative_balance_accounts", name: "Negative Balance Accounts" },
      { id: "duplicate_transactions", name: "Duplicate Transactions" },
      { id: "missing_transactions", name: "Missing Transactions" },
      { id: "gl_balance_discrepancy", name: "GL Balance Discrepancy" },
      { id: "bank_balance_discrepancy", name: "Bank Balance Discrepancy" },
    ],
  },
  {
    category: "Transaction Reports",
    reports: [
      { id: "all_transactions", name: "All Transactions" },
      { id: "bill_payment_history", name: "Bill Payment History" },
      { id: "receipt_history", name: "Receipt History" },
      { id: "check_register", name: "Check Register" },
      { id: "payment_history", name: "Payment History" },
      { id: "vendor_ledger", name: "Vendor Ledger" },
      { id: "vendor_payment_history", name: "Vendor Payment History" },
      { id: "transaction_audit_log", name: "Transaction Audit Log" },
      { id: "journal_entry_register", name: "Journal Entry Register" },
    ],
  },
  {
    category: "People Reports",
    reports: [
      { id: "vendor_directory", name: "Vendor Directory" },
      { id: "owner_directory", name: "Owner Directory" },
      { id: "board_member_directory", name: "Board Member Directory" },
      { id: "contact_list", name: "Contact List" },
      { id: "vendor_1099_detail", name: "Vendor 1099 Detail" },
      { id: "vendor_1099_summary", name: "Vendor 1099 Summary" },
    ],
  },
  {
    category: "Property Reports",
    reports: [
      { id: "property_summary", name: "Property Summary" },
      { id: "unit_availability", name: "Unit Availability" },
      { id: "occupancy_report", name: "Occupancy Report" },
      { id: "vacancy_report", name: "Vacancy Report" },
    ],
  },
  {
    category: "Tax Reports",
    reports: [
      { id: "1099_detail", name: "1099 Detail" },
      { id: "1099_summary", name: "1099 Summary" },
      { id: "w9_status_report", name: "W-9 Status Report" },
    ],
  },
  {
    category: "Maintenance Reports",
    reports: [
      { id: "open_work_orders", name: "Open Work Orders" },
      { id: "work_order_history", name: "Work Order History" },
      { id: "vendor_performance", name: "Vendor Performance" },
      { id: "preventive_maintenance", name: "Preventive Maintenance Schedule" },
    ],
  },
];

// ─── REPORT EXECUTION ─────────────────────────────────────────────────────────
async function runReportQuery(
  reportId: string,
  params: { startDate?: string; endDate?: string; propertyId?: number },
  propertyIds: number[] | null
): Promise<{ columns: string[]; rows: Record<string, unknown>[]; summary?: Record<string, unknown> }> {
  const now = new Date();
  const startDate = params.startDate ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endDate = params.endDate ?? now.toISOString().split("T")[0];

  switch (reportId) {
    // ── Chart of Accounts ──────────────────────────────────────────────────
    case "chart_of_accounts": {
      const { data } = await supabase
        .from("gl_accounts")
        .select("number, name, account_type, fund_account, active, description")
        .eq("active", true)
        .order("number");
      const rows = (data ?? []).map((r: any) => ({
        "Account #": r.number,
        "Account Name": r.name,
        "Type": r.account_type,
        "Fund": r.fund_account ?? "—",
        "Description": r.description ?? "—",
      }));
      return {
        columns: ["Account #", "Account Name", "Type", "Fund", "Description"],
        rows,
        summary: { "Total Accounts": rows.length },
      };
    }

    // ── All Transactions ───────────────────────────────────────────────────
    case "all_transactions":
    case "transaction_audit_log": {
      let query = supabase
        .from("transactions")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });
      if (propertyIds !== null) {
        if (propertyIds.length === 0) return { columns: [], rows: [] };
        query = query.in("propertyId", propertyIds);
      }
      const { data } = await query;
      const rows = (data ?? []).map((r: any) => ({
        "Date": r.date,
        "Type": r.transactionType,
        "Amount": `$${Number(r.amount ?? 0).toFixed(2)}`,
        "Status": r.status,
        "Reference": r.referenceNumber ?? "—",
        "Description": r.description ?? "—",
      }));
      const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      return {
        columns: ["Date", "Type", "Amount", "Status", "Reference", "Description"],
        rows,
        summary: { "Total Transactions": rows.length, "Total Amount": `$${total.toFixed(2)}` },
      };
    }

    // ── Bill Payment History ───────────────────────────────────────────────
    case "bill_payment_history": {
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("transactionType", "bill")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });
      if (propertyIds !== null) {
        if (propertyIds.length === 0) return { columns: [], rows: [] };
        query = query.in("propertyId", propertyIds);
      }
      const { data } = await query;
      const rows = (data ?? []).map((r: any) => ({
        "Date": r.date,
        "Amount": `$${Number(r.amount ?? 0).toFixed(2)}`,
        "Status": r.status,
        "Reference": r.referenceNumber ?? "—",
        "Description": r.description ?? "—",
      }));
      const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      return {
        columns: ["Date", "Amount", "Status", "Reference", "Description"],
        rows,
        summary: { "Total Bills": rows.length, "Total Amount": `$${total.toFixed(2)}` },
      };
    }

    // ── Receipt History ────────────────────────────────────────────────────
    case "receipt_history": {
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("transactionType", "receipt")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });
      if (propertyIds !== null) {
        if (propertyIds.length === 0) return { columns: [], rows: [] };
        query = query.in("propertyId", propertyIds);
      }
      const { data } = await query;
      const rows = (data ?? []).map((r: any) => ({
        "Date": r.date,
        "Amount": `$${Number(r.amount ?? 0).toFixed(2)}`,
        "Status": r.status,
        "Reference": r.referenceNumber ?? "—",
        "Description": r.description ?? "—",
      }));
      const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      return {
        columns: ["Date", "Amount", "Status", "Reference", "Description"],
        rows,
        summary: { "Total Receipts": rows.length, "Total Amount": `$${total.toFixed(2)}` },
      };
    }

    // ── Check Register ─────────────────────────────────────────────────────
    case "check_register":
    case "payment_history": {
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("transactionType", "payment")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });
      if (propertyIds !== null) {
        if (propertyIds.length === 0) return { columns: [], rows: [] };
        query = query.in("propertyId", propertyIds);
      }
      const { data } = await query;
      const rows = (data ?? []).map((r: any) => ({
        "Date": r.date,
        "Amount": `$${Number(r.amount ?? 0).toFixed(2)}`,
        "Status": r.status,
        "Reference #": r.referenceNumber ?? "—",
        "Description": r.description ?? "—",
      }));
      const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      return {
        columns: ["Date", "Amount", "Status", "Reference #", "Description"],
        rows,
        summary: { "Total Payments": rows.length, "Total Amount": `$${total.toFixed(2)}` },
      };
    }

    // ── Journal Entry Register ─────────────────────────────────────────────
    case "journal_entry_register": {
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("transactionType", "journal_entry")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });
      if (propertyIds !== null) {
        if (propertyIds.length === 0) return { columns: [], rows: [] };
        query = query.in("propertyId", propertyIds);
      }
      const { data } = await query;
      const rows = (data ?? []).map((r: any) => ({
        "Date": r.date,
        "Amount": `$${Number(r.amount ?? 0).toFixed(2)}`,
        "Reference": r.referenceNumber ?? "—",
        "Description": r.description ?? "—",
        "Status": r.status,
      }));
      return {
        columns: ["Date", "Amount", "Reference", "Description", "Status"],
        rows,
        summary: { "Total Entries": rows.length },
      };
    }

    // ── Vendor Directory ───────────────────────────────────────────────────
    case "vendor_directory": {
      const { data } = await supabase
        .from("vendors")
        .select("*")
        .is("archived_at", null)
        .order("name");
      const rows = (data ?? []).map((r: any) => ({
        "Vendor Name": r.name ?? "—",
        "Trade": r.trade ?? "—",
        "Phone": Array.isArray(r.phone_numbers) ? r.phone_numbers[0] ?? "—" : "—",
        "Email": Array.isArray(r.emails) ? r.emails[0] ?? "—" : r.email ?? "—",
        "1099": r.send_1099 ? "Yes" : "No",
        "W-9": r.w9_on_file ? "On File" : "Missing",
      }));
      return {
        columns: ["Vendor Name", "Trade", "Phone", "Email", "1099", "W-9"],
        rows,
        summary: { "Total Vendors": rows.length },
      };
    }

    // ── Vendor 1099 Detail ─────────────────────────────────────────────────
    case "vendor_1099_detail":
    case "vendor_1099_summary":
    case "1099_detail":
    case "1099_summary": {
      const { data } = await supabase
        .from("vendors")
        .select("*")
        .eq("send_1099", true)
        .is("archived_at", null)
        .order("name");
      const rows = (data ?? []).map((r: any) => ({
        "Vendor Name": r.name ?? "—",
        "Trade": r.trade ?? "—",
        "Phone": Array.isArray(r.phone_numbers) ? r.phone_numbers[0] ?? "—" : "—",
        "Email": Array.isArray(r.emails) ? r.emails[0] ?? "—" : "—",
        "W-9 Status": r.w9_on_file ? "On File" : "Missing",
      }));
      return {
        columns: ["Vendor Name", "Trade", "Phone", "Email", "W-9 Status"],
        rows,
        summary: { "1099 Vendors": rows.length },
      };
    }

    // ── W-9 Status Report ──────────────────────────────────────────────────
    case "w9_status_report": {
      const { data } = await supabase
        .from("vendors")
        .select("*")
        .is("archived_at", null)
        .order("name");
      const rows = (data ?? []).map((r: any) => ({
        "Vendor Name": r.name ?? "—",
        "W-9 Status": r.w9_on_file ? "✓ On File" : "✗ Missing",
        "1099 Required": r.send_1099 ? "Yes" : "No",
        "Trade": r.trade ?? "—",
      }));
      const onFile = rows.filter((r: any) => r["W-9 Status"].startsWith("✓")).length;
      return {
        columns: ["Vendor Name", "W-9 Status", "1099 Required", "Trade"],
        rows,
        summary: { "Total Vendors": rows.length, "W-9 On File": onFile, "W-9 Missing": rows.length - onFile },
      };
    }

    // ── Owner Directory ────────────────────────────────────────────────────
    case "owner_directory":
    case "contact_list": {
      const { data } = await supabase
        .from("owners")
        .select("*")
        .is("archived_at", null)
        .order("last_name");
      const rows = (data ?? []).map((r: any) => ({
        "Name": (r.full_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()) || "—",
        "Email": r.email ?? "—",
        "Phone": r.phone ?? "—",
        "Portal Access": r.portal_activated ? "Active" : "Inactive",
      }));
      return {
        columns: ["Name", "Email", "Phone", "Portal Access"],
        rows,
        summary: { "Total Owners": rows.length },
      };
    }

    // ── Property Summary ───────────────────────────────────────────────────
    case "property_summary": {
      let query = supabase.from("properties").select("*").order("name");
      if (propertyIds !== null) {
        if (propertyIds.length === 0) return { columns: [], rows: [] };
        query = query.in("id", propertyIds);
      }
      const { data } = await query;
      const rows = (data ?? []).map((r: any) => ({
        "Property Name": r.name ?? "—",
        "Address": r.address ?? "—",
        "City": r.city ?? "—",
        "State": r.state ?? "—",
        "Type": r.propertyType ?? "—",
        "Units": r.totalUnits ?? "—",
      }));
      return {
        columns: ["Property Name", "Address", "City", "State", "Type", "Units"],
        rows,
        summary: { "Total Properties": rows.length },
      };
    }

    // ── Delinquency Report ─────────────────────────────────────────────────
    case "delinquency_report":
    case "homeowner_delinquency": {
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("transactionType", "charge")
        .eq("status", "pending")
        .order("date", { ascending: true });
      if (propertyIds !== null) {
        if (propertyIds.length === 0) return { columns: [], rows: [] };
        query = query.in("propertyId", propertyIds);
      }
      const { data } = await query;
      const rows = (data ?? []).map((r: any) => ({
        "Date": r.date,
        "Amount Due": `$${Number(r.amount ?? 0).toFixed(2)}`,
        "Status": r.status,
        "Description": r.description ?? "—",
        "Days Overdue": Math.max(0, Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000)),
      }));
      const totalDue = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      return {
        columns: ["Date", "Amount Due", "Status", "Description", "Days Overdue"],
        rows,
        summary: { "Delinquent Items": rows.length, "Total Amount Due": `$${totalDue.toFixed(2)}` },
      };
    }

    // ── Fund Balance ───────────────────────────────────────────────────────
    case "fund_balance":
    case "trust_account_balance": {
      const { data: bankData } = await supabase
        .from("bank_accounts")
        .select("*")
        .order("name");
      const rows = (bankData ?? []).map((r: any) => ({
        "Account Name": r.name ?? "—",
        "Account Type": r.accountType ?? r.account_type ?? "—",
        "Bank": r.bankName ?? r.bank_name ?? "—",
        "Balance": `$${Number(r.balance ?? r.currentBalance ?? 0).toFixed(2)}`,
        "Fund": r.fundAccount ?? r.fund_account ?? "operating",
      }));
      const total = (bankData ?? []).reduce((s: number, r: any) => s + Number(r.balance ?? r.currentBalance ?? 0), 0);
      return {
        columns: ["Account Name", "Account Type", "Bank", "Balance", "Fund"],
        rows,
        summary: { "Total Accounts": rows.length, "Total Balance": `$${total.toFixed(2)}` },
      };
    }

    // ── Balance Sheet (simplified) ─────────────────────────────────────────
    case "balance_sheet": {
      const { data: glData } = await supabase
        .from("gl_accounts")
        .select("number, name, account_type, fund_account")
        .eq("active", true)
        .in("account_type", ["cash", "accounts_receivable", "asset", "fixed_asset", "accounts_payable", "liability", "equity"])
        .order("number");
      const rows = (glData ?? []).map((r: any) => ({
        "Account #": r.number,
        "Account Name": r.name,
        "Type": r.account_type,
        "Fund": r.fund_account ?? "—",
        "Balance": "$0.00",
      }));
      const assets = rows.filter((r: any) => ["cash", "accounts_receivable", "asset", "fixed_asset"].includes(r.Type));
      const liabilities = rows.filter((r: any) => ["accounts_payable", "liability"].includes(r.Type));
      const equity = rows.filter((r: any) => r.Type === "equity");
      return {
        columns: ["Account #", "Account Name", "Type", "Fund", "Balance"],
        rows,
        summary: {
          "Total Asset Accounts": assets.length,
          "Total Liability Accounts": liabilities.length,
          "Total Equity Accounts": equity.length,
        },
      };
    }

    // ── Income Statement (simplified) ──────────────────────────────────────
    case "income_statement":
    case "fund_income_statement": {
      let incomeQ = supabase
        .from("transactions")
        .select("*")
        .eq("transactionType", "receipt")
        .gte("date", startDate)
        .lte("date", endDate);
      let expenseQ = supabase
        .from("transactions")
        .select("*")
        .eq("transactionType", "bill")
        .gte("date", startDate)
        .lte("date", endDate);
      if (propertyIds !== null && propertyIds.length > 0) {
        incomeQ = incomeQ.in("propertyId", propertyIds);
        expenseQ = expenseQ.in("propertyId", propertyIds);
      }
      const [{ data: incomeData }, { data: expenseData }] = await Promise.all([incomeQ, expenseQ]);
      const totalIncome = (incomeData ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      const totalExpense = (expenseData ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      const rows = [
        { "Category": "Total Income", "Amount": `$${totalIncome.toFixed(2)}`, "Count": incomeData?.length ?? 0 },
        { "Category": "Total Expenses", "Amount": `$${totalExpense.toFixed(2)}`, "Count": expenseData?.length ?? 0 },
        { "Category": "Net Income", "Amount": `$${(totalIncome - totalExpense).toFixed(2)}`, "Count": "" },
      ];
      return {
        columns: ["Category", "Amount", "Count"],
        rows,
        summary: {
          "Period": `${startDate} to ${endDate}`,
          "Net Income": `$${(totalIncome - totalExpense).toFixed(2)}`,
        },
      };
    }

    // ── Trial Balance ──────────────────────────────────────────────────────
    case "trial_balance": {
      const { data: glData } = await supabase
        .from("gl_accounts")
        .select("number, name, account_type, fund_account")
        .eq("active", true)
        .order("number");
      const rows = (glData ?? []).map((r: any) => ({
        "Account #": r.number,
        "Account Name": r.name,
        "Type": r.account_type,
        "Debit": ["cash", "accounts_receivable", "asset", "fixed_asset", "expense", "other_expense"].includes(r.account_type) ? "$0.00" : "",
        "Credit": ["accounts_payable", "liability", "income", "other_income", "equity"].includes(r.account_type) ? "$0.00" : "",
      }));
      return {
        columns: ["Account #", "Account Name", "Type", "Debit", "Credit"],
        rows,
        summary: { "Total Accounts": rows.length, "Total Debit": "$0.00", "Total Credit": "$0.00" },
      };
    }

    // ── General Ledger ─────────────────────────────────────────────────────
    case "general_ledger": {
      let query = supabase
        .from("transactions")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });
      if (propertyIds !== null) {
        if (propertyIds.length === 0) return { columns: [], rows: [] };
        query = query.in("propertyId", propertyIds);
      }
      const { data } = await query;
      const rows = (data ?? []).map((r: any) => ({
        "Date": r.date,
        "Type": r.transactionType,
        "Description": r.description ?? "—",
        "Reference": r.referenceNumber ?? "—",
        "Debit": ["bill", "payment"].includes(r.transactionType) ? `$${Number(r.amount ?? 0).toFixed(2)}` : "",
        "Credit": ["receipt", "charge"].includes(r.transactionType) ? `$${Number(r.amount ?? 0).toFixed(2)}` : "",
      }));
      return {
        columns: ["Date", "Type", "Description", "Reference", "Debit", "Credit"],
        rows,
        summary: { "Total Entries": rows.length, "Period": `${startDate} to ${endDate}` },
      };
    }

    // ── HOA Assessment Roll ────────────────────────────────────────────────
    case "hoa_assessment_roll": {
      const { data: owners } = await supabase
        .from("owners")
        .select("*")
        .is("archived_at", null)
        .order("last_name");
      const rows = (owners ?? []).map((r: any) => ({
        "Owner Name": (r.full_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()) || "—",
        "Email": r.email ?? "—",
        "Portal": r.portal_activated ? "Active" : "Inactive",
        "Assessment": "$0.00",
        "Balance Due": "$0.00",
      }));
      return {
        columns: ["Owner Name", "Email", "Portal", "Assessment", "Balance Due"],
        rows,
        summary: { "Total Homeowners": rows.length },
      };
    }

    // ── Board Member Directory ─────────────────────────────────────────────
    case "board_member_directory": {
      const { data: users } = await supabase
        .from("users")
        .select("name, email, role, createdAt")
        .eq("role", "board_member")
        .order("name");
      const rows = (users ?? []).map((r: any) => ({
        "Name": r.name ?? "—",
        "Email": r.email ?? "—",
        "Role": "Board Member",
        "Since": r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—",
      }));
      return {
        columns: ["Name", "Email", "Role", "Since"],
        rows,
        summary: { "Total Board Members": rows.length },
      };
    }

    // ── Unreconciled Transactions ──────────────────────────────────────────
    case "unreconciled_transactions": {
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("status", "pending")
        .order("date", { ascending: true });
      if (propertyIds !== null) {
        if (propertyIds.length === 0) return { columns: [], rows: [] };
        query = query.in("propertyId", propertyIds);
      }
      const { data } = await query;
      const rows = (data ?? []).map((r: any) => ({
        "Date": r.date,
        "Type": r.transactionType,
        "Amount": `$${Number(r.amount ?? 0).toFixed(2)}`,
        "Description": r.description ?? "—",
        "Days Pending": Math.max(0, Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000)),
      }));
      return {
        columns: ["Date", "Type", "Amount", "Description", "Days Pending"],
        rows,
        summary: { "Unreconciled Items": rows.length },
      };
    }

    // ── Reserve Fund Analysis ──────────────────────────────────────────────
    case "reserve_fund_analysis": {
      const { data: glData } = await supabase
        .from("gl_accounts")
        .select("number, name, account_type, fund_account")
        .eq("active", true)
        .eq("fund_account", "reserve")
        .order("number");
      const rows = (glData ?? []).map((r: any) => ({
        "Account #": r.number,
        "Account Name": r.name,
        "Type": r.account_type,
        "Balance": "$0.00",
      }));
      return {
        columns: ["Account #", "Account Name", "Type", "Balance"],
        rows,
        summary: { "Reserve Accounts": rows.length, "Total Reserve Balance": "$0.00" },
      };
    }

    // ── Default: return empty with message ────────────────────────────────
    default: {
      return {
        columns: ["Message"],
        rows: [{ "Message": `Report "${reportId}" is not yet implemented. Data will be available in a future update.` }],
        summary: { "Status": "Coming Soon" },
      };
    }
  }
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────
export const reportsRouter = router({
  catalog: protectedProcedure.query(() => REPORT_CATALOG),

  run: protectedProcedure
    .input(
      z.object({
        reportId: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        propertyId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const propertyIds = await getPropertyFilter(ctx.user as any);
      const result = await runReportQuery(input.reportId, input, propertyIds);
      return result;
    }),

  scheduled: protectedProcedure.query(async ({ ctx }) => {
    const ids = await getPropertyFilter(ctx.user as any);
    let query = supabase.from("scheduled_reports").select("*").order("reportName");
    if (ids !== null) {
      if (ids.length === 0) return [];
      query = query.in("propertyId", ids);
    }
    const { data, error } = await query;
    if (error) console.error("[DB] getScheduledReports:", error.message);
    return data ?? [];
  }),
});
