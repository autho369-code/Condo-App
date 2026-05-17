import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Building2, Ticket, CalendarDays, Mail, Users, BarChart3,
  Briefcase, LogOut, Menu, X, ChevronRight, Shield, Home,
  MessageSquare,
} from "lucide-react";
import type { ReactNode } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  badgeKey?: "ownerMessages"; // extend if more badges needed
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Properties", href: "/dashboard/properties", icon: Building2, roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager"] },
  { label: "Work Tickets", href: "/dashboard/tickets", icon: Ticket, roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager", "accountant", "assistant_manager"] },
  { label: "Schedule", href: "/dashboard/schedule", icon: CalendarDays, roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager", "assistant_manager"] },
  { label: "Email Hub", href: "/dashboard/email", icon: Mail, roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager", "accountant", "assistant_manager"] },
  { label: "Owner Messages", href: "/dashboard/owner-messages", icon: MessageSquare, roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager", "assistant_manager"], badgeKey: "ownerMessages" },
  { label: "Meetings", href: "/dashboard/meetings", icon: Users, roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager"] },
  { label: "Vendors", href: "/dashboard/vendors", icon: Briefcase, roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager"] },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3, roles: ["super_admin", "company_admin", "portfolio_manager"] },
  { label: "Admin Panel", href: "/dashboard/admin", icon: Shield, roles: ["super_admin"] },
  { label: "Resident Portal", href: "/portal", icon: Home, roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager"] },
];

// ─── Unread badge hook ────────────────────────────────────────────────────────
function useOwnerMessageUnread(): number {
  const { user } = useAuth();
  const isManager = user?.portierRole && [
    "super_admin", "company_admin", "portfolio_manager",
    "property_manager", "assistant_manager",
  ].includes(user.portierRole);

  const { data } = trpc.documents.getTotalUnread.useQuery(undefined, {
    enabled: !!isManager,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return data?.count ?? 0;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout, loginUrl } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const ownerMsgUnread = useOwnerMessageUnread();

  const badges: Record<string, number> = {
    ownerMessages: ownerMsgUnread,
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-olive mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold text-charcoal mb-2">Sign in to Portier369</h2>
          <p className="text-muted-foreground mb-6">Access your property management dashboard.</p>
          <a href={loginUrl}><Button className="bg-olive text-cream hover:bg-olive/90">Sign In</Button></a>
        </div>
      </div>
    );
  }

  const role = user.portierRole ?? "user";
  const visibleNav = NAV_ITEMS.filter(item => !item.roles || item.roles.includes(role));

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-card border-r border-border w-64">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-olive" />
          <span className="font-serif text-lg font-semibold text-charcoal">Portier<span className="text-gold">369</span></span>
        </Link>
      </div>
      {/* User */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-olive/10 text-olive text-xs font-semibold">
              {(user.name ?? user.email ?? "U").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-charcoal truncate">{user.name ?? user.email ?? "User"}</p>
            <p className="text-xs text-muted-foreground capitalize">{role.replace(/_/g, " ")}</p>
          </div>
        </div>
      </div>
      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-0.5">
          {visibleNav.map(item => {
            const active = location === item.href;
            const badgeCount = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0;
            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <a
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? "bg-olive text-cream" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badgeCount > 0 && !active && (
                      <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                    {active && <ChevronRight className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                  </a>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* Logout */}
      <div className="p-3 border-t border-border">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 w-64">
            <Sidebar />
          </div>
        </div>
      )}
      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-serif text-base font-semibold text-charcoal">
            Portier<span className="text-gold">369</span>
          </span>
          <div className="w-5" />
        </div>
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
