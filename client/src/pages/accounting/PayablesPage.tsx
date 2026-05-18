import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Plus, Search, Filter, Download, ChevronDown, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const TABS = ["Bills", "Payments", "Recurring", "Loans"];
const STATUS_OPTIONS = ["all", "pending", "approved", "paid", "overdue"];

export default function PayablesPage() {
  const [activeTab, setActiveTab] = useState("Bills");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: bills, isLoading, refetch } = trpc.accounting.bills.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const approveBill = trpc.accounting.approveBill.useMutation({
    onSuccess: () => { toast.success("Bill approved"); refetch(); },
    onError: e => toast.error(e.message),
  });

  const rows = bills ?? [];

  return (
    <ThreePanelLayout
      title="Payables"
      subtitle="Bills, payments, recurring, and loans"
      actions={
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm hover:bg-secondary/80 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Bill
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

      {/* Search + filter */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by payee, reference, or amount..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-card border border-border px-3 py-2 rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === "all" ? "All Statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payee</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ref #</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bill Date</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">GL Account</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(8)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length > 0 ? rows.map((b: any) => (
              <tr key={b.id} className="table-row-hover">
                <td className="px-4 py-3 text-sm font-medium text-foreground">{b.description ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{b.referenceNumber ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-foreground">{format(new Date(b.date), "MM/dd/yyyy")}</td>
                <td className="px-4 py-3 text-sm text-foreground">—</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{b.glAccountId ?? "—"}</td>
                <td className="px-4 py-3 text-sm font-medium text-foreground text-right">${Number(b.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                    b.status === "approved" || b.status === "paid" ? "status-approved" :
                    b.status === "pending" ? "status-pending" :
                    b.status === "void" ? "status-void" :
                    "status-void"
                  }`}>{b.status}</span>
                </td>
                <td className="px-4 py-3">
                  {b.status === "pending" && (
                    <button
                      onClick={() => approveBill.mutate({ id: b.id })}
                      disabled={approveBill.isPending}
                      className="flex items-center gap-1 text-xs btn-approve px-2 py-1 rounded transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" /> Approve
                    </button>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No bills found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ThreePanelLayout>
  );
}
