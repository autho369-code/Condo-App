import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  Home,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Settings,
  Shield,
  Users,
  Wallet,
  Wrench,
  Activity,
  Bell,
  Search,
  Star,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";

// ─── ROLE LABELS ──────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  company_admin: "Company Admin",
  portfolio_manager: "Portfolio Manager",
  manager: "Manager",
  accountant: "Accountant",
  assistant: "Assistant",
  board_member: "Board Member",
  admin: "Admin",
  user: "User",
};

const ROLE_CSS: Record<string, string> = {
  super_admin: "role-super-admin",
  company_admin: "role-company-admin",
  portfolio_manager: "role-portfolio-manager",
  manager: "role-manager",
  accountant: "role-accountant",
  assistant: "role-assistant",
  board_member: "role-board-member",
};

// ─── NAV STRUCTURE ────────────────────────────────────────────────────────────
function getNavItems(role: string) {
  const isViewOnly = role === "board_member";
  const isSuperAdmin = role === "super_admin" || role === "admin";
  const isPortfolioMgr = role === "portfolio_manager";
  const isManager = ["manager", "accountant", "assistant"].includes(role);

  const items = [
    {
      section: "OVERVIEW",
      links: [
        { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
        { label: "Inbox", icon: Inbox, href: "/inbox" },
        { label: "Activity", icon: Activity, href: "/activity" },
      ],
    },
  ];

  if (isSuperAdmin) {
    items.push({
      section: "ADMIN",
      links: [
        { label: "Companies", icon: Building2, href: "/admin/companies" },
        { label: "All Users", icon: Users, href: "/admin/users" },
        { label: "Invitations", icon: Mail, href: "/admin/invitations" },
        { label: "All Properties", icon: Home, href: "/admin/properties" },
      ],
    });
  }

  if (!isViewOnly) {
    items.push({
      section: "BUILD",
      links: [
        { label: "Associations", icon: Building2, href: "/associations" },
        { label: "People", icon: Users, href: "/people" },
        ...(isManager || isSuperAdmin || isPortfolioMgr
          ? [{ label: "Invitations", icon: Mail, href: "/invitations" }]
          : []),
      ],
    });

    items.push({
      section: "ACCOUNTING",
      links: [
        { label: "Receivables", icon: Wallet, href: "/accounting/receivables" },
        { label: "Payables", icon: CreditCard, href: "/accounting/payables" },
        { label: "Bank Accounts", icon: BookOpen, href: "/accounting/bank-accounts" },
        { label: "Journal Entries", icon: FileText, href: "/accounting/journal-entries" },
        { label: "GL Accounts", icon: BarChart3, href: "/accounting/gl-accounts" },
        { label: "Diagnostics", icon: Wrench, href: "/accounting/diagnostics" },
      ],
    });
  }

  items.push({
    section: "REPORTING",
    links: [
      { label: "Reports", icon: BarChart3, href: "/reports" },
      { label: "Scheduled Reports", icon: Calendar, href: "/reports/scheduled" },
      { label: "Metrics", icon: Activity, href: "/reports/metrics" },
      ...(isViewOnly ? [] : [{ label: "Compliance", icon: Shield, href: "/reports/compliance" }]),
    ],
  });

  items.push({
    section: "TOOLS",
    links: [
      { label: "Search", icon: Search, href: "/search" },
      { label: "Settings", icon: Settings, href: "/settings" },
    ],
  });

  return items;
}

// ─── LEFT PANEL — SIDEBAR ─────────────────────────────────────────────────────
function LeftPanel({ role }: { role: string }) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const navItems = getNavItems(role);

  return (
    <div className="panel-left h-full flex flex-col">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Star className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Stellar PM</div>
            <div className="text-xs text-muted-foreground">Property Manager</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navItems.map((section) => (
          <div key={section.section} className="mb-4">
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground tracking-wider uppercase">
              {section.section}
            </div>
            {section.links.map((link) => {
              const isActive = location === link.href || location.startsWith(link.href + "/");
              return (
                <Link key={link.href} href={link.href}>
                  <a
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors mb-0.5 ${
                      isActive
                        ? "nav-item-active font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <link.icon className="w-4 h-4 flex-shrink-0" />
                    {link.label}
                  </a>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span className="text-xs text-muted-foreground">Systems operational</span>
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── RIGHT PANEL — RECENT ACTIVITY (last 24h) ─────────────────────────────────
function RightPanel() {
  const { data: activity, isLoading } = trpc.dashboard.recentActivity.useQuery({ hours: 24 });

  const ACTIVITY_ICONS: Record<string, string> = {
    transaction_created: "💳",
    report_run: "📊",
    invoice_processed: "📄",
    user_invited: "👤",
    property_updated: "🏢",
    bill_approved: "✅",
    diagnostic_resolved: "🔧",
    file_updated: "📝",
  };

  return (
    <div className="panel-right h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
          <Link href="/activity" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Last 24 hours</p>
      </div>

      {/* Activity feed */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-2 animate-pulse">
                <div className="w-8 h-8 rounded bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activity && activity.length > 0 ? (
          <div className="divide-y divide-border">
            {activity.map((item) => (
              <div key={item.id} className="px-4 py-3 hover:bg-accent/30 transition-colors">
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0 mt-0.5">
                    {ACTIVITY_ICONS[item.activityType] ?? "📌"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Activity className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">No activity in the last 24 hours</p>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="border-t border-sidebar-border p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Reports</p>
        <div className="space-y-1">
          {["Fund Income Statement", "Vendor Ledger", "Homeowner Delinquency"].map((r) => (
            <Link key={r} href="/reports" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5">
                <Star className="w-3 h-3 text-yellow-500" />
                {r}
              </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN LAYOUT ──────────────────────────────────────────────────────────────
interface ThreePanelLayoutProps {
  children: React.ReactNode;
  showRightPanel?: boolean;
  rightPanelContent?: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function ThreePanelLayout({
  children,
  showRightPanel = true,
  rightPanelContent,
  title,
  subtitle,
  actions,
}: ThreePanelLayoutProps) {
  const { user } = useAuth();
  const role = (user as any)?.role ?? "user";

  return (
    <div className={`three-panel-layout ${!showRightPanel ? "no-right-panel" : ""}`}>
      {/* Left: Sidebar */}
      <LeftPanel role={role} />

      {/* Center: Main content */}
      <div className="panel-center flex flex-col">
        {/* Top bar */}
        {(title || actions) && (
          <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
            <div>
              {title && <h1 className="text-lg font-semibold text-foreground">{title}</h1>}
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}
        <div className="flex-1 p-6">{children}</div>
      </div>

      {/* Right: Activity / contextual panel */}
      {showRightPanel && (rightPanelContent ?? <RightPanel />)}
    </div>
  );
}

export default ThreePanelLayout;
