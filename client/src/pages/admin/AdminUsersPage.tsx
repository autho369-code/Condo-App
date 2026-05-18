import { ThreePanelLayout } from "@/components/ThreePanelLayout";
import { trpc } from "@/lib/trpc";
import { Users, Search } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin", admin: "Admin", company_admin: "Company Admin",
  portfolio_manager: "Portfolio Manager", manager: "Manager",
  accountant: "Accountant", assistant: "Assistant", board_member: "Board Member", user: "User",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "role-super-admin", admin: "role-super-admin",
  company_admin: "role-company-admin", portfolio_manager: "role-portfolio-manager",
  manager: "role-manager", accountant: "role-accountant",
  assistant: "role-assistant", board_member: "role-board-member",
  user: "role-board-member",
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const { data: users, isLoading } = trpc.admin.users.useQuery({ search });

  return (
    <ThreePanelLayout title="Users" subtitle="All users across the system">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Properties</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Sign In</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : users && users.length > 0 ? users.map(u => (
              <tr key={u.id} className="table-row-hover">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {(u.name?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{u.email ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{(u as any).companyName ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-foreground">{(u as any).propertyCount ?? "All"}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {u.lastSignedIn ? format(new Date(u.lastSignedIn), "MM/dd/yyyy") : "Never"}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ThreePanelLayout>
  );
}
