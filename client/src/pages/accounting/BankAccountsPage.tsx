import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { Plus, CreditCard, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function BankAccountsPage() {
  const { data: accounts, isLoading } = trpc.accounting.bankAccounts.useQuery();

  return (
    <ThreePanelLayout
      title="Bank Accounts"
      subtitle="Manage operating and reserve bank accounts"
      actions={
        <button className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Account
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-3" />
              <div className="h-6 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          ))
        ) : accounts && accounts.length > 0 ? accounts.map(a => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full status-approved">
                Active
              </span>
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">{a.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{a.bankName} · ****{a.accountNumberLast4}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Account Type</p>
                <p className="text-foreground capitalize">Operating</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Reconciled</p>
                <p className="text-foreground">
                  {a.lastReconciliation ? format(new Date(a.lastReconciliation), "MM/dd/yyyy") : "Never"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Online Payments</p>
                <p className="text-foreground">{a.paymentsEnabled ? "Enabled" : "Disabled"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Auto-Reconcile</p>
                <p className="text-foreground">{a.autoReconciliation ? "On" : "Off"}</p>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-2 bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
            No bank accounts configured
          </div>
        )}
      </div>
    </ThreePanelLayout>
  );
}
