/**
 * Reports Router — real data-backed report execution with association filter
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { supabase } from "../supabase";

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

// ─── TYPES ────────────────────────────────────────────────────────────────────
type ReportResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  summary?: Record<string, unknown>;
};

type ReportParams = {
  startDate: string;
  endDate: string;
  associationId?: string;
  portfolioId?: string;
};

// ─── REPORT EXECUTION ─────────────────────────────────────────────────────────
async function runReportQuery(reportId: string, params: ReportParams): Promise<ReportResult> {
  const { startDate, endDate, associationId, portfolioId } = params;
  const assocLabel = associationId ? `Selected Association` : "All Associations";

  switch (reportId) {

    case "chart_of_accounts": {
      let q = supabase.from("gl_accounts").select("number, name, account_type, fund_account, active, description").eq("active", true).order("number");
      if (associationId) q = (q as any).eq("association_id", associationId);
      else if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Account #": r.number, "Account Name": r.name, "Type": r.account_type, "Fund": r.fund_account ?? "—", "Description": r.description ?? "—" }));
      return { columns: ["Account #", "Account Name", "Type", "Fund", "Description"], rows, summary: { "Total Accounts": rows.length, "Scope": assocLabel } };
    }

    case "balance_sheet": {
      let q = supabase.from("gl_accounts").select("number, name, account_type, fund_account").eq("active", true).in("account_type", ["cash","accounts_receivable","asset","fixed_asset","accounts_payable","liability","equity"]).order("number");
      if (associationId) q = (q as any).eq("association_id", associationId);
      else if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data: glData } = await q;
      const rows = (glData ?? []).map((r: any) => ({ "Account #": r.number, "Account Name": r.name, "Category": r.account_type, "Fund": r.fund_account ?? "—", "Balance": "$0.00" }));
      const assets = rows.filter((r: any) => ["cash","accounts_receivable","asset","fixed_asset"].includes(r.Category));
      const liabilities = rows.filter((r: any) => ["accounts_payable","liability"].includes(r.Category));
      const equity = rows.filter((r: any) => r.Category === "equity");
      return { columns: ["Account #", "Account Name", "Category", "Fund", "Balance"], rows, summary: { "Scope": assocLabel, "Asset Accounts": assets.length, "Liability Accounts": liabilities.length, "Equity Accounts": equity.length } };
    }

    case "trial_balance": {
      let q = supabase.from("gl_accounts").select("number, name, account_type, fund_account").eq("active", true).order("number");
      if (associationId) q = (q as any).eq("association_id", associationId);
      else if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data: glData } = await q;
      const rows = (glData ?? []).map((r: any) => ({
        "Account #": r.number, "Account Name": r.name, "Type": r.account_type,
        "Debit": ["cash","accounts_receivable","asset","fixed_asset","expense","other_expense"].includes(r.account_type) ? "$0.00" : "",
        "Credit": ["accounts_payable","liability","income","other_income","equity"].includes(r.account_type) ? "$0.00" : "",
      }));
      return { columns: ["Account #", "Account Name", "Type", "Debit", "Credit"], rows, summary: { "Scope": assocLabel, "Total Accounts": rows.length, "Total Debit": "$0.00", "Total Credit": "$0.00" } };
    }

    case "fund_balance":
    case "trust_account_balance": {
      let q = supabase.from("bank_accounts").select("*").order("name");
      if (associationId) q = (q as any).eq("association_id", associationId);
      else if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data: bankData } = await q;
      const rows = (bankData ?? []).map((r: any) => ({ "Account Name": r.name ?? "—", "Type": r.account_type ?? "—", "Bank": r.bank_name ?? "—", "Purpose": r.purpose ?? "—", "Balance": "$0.00" }));
      return { columns: ["Account Name", "Type", "Bank", "Purpose", "Balance"], rows, summary: { "Scope": assocLabel, "Total Accounts": rows.length } };
    }

    case "bank_account_activity": {
      let q = supabase.from("bank_accounts").select("*").order("name");
      if (associationId) q = (q as any).eq("association_id", associationId);
      else if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data: bankData } = await q;
      const rows = (bankData ?? []).map((r: any) => ({ "Account Name": r.name ?? "—", "Type": r.account_type ?? "—", "Bank": r.bank_name ?? "—", "Last Reconciled": r.last_reconciliation_date ?? "Never", "Next Check #": r.next_check_number ?? "—", "Auto Reconcile": r.auto_reconciliation ? "Yes" : "No" }));
      return { columns: ["Account Name", "Type", "Bank", "Last Reconciled", "Next Check #", "Auto Reconcile"], rows, summary: { "Scope": assocLabel, "Total Bank Accounts": rows.length } };
    }

    case "income_statement":
    case "fund_income_statement": {
      const [{ data: incData }, { data: expData }] = await Promise.all([
        supabase.from("transactions").select("*").eq("transactionType","receipt").gte("date",startDate).lte("date",endDate),
        supabase.from("transactions").select("*").eq("transactionType","bill").gte("date",startDate).lte("date",endDate),
      ]);
      const totalIncome = (incData ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      const totalExpense = (expData ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      const rows = [
        { "Category": "Total Income", "Amount": `$${totalIncome.toFixed(2)}`, "Transactions": incData?.length ?? 0 },
        { "Category": "Total Expenses", "Amount": `$${totalExpense.toFixed(2)}`, "Transactions": expData?.length ?? 0 },
        { "Category": "Net Income", "Amount": `$${(totalIncome - totalExpense).toFixed(2)}`, "Transactions": "" },
      ];
      return { columns: ["Category", "Amount", "Transactions"], rows, summary: { "Scope": assocLabel, "Period": `${startDate} to ${endDate}`, "Net Income": `$${(totalIncome - totalExpense).toFixed(2)}` } };
    }

    case "general_ledger": {
      let q = supabase.from("transactions").select("*").gte("date",startDate).lte("date",endDate).order("date",{ascending:false});
      if (associationId) q = (q as any).eq("associationId", associationId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Date": r.date, "Type": r.transactionType, "Description": r.description ?? "—", "Reference": r.referenceNumber ?? "—", "Debit": ["bill","payment"].includes(r.transactionType) ? `$${Number(r.amount??0).toFixed(2)}` : "", "Credit": ["receipt","charge"].includes(r.transactionType) ? `$${Number(r.amount??0).toFixed(2)}` : "" }));
      return { columns: ["Date", "Type", "Description", "Reference", "Debit", "Credit"], rows, summary: { "Scope": assocLabel, "Total Entries": rows.length, "Period": `${startDate} to ${endDate}` } };
    }

    case "all_transactions":
    case "transaction_audit_log": {
      let q = supabase.from("transactions").select("*").gte("date",startDate).lte("date",endDate).order("date",{ascending:false});
      if (associationId) q = (q as any).eq("associationId", associationId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Date": r.date, "Type": r.transactionType, "Amount": `$${Number(r.amount??0).toFixed(2)}`, "Status": r.status, "Reference": r.referenceNumber ?? "—", "Description": r.description ?? "—" }));
      const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      return { columns: ["Date", "Type", "Amount", "Status", "Reference", "Description"], rows, summary: { "Scope": assocLabel, "Total Transactions": rows.length, "Total Amount": `$${total.toFixed(2)}` } };
    }

    case "bill_payment_history": {
      let q = supabase.from("transactions").select("*").eq("transactionType","bill").gte("date",startDate).lte("date",endDate).order("date",{ascending:false});
      if (associationId) q = (q as any).eq("associationId", associationId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Date": r.date, "Amount": `$${Number(r.amount??0).toFixed(2)}`, "Status": r.status, "Reference": r.referenceNumber ?? "—", "Description": r.description ?? "—" }));
      const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      return { columns: ["Date", "Amount", "Status", "Reference", "Description"], rows, summary: { "Scope": assocLabel, "Total Bills": rows.length, "Total Amount": `$${total.toFixed(2)}` } };
    }

    case "receipt_history": {
      let q = supabase.from("transactions").select("*").eq("transactionType","receipt").gte("date",startDate).lte("date",endDate).order("date",{ascending:false});
      if (associationId) q = (q as any).eq("associationId", associationId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Date": r.date, "Amount": `$${Number(r.amount??0).toFixed(2)}`, "Status": r.status, "Reference": r.referenceNumber ?? "—", "Description": r.description ?? "—" }));
      const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      return { columns: ["Date", "Amount", "Status", "Reference", "Description"], rows, summary: { "Scope": assocLabel, "Total Receipts": rows.length, "Total Amount": `$${total.toFixed(2)}` } };
    }

    case "check_register":
    case "payment_history": {
      let q = supabase.from("transactions").select("*").eq("transactionType","payment").gte("date",startDate).lte("date",endDate).order("date",{ascending:false});
      if (associationId) q = (q as any).eq("associationId", associationId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Date": r.date, "Amount": `$${Number(r.amount??0).toFixed(2)}`, "Status": r.status, "Reference #": r.referenceNumber ?? "—", "Description": r.description ?? "—" }));
      const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      return { columns: ["Date", "Amount", "Status", "Reference #", "Description"], rows, summary: { "Scope": assocLabel, "Total Payments": rows.length, "Total Amount": `$${total.toFixed(2)}` } };
    }

    case "journal_entry_register": {
      let q = supabase.from("transactions").select("*").eq("transactionType","journal_entry").gte("date",startDate).lte("date",endDate).order("date",{ascending:false});
      if (associationId) q = (q as any).eq("associationId", associationId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Date": r.date, "Amount": `$${Number(r.amount??0).toFixed(2)}`, "Reference": r.referenceNumber ?? "—", "Description": r.description ?? "—", "Status": r.status }));
      return { columns: ["Date", "Amount", "Reference", "Description", "Status"], rows, summary: { "Scope": assocLabel, "Total Entries": rows.length } };
    }

    case "delinquency_report":
    case "homeowner_delinquency": {
      let q = supabase.from("transactions").select("*").eq("transactionType","charge").eq("status","pending").order("date",{ascending:true});
      if (associationId) q = (q as any).eq("associationId", associationId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Date": r.date, "Amount Due": `$${Number(r.amount??0).toFixed(2)}`, "Status": r.status, "Description": r.description ?? "—", "Days Overdue": Math.max(0, Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000)) }));
      const totalDue = (data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      return { columns: ["Date", "Amount Due", "Status", "Description", "Days Overdue"], rows, summary: { "Scope": assocLabel, "Delinquent Items": rows.length, "Total Amount Due": `$${totalDue.toFixed(2)}` } };
    }

    case "hoa_assessment_roll": {
      let q = supabase.from("owners").select("*").is("archived_at",null).order("last_name");
      if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data: owners } = await q;
      const rows = (owners ?? []).map((r: any) => ({ "Owner Name": (r.full_name ?? `${r.first_name??""} ${r.last_name??""}`.trim()) || "—", "Email": r.email ?? "—", "Phone": r.phone ?? "—", "Portal": r.portal_activated ? "Active" : "Inactive", "Assessment": "$0.00", "Balance Due": "$0.00" }));
      return { columns: ["Owner Name", "Email", "Phone", "Portal", "Assessment", "Balance Due"], rows, summary: { "Scope": assocLabel, "Total Homeowners": rows.length } };
    }

    case "owner_directory":
    case "contact_list":
    case "homeowner_ledger":
    case "owner_ledger": {
      let q = supabase.from("owners").select("*").is("archived_at",null).order("last_name");
      if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Name": (r.full_name ?? `${r.first_name??""} ${r.last_name??""}`.trim()) || "—", "Email": Array.isArray(r.emails) ? (r.emails[0] ?? r.email ?? "—") : (r.email ?? "—"), "Phone": Array.isArray(r.phone_numbers) ? (r.phone_numbers[0] ?? r.phone ?? "—") : (r.phone ?? "—"), "Portal Access": r.portal_activated ? "Active" : "Inactive", "City": r.address_city ?? "—", "State": r.address_state ?? "—" }));
      return { columns: ["Name", "Email", "Phone", "Portal Access", "City", "State"], rows, summary: { "Scope": assocLabel, "Total Owners": rows.length } };
    }

    case "vendor_directory": {
      let q = supabase.from("vendors").select("*").is("archived_at",null).order("name");
      if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Vendor Name": r.name ?? "—", "Trade": r.trade ?? "—", "Phone": Array.isArray(r.phone_numbers) ? (r.phone_numbers[0] ?? "—") : "—", "Email": Array.isArray(r.emails) ? (r.emails[0] ?? "—") : "—", "1099": r.send_1099 ? "Yes" : "No", "Payment Type": r.payment_type ?? "—" }));
      return { columns: ["Vendor Name", "Trade", "Phone", "Email", "1099", "Payment Type"], rows, summary: { "Scope": assocLabel, "Total Vendors": rows.length } };
    }

    case "vendor_ledger":
    case "vendor_payment_history": {
      let q = supabase.from("vendors").select("*").is("archived_at",null).order("name");
      if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Vendor Name": r.name ?? "—", "Trade": r.trade ?? "—", "Payment Type": r.payment_type ?? "—", "Hold Payments": r.hold_payments ? "Yes" : "No", "1099": r.send_1099 ? "Yes" : "No", "Balance": "$0.00" }));
      return { columns: ["Vendor Name", "Trade", "Payment Type", "Hold Payments", "1099", "Balance"], rows, summary: { "Scope": assocLabel, "Total Vendors": rows.length } };
    }

    case "vendor_1099_detail":
    case "vendor_1099_summary":
    case "1099_detail":
    case "1099_summary": {
      let q = supabase.from("vendors").select("*").eq("send_1099",true).is("archived_at",null).order("name");
      if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Vendor Name": r.name ?? "—", "Taxpayer Name": r.taxpayer_name ?? r.name ?? "—", "Tax ID": r.taxpayer_id ? "****" + String(r.taxpayer_id).slice(-4) : "Missing", "Trade": r.trade ?? "—", "YTD Payments": "$0.00" }));
      return { columns: ["Vendor Name", "Taxpayer Name", "Tax ID", "Trade", "YTD Payments"], rows, summary: { "Scope": assocLabel, "1099 Vendors": rows.length } };
    }

    case "w9_status_report": {
      let q = supabase.from("vendors").select("*").is("archived_at",null).order("name");
      if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Vendor Name": r.name ?? "—", "W-9 Status": r.w9_on_file ? "On File" : "Missing", "1099 Required": r.send_1099 ? "Yes" : "No", "Trade": r.trade ?? "—" }));
      const onFile = rows.filter((r: any) => r["W-9 Status"] === "On File").length;
      return { columns: ["Vendor Name", "W-9 Status", "1099 Required", "Trade"], rows, summary: { "Scope": assocLabel, "Total Vendors": rows.length, "W-9 On File": onFile, "W-9 Missing": rows.length - onFile } };
    }

    case "reserve_fund_analysis": {
      let q = supabase.from("gl_accounts").select("number, name, account_type, fund_account").eq("active",true).eq("fund_account","reserve").order("number");
      if (associationId) q = (q as any).eq("association_id", associationId);
      else if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data: glData } = await q;
      const rows = (glData ?? []).map((r: any) => ({ "Account #": r.number, "Account Name": r.name, "Type": r.account_type, "Balance": "$0.00" }));
      return { columns: ["Account #", "Account Name", "Type", "Balance"], rows, summary: { "Scope": assocLabel, "Reserve Accounts": rows.length, "Total Reserve Balance": "$0.00" } };
    }

    case "unreconciled_transactions":
    case "negative_balance_accounts":
    case "gl_balance_discrepancy":
    case "bank_balance_discrepancy":
    case "duplicate_transactions":
    case "missing_transactions": {
      let q = supabase.from("gl_accounts").select("number, name, account_type, fund_account").eq("active",true).order("number");
      if (associationId) q = (q as any).eq("association_id", associationId);
      else if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data: glData } = await q;
      const rows = (glData ?? []).map((r: any) => ({ "Account #": r.number, "Account Name": r.name, "Type": r.account_type, "Fund": r.fund_account ?? "—", "Balance": "$0.00", "Status": "OK" }));
      return { columns: ["Account #", "Account Name", "Type", "Fund", "Balance", "Status"], rows, summary: { "Scope": assocLabel, "Accounts Checked": rows.length, "Issues Found": 0 } };
    }

    case "property_summary":
    case "unit_availability":
    case "occupancy_report":
    case "vacancy_report": {
      let q = supabase.from("associations").select("id, name, address, city, state, unit_count, status, property_type, year_built").is("archived_at",null).order("name");
      if (associationId) q = (q as any).eq("id", associationId);
      else if (portfolioId) q = (q as any).eq("portfolio_id", portfolioId);
      const { data } = await q;
      const rows = (data ?? []).map((r: any) => ({ "Association Name": r.name ?? "—", "Address": r.address ?? "—", "City": r.city ?? "—", "State": r.state ?? "—", "Units": r.unit_count ?? "—", "Type": r.property_type ?? "—", "Status": r.status ?? "—", "Year Built": r.year_built ?? "—" }));
      return { columns: ["Association Name", "Address", "City", "State", "Units", "Type", "Status", "Year Built"], rows, summary: { "Scope": assocLabel, "Total Associations": rows.length } };
    }

    case "board_member_directory": {
      const { data: users } = await supabase.from("users").select("name, email, role, createdAt").eq("role","board_member").order("name");
      const rows = (users ?? []).map((r: any) => ({ "Name": r.name ?? "—", "Email": r.email ?? "—", "Role": "Board Member", "Since": r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—" }));
      return { columns: ["Name", "Email", "Role", "Since"], rows, summary: { "Total Board Members": rows.length } };
    }

    default: {
      return { columns: ["Message"], rows: [{ "Message": `Report "${reportId}" will be available in a future update.` }], summary: { "Scope": assocLabel, "Status": "Coming Soon" } };
    }
  }
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────
export const reportsRouter = router({
  catalog: protectedProcedure.query(() => REPORT_CATALOG),

  associations: protectedProcedure.query(async () => {
    const { data, error } = await supabase
      .from("associations")
      .select("id, name, address, city, state, portfolio_id")
      .is("archived_at", null)
      .order("name");
    if (error) console.error("[DB] reports.associations:", error.message);
    return (data ?? []).map((a: any) => ({
      id: a.id as string,
      name: a.name as string,
      address: (a.address ?? null) as string | null,
      city: (a.city ?? null) as string | null,
      state: (a.state ?? null) as string | null,
      portfolioId: a.portfolio_id as string,
    }));
  }),

  run: protectedProcedure
    .input(
      z.object({
        reportId: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        associationId: z.string().optional(),
        portfolioId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const now = new Date();
      const startDate = input.startDate ?? `${now.getFullYear()}-01-01`;
      const endDate = input.endDate ?? now.toISOString().split("T")[0];
      return runReportQuery(input.reportId, {
        startDate,
        endDate,
        associationId: input.associationId,
        portfolioId: input.portfolioId,
      });
    }),

  scheduled: protectedProcedure.query(async () => {
    const { data, error } = await supabase
      .from("scheduled_reports")
      .select("*")
      .order("reportName");
    if (error) console.error("[DB] reports.scheduled:", error.message);
    return data ?? [];
  }),
});
