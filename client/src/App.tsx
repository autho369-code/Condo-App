import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import Schedule from "./pages/Schedule";
import EmailHub from "./pages/EmailHub";
import Meetings from "./pages/Meetings";
import Vendors from "./pages/Vendors";
import Properties from "./pages/Properties";
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";
import ResidentPortal from "./pages/ResidentPortal";
import OwnerMessages from "./pages/OwnerMessages";
import Login from "./pages/Login";
import SuperAdminLogin from "./pages/SuperAdminLogin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/tickets" component={Tickets} />
      <Route path="/dashboard/schedule" component={Schedule} />
      <Route path="/dashboard/email" component={EmailHub} />
      <Route path="/dashboard/meetings" component={Meetings} />
      <Route path="/dashboard/vendors" component={Vendors} />
      <Route path="/dashboard/properties" component={Properties} />
      <Route path="/dashboard/admin" component={AdminPanel} />
      <Route path="/portal" component={ResidentPortal} />
      <Route path="/dashboard/owner-messages" component={OwnerMessages} />
      <Route path="/login" component={Login} />
      <Route path="/sa-access" component={SuperAdminLogin} />
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
