import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Plus, Building2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

export default function AdminPanel() {
  const { user } = useAuth();
  const role = user?.portierRole;

  if (role !== "super_admin") {
    return (
      <DashboardLayout>
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Access Denied</p>
          <p className="text-sm mt-1">This area is restricted to Super Admins only.</p>
          <Link href="/dashboard"><Button size="sm" className="mt-4 bg-olive text-cream">Back to Dashboard</Button></Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-red-600" />
          <Badge className="bg-red-100 text-red-700 border-red-200">Super Admin</Badge>
        </div>
        <h1 className="font-serif text-3xl font-bold text-charcoal">Admin Panel</h1>
        <p className="text-muted-foreground mt-1 text-sm">Platform-wide management across all companies and users.</p>
      </div>
      <Tabs defaultValue="companies">
        <TabsList className="mb-6">
          <TabsTrigger value="companies"><Building2 className="w-3.5 h-3.5 mr-1.5" />Companies</TabsTrigger>
          <TabsTrigger value="users"><Users className="w-3.5 h-3.5 mr-1.5" />Users</TabsTrigger>
        </TabsList>
        <TabsContent value="companies"><CompaniesTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

function CompaniesTab() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", email: "", phone: "", tier: "starter", address: "" });
  const utils = trpc.useUtils();
  const { data: companies, isLoading } = trpc.admin.allCompanies.useQuery();

  const createCompany = trpc.admin.createCompany.useMutation({
    onSuccess: () => {
      toast.success("Company created.");
      utils.admin.allCompanies.invalidate();
      setOpen(false);
      setForm({ name: "", slug: "", email: "", phone: "", tier: "starter", address: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{companies?.length ?? 0} companies registered</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-olive text-cream hover:bg-olive/90"><Plus className="w-3.5 h-3.5 mr-1.5" />Add Company</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-serif">Register Company</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Company Name *</Label><Input placeholder="Acme Property Management" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" placeholder="admin@acme.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Phone</Label><Input placeholder="(555) 000-0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div>
                <Label>Subscription Tier</Label>
                <Select value={form.tier} onValueChange={v => setForm(f => ({ ...f, tier: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["starter","growth","professional","enterprise"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Address</Label><Input placeholder="123 Main St, Miami FL" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <Button className="w-full bg-olive text-cream" onClick={() => createCompany.mutate({ ...form, slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'), tier: form.tier as any })} disabled={createCompany.isPending}>
                {createCompany.isPending ? "Creating..." : "Create Company"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : !companies || companies.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No companies yet. Add the first one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {companies.map(c => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-charcoal text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.email ?? "No email"} · {c.phone ?? "No phone"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">{c.tier}</Badge>
                  <Badge variant="outline" className={`text-xs ${c.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.admin.allUsers.useQuery();

  const updateRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => { toast.success("Role updated."); utils.admin.allUsers.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const ROLE_COLORS: Record<string, string> = {
    super_admin: "bg-red-100 text-red-700",
    company_admin: "bg-purple-100 text-purple-700",
    portfolio_manager: "bg-blue-100 text-blue-700",
    property_manager: "bg-emerald-100 text-emerald-700",
    accountant: "bg-amber-100 text-amber-700",
    assistant_manager: "bg-orange-100 text-orange-700",
    owner: "bg-cyan-100 text-cyan-700",
    vendor: "bg-gray-100 text-gray-600",
    resident: "bg-gray-100 text-gray-600",
    user: "bg-gray-100 text-gray-600",
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">{users?.length ?? 0} registered users</p>
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : !users || users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No users yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <Card key={u.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-charcoal text-sm truncate">{u.name ?? u.email ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email ?? u.openId}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={`text-xs ${ROLE_COLORS[u.portierRole ?? "user"]}`}>{(u.portierRole ?? "user").replace(/_/g," ")}</Badge>
                  <Select value={u.portierRole ?? "user"} onValueChange={v => updateRole.mutate({ userId: u.id, portierRole: v as any })}>
                    <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["super_admin","company_admin","portfolio_manager","property_manager","accountant","assistant_manager","owner","vendor","resident","user"].map(r => (
                        <SelectItem key={r} value={r} className="text-xs capitalize">{r.replace(/_/g," ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
