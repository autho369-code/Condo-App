import { useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2, Ticket, Users, Briefcase, BarChart3, Shield,
  ArrowRight, TrendingUp, AlertCircle
} from "lucide-react";
import { Link, useLocation } from "wouter";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" as const } }),
};

function SuperAdminDashboard() {
  const { data: stats } = trpc.admin.platformStats.useQuery();
  const { data: companies } = trpc.admin.allCompanies.useQuery();

  return (
    <div>
      <div className="mb-8">
        <Badge className="bg-red-100 text-red-700 border-red-200 mb-2">Super Admin</Badge>
        <h1 className="font-serif text-3xl font-bold text-charcoal">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">Full visibility across all companies and properties.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Companies", value: stats?.companies ?? 0, icon: Building2, color: "text-blue-600 bg-blue-50" },
          { label: "Properties", value: stats?.properties ?? 0, icon: Building2, color: "text-emerald-600 bg-emerald-50" },
          { label: "Total Users", value: stats?.users ?? 0, icon: Users, color: "text-purple-600 bg-purple-50" },
          { label: "Total Tickets", value: stats?.tickets ?? 0, icon: Ticket, color: "text-amber-600 bg-amber-50" },
        ].map((s, i) => (
          <motion.div key={s.label} initial="hidden" animate="visible" variants={fadeUp} custom={i}>
            <Card>
              <CardContent className="p-5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                  <s.icon className="w-4 h-4" />
                </div>
                <p className="font-serif text-2xl font-bold text-charcoal">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg">Registered Companies</CardTitle>
        </CardHeader>
        <CardContent>
          {!companies || companies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No companies registered yet.</p>
              <Link href="/dashboard/admin"><Button size="sm" className="mt-3 bg-olive text-cream">Add Company</Button></Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {companies.map(c => (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-charcoal text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.tier} · {c.email ?? "No email"}</p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{c.tier}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyDashboard() {
  const { data: stats } = trpc.company.stats.useQuery();
  const { data: properties } = trpc.company.properties.useQuery();
  const { data: tickets } = trpc.tickets.list.useQuery({ propertyId: undefined });

  const openTickets = tickets?.filter(t => t.status === "open") ?? [];
  const urgentTickets = tickets?.filter(t => t.priority === "urgent" && t.status !== "closed") ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-charcoal">Company Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your portfolio at a glance.</p>
      </div>
      {urgentTickets.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">{urgentTickets.length} urgent ticket{urgentTickets.length > 1 ? "s" : ""} require immediate attention.</p>
          <Link href="/dashboard/tickets" className="ml-auto"><Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">View</Button></Link>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Properties", value: stats?.properties ?? 0, icon: Building2, color: "text-emerald-600 bg-emerald-50" },
          { label: "Open Tickets", value: stats?.openTickets ?? 0, icon: Ticket, color: "text-amber-600 bg-amber-50" },
          { label: "Vendors", value: stats?.vendors ?? 0, icon: Briefcase, color: "text-blue-600 bg-blue-50" },
        ].map((s, i) => (
          <motion.div key={s.label} initial="hidden" animate="visible" variants={fadeUp} custom={i}>
            <Card>
              <CardContent className="p-5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                  <s.icon className="w-4 h-4" />
                </div>
                <p className="font-serif text-2xl font-bold text-charcoal">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-lg">Properties</CardTitle>
            <Link href="/dashboard/properties"><Button size="sm" variant="ghost" className="text-olive">View All <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button></Link>
          </CardHeader>
          <CardContent>
            {!properties || properties.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Building2 className="w-7 h-7 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No properties yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {properties.slice(0, 5).map(p => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-charcoal">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.city ?? "—"} · {p.unitCount ?? 0} units</p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">{p.propertyType}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-lg">Recent Tickets</CardTitle>
            <Link href="/dashboard/tickets"><Button size="sm" variant="ghost" className="text-olive">View All <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button></Link>
          </CardHeader>
          <CardContent>
            {openTickets.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Ticket className="w-7 h-7 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No open tickets.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {openTickets.slice(0, 5).map(t => (
                  <div key={t.id} className="py-2.5 flex items-center justify-between">
                    <div className="min-w-0 mr-2">
                      <p className="text-sm font-medium text-charcoal truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{t.category?.replace(/_/g, " ")} · {t.status?.replace(/_/g, " ")}</p>
                    </div>
                    <Badge className={`text-xs flex-shrink-0 ${t.priority === "urgent" ? "bg-red-100 text-red-700" : t.priority === "high" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}>
                      {t.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const role = user?.portierRole ?? "user";

  // Residents and owners belong in the portal, not the manager dashboard
  useEffect(() => {
    if (user && (role === "resident" || role === "owner")) {
      navigate("/portal");
    }
  }, [user, role, navigate]);

  const renderContent = () => {
    if (role === "super_admin") return <SuperAdminDashboard />;
    return <CompanyDashboard />;
  };

  return (
    <DashboardLayout>
      {renderContent()}
    </DashboardLayout>
  );
}
