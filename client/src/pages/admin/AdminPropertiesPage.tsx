import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { Building2, Search, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminPropertiesPage() {
  const [search, setSearch] = useState("");
  const { data: properties, isLoading } = trpc.properties.list.useQuery();
  const filtered = (properties ?? []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.city ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ThreePanelLayout
      title="Properties"
      subtitle="All properties across all companies"
      actions={
        <button
          onClick={() => toast.info("Add property coming soon")}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Property
        </button>
      }
    >
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search properties..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Property</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ID</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Location</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Units</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length > 0 ? filtered.map(p => (
              <tr key={p.id} className="table-row-hover">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-muted-foreground">#{p.id}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{p.city}, {p.state}</td>
                <td className="px-4 py-3 text-sm text-foreground">{p.unitCount}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{p.type}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${p.status === "active" ? "status-approved" : "bg-muted text-muted-foreground"}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">No properties found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ThreePanelLayout>
  );
}
