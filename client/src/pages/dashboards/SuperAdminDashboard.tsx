import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import {
  Building2, Users, Mail, AlertTriangle, Plus, ArrowRight,
  CheckCircle, Home
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function StatCard({ title, value, icon: Icon, accent, delta }: {
  title: string; value: number | string; icon: any; accent: string; delta?: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-xl p-5 ${accent}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-muted-foreground" />
        </div>
        {delta && (
          <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">{delta}</span>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-0.5">{title}</div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/");
  }, [loading, isAuthenticated]);

  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: companies } = trpc.companies.list.useQuery();
  const { data: allUsers } = trpc.users.list.useQuery();
  const { data: invitations } = trpc.invitations.list.useQuery();
  const { data: diagnostics } = trpc.accounting.diagnostics.useQuery();
  const { data: properties } = trpc.properties.list.useQuery();

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const pendingInvites = invitations?.filter(i => i.status === "pending") ?? [];
  const criticalFlags = diagnostics?.filter(d => d.severity === "critical" || d.severity === "high") ?? [];

  return (
    <ThreePanelLayout
      title="Super Admin Dashboard"
      subtitle="System-wide overview — all companies, properties, and users"
      actions={
        <div className="flex gap-2">
          <Link
            href="/admin/companies"
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Company
          </Link>
          <Link
            href="/admin/invitations"
            className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Invite User
          </Link>
        </div>
      }
    >
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard title="Companies" value={companies?.length ?? 0} icon={Building2} accent="stat-accent-blue" delta="+1 this week" />
        <StatCard title="Properties" value={properties?.length ?? 0} icon={Home} accent="stat-accent-purple" delta="+2 today" />
        <StatCard title="Total Users" value={allUsers?.length ?? 0} icon={Users} accent="stat-accent-green" />
        <StatCard title="Open Diagnostics" value={criticalFlags.length} icon={AlertTriangle} accent="stat-accent-red" />
      </div>

      {/* Two-column middle section */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Companies */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Companies</h3>
            <Link href="/admin/companies" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {companies && companies.length > 0 ? companies.slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2.5 table-row-hover">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.code}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.isActive ? "bg-green-400/10 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {c.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            )) : (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No companies yet</div>
            )}
          </div>
        </div>

        {/* Users by role */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Users by Role</h3>
            <Link href="/admin/users" className="text-xs text-primary hover:underline flex items-center gap-1">
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 space-y-2">
            {[
              { role: "super_admin", label: "Super Admin", css: "role-super-admin" },
              { role: "company_admin", label: "Company Admin", css: "role-company-admin" },
              { role: "portfolio_manager", label: "Portfolio Manager", css: "role-portfolio-manager" },
              { role: "manager", label: "Manager", css: "role-manager" },
              { role: "accountant", label: "Accountant", css: "role-accountant" },
              { role: "assistant", label: "Assistant", css: "role-assistant" },
              { role: "board_member", label: "Board Member", css: "role-board-member" },
            ].map(r => {
              const count = allUsers?.filter(u => u.role === r.role).length ?? 0;
              return (
                <div key={r.role} className="flex items-center justify-between">
                  <span className={`role-badge ${r.css}`}>{r.label}</span>
                  <span className="text-sm font-medium text-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pending Invitations */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Pending Invitations</h3>
            <Link href="/admin/invitations" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {pendingInvites.length > 0 ? pendingInvites.slice(0, 5).map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm text-foreground">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(inv.createdAt), { addSuffix: true })}</p>
                </div>
                <span className={`role-badge role-${inv.role.replace("_", "-")}`}>{inv.role.replace("_", " ")}</span>
              </div>
            )) : (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No pending invitations</div>
            )}
          </div>
        </div>

        {/* Diagnostic Flags */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">System Diagnostics</h3>
            <Link href="/accounting/diagnostics" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {diagnostics && diagnostics.length > 0 ? diagnostics.slice(0, 5).map(d => (
              <div key={d.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${
                    d.severity === "critical" ? "text-red-400" :
                    d.severity === "high" ? "text-orange-400" :
                    d.severity === "medium" ? "text-yellow-400" : "text-muted-foreground"
                  }`} />
                  <div>
                    <p className="text-sm text-foreground">{d.flagType}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(d.detectedAt), { addSuffix: true })}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                  d.severity === "critical" ? "bg-red-400/10 text-red-400" :
                  d.severity === "high" ? "bg-orange-400/10 text-orange-400" :
                  "bg-yellow-400/10 text-yellow-400"
                }`}>{d.severity}</span>
              </div>
            )) : (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-green-400">
                <CheckCircle className="w-4 h-4" /> All systems healthy
              </div>
            )}
          </div>
        </div>
      </div>
    </ThreePanelLayout>
  );
}
