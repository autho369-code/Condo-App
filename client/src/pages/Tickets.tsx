import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Ticket, Plus, Search, Filter } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  pending_vendor: "bg-orange-100 text-orange-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function Tickets() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", unitNumber: "" });

  const utils = trpc.useUtils();
  const { data: properties } = trpc.company.properties.useQuery();
  const [selectedProperty, setSelectedProperty] = useState<number | undefined>();
  const { data: tickets, isLoading } = trpc.tickets.list.useQuery({ propertyId: selectedProperty });

  const createTicket = trpc.tickets.create.useMutation({
    onSuccess: () => {
      toast.success("Ticket created — AI is classifying it now.");
      utils.tickets.list.invalidate();
      setOpen(false);
      setForm({ title: "", description: "", priority: "medium", unitNumber: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.tickets.updateStatus.useMutation({
    onSuccess: () => { utils.tickets.list.invalidate(); toast.success("Status updated."); },
  });

  const filtered = (tickets ?? []).filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = () => {
    if (!form.title.trim()) return toast.error("Title is required.");
    if (!selectedProperty && properties && properties.length > 0) {
      toast.error("Please select a property.");
      return;
    }
    const propertyId = selectedProperty ?? properties?.[0]?.id;
    if (!propertyId) return toast.error("No property available.");
    createTicket.mutate({ ...form, propertyId, priority: form.priority as any });
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">Work Tickets</h1>
          <p className="text-muted-foreground mt-1 text-sm">AI-classified tickets from all sources.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-olive text-cream hover:bg-olive/90"><Plus className="w-4 h-4 mr-2" />New Ticket</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-serif">Create Work Ticket</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              {properties && properties.length > 1 && (
                <div>
                  <Label>Property</Label>
                  <Select onValueChange={v => setSelectedProperty(Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Title *</Label>
                <Input placeholder="e.g. Lobby elevator not working" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea placeholder="Describe the issue..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["low","medium","high","urgent"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unit # (optional)</Label>
                  <Input placeholder="e.g. 4B" value={form.unitNumber} onChange={e => setForm(f => ({ ...f, unitNumber: e.target.value }))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">AI will automatically classify the category based on the title and description.</p>
              <Button className="w-full bg-olive text-cream" onClick={handleCreate} disabled={createTicket.isPending}>
                {createTicket.isPending ? "Creating..." : "Create Ticket"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {["open","in_progress","pending_vendor","resolved","closed"].map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g," ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {properties && properties.length > 1 && (
          <Select value={selectedProperty ? String(selectedProperty) : "all"} onValueChange={v => setSelectedProperty(v === "all" ? undefined : Number(v))}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Properties" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Ticket List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Ticket className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tickets found</p>
          <p className="text-sm mt-1">Create your first ticket to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <Card key={t.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-charcoal text-sm">{t.title}</span>
                      {t.unitNumber && <Badge variant="outline" className="text-xs">Unit {t.unitNumber}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs ${STATUS_COLORS[t.status ?? "open"]}`}>{(t.status ?? "open").replace(/_/g," ")}</Badge>
                      <Badge className={`text-xs ${PRIORITY_COLORS[t.priority ?? "medium"]}`}>{t.priority}</Badge>
                      {t.category && <Badge variant="outline" className="text-xs capitalize">{t.category.replace(/_/g," ")}</Badge>}
                      <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{t.description}</p>}
                  </div>
                  <Select value={t.status ?? "open"} onValueChange={v => updateStatus.mutate({ ticketId: t.id, status: v as any })}>
                    <SelectTrigger className="w-36 h-8 text-xs flex-shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["open","in_progress","pending_vendor","resolved","closed"].map(s => (
                        <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace(/_/g," ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
