import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Plus, Search, Filter, Download, ChevronDown } from "lucide-react";
import { format } from "date-fns";

const TABS = ["Receipts", "Charges", "Bank Deposits", "Delinquencies"];

export default function ReceivablesPage() {
  const [activeTab, setActiveTab] = useState("Receipts");
  const [search, setSearch] = useState("");

  const typeMap: Record<string, string> = {
    "Receipts": "receipt",
    "Charges": "charge",
    "Bank Deposits": "bank_deposit",
    "Delinquencies": "charge",
  };

  const { data: receipts, isLoading: l1 } = trpc.accounting.receipts.useQuery();
  const { data: charges, isLoading: l2 } = trpc.accounting.charges.useQuery();
  const { data: deposits, isLoading: l3 } = trpc.accounting.bankDeposits.useQuery();

  const allRows = activeTab === "Receipts" ? (receipts ?? []) :
    activeTab === "Charges" || activeTab === "Delinquencies" ? (charges ?? []) :
    (deposits ?? []);
  const isLoading = l1 || l2 || l3;

  const filtered = allRows.filter((r: any) =>
    !search ||
    r.description?.toLowerCase().includes(search.toLowerCase()) ||
    r.referenceNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ThreePanelLayout
      title="Receivables"
      subtitle="Receipts, charges, bank deposits, and delinquencies"
      actions={
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm hover:bg-secondary/80 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Receipt
          </button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by description or reference..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button className="flex items-center gap-1.5 bg-card border border-border px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Filter className="w-3.5 h-3.5" /> Filter <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">GL Account</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference #</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length > 0 ? filtered.map(r => (
              <tr key={r.id} className="table-row-hover">
                <td className="px-4 py-3 text-sm text-foreground">{format(new Date(r.date), "MM/dd/yyyy")}</td>
                <td className="px-4 py-3 text-sm text-foreground">{r.description ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{r.glAccountId ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{r.referenceNumber ?? "—"}</td>
                <td className="px-4 py-3 text-sm font-medium text-foreground text-right">${Number(r.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                    r.status === "posted" ? "status-approved" :
                    r.status === "pending" ? "status-pending" :
                    "bg-muted text-muted-foreground"
                  }`}>{r.status}</span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No {activeTab.toLowerCase()} found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ThreePanelLayout>
  );
}
