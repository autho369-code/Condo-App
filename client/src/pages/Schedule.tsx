import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarDays, Plus, Clock } from "lucide-react";
import { toast } from "sonner";

const EVENT_COLORS: Record<string, string> = {
  inspection: "bg-blue-100 text-blue-700",
  vendor_visit: "bg-purple-100 text-purple-700",
  maintenance: "bg-orange-100 text-orange-700",
  board_meeting: "bg-emerald-100 text-emerald-700",
  deadline: "bg-red-100 text-red-700",
  owner_meeting: "bg-amber-100 text-amber-700",
  other: "bg-gray-100 text-gray-600",
};

export default function Schedule() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", eventType: "other", startTime: "", endTime: "", isAllDay: false });

  const utils = trpc.useUtils();
  const { data: properties } = trpc.company.properties.useQuery();
  const [selectedProperty, setSelectedProperty] = useState<number | undefined>();
  const { data: events, isLoading } = trpc.schedule.list.useQuery({ propertyId: selectedProperty });

  const createEvent = trpc.schedule.create.useMutation({
    onSuccess: () => {
      toast.success("Event scheduled.");
      utils.schedule.list.invalidate();
      setOpen(false);
      setForm({ title: "", description: "", eventType: "other", startTime: "", endTime: "", isAllDay: false });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.title.trim()) return toast.error("Title is required.");
    if (!form.startTime) return toast.error("Start time is required.");
    const propertyId = selectedProperty ?? properties?.[0]?.id;
    if (!propertyId) return toast.error("No property available.");
    createEvent.mutate({
      ...form,
      propertyId,
      eventType: form.eventType as any,
      startTime: new Date(form.startTime),
      endTime: form.endTime ? new Date(form.endTime) : undefined,
    });
  };

  // Group events by date
  const grouped: Record<string, typeof events> = {};
  (events ?? []).forEach(e => {
    const d = new Date(e.startTime).toDateString();
    if (!grouped[d]) grouped[d] = [];
    grouped[d]!.push(e);
  });

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-charcoal">Schedule</h1>
          <p className="text-muted-foreground mt-1 text-sm">Inspections, meetings, vendor visits, and deadlines.</p>
        </div>
        <div className="flex gap-3">
          {properties && properties.length > 1 && (
            <Select value={selectedProperty ? String(selectedProperty) : "all"} onValueChange={v => setSelectedProperty(v === "all" ? undefined : Number(v))}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Properties" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-olive text-cream hover:bg-olive/90"><Plus className="w-4 h-4 mr-2" />New Event</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="font-serif">Schedule Event</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                {properties && properties.length > 1 && (
                  <div>
                    <Label>Property</Label>
                    <Select onValueChange={v => setSelectedProperty(Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                      <SelectContent>{properties.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Title *</Label>
                  <Input placeholder="e.g. Annual fire inspection" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <Label>Event Type</Label>
                  <Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(EVENT_COLORS).map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g," ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start *</Label>
                    <Input type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <Label>End</Label>
                    <Input type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea placeholder="Additional details..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
                </div>
                <Button className="w-full bg-olive text-cream" onClick={handleCreate} disabled={createEvent.isPending}>
                  {createEvent.isPending ? "Scheduling..." : "Schedule Event"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No events scheduled</p>
          <p className="text-sm mt-1">Add your first event to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, evts]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
              <div className="space-y-2">
                {(evts ?? []).map(e => (
                  <Card key={e.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-1 h-12 rounded-full bg-olive flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-charcoal text-sm">{e.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{new Date(e.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                          {e.endTime && <span className="text-xs text-muted-foreground">– {new Date(e.endTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
                        </div>
                      </div>
                      <Badge className={`text-xs flex-shrink-0 ${EVENT_COLORS[e.eventType ?? "other"]}`}>{(e.eventType ?? "other").replace(/_/g," ")}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
