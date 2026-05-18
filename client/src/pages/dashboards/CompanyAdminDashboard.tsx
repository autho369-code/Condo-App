import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { Briefcase, Plus, Mail, Home, LogOut, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function CompanyAdminDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const [sending, setSending] = useState(false);

  const invitesQuery = trpc.invitations.list.useQuery();
  const propertiesQuery = trpc.properties.list.useQuery();
  const sendInvite = trpc.invitations.create.useMutation({
    onSuccess: () => {
      toast.success("Portfolio Manager invitation sent");
      setEmail("");
      setSelectedPropertyIds([]);
      invitesQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    try {
      await sendInvite.mutateAsync({
        email,
        role: "portfolio_manager",
        propertyIds: selectedPropertyIds,
        origin: window.location.origin,
      });
    } finally {
      setSending(false);
    }
  };

  const toggleProperty = (id: number) => {
    setSelectedPropertyIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const invites = invitesQuery.data ?? [];
  const pmInvites = invites.filter((i: any) => i.role === "portfolio_manager");
  const properties = propertiesQuery.data ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-foreground">Stellar PM</span>
          <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">Company Admin</span>
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
            <div className="text-2xl font-bold text-foreground">{properties.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Properties</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-2xl font-bold text-green-400">
              {pmInvites.filter((i: any) => i.acceptedAt).length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Active Portfolio Managers</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-2xl font-bold text-yellow-400">
              {pmInvites.filter((i: any) => !i.acceptedAt).length}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Pending Invitations</div>
          </div>
        </div>

        {/* Invite form */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-5">
            <Plus className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-foreground">Invite a Portfolio Manager</h2>
          </div>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Portfolio Manager Email</label>
              <div className="flex items-center gap-2 bg-input border border-border rounded-lg px-3 py-2.5">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pm@company.com"
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
                  required
                />
              </div>
            </div>

            {/* Property assignment */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                Assign Properties <span className="text-muted-foreground/60">(select all that apply)</span>
              </label>
              {properties.length === 0 ? (
                <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-3">
                  No properties available. Contact Super Admin to add properties.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {properties.map((p: any) => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedPropertyIds.includes(p.id)
                          ? "border-primary bg-primary/10"
                          : "border-border bg-input hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPropertyIds.includes(p.id)}
                        onChange={() => toggleProperty(p.id)}
                        className="hidden"
                      />
                      <Home className={`w-3.5 h-3.5 flex-shrink-0 ${selectedPropertyIds.includes(p.id) ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs truncate ${selectedPropertyIds.includes(p.id) ? "text-foreground" : "text-muted-foreground"}`}>
                        {p.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={sending || !email}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "Sending Invitation..." : "Send Portfolio Manager Invitation"}
            </button>
          </form>
        </div>

        {/* Invitations list */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Portfolio Manager Invitations</h2>
          </div>
          {pmInvites.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No invitations sent yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pmInvites.map((inv: any) => (
                <div key={inv.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">{inv.email}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {inv.propertyIds?.length
                        ? `${inv.propertyIds.length} propert${inv.propertyIds.length === 1 ? "y" : "ies"} assigned`
                        : "No properties assigned"}
                    </div>
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
