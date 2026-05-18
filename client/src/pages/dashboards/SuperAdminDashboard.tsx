import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Plus, Mail, Building2, LogOut, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [sending, setSending] = useState(false);

  const invitesQuery = trpc.invitations.list.useQuery();
  const sendInvite = trpc.invitations.create.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent to Company Admin");
      setEmail("");
      setCompanyName("");
      invitesQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !companyName) return;
    setSending(true);
    try {
      await sendInvite.mutateAsync({
        email,
        role: "company_admin",
        origin: window.location.origin,
      });
    } finally {
      setSending(false);
    }
  };

  const invites = invitesQuery.data ?? [];
  const companyAdminInvites = invites.filter((i: any) => i.role === "company_admin");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Stellar PM</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Super Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">{user?.name ?? user?.email}</span>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-12">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-2xl font-bold text-foreground">{companyAdminInvites.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Companies Invited</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-2xl font-bold text-green-400">
              {companyAdminInvites.filter((i: any) => i.acceptedAt).length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Active Companies</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-2xl font-bold text-yellow-400">
              {companyAdminInvites.filter((i: any) => !i.acceptedAt).length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Pending Invitations</div>
          </div>
        </div>

        {/* Invite form */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-5">
            <Plus className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Invite a New Company</h2>
          </div>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Company Name</label>
              <div className="flex items-center gap-2 bg-input border border-border rounded-lg px-3 py-2.5">
                <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Stellar Property Group"
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Company Admin Email</label>
              <div className="flex items-center gap-2 bg-input border border-border rounded-lg px-3 py-2.5">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={sending || !email || !companyName}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "Sending Invitation..." : "Send Company Admin Invitation"}
            </button>
          </form>
        </div>

        {/* Invitations list */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Company Invitations</h2>
          </div>
          {companyAdminInvites.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No invitations sent yet. Invite your first company above.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {companyAdminInvites.map((inv: any) => (
                <div key={inv.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">{(inv as any).companyName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{inv.email}</div>
                  </div>
                  <div>
                    {inv.acceptedAt ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : inv.expiresAt && new Date(inv.expiresAt) < new Date() ? (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <XCircle className="w-3.5 h-3.5" /> Expired
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-yellow-400">
                        <Clock className="w-3.5 h-3.5" /> Pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
