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
import { Building2, Plus, MapPin, Home } from "lucide-react";
import { toast } from "sonner";

export default function Properties() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", city: "", state: "", zip: "", unitCount: "", propertyType: "condominium" });

  const utils = trpc.useUtils();
  const { data: properties, isLoading } = trpc.company.properties.useQuery();

  const createProperty = trpc.company.addProperty.useMutation({
    onSuccess: () => {
      toast.success("Property added.");
      utils.company.properties.invalidate();
      setOpen(false);
      setForm({ name: "", address: "", city: "", state: "", zip: "", unitCount: "", propertyType: "condominium" });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">Properties</h1>
          <p className="text-muted-foreground mt-1 text-sm">{properties?.length ?? 0} properties in your portfolio.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-olive text-cream hover:bg-olive/90"><Plus className="w-4 h-4 mr-2" />Add Property</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-serif">Add Condominium Property</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Property Name *</Label><Input placeholder="e.g. The Meridian at Brickell" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <Label>Property Type</Label>
                <Select value={form.propertyType} onValueChange={v => setForm(f => ({ ...f, propertyType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="condominium">Condominium</SelectItem>
                    <SelectItem value="hoa">HOA Community</SelectItem>
                    <SelectItem value="coop">Co-op</SelectItem>
                    
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Street Address</Label><Input placeholder="123 Ocean Drive" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1"><Label>City</Label><Input placeholder="Miami" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
                <div><Label>State</Label><Input placeholder="FL" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></div>
                <div><Label>ZIP</Label><Input placeholder="33131" value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
              </div>
              <div><Label>Number of Units</Label><Input type="number" placeholder="120" value={form.unitCount} onChange={e => setForm(f => ({ ...f, unitCount: e.target.value }))} /></div>
              <Button className="w-full bg-olive text-cream" onClick={() => createProperty.mutate({ ...form, unitCount: form.unitCount ? Number(form.unitCount) : undefined, propertyType: form.propertyType as "condominium" | "hoa" | "coop" | undefined })} disabled={createProperty.isPending}>
                {createProperty.isPending ? "Adding..." : "Add Property"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : !properties || properties.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No properties yet</p>
          <p className="text-sm mt-1">Add your first condominium property to get started.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-olive/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-olive" />
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{(p.propertyType ?? "condominium").replace(/_/g," ")}</Badge>
                </div>
                <h3 className="font-serif font-semibold text-charcoal mb-1">{p.name}</h3>
                {(p.address || p.city) && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{[p.address, p.city, p.state].filter(Boolean).join(", ")}</span>
                  </div>
                )}
                {p.unitCount && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Home className="w-3 h-3" />{p.unitCount} units
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
