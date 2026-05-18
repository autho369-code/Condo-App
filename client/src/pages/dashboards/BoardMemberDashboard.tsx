import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Building2, Users, BarChart3, Eye, ArrowRight, DollarSign } from "lucide-react";
import { Link } from "wouter";

export default function BoardMemberDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/");
  }, [loading, isAuthenticated]);

  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: properties } = trpc.properties.list.useQuery();
  const { data: receipts } = trpc.accounting.receipts.useQuery({});

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const totalIncome = receipts?.reduce((sum, r) => sum + Number(r.amount), 0) ?? 0;

  return (
    <ThreePanelLayout
      title="Board Member View"
      subtitle="Read-only access to your association financials"
    >
      {/* View-only notice */}
      <div className="flex items-center gap-2 bg-blue-400/10 border border-blue-400/20 rounded-lg px-4 py-3 mb-6">
        <Eye className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <p className="text-sm text-blue-400">
          You have <strong>view-only</strong> access. Contact your Manager to request changes.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-blue">
          <div className="w-9 h-9 rounded-lg bg-blue-400/10 flex items-center justify-center mb-3">
            <Building2 className="w-4.5 h-4.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats?.associations ?? 0}</div>
          <div className="text-sm text-muted-foreground">Associations</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-green">
          <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center mb-3">
            <Users className="w-4.5 h-4.5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats?.owners ?? 0}</div>
          <div className="text-sm text-muted-foreground">Owners</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-purple">
          <div className="w-9 h-9 rounded-lg bg-purple-400/10 flex items-center justify-center mb-3">
            <DollarSign className="w-4.5 h-4.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">${totalIncome.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Total Income</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-orange">
          <div className="w-9 h-9 rounded-lg bg-orange-400/10 flex items-center justify-center mb-3">
            <BarChart3 className="w-4.5 h-4.5 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{receipts?.length ?? 0}</div>
          <div className="text-sm text-muted-foreground">Transactions</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Associations */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Your Associations</h3>
            <Link href="/associations">
              <a className="text-xs text-primary hover:underline flex items-center gap-1">View <ArrowRight className="w-3 h-3" /></a>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {properties && properties.length > 0 ? properties.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.city}, {p.state} · {p.unitCount} units</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "active" ? "bg-green-400/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {p.status}
                </span>
              </div>
            )) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No associations assigned</div>
            )}
          </div>
        </div>

        {/* Available Reports (view only) */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Available Reports</h3>
            <Link href="/reports">
              <a className="text-xs text-primary hover:underline flex items-center gap-1">All reports <ArrowRight className="w-3 h-3" /></a>
            </Link>
          </div>
          <div className="p-3 space-y-1">
            {[
              { name: "Fund Income Statement", cat: "Association" },
              { name: "Fund Balance", cat: "Association" },
              { name: "Budget Comparison", cat: "Association" },
              { name: "Income Statement", cat: "Accounting" },
              { name: "Balance Sheet", cat: "Accounting" },
              { name: "Homeowner Delinquency", cat: "Association" },
              { name: "Reserve Fund Analysis", cat: "Association" },
            ].map(r => (
              <Link key={r.name} href="/reports">
                <a className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent/30 transition-colors">
                  <span className="text-sm text-foreground">{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.cat}</span>
                </a>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </ThreePanelLayout>
  );
}
