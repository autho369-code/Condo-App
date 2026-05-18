import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Plus, Search, Download } from "lucide-react";
import { format } from "date-fns";

const TABS = ["History", "Recurring", "Batches"];

export default function JournalEntriesPage() {
  const [activeTab, setActiveTab] = useState("History");
  const [search, setSearch] = useState("");

  const { data: entries, isLoading } = trpc.accounting.journalEntries.useQuery();

  return (
    <ThreePanelLayout
      title="Journal Entries"
      subtitle="Manual journal entries, recurring entries, and batches"
      actions={
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm hover:bg-secondary/80 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Entry
          </button>
        </div>
      }
    >
      <div className="flex gap-1 mb-4 border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by reference, GL account, or property..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Property</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Debit</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Credit</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : entries && entries.length > 0 ? entries.map((e: any) => (
              <tr key={e.id} className="table-row-hover">
                <td className="px-4 py-3 text-sm text-foreground">{format(new Date(e.date), "MM/dd/yyyy")}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{e.referenceNumber ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-foreground">{e.description ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">#{e.propertyId}</td>
                <td className="px-4 py-3 text-sm text-foreground text-right">${Number(e.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-foreground text-right">—</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                    e.status === "posted" ? "bg-green-400/10 text-green-400" :
                    e.status === "pending" ? "bg-yellow-400/10 text-yellow-400" :
                    "bg-muted text-muted-foreground"
                  }`}>{e.status}</span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No journal entries found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ThreePanelLayout>
  );
}
