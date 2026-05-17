import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Briefcase, Plus, Search, Phone, Mail, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["plumbing","electrical","hvac","landscaping","cleaning","security","elevator","general","other"] as const;
type VendorCategory = typeof CATEGORIES[number];

export default function Vendors() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "other" as VendorCategory, contactName: "", phone: "", email: "", notes: "" });

  const utils = trpc.useUtils();
  const { data: vendors, isLoading } = trpc.company.vendors.useQuery();

  const addVendor = trpc.company.addVendor.useMutation({
    onSuccess: () => {
      toast.success("Vendor added to directory.");
      utils.company.vendors.invalidate();
      setOpen(false);
      setForm({ name: "", category: "other", contactName: "", phone: "", email: "", notes: "" });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const filtered = (vendors ?? []).filter((v) => {
    const matchSearch = !search || v.name.toLowerCase().includes(search.toLowerCase()) || (v.contactName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || v.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">Vendor Directory</h1>
          <p className="text-muted-foreground mt-1 text-sm">{vendors?.length ?? 0} vendors registered.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-olive text-cream hover:bg-olive/90"><Plus className="w-4 h-4 mr-2" />Add Vendor</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-serif">Add Vendor</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Company Name *</Label><Input placeholder="e.g. Ace Plumbing LLC" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as VendorCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contact Name</Label><Input placeholder="John Smith" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} /></div>
                <div><Label>Phone</Label><Input placeholder="(555) 000-0000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div><Label>Email</Label><Input type="email" placeholder="vendor@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Notes</Label><Input placeholder="Preferred for emergency calls..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
              <Button className="w-full bg-olive text-cream" onClick={() => addVendor.mutate({ name: form.name, category: form.category, contactName: form.contactName || undefined, phone: form.phone || undefined, email: form.email || undefined, notes: form.notes || undefined })} disabled={addVendor.isPending}>
                {addVendor.isPending ? "Adding..." : "Add Vendor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g," ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">{[1,2,3,4].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No vendors found</p>
          <p className="text-sm mt-1">Add your first vendor to the directory.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((v) => (
            <Card key={v.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-charcoal">{v.name}</p>
                    {v.contactName && <p className="text-xs text-muted-foreground mt-0.5">{v.contactName}</p>}
                  </div>
                  <Badge variant="outline" className="text-xs capitalize flex-shrink-0">{(v.category ?? "other").replace(/_/g," ")}</Badge>
                </div>
                <div className="flex flex-col gap-1.5">
                  {v.phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="w-3 h-3" />{v.phone}</div>}
                  {v.email && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="w-3 h-3" />{v.email}</div>}
                  {v.notes && <p className="text-xs text-muted-foreground italic mt-1">{v.notes}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
