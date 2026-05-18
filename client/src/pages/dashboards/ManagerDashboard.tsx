import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Building2, Users, CreditCard, Package, ArrowRight, CheckCircle, Clock, Star, Mail, Plus } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  accountant: "Accountant",
  assistant: "Assistant",
};

export default function ManagerDashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const role = (user as any)?.role ?? "manager";

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/");
  }, [loading, isAuthenticated]);

  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: bills } = trpc.accounting.bills.useQuery({ status: "pending" });
  const { data: properties } = trpc.properties.list.useQuery();
  const approveBill = trpc.accounting.approveBill.useMutation({
    onSuccess: () => toast.success("Bill approved"),
    onError: (e) => toast.error(e.message),
  });

  const pendingBills = bills ?? [];

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const canApprove = ["manager", "accountant", "assistant"].includes(role);

  return (
    <ThreePanelLayout
      title={`${ROLE_LABELS[role] ?? "Manager"} Dashboard`}
      subtitle="Your associations at a glance"
      actions={
        <div className="flex gap-2">
          <Link href="/invitations" className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Mail className="w-3.5 h-3.5" /> Invite
            </Link>
        </div>
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
            <Package className="w-4.5 h-4.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats?.vendors ?? 0}</div>
          <div className="text-sm text-muted-foreground">Vendors</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-green">
          <div className="w-9 h-9 rounded-lg bg-green-400/10 flex items-center justify-center mb-3">
            <Users className="w-4.5 h-4.5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats?.owners ?? 0}</div>
          <div className="text-sm text-muted-foreground">Owners</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 stat-accent-orange">
          <div className="w-9 h-9 rounded-lg bg-orange-400/10 flex items-center justify-center mb-3">
            <CreditCard className="w-4.5 h-4.5 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats?.openBills ?? 0}</div>
          <div className="text-sm text-muted-foreground">Open Bills</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-6">
        <Link href="/accounting/payables" className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Bill
          </Link>
        <Link href="/accounting/receivables" className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Receipt
          </Link>
        <Link href="/reports" className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
            <ArrowRight className="w-3.5 h-3.5" /> Run Report
          </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Payables Approval Queue */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Payables Approval Queue</h3>
              <p className="text-xs text-muted-foreground">{pendingBills.length} pending</p>
            </div>
            <Link href="/accounting/payables" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="divide-y divide-border">
            {pendingBills.length > 0 ? pendingBills.slice(0, 6).map(b => (
              <div key={b.id} className="flex items-center justify-between px-4 py-2.5 table-row-hover">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-foreground">{b.description ?? `Bill #${b.id}`}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(b.date), { addSuffix: true })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">${Number(b.amount).toLocaleString()}</span>
                  {canApprove && (
                    <button
                      onClick={() => approveBill.mutate({ id: b.id })}
                      disabled={approveBill.isPending}
                      className="flex items-center gap-1 text-xs bg-green-400/10 text-green-400 hover:bg-green-400/20 px-2 py-1 rounded transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" /> Approve
                    </button>
                  )}
                </div>
              </div>
            )) : (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-green-400">
                <CheckCircle className="w-4 h-4" /> Queue is clear
              </div>
            )}
          </div>
        </div>

        {/* Quick Report Links + Associations */}
        <div className="space-y-4">
          {/* Favorite Reports */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Favorite Reports</h3>
              <Link href="/reports" className="text-xs text-primary hover:underline flex items-center gap-1">All reports <ArrowRight className="w-3 h-3" /></Link>
            </div>
            <div className="p-3 space-y-1">
              {[
                "Association Work Order",
                "Homeowner Delinquency",
                "Vendor Ledger",
                "Fund Income Statement",
                "Vendor 1099 Detail",
              ].map(r => (
                <Link key={r} href="/reports" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/30 transition-colors">
                    <Star className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                    <span className="text-sm text-foreground">{r}</span>
                  </Link>
              ))}
            </div>
          </div>

          {/* Associations list */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Associations</h3>
              <Link href="/associations" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
            </div>
            <div className="divide-y divide-border">
              {properties && properties.length > 0 ? properties.slice(0, 4).map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5 table-row-hover">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.city}, {p.state}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{p.unitCount} units</span>
                </div>
              )) : (
                <div className="px-4 py-4 text-center text-sm text-muted-foreground">No associations</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ThreePanelLayout>
  );
}
