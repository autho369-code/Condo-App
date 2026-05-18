import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { Users, Search, Plus } from "lucide-react";
import { useState } from "react";

const TABS = ["Owners", "Vendors", "Board Members"];

export default function PeoplePage() {
  const [activeTab, setActiveTab] = useState("Owners");
  const [search, setSearch] = useState("");

  const { data: owners } = trpc.owners.list.useQuery({ search });
  const { data: vendors } = trpc.vendors.list.useQuery({ search });

  const rows = activeTab === "Owners" ? (owners ?? []) : (vendors ?? []);

  return (
    <ThreePanelLayout
      title="People"
      subtitle="Owners, vendors, and board members"
      actions={
        <button className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Person
        </button>
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
          placeholder={`Search ${activeTab.toLowerCase()}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length > 0 ? rows.map((r: any) => (
              <tr key={r.id} className="table-row-hover">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {(r.firstName?.[0] ?? r.companyName?.[0] ?? "?").toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {r.firstName ? `${r.firstName} ${r.lastName ?? ""}` : r.companyName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{r.email ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{r.phone ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.isActive !== false ? "bg-green-400/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {r.isActive !== false ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">No {activeTab.toLowerCase()} found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ThreePanelLayout>
  );
}
