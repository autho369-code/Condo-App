import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Building2, Ticket, CalendarDays, Mail, Users, BarChart3,
  Briefcase, LogOut, Menu, X, ChevronRight, Shield, Home,
  MessageSquare, CheckSquare, Plus, FileText, DollarSign,
  Bell, Settings, CreditCard, Upload, Eye, LayoutList,
} from "lucide-react";
import type { ReactNode } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  badgeKey?: "ownerMessages";
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

// ─── Task panel sections ──────────────────────────────────────────────────────
interface TaskAction {
  label: string;
  href: string;
  icon: React.ElementType;
}
interface TaskSection {
  heading: string;
  roles?: string[];
  actions: TaskAction[];
}

const TASK_SECTIONS: TaskSection[] = [
  {
    heading: "QUICK ACTIONS",
    actions: [
      { label: "Open work orders", href: "/dashboard/tickets", icon: Ticket },
      { label: "Schedule hearing", href: "/dashboard/schedule", icon: CalendarDays },
      { label: "Send email blast", href: "/dashboard/email", icon: Mail },
      { label: "View meetings", href: "/dashboard/meetings", icon: Users },
    ],
  },
  {
    heading: "OWNER COMMUNICATIONS",
    roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager", "assistant_manager"],
    actions: [
      { label: "View owner messages", href: "/dashboard/owner-messages", icon: MessageSquare },
      { label: "Owner portal", href: "/portal", icon: Eye },
    ],
  },
  {
    heading: "PROPERTIES & DOCUMENTS",
    roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager"],
    actions: [
      { label: "Manage properties", href: "/dashboard/properties", icon: Building2 },
      { label: "Upload document", href: "/dashboard/properties", icon: Upload },
      { label: "View all documents", href: "/dashboard/properties", icon: FileText },
    ],
  },
  {
    heading: "WORK ORDERS",
    roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager", "accountant", "assistant_manager"],
    actions: [
      { label: "All tickets", href: "/dashboard/tickets", icon: LayoutList },
      { label: "Urgent tickets", href: "/dashboard/tickets", icon: Ticket },
      { label: "Manage vendors", href: "/dashboard/vendors", icon: Briefcase },
    ],
  },
  {
    heading: "ACCOUNTING",
    roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager", "accountant"],
    actions: [
      { label: "Post charge", href: "/dashboard/properties", icon: Plus },
      { label: "Record credit", href: "/dashboard/properties", icon: CreditCard },
      { label: "Payment history", href: "/dashboard/properties", icon: DollarSign },
    ],
  },
  {
    heading: "REPORTS & ANALYTICS",
    roles: ["super_admin", "company_admin", "portfolio_manager"],
    actions: [
      { label: "View analytics", href: "/dashboard/analytics", icon: BarChart3 },
    ],
  },
  {
    heading: "NOTIFICATIONS",
    roles: ["super_admin", "company_admin", "portfolio_manager", "property_manager", "assistant_manager"],
    actions: [
      { label: "Notification history", href: "/dashboard/owner-messages", icon: Bell },
      { label: "Settings", href: "/dashboard/properties", icon: Settings },
    ],
  },
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

// ─── Tasks Panel ──────────────────────────────────────────────────────────────
function TasksPanel({ role, onClose }: { role: string; onClose?: () => void }) {
  const [, navigate] = useLocation();

  const visibleSections = TASK_SECTIONS.filter(
    s => !s.roles || s.roles.includes(role)
  );

  return (
    <aside className="flex flex-col h-full bg-card border-l border-border w-56 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-olive" />
          <span className="font-semibold text-sm text-charcoal tracking-wide">Tasks</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto py-2">
        {visibleSections.map(section => (
          <div key={section.heading} className="mb-1">
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              {section.heading}
            </p>
            <ul>
              {section.actions.map(action => (
                <li key={action.label}>
                  <button
                    onClick={() => navigate(action.href)}
                    className="w-full flex items-center gap-2.5 px-4 py-1.5 text-sm text-foreground hover:bg-muted hover:text-charcoal transition-colors text-left"
                  >
                    <action.icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{action.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout, loginUrl } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(true);
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

  // Show Tasks panel only for managers
  const showTasks = [
    "super_admin", "company_admin", "portfolio_manager",
    "property_manager", "accountant", "assistant_manager",
  ].includes(role);

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-card border-r border-border w-56">
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
          <div className="relative z-10 w-56">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-serif text-base font-semibold text-charcoal">
            Portier<span className="text-gold">369</span>
          </span>
          {showTasks && (
            <button onClick={() => setTasksOpen(o => !o)} className="text-muted-foreground">
              <CheckSquare className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content + right Tasks panel */}
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-hidden min-w-0">
            {children}
          </main>

          {/* Desktop Tasks panel */}
          {showTasks && tasksOpen && (
            <div className="hidden md:flex">
              <TasksPanel role={role} onClose={() => setTasksOpen(false)} />
            </div>
          )}

          {/* Mobile Tasks panel overlay */}
          {showTasks && tasksOpen && (
            <div className="md:hidden fixed inset-y-0 right-0 z-40 flex">
              <div className="fixed inset-0 bg-black/30" onClick={() => setTasksOpen(false)} />
              <div className="relative z-10 ml-auto">
                <TasksPanel role={role} onClose={() => setTasksOpen(false)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tasks toggle button (when panel is closed) */}
      {showTasks && !tasksOpen && (
        <button
          onClick={() => setTasksOpen(true)}
          className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 items-center gap-1.5 bg-card border border-border border-r-0 rounded-l-lg px-2 py-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
          title="Open Tasks panel"
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] tracking-wide">Tasks</span>
        </button>
      )}
    </div>
  );
}
