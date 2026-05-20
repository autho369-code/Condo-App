import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import {
  Building2, Users, Shield, Mail, ArrowRight,
  Plus, Settings, BarChart3, CheckCircle,
} from "lucide-react";
import { format } from "date-fns";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", admin: "Admin", company_admin: "Company Admin",
  portfolio_manager: "Portfolio Mgr", manager: "Manager",
  accountant: "Accountant", assistant: "Assistant", board_member: "Board Member", user: "User",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "role-super-admin", admin: "role-super-admin",
  company_admin: "role-company-admin", portfolio_manager: "role-portfolio-manager",
  manager: "role-manager", accountant: "role-accountant",
  assistant: "role-assistant", board_member: "role-board-member",
  user: "role-board-member",
};

export default function SuperAdminDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/");
  }, [loading, isAuthenticated]);

  const { data: users } = trpc.admin.users.useQuery({});
  const { data: companies } = trpc.admin.companies.useQuery();
  const { data: properties } = trpc.admin.properties.useQuery();
  const { data: invitations } = trpc.invitations.list.useQuery();

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const recentUsers = (users ?? []).slice(0, 6);
  const pendingInvites = (invitations ?? []).filter((i: any) => i.status === "pending");

  return (
    <ThreePanelLayout
      title="Super Admin Dashboard"
      subtitle="System-wide overview — Portier369"
      actions={
        <div className="flex gap-2">
          <Link href="/invitations" className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Mail className="w-3.5 h-3.5" /> Invite User
          </Link>
          <Link href="/admin/companies" className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Company
          </Link>
        </div>
      }
    >
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-blue">
          <div className="w-9 h-9 rounded-lg stat-icon-blue flex items-center justify-center mb-3">
            <Building2 className="w-4.5 h-4.5" style={{ color: '#3a5a7a' }} />
          </div>
          <div className="text-2xl font-bold text-foreground">{properties?.length ?? 0}</div>
          <div className="text-sm text-muted-foreground">Associations</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-purple">
          <div className="w-9 h-9 rounded-lg stat-icon-purple flex items-center justify-center mb-3">
            <Users className="w-4.5 h-4.5" style={{ color: '#5a4a7a' }} />
          </div>
          <div className="text-2xl font-bold text-foreground">{users?.length ?? 0}</div>
          <div className="text-sm text-muted-foreground">Users</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-green">
          <div className="w-9 h-9 rounded-lg stat-icon-green flex items-center justify-center mb-3">
            <Shield className="w-4.5 h-4.5" style={{ color: '#2d4a2d' }} />
          </div>
          <div className="text-2xl font-bold text-foreground">{companies?.length ?? 0}</div>
          <div className="text-sm text-muted-foreground">Companies</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-orange">
          <div className="w-9 h-9 rounded-lg stat-icon-orange flex items-center justify-center mb-3">
            <Mail className="w-4.5 h-4.5" style={{ color: '#7a4a1a' }} />
          </div>
          <div className="text-2xl font-bold text-foreground">{pendingInvites.length}</div>
          <div className="text-sm text-muted-foreground">Pending Invites</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-6">
        <Link href="/admin/users" className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
          <Users className="w-3.5 h-3.5" /> Manage Users
        </Link>
        <Link href="/admin/companies" className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
          <Building2 className="w-3.5 h-3.5" /> Companies
        </Link>
        <Link href="/admin/properties" className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
          <Settings className="w-3.5 h-3.5" /> Properties
        </Link>
        <Link href="/reports" className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
          <BarChart3 className="w-3.5 h-3.5" /> Reports
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Recent Users */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Recent Users</h3>
              <p className="text-xs text-muted-foreground">{users?.length ?? 0} total</p>
            </div>
            <Link href="/admin/users" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentUsers.length > 0 ? recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-2.5 table-row-hover">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {(u.name?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{u.email ?? "—"}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"}`}>
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
              </div>
            )) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No users yet</div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Companies */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Companies</h3>
              <Link href="/admin/companies" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {companies && companies.length > 0 ? companies.slice(0, 4).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-2.5 table-row-hover">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.code}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.isActive ? 'badge-active' : 'badge-inactive'}`}>
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              )) : (
                <div className="px-4 py-4 text-center text-sm text-muted-foreground">No companies yet</div>
              )}
            </div>
          </div>

          {/* Pending Invitations */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Pending Invitations</h3>
              <Link href="/invitations" className="text-xs text-primary hover:underline flex items-center gap-1">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {pendingInvites.length > 0 ? pendingInvites.slice(0, 4).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-2.5 table-row-hover">
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABELS[inv.role] ?? inv.role} · Expires {format(new Date(inv.expiresAt), "MM/dd")}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full badge-pending">Pending</span>
                </div>
              )) : (
                <div className="flex items-center justify-center gap-2 px-4 py-4 text-sm" style={{ color: '#2d4a2d' }}>
                  <CheckCircle className="w-4 h-4" /> No pending invites
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ThreePanelLayout>
  );
}
