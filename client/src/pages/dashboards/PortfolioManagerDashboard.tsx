import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Building2, Users, CreditCard, BarChart3, Plus, ArrowRight, Mail } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

export default function PortfolioManagerDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/");
  }, [loading, isAuthenticated]);

  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: properties } = trpc.properties.list.useQuery();
  const { data: invitations } = trpc.invitations.list.useQuery();
  const { data: bills } = trpc.accounting.bills.useQuery({ status: "pending" });

  const pendingBills = bills ?? [];
  const pendingInvites = invitations?.filter(i => i.status === "pending") ?? [];

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <ThreePanelLayout
      title="Portfolio Manager"
      subtitle="Your assigned portfolio overview"
      actions={
        <Link href="/invitations" className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Mail className="w-3.5 h-3.5" /> Invite Manager
          </Link>
      }
    >
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-blue">
          <div className="w-9 h-9 rounded-lg bg-blue-400/10 flex items-center justify-center mb-3">
            <Building2 className="w-4.5 h-4.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats?.associations ?? 0}</div>
          <div className="text-sm text-muted-foreground">Associations</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-purple">
          <div className="w-9 h-9 rounded-lg bg-purple-400/10 flex items-center justify-center mb-3">
            <Users className="w-4.5 h-4.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats?.owners ?? 0}</div>
          <div className="text-sm text-muted-foreground">Owners</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-orange">
          <div className="w-9 h-9 rounded-lg bg-orange-400/10 flex items-center justify-center mb-3">
            <CreditCard className="w-4.5 h-4.5 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{pendingBills.length}</div>
          <div className="text-sm text-muted-foreground">Pending Bills</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-green">
          <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center mb-3">
            <BarChart3 className="w-4.5 h-4.5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{pendingInvites.length}</div>
          <div className="text-sm text-muted-foreground">Pending Invites</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Assigned Properties */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Assigned Properties</h3>
            <Link href="/associations" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="divide-y divide-border">
            {properties && properties.length > 0 ? properties.slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5 table-row-hover">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.city}, {p.state} · {p.unitCount} units</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "active" ? "bg-green-400/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {p.status}
                </span>
              </div>
            )) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No properties assigned</div>
            )}
          </div>
        </div>

        {/* Pending Bills + Invitations */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Bills Awaiting Approval</h3>
              <Link href="/accounting/payables" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
            </div>
            <div className="divide-y divide-border">
              {pendingBills.length > 0 ? pendingBills.slice(0, 4).map(b => (
                <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm text-foreground">{b.description ?? `Bill #${b.id}`}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(b.date), { addSuffix: true })}</p>
                  </div>
                  <span className="text-sm font-medium text-foreground">${Number(b.amount).toLocaleString()}</span>
                </div>
              )) : (
                <div className="px-4 py-4 text-center text-sm text-muted-foreground">No pending bills</div>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">My Invitations</h3>
              <Link href="/invitations" className="text-xs text-primary hover:underline flex items-center gap-1">Manage <ArrowRight className="w-3 h-3" /></Link>
            </div>
            <div className="divide-y divide-border">
              {pendingInvites.length > 0 ? pendingInvites.slice(0, 3).map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-2.5">
                  <p className="text-sm text-foreground">{inv.email}</p>
                  <span className={`role-badge role-${inv.role.replace(/_/g, "-")}`}>{inv.role.replace(/_/g, " ")}</span>
                </div>
              )) : (
                <div className="px-4 py-4 text-center text-sm text-muted-foreground">No pending invitations</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ThreePanelLayout>
  );
}
