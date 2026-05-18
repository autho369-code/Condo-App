import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect } from "react";

// Pages
import Home from "./pages/Home";
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import PortfolioManagerDashboard from "./pages/dashboards/PortfolioManagerDashboard";
import ManagerDashboard from "./pages/dashboards/ManagerDashboard";
import BoardMemberDashboard from "./pages/dashboards/BoardMemberDashboard";
import AssociationsPage from "./pages/associations/AssociationsPage";
import PeoplePage from "./pages/people/PeoplePage";
import InvitationsPage from "./pages/invitations/InvitationsPage";
import AcceptInvitePage from "./pages/invitations/AcceptInvitePage";
import ReceivablesPage from "./pages/accounting/ReceivablesPage";
import PayablesPage from "./pages/accounting/PayablesPage";
import BankAccountsPage from "./pages/accounting/BankAccountsPage";
import JournalEntriesPage from "./pages/accounting/JournalEntriesPage";
import GlAccountsPage from "./pages/accounting/GlAccountsPage";
import DiagnosticsPage from "./pages/accounting/DiagnosticsPage";
import ReportsPage from "./pages/reports/ReportsPage";
import ScheduledReportsPage from "./pages/reports/ScheduledReportsPage";
import MetricsPage from "./pages/reports/MetricsPage";
import CompliancePage from "./pages/reports/CompliancePage";
import AdminCompaniesPage from "./pages/admin/AdminCompaniesPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminPropertiesPage from "./pages/admin/AdminPropertiesPage";
import ActivityPage from "./pages/ActivityPage";
import InboxPage from "./pages/InboxPage";
import SearchPage from "./pages/SearchPage";
import SettingsPage from "./pages/SettingsPage";

// Role → dashboard route mapping
const ROLE_DASHBOARDS: Record<string, string> = {
  super_admin: "/dashboard/super-admin",
  admin: "/dashboard/super-admin",
  company_admin: "/dashboard/super-admin",
  portfolio_manager: "/dashboard/portfolio-manager",
  manager: "/dashboard/manager",
  accountant: "/dashboard/manager",
  assistant: "/dashboard/manager",
  board_member: "/dashboard/board-member",
};

function RoleRedirect() {
  // Check if user clicked a specific role login button
  const savedPath = sessionStorage.getItem('loginReturnPath');
  if (savedPath) {
    sessionStorage.removeItem('loginReturnPath');
    return <Redirect to={savedPath} />;
  }
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      const role = (user as any).role ?? "user";
      const dest = ROLE_DASHBOARDS[role] ?? "/dashboard/manager";
      navigate(dest);
    }
  }, [user, loading, isAuthenticated]);

  return null;
}

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />
      <Route path="/invite/accept" component={AcceptInvitePage} />

      {/* Role redirect */}
      <Route path="/dashboard" component={RoleRedirect} />

      {/* Role-specific dashboards */}
      <Route path="/dashboard/super-admin" component={SuperAdminDashboard} />
      <Route path="/dashboard/portfolio-manager" component={PortfolioManagerDashboard} />
      <Route path="/dashboard/manager" component={ManagerDashboard} />
      <Route path="/dashboard/board-member" component={BoardMemberDashboard} />

      {/* Admin */}
      <Route path="/admin/companies" component={AdminCompaniesPage} />
      <Route path="/admin/users" component={AdminUsersPage} />
      <Route path="/admin/invitations" component={InvitationsPage} />
      <Route path="/admin/properties" component={AdminPropertiesPage} />

      {/* Core modules */}
      <Route path="/associations" component={AssociationsPage} />
      <Route path="/people" component={PeoplePage} />
      <Route path="/invitations" component={InvitationsPage} />

      {/* Accounting */}
      <Route path="/accounting/receivables" component={ReceivablesPage} />
      <Route path="/accounting/payables" component={PayablesPage} />
      <Route path="/accounting/bank-accounts" component={BankAccountsPage} />
      <Route path="/accounting/journal-entries" component={JournalEntriesPage} />
      <Route path="/accounting/gl-accounts" component={GlAccountsPage} />
      <Route path="/accounting/diagnostics" component={DiagnosticsPage} />

      {/* Reports */}
      <Route path="/reports" component={ReportsPage} />
      <Route path="/reports/scheduled" component={ScheduledReportsPage} />
      <Route path="/reports/metrics" component={MetricsPage} />
      <Route path="/reports/compliance" component={CompliancePage} />

      {/* Misc */}
      <Route path="/activity" component={ActivityPage} />
      <Route path="/inbox" component={InboxPage} />
      <Route path="/search" component={SearchPage} />
      <Route path="/settings" component={SettingsPage} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
