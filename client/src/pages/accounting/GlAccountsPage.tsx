import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Search, Plus, ChevronRight } from "lucide-react";

const ACCOUNT_TYPES = ["All", "Cash", "Asset", "Liability", "Capital", "Income", "Expense", "Other Income", "Other Expense"];

export default function GlAccountsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: accounts, isLoading } = trpc.accounting.glAccounts.useQuery();

  // Group by type
  const grouped: Record<string, typeof accounts> = {};
  (accounts ?? []).filter(a =>
    (!search || a.name.toLowerCase().includes(search.toLowerCase()) || String(a.code).includes(search)) &&
    (typeFilter === "All" || a.type.replace(/_/g, " ").toLowerCase() === typeFilter.toLowerCase())
  ).forEach(a => {
    const key = a.type;
    if (!grouped[key]) grouped[key] = [];
    grouped[key]!.push(a);
  });

  const toggleGroup = (type: string) => setExpanded(prev => ({ ...prev, [type]: !prev[type] }));

  return (
    <ThreePanelLayout
      title="GL Accounts"
      subtitle="Chart of Accounts — 370+ codes"
      actions={
        <button className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Account
        </button>
      }
    >
      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by code or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {ACCOUNT_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped accounts */}
      <div className="space-y-2">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4" />
            </div>
          ))
        ) : Object.keys(grouped).length > 0 ? Object.entries(grouped).map(([type, accts]) => (
          <div key={type} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleGroup(type)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded[type] ? "rotate-90" : ""}`} />
                <span className="text-sm font-semibold text-foreground">{type}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{accts?.length}</span>
              </div>
            </button>
            {expanded[type] && (
              <div className="border-t border-border">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/20">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Code</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Description</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {accts?.map(a => (
                      <tr key={a.id} className="table-row-hover">
                        <td className="px-4 py-2 text-sm font-mono text-primary">{a.code}</td>
                        <td className="px-4 py-2 text-sm text-foreground">{a.name}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">{a.parentCode ? `Parent: ${a.parentCode}` : "—"}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${a.isActive ? "bg-green-400/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                            {a.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )) : (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
            No GL accounts found
          </div>
        )}
      </div>
    </ThreePanelLayout>
  );
}
