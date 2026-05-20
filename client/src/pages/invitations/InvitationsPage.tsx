import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Mail, Plus, Copy, CheckCircle, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const INVITABLE_ROLES: Record<string, string[]> = {
  super_admin: ["company_admin", "portfolio_manager"],
  admin: ["company_admin", "portfolio_manager"],
  company_admin: ["portfolio_manager"],
  portfolio_manager: ["manager"],
  manager: ["accountant", "assistant", "board_member"],
  accountant: [],
  assistant: [],
  board_member: [],
};

const ROLE_LABELS: Record<string, string> = {
  company_admin: "Company Admin",
  portfolio_manager: "Portfolio Manager",
  manager: "Manager",
  accountant: "Accountant",
  assistant: "Assistant",
  board_member: "Board Member",
};

export default function InvitationsPage() {
  const { user } = useAuth();
  const role = (user as any)?.role ?? "manager";
  const invitableRoles = INVITABLE_ROLES[role] ?? [];

  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState(invitableRoles[0] ?? "");
  const [propertyIds, setPropertyIds] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: invitations, isLoading, refetch } = trpc.invitations.list.useQuery();
  const { data: properties } = trpc.properties.list.useQuery();

  const sendInvite = trpc.invitations.send.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent!");
      setEmail("");
      setPropertyIds("");
      setShowForm(false);
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const needsPropertyAssignment = ["portfolio_manager", "manager"].includes(selectedRole);

  return (
    <ThreePanelLayout
      title="Invitations"
      subtitle="Manage user invitations and access assignments"
      actions={
        invitableRoles.length > 0 && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Send Invitation
          </button>
        )
      }
    >
      {/* Invite form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">New Invitation</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Role *</label>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {invitableRoles.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>
          {needsPropertyAssignment && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Assign Properties * <span className="text-muted-foreground font-normal">(select properties to grant access)</span>
              </label>
              <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 bg-background border border-border rounded-lg">
                {(properties ?? []).map(p => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={propertyIds.split(",").includes(String(p.id))}
                      onChange={e => {
                        const ids = propertyIds ? propertyIds.split(",").filter(Boolean) : [];
                        if (e.target.checked) ids.push(String(p.id));
                        else ids.splice(ids.indexOf(String(p.id)), 1);
                        setPropertyIds(ids.join(","));
                      }}
                      className="rounded border-border"
                    />
                    <span className="text-xs text-foreground">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => sendInvite.mutate({
                email,
                role: selectedRole as any,
                assignedPropertyIds: propertyIds ? propertyIds.split(",").map(Number) : undefined,
                origin: window.location.origin,
              })}
              disabled={!email || sendInvite.isPending}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Mail className="w-3.5 h-3.5" />
              {sendInvite.isPending ? "Sending..." : "Send Invitation"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Invitations table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Properties</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sent</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expires</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : invitations && invitations.length > 0 ? invitations.map(inv => (
              <tr key={inv.id} className="table-row-hover">
                <td className="px-4 py-3 text-sm text-foreground">{inv.email}</td>
                <td className="px-4 py-3">
                  <span className={`role-badge role-${inv.role.replace(/_/g, "-")}`}>
                    {ROLE_LABELS[inv.role] ?? inv.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {(inv as any).assignedPropertyIds ? `${((inv as any).assignedPropertyIds as number[]).length} properties` : "All"}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {format(new Date(inv.createdAt), "MM/dd/yyyy")}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {inv.expiresAt ? format(new Date(inv.expiresAt), "MM/dd/yyyy") : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit ${
                    inv.status === "accepted" ? "status-approved" :
                    inv.status === "pending" ? "status-pending" :
                    "status-void"
                  }`}>
                    {inv.status === "accepted" ? <CheckCircle className="w-3 h-3" /> :
                     inv.status === "pending" ? <Clock className="w-3 h-3" /> :
                     <XCircle className="w-3 h-3" />}
                    {inv.status}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">No invitations sent yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ThreePanelLayout>
  );
}
